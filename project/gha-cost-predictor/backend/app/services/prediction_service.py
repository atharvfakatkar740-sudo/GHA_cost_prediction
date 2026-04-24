import logging
import math
from typing import List, Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.engine import PredictionEngine
from app.services.pricing_service import pricing_service
from app.services.workflow_parser import (
    parse_workflow, get_jobs, get_job_runner, get_job_steps,
    get_workflow_name, extract_workflow_features,
)
from app.services.github_service import github_service
from app.models.database import Prediction
from app.models.schemas import (
    PredictionResponse,
    JobPrediction,
    WorkflowPredictionRequest,
)
from config import settings

logger = logging.getLogger(__name__)


def _detect_runner_os(os_label: str) -> str:
    """Map an os_label string to a normalised OS name."""
    val = os_label.lower()
    if "ubuntu" in val or "linux" in val:
        return "linux"
    if "windows" in val:
        return "windows"
    if "macos" in val or "mac" in val:
        return "macos"
    return "linux"


class PredictionService:
    """
    Orchestrates the full prediction pipeline:
    1. Parse workflow YAML
    2. Extract 21 features via extract_workflow_features()
    3. Run ML prediction for duration
    4. Compute cost using pricing formula
    5. Persist results and optionally post to PR
    """

    def __init__(self, engine: PredictionEngine):
        self.engine = engine

    async def predict_from_yaml(
        self,
        request: WorkflowPredictionRequest,
        session: AsyncSession,
        post_to_pr: bool = False,
        user_id: Optional[int] = None,
    ) -> PredictionResponse:
        """Run full prediction pipeline from raw YAML."""
        yaml_content = request.workflow_yaml

        # Parse workflow for metadata
        workflow = parse_workflow(yaml_content)
        workflow_name = get_workflow_name(workflow) if workflow else "Unknown"

        # Fetch lightweight repo metadata for better code_complexity signal
        repo_meta = {}
        if request.repo_owner and request.repo_name:
            try:
                repo_meta = await github_service.get_repo_metadata(
                    request.repo_owner, request.repo_name
                )
            except Exception:
                pass

        # Extract the feature dict used by the ML model
        feature_dict = extract_workflow_features(
            yaml_content,
            repo_name=request.repo_name,
            head_sha=request.commit_sha,
            primary_language=repo_meta.get("primary_language"),
            repo_size_kb=repo_meta.get("repo_size_kb", 0),
        )

        # Get ML prediction for overall duration
        result = self.engine.predict_duration(feature_dict)
        total_predicted_minutes = result["predicted_minutes"]
        model_used = result["model_used"]
        confidence = result["confidence"]

        # ── Per-job cost breakdown ─────────────────────────────────
        jobs_dict = get_jobs(workflow) if workflow else {}
        job_predictions: List[JobPrediction] = []
        total_cost = 0.0

        job_infos = []
        for job_name, job_def in jobs_dict.items():
            if not isinstance(job_def, dict):
                continue
            runner_label = get_job_runner(job_def)
            runner_os = _detect_runner_os(runner_label)
            steps = get_job_steps(job_def)
            strategy = job_def.get("strategy", {})
            has_matrix = isinstance(strategy, dict) and "matrix" in strategy
            matrix_perms = feature_dict.get("matrix_permutations", 0) if has_matrix else 0
            job_infos.append({
                "job_name": job_name,
                "runner_label": runner_label,
                "runner_os": runner_os,
                "step_count": len(steps),
                "has_matrix": has_matrix,
                "matrix_permutations": matrix_perms,
            })

        if job_infos:
            total_step_weight = sum(max(j["step_count"], 1) for j in job_infos)

            for ji in job_infos:
                weight = max(ji["step_count"], 1) / total_step_weight
                job_duration = round(total_predicted_minutes * weight, 2)
                billable_minutes = math.ceil(job_duration)

                per_min_cost = await pricing_service.get_per_minute_cost(
                    ji["runner_label"], ji["runner_os"]
                )
                job_cost = round(billable_minutes * per_min_cost, 6)
                total_cost += job_cost

                matrix_mult = max(ji.get("matrix_permutations", 0), 1)
                if ji["has_matrix"] and matrix_mult > 1:
                    job_cost *= matrix_mult
                    job_duration *= matrix_mult
                    total_cost += job_cost * (matrix_mult - 1)

                job_predictions.append(JobPrediction(
                    job_name=ji["job_name"],
                    runner_type=ji["runner_label"],
                    runner_os=ji["runner_os"],
                    predicted_duration_minutes=round(job_duration, 2),
                    estimated_cost_usd=round(job_cost, 6),
                    step_count=ji["step_count"],
                ))
        else:
            per_min_cost = await pricing_service.get_per_minute_cost(
                "ubuntu-latest", "linux"
            )
            billable = math.ceil(total_predicted_minutes)
            total_cost = round(billable * per_min_cost, 6)
            job_predictions.append(JobPrediction(
                job_name="default",
                runner_type="ubuntu-latest",
                runner_os="linux",
                predicted_duration_minutes=total_predicted_minutes,
                estimated_cost_usd=total_cost,
                step_count=feature_dict.get("total_steps", 0),
            ))

        total_cost = round(total_cost, 6)
        dominant_runner = job_predictions[0].runner_type if job_predictions else "ubuntu-latest"
        dominant_os = job_predictions[0].runner_os if job_predictions else "linux"
        num_jobs = feature_dict.get("job_count", len(job_infos))
        total_steps = feature_dict.get("total_steps", 0)

        cost_breakdown = {
            "billing_model": "per_minute",
            "rounding": "ceil_to_nearest_minute",
            "pricing_source": "github_docs",
            "pricing_last_updated": (
                pricing_service.last_updated.isoformat()
                if pricing_service.last_updated
                else None
            ),
        }

        # ── Persist to database ────────────────────────────────────
        db_record = Prediction(
            user_id=user_id,
            repo_owner=request.repo_owner or "",
            repo_name=request.repo_name or "",
            pr_number=request.pr_number,
            workflow_file=request.workflow_file,
            workflow_content=yaml_content[:5000],
            predicted_duration_minutes=total_predicted_minutes,
            estimated_cost_usd=total_cost,
            runner_type=dominant_runner,
            runner_os=dominant_os,
            num_jobs=num_jobs,
            total_steps=total_steps,
            features_json=feature_dict,
            model_used=model_used,
            confidence_score=confidence,
            status="completed",
            trigger_type=request.trigger_type or "manual",
            commit_sha=request.commit_sha,
            branch=request.branch,
        )
        session.add(db_record)
        await session.flush()

        # ── Post PR comment if applicable ──────────────────────────
        comment_id = None
        if (
            post_to_pr
            and request.repo_owner
            and request.repo_name
            and request.pr_number
        ):
            comment_body = github_service.format_prediction_comment(
                workflow_name=workflow_name,
                total_duration=total_predicted_minutes,
                total_cost=total_cost,
                jobs=[jp.model_dump() for jp in job_predictions],
                model_used=model_used,
                confidence=confidence,
                trigger_type=request.trigger_type or "pull_request",
                commit_sha=request.commit_sha or "",
                branch=request.branch or "",
            )
            comment_id = await github_service.post_pr_comment(
                request.repo_owner,
                request.repo_name,
                request.pr_number,
                comment_body,
            )
            if comment_id:
                db_record.github_comment_id = comment_id

        await session.commit()

        return PredictionResponse(
            id=db_record.id,
            repo_owner=request.repo_owner,
            repo_name=request.repo_name,
            pr_number=request.pr_number,
            workflow_file=request.workflow_file,
            total_predicted_duration_minutes=total_predicted_minutes,
            total_estimated_cost_usd=total_cost,
            jobs=job_predictions,
            model_used=model_used,
            confidence_score=confidence,
            runner_type=dominant_runner,
            runner_os=dominant_os,
            num_jobs=num_jobs,
            total_steps=total_steps,
            created_at=db_record.created_at,
            status="completed",
            trigger_type=request.trigger_type or "manual",
            commit_sha=request.commit_sha,
            branch=request.branch,
            cost_breakdown=cost_breakdown,
        )

    async def predict_repo_workflows(
        self,
        owner: str,
        repo: str,
        branch: str,
        pr_number: Optional[int],
        session: AsyncSession,
        post_to_pr: bool = False,
    ) -> List[PredictionResponse]:
        """Fetch and predict all workflows in a repo."""
        workflow_files = await github_service.get_workflow_files(owner, repo, branch)

        if not workflow_files:
            logger.warning(f"No workflow files found in {owner}/{repo}@{branch}")
            return []

        predictions = []
        for wf in workflow_files:
            content = await github_service.get_file_content(
                owner, repo, wf["path"], ref=branch
            )
            if not content:
                continue

            request = WorkflowPredictionRequest(
                workflow_yaml=content,
                repo_owner=owner,
                repo_name=repo,
                pr_number=pr_number,
                workflow_file=wf["name"],
            )
            pred = await self.predict_from_yaml(request, session, post_to_pr)
            predictions.append(pred)

        return predictions
