import hmac
import hashlib
import logging
from typing import List, Set

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_session
from app.models.schemas import WorkflowPredictionRequest
from app.services.prediction_service import PredictionService
from app.services.github_service import github_service
from app.ml.engine import PredictionEngine
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

_engine = PredictionEngine(model_path=settings.MODEL_PATH)
_service = PredictionService(engine=_engine)

WORKFLOW_DIR = ".github/workflows/"


def verify_signature(payload_body: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature (HMAC SHA-256)."""
    if not secret:
        return True  # Skip verification if no secret configured
    expected = "sha256=" + hmac.new(
        secret.encode(), payload_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _extract_workflow_paths_from_commits(commits: list) -> Set[str]:
    """
    Scan all commits in a push payload and collect unique workflow file paths
    that were added or modified (not removed).
    """
    paths: Set[str] = set()
    for commit in commits:
        for f in commit.get("added", []):
            if f.startswith(WORKFLOW_DIR) and f.endswith((".yml", ".yaml")):
                paths.add(f)
        for f in commit.get("modified", []):
            if f.startswith(WORKFLOW_DIR) and f.endswith((".yml", ".yaml")):
                paths.add(f)
    return paths


# ─── Main Webhook Endpoint ──────────────────────────────────────────

@router.post("/github")
async def github_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """
    Handle GitHub webhook events.

    Supported events:
      - **push**          — Detects workflow file changes in commits and runs
                            predictions automatically. Posts a commit comment
                            and also comments on any open PRs for the branch.
      - **pull_request**  — Runs predictions when a PR is opened / updated.
      - **workflow_run**  — Reacts when a workflow run is requested (optional).
      - **ping**          — Responds to GitHub's connectivity check.
    """
    # Verify signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    body = await request.body()

    if settings.GITHUB_WEBHOOK_SECRET and not verify_signature(
        body, signature, settings.GITHUB_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = request.headers.get("X-GitHub-Event", "")
    payload = await request.json()

    if event == "push":
        return await _handle_push(payload, session)
    elif event == "pull_request":
        return await _handle_pull_request(payload, session)
    elif event == "workflow_run":
        return await _handle_workflow_run(payload, session)
    elif event == "ping":
        return {"status": "pong"}
    else:
        return {"status": "ignored", "event": event}


# ─── Push Handler ────────────────────────────────────────────────────

async def _handle_push(payload: dict, session: AsyncSession):
    """
    Handle push webhook events.

    Workflow:
      1. Inspect added/modified files across all commits in the push.
      2. If any file lives under .github/workflows/, fetch its latest
         content from the head commit and run the prediction pipeline.
      3. Post a commit comment on the head commit with the results.
      4. If an open PR exists for this branch, also post the prediction
         there so the team sees it in the PR timeline.
    """
    repo = payload.get("repository", {})
    owner = repo.get("owner", {}).get("login", "") or repo.get("owner", {}).get("name", "")
    repo_name = repo.get("name", "")
    ref = payload.get("ref", "")                # e.g. "refs/heads/main"
    head_sha = payload.get("after", "")
    commits = payload.get("commits", [])

    # Extract branch name from ref (refs/heads/<branch>)
    branch = ref.replace("refs/heads/", "") if ref.startswith("refs/heads/") else ref

    if not all([owner, repo_name, head_sha]):
        return {"status": "error", "detail": "Missing repo or commit info in push payload"}

    # Ignore tag pushes
    if ref.startswith("refs/tags/"):
        return {"status": "skipped", "reason": "tag_push"}

    # Ignore branch deletions (after == 0000...)
    if head_sha == "0000000000000000000000000000000000000000":
        return {"status": "skipped", "reason": "branch_deleted"}

    # Collect workflow file paths that were added or modified
    changed_workflows = _extract_workflow_paths_from_commits(commits)

    if not changed_workflows:
        return {
            "status": "skipped",
            "reason": "no_workflow_files_changed",
            "branch": branch,
            "commit": head_sha[:7],
        }

    logger.info(
        f"Push on {owner}/{repo_name}@{branch} ({head_sha[:7]}) "
        f"changed {len(changed_workflows)} workflow file(s): "
        f"{', '.join(p.split('/')[-1] for p in changed_workflows)}"
    )

    # Run predictions for each changed workflow
    predictions = []
    for wf_path in changed_workflows:
        content = await github_service.get_file_content(
            owner, repo_name, wf_path, ref=head_sha
        )
        if not content:
            logger.warning(f"Could not fetch {wf_path}@{head_sha[:7]}, skipping")
            continue

        req = WorkflowPredictionRequest(
            workflow_yaml=content,
            repo_owner=owner,
            repo_name=repo_name,
            workflow_file=wf_path.split("/")[-1],
            trigger_type="push",
            commit_sha=head_sha,
            branch=branch,
        )
        pred = await _service.predict_from_yaml(req, session, post_to_pr=False)
        predictions.append(pred)

    if not predictions:
        return {"status": "skipped", "reason": "no_fetchable_workflows"}

    # ── Post commit comment ──────────────────────────────────────
    for pred in predictions:
        comment_body = github_service.format_prediction_comment(
            workflow_name=pred.workflow_file or "Workflow",
            total_duration=pred.total_predicted_duration_minutes,
            total_cost=pred.total_estimated_cost_usd,
            jobs=[j.model_dump() for j in pred.jobs],
            model_used=pred.model_used,
            confidence=pred.confidence_score or 0.0,
            trigger_type="push",
            commit_sha=head_sha,
            branch=branch,
        )
        await github_service.post_commit_comment(
            owner, repo_name, head_sha, comment_body
        )

    # ── Also post to any open PRs for this branch ────────────────
    open_prs = await github_service.find_open_prs_for_branch(
        owner, repo_name, branch
    )
    for pr_info in open_prs:
        pr_num = pr_info["number"]
        for pred in predictions:
            comment_body = github_service.format_prediction_comment(
                workflow_name=pred.workflow_file or "Workflow",
                total_duration=pred.total_predicted_duration_minutes,
                total_cost=pred.total_estimated_cost_usd,
                jobs=[j.model_dump() for j in pred.jobs],
                model_used=pred.model_used,
                confidence=pred.confidence_score or 0.0,
                trigger_type="push",
                commit_sha=head_sha,
                branch=branch,
            )
            await github_service.post_pr_comment(
                owner, repo_name, pr_num, comment_body
            )
        logger.info(f"Also posted prediction to PR #{pr_num}")

    return {
        "status": "predicted",
        "trigger": "push",
        "branch": branch,
        "commit": head_sha[:7],
        "workflows_analyzed": len(predictions),
        "prs_notified": len(open_prs),
    }


# ─── Pull Request Handler ───────────────────────────────────────────

async def _handle_pull_request(payload: dict, session: AsyncSession):
    """Handle pull_request webhook events."""
    action = payload.get("action", "")

    # Only trigger on opened/synchronize (new commits pushed) / reopened
    if action not in ("opened", "synchronize", "reopened"):
        return {"status": "skipped", "action": action}

    pr = payload.get("pull_request", {})
    repo = payload.get("repository", {})

    pr_number = pr.get("number")
    owner = repo.get("owner", {}).get("login", "")
    repo_name = repo.get("name", "")
    head_branch = pr.get("head", {}).get("ref", "main")
    head_sha = pr.get("head", {}).get("sha", "")

    if not all([pr_number, owner, repo_name]):
        return {"status": "error", "detail": "Missing PR or repo info"}

    logger.info(
        f"PR #{pr_number} ({action}) on {owner}/{repo_name} "
        f"(branch: {head_branch}, sha: {head_sha[:7] if head_sha else '?'})"
    )

    # Check if workflow files were changed in this PR
    changed_files = await github_service.get_pr_changed_files(
        owner, repo_name, pr_number
    )

    workflow_changes = [
        f for f in changed_files if f.startswith(WORKFLOW_DIR)
    ]

    try:
        if workflow_changes:
            # Predict only changed workflows
            predictions = []
            for wf_path in workflow_changes:
                content = await github_service.get_file_content(
                    owner, repo_name, wf_path, ref=head_branch
                )
                if not content:
                    continue

                req = WorkflowPredictionRequest(
                    workflow_yaml=content,
                    repo_owner=owner,
                    repo_name=repo_name,
                    pr_number=pr_number,
                    workflow_file=wf_path.split("/")[-1],
                    trigger_type="pull_request",
                    commit_sha=head_sha,
                    branch=head_branch,
                )
                pred = await _service.predict_from_yaml(
                    req, session, post_to_pr=True
                )
                predictions.append(pred)

            return {
                "status": "predicted",
                "trigger": "pull_request",
                "workflows_analyzed": len(predictions),
                "detail": "workflow_file_changed",
            }
        else:
            # Predict all workflows in the repo
            predictions = await _service.predict_repo_workflows(
                owner=owner,
                repo=repo_name,
                branch=head_branch,
                pr_number=pr_number,
                session=session,
                post_to_pr=True,
            )
            return {
                "status": "predicted",
                "trigger": "pull_request",
                "workflows_analyzed": len(predictions),
                "detail": "all_workflows",
            }
    except Exception as e:
        logger.error(f"PR webhook prediction failed: {e}")
        return {"status": "error", "detail": str(e)}


# ─── Workflow Run Handler ────────────────────────────────────────────

async def _handle_workflow_run(payload: dict, session: AsyncSession):
    """
    Handle workflow_run webhook events.

    Triggered when a workflow run is requested, completed, etc.
    We react to 'requested' to predict cost before execution starts.
    """
    action = payload.get("action", "")

    if action != "requested":
        return {"status": "skipped", "event": "workflow_run", "action": action}

    workflow_run = payload.get("workflow_run", {})
    repo = payload.get("repository", {})
    workflow = payload.get("workflow", {})

    owner = repo.get("owner", {}).get("login", "")
    repo_name = repo.get("name", "")
    branch = workflow_run.get("head_branch", "main")
    head_sha = workflow_run.get("head_sha", "")
    workflow_path = workflow.get("path", "")  # e.g. ".github/workflows/ci.yml"

    if not all([owner, repo_name, workflow_path]):
        return {"status": "error", "detail": "Missing workflow_run info"}

    logger.info(
        f"workflow_run requested: {workflow_path} on {owner}/{repo_name}@{branch}"
    )

    content = await github_service.get_file_content(
        owner, repo_name, workflow_path, ref=head_sha or branch
    )
    if not content:
        return {"status": "error", "detail": f"Could not fetch {workflow_path}"}

    # Check for associated PRs
    pr_number = None
    prs = workflow_run.get("pull_requests", [])
    if prs:
        pr_number = prs[0].get("number")

    req = WorkflowPredictionRequest(
        workflow_yaml=content,
        repo_owner=owner,
        repo_name=repo_name,
        pr_number=pr_number,
        workflow_file=workflow_path.split("/")[-1],
        trigger_type="workflow_run",
        commit_sha=head_sha,
        branch=branch,
    )
    pred = await _service.predict_from_yaml(
        req, session, post_to_pr=(pr_number is not None)
    )

    # If no PR, post a commit comment instead
    if not pr_number and head_sha:
        comment_body = github_service.format_prediction_comment(
            workflow_name=pred.workflow_file or "Workflow",
            total_duration=pred.total_predicted_duration_minutes,
            total_cost=pred.total_estimated_cost_usd,
            jobs=[j.model_dump() for j in pred.jobs],
            model_used=pred.model_used,
            confidence=pred.confidence_score or 0.0,
            trigger_type="workflow_run",
            commit_sha=head_sha,
            branch=branch,
        )
        await github_service.post_commit_comment(
            owner, repo_name, head_sha, comment_body
        )

    return {
        "status": "predicted",
        "trigger": "workflow_run",
        "workflow": workflow_path,
        "branch": branch,
        "commit": head_sha[:7] if head_sha else "",
        "pr_number": pr_number,
    }
