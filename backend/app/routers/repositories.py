import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_session, TrackedRepository, Prediction, User
from app.models.schemas import (
    TrackRepoRequest,
    TrackedRepoItem,
    TrackedRepoResponse,
    WebhookSetupInfo,
    RepoStatsResponse,
    WorkflowCostItem,
    DailyCostItem,
    PredictionHistoryItem,
)
from app.dependencies import get_current_user
from config import settings

router = APIRouter(prefix="/api/repositories", tags=["repositories"])

WEBHOOK_EVENTS = ["push", "pull_request", "workflow_run"]


def _webhook_info(secret: str) -> WebhookSetupInfo:
    return WebhookSetupInfo(
        payload_url=f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/webhooks/github",
        content_type="application/json",
        secret=secret,
        events=WEBHOOK_EVENTS,
    )


async def _repo_aggregates(session: AsyncSession, user_id: int):
    """Return per-repo aggregated prediction stats keyed by (owner, name)."""
    result = await session.execute(
        select(
            Prediction.repo_owner,
            Prediction.repo_name,
            func.count(Prediction.id),
            func.coalesce(func.sum(Prediction.estimated_cost_usd), 0.0),
            func.coalesce(func.avg(Prediction.predicted_duration_minutes), 0.0),
            func.max(Prediction.created_at),
        )
        .where(Prediction.user_id == user_id)
        .group_by(Prediction.repo_owner, Prediction.repo_name)
    )
    agg = {}
    for owner, name, count, cost, dur, last in result.all():
        agg[(owner or "", name or "")] = {
            "count": count,
            "cost": float(cost or 0.0),
            "duration": float(dur or 0.0),
            "last": last,
        }
    return agg


def _to_item(repo: TrackedRepository, stats: dict) -> TrackedRepoItem:
    return TrackedRepoItem(
        id=repo.id,
        repo_owner=repo.repo_owner,
        repo_name=repo.repo_name,
        is_active=repo.is_active,
        last_event_at=repo.last_event_at,
        created_at=repo.created_at,
        total_cost_usd=round(stats.get("cost", 0.0), 6),
        prediction_count=stats.get("count", 0),
        avg_duration_minutes=round(stats.get("duration", 0.0), 2),
        last_prediction_at=stats.get("last"),
    )


@router.post("", response_model=TrackedRepoResponse, status_code=201)
async def track_repository(
    body: TrackRepoRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Register a repository for the authenticated user and return webhook setup details."""
    owner = body.repo_owner.strip()
    name = body.repo_name.strip()
    if not owner or not name:
        raise HTTPException(status_code=422, detail="repo_owner and repo_name are required")

    existing = await session.execute(
        select(TrackedRepository).where(
            TrackedRepository.user_id == user.id,
            TrackedRepository.repo_owner == owner,
            TrackedRepository.repo_name == name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Repository is already being tracked")

    repo = TrackedRepository(
        user_id=user.id,
        repo_owner=owner,
        repo_name=name,
        webhook_secret=secrets.token_hex(20),
        is_active=True,
    )
    session.add(repo)
    await session.commit()
    await session.refresh(repo)

    return TrackedRepoResponse(
        repository=_to_item(repo, {}),
        webhook=_webhook_info(repo.webhook_secret),
    )


@router.get("", response_model=list[TrackedRepoItem])
async def list_repositories(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List the authenticated user's tracked repositories with aggregated cost stats."""
    result = await session.execute(
        select(TrackedRepository)
        .where(TrackedRepository.user_id == user.id)
        .order_by(desc(TrackedRepository.created_at))
    )
    repos = result.scalars().all()
    agg = await _repo_aggregates(session, user.id)
    return [_to_item(r, agg.get((r.repo_owner, r.repo_name), {})) for r in repos]


@router.get("/{repo_id}/webhook", response_model=WebhookSetupInfo)
async def get_webhook_info(
    repo_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return webhook setup instructions (including the secret) for a tracked repo."""
    repo = await _get_owned_repo(session, user.id, repo_id)
    return _webhook_info(repo.webhook_secret)


@router.post("/{repo_id}/rotate-secret", response_model=WebhookSetupInfo)
async def rotate_secret(
    repo_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Generate a fresh webhook secret for a tracked repo."""
    repo = await _get_owned_repo(session, user.id, repo_id)
    repo.webhook_secret = secrets.token_hex(20)
    await session.commit()
    return _webhook_info(repo.webhook_secret)


@router.delete("/{repo_id}", status_code=204)
async def untrack_repository(
    repo_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Stop tracking a repository."""
    repo = await _get_owned_repo(session, user.id, repo_id)
    await session.delete(repo)
    await session.commit()


@router.get("/{repo_id}/stats", response_model=RepoStatsResponse)
async def get_repo_stats(
    repo_id: int,
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return detailed analytics for a single tracked repository."""
    repo = await _get_owned_repo(session, user.id, repo_id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await session.execute(
        select(Prediction).where(
            Prediction.user_id == user.id,
            Prediction.repo_owner == repo.repo_owner,
            Prediction.repo_name == repo.repo_name,
            Prediction.created_at >= cutoff,
        ).order_by(desc(Prediction.created_at))
    )
    records = result.scalars().all()

    if not records:
        return RepoStatsResponse(
            repo_owner=repo.repo_owner, repo_name=repo.repo_name,
            total_predictions=0, total_cost_usd=0.0,
            avg_duration_minutes=0.0, avg_cost_usd=0.0,
            cost_over_time=[], cost_by_workflow=[], recent_predictions=[],
        )

    total_cost = sum(r.estimated_cost_usd for r in records)
    avg_duration = sum(r.predicted_duration_minutes for r in records) / len(records)

    runner_counts: dict = defaultdict(int)
    for r in records:
        if r.runner_type:
            runner_counts[r.runner_type] += 1
    top_runner = max(runner_counts, key=runner_counts.get) if runner_counts else None

    # Cost over time (daily)
    daily_map: dict = defaultdict(lambda: {"cost": 0.0, "count": 0})
    for r in records:
        if r.created_at:
            dt = r.created_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            key = dt.strftime("%Y-%m-%d")
            daily_map[key]["cost"] += r.estimated_cost_usd
            daily_map[key]["count"] += 1
    cost_over_time = sorted(
        [
            DailyCostItem(date=d, total_cost_usd=round(v["cost"], 6), prediction_count=v["count"])
            for d, v in daily_map.items()
        ],
        key=lambda x: x.date,
    )

    # Cost by workflow file
    wf_map: dict = defaultdict(lambda: {"cost": 0.0, "count": 0, "duration": 0.0})
    for r in records:
        key = r.workflow_file or "unknown"
        wf_map[key]["cost"] += r.estimated_cost_usd
        wf_map[key]["count"] += 1
        wf_map[key]["duration"] += r.predicted_duration_minutes
    cost_by_workflow = sorted(
        [
            WorkflowCostItem(
                workflow_file=k,
                total_cost_usd=round(v["cost"], 6),
                prediction_count=v["count"],
                avg_duration_minutes=round(v["duration"] / v["count"], 2),
            )
            for k, v in wf_map.items()
        ],
        key=lambda x: x.total_cost_usd,
        reverse=True,
    )

    recent = [
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
        for r in records[:15]
    ]

    return RepoStatsResponse(
        repo_owner=repo.repo_owner,
        repo_name=repo.repo_name,
        total_predictions=len(records),
        total_cost_usd=round(total_cost, 6),
        avg_duration_minutes=round(avg_duration, 2),
        avg_cost_usd=round(total_cost / len(records), 6),
        top_runner=top_runner,
        cost_over_time=cost_over_time,
        cost_by_workflow=cost_by_workflow,
        recent_predictions=recent,
    )


async def _get_owned_repo(session: AsyncSession, user_id: int, repo_id: int) -> TrackedRepository:
    result = await session.execute(
        select(TrackedRepository).where(
            TrackedRepository.id == repo_id,
            TrackedRepository.user_id == user_id,
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Tracked repository not found")
    return repo
