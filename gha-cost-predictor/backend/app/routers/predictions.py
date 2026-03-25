from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional

from app.models.database import get_session, Prediction, User
from app.models.schemas import (
    WorkflowPredictionRequest,
    RepoPredictionRequest,
    PredictionResponse,
    PredictionHistoryItem,
    PredictionHistoryResponse,
)
from app.services.prediction_service import PredictionService
from app.ml.engine import PredictionEngine
from app.dependencies import get_optional_user, get_current_user
from config import settings

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

# Initialize engine and service
_engine = PredictionEngine(model_path=settings.MODEL_PATH)
_service = PredictionService(engine=_engine)


@router.post("/predict", response_model=PredictionResponse)
async def predict_workflow(
    request: WorkflowPredictionRequest,
    post_to_pr: bool = Query(False, description="Post result as PR comment"),
    session: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_optional_user),
):
    """
    Predict the duration and cost of a GitHub Actions workflow from raw YAML.
    Optionally posts a beautifully formatted comment on the pull request.
    If authenticated, the prediction is linked to the user's account.
    """
    try:
        result = await _service.predict_from_yaml(
            request, session, post_to_pr, user_id=user.id if user else None
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/predict-repo", response_model=list[PredictionResponse])
async def predict_repo_workflows(
    request: RepoPredictionRequest,
    post_to_pr: bool = Query(False, description="Post results as PR comments"),
    session: AsyncSession = Depends(get_session),
):
    """
    Fetch all workflow files from a GitHub repo and predict costs for each.
    """
    try:
        results = await _service.predict_repo_workflows(
            owner=request.repo_owner,
            repo=request.repo_name,
            branch=request.branch or "main",
            pr_number=request.pr_number,
            session=session,
            post_to_pr=post_to_pr,
        )
        if not results:
            raise HTTPException(
                status_code=404,
                detail="No workflow files found in the repository",
            )
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/me", response_model=PredictionHistoryResponse)
async def get_my_predictions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get predictions for the currently authenticated user."""
    query = (
        select(Prediction)
        .where(Prediction.user_id == user.id)
        .order_by(desc(Prediction.created_at))
    )
    count_query = (
        select(func.count(Prediction.id))
        .where(Prediction.user_id == user.id)
    )

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(query.offset(offset).limit(page_size))
    records = result.scalars().all()

    items = [
        PredictionHistoryItem(
            id=r.id, repo_owner=r.repo_owner, repo_name=r.repo_name,
            pr_number=r.pr_number, workflow_file=r.workflow_file,
            predicted_duration_minutes=r.predicted_duration_minutes,
            estimated_cost_usd=r.estimated_cost_usd, runner_type=r.runner_type,
            num_jobs=r.num_jobs, total_steps=r.total_steps,
            model_used=r.model_used, status=r.status,
            trigger_type=r.trigger_type, commit_sha=r.commit_sha,
            branch=r.branch, created_at=r.created_at,
        )
        for r in records
    ]
    return PredictionHistoryResponse(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/history", response_model=PredictionHistoryResponse)
async def get_prediction_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    repo_owner: Optional[str] = None,
    repo_name: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve paginated prediction history with optional filters."""
    query = select(Prediction).order_by(desc(Prediction.created_at))
    count_query = select(func.count(Prediction.id))

    if repo_owner:
        query = query.where(Prediction.repo_owner == repo_owner)
        count_query = count_query.where(Prediction.repo_owner == repo_owner)
    if repo_name:
        query = query.where(Prediction.repo_name == repo_name)
        count_query = count_query.where(Prediction.repo_name == repo_name)

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await session.execute(query)
    records = result.scalars().all()

    items = [
        PredictionHistoryItem(
            id=r.id,
            repo_owner=r.repo_owner,
            repo_name=r.repo_name,
            pr_number=r.pr_number,
            workflow_file=r.workflow_file,
            predicted_duration_minutes=r.predicted_duration_minutes,
            estimated_cost_usd=r.estimated_cost_usd,
            runner_type=r.runner_type,
            num_jobs=r.num_jobs,
            total_steps=r.total_steps,
            model_used=r.model_used,
            status=r.status,
            trigger_type=r.trigger_type,
            commit_sha=r.commit_sha,
            branch=r.branch,
            created_at=r.created_at,
        )
        for r in records
    ]

    return PredictionHistoryResponse(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/{prediction_id}", response_model=PredictionHistoryItem)
async def get_prediction(
    prediction_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve a single prediction by ID."""
    result = await session.execute(
        select(Prediction).where(Prediction.id == prediction_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Prediction not found")

    return PredictionHistoryItem(
        id=record.id,
        repo_owner=record.repo_owner,
        repo_name=record.repo_name,
        pr_number=record.pr_number,
        workflow_file=record.workflow_file,
        predicted_duration_minutes=record.predicted_duration_minutes,
        estimated_cost_usd=record.estimated_cost_usd,
        runner_type=record.runner_type,
        num_jobs=record.num_jobs,
        total_steps=record.total_steps,
        model_used=record.model_used,
        status=record.status,
        trigger_type=record.trigger_type,
        commit_sha=record.commit_sha,
        branch=record.branch,
        created_at=record.created_at,
    )


@router.get("/model/info")
async def get_model_info():
    """Get information about the currently loaded ML model."""
    return _engine.info


@router.post("/model/reload")
async def reload_model(model_path: Optional[str] = None):
    """Hot-reload the ML model (optionally from a new path)."""
    _engine.reload_model(model_path)
    return {"status": "reloaded", **_engine.info}
