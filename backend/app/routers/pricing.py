from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_session
from app.models.schemas import PricingResponse, RunnerPricing
from app.services.pricing_service import pricing_service

router = APIRouter(prefix="/api/pricing", tags=["pricing"])


@router.get("/", response_model=PricingResponse)
async def get_pricing():
    """Get current GitHub Actions runner pricing."""
    all_pricing = await pricing_service.get_all_pricing()

    runners = [
        RunnerPricing(
            runner_sku=sku,
            per_minute_cost_usd=info["cost"],
            os_type=info["os"],
            cpu_cores=info.get("cores"),
            is_arm=info.get("arm", False),
            is_gpu=info.get("gpu", False),
        )
        for sku, info in all_pricing.items()
    ]

    return PricingResponse(
        runners=runners,
        last_updated=pricing_service.last_updated,
        source="github_docs",
    )


@router.post("/refresh")
async def refresh_pricing(session: AsyncSession = Depends(get_session)):
    """Force-refresh pricing from GitHub docs and persist to database."""
    pricing_service._last_fetched = 0  # Reset TTL to force refresh
    await pricing_service._ensure_fresh()
    await pricing_service.persist_to_db(session)

    return {
        "status": "refreshed",
        "last_updated": pricing_service.last_updated,
    }
