import logging
import time
from typing import Dict, Optional
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import PricingCache
from config import settings

logger = logging.getLogger(__name__)

# Default pricing as fallback (per-minute USD) — sourced from GitHub docs
DEFAULT_PRICING: Dict[str, Dict] = {
    "actions_linux_slim": {"cost": 0.008, "os": "linux", "cores": 2, "arm": False, "gpu": False},
    "actions_linux": {"cost": 0.008, "os": "linux", "cores": 2, "arm": False, "gpu": False},
    "actions_linux_arm": {"cost": 0.005, "os": "linux", "cores": 2, "arm": True, "gpu": False},
    "actions_windows": {"cost": 0.016, "os": "windows", "cores": 2, "arm": False, "gpu": False},
    "actions_windows_arm": {"cost": 0.010, "os": "windows", "cores": 2, "arm": True, "gpu": False},
    "actions_macos": {"cost": 0.080, "os": "macos", "cores": 3, "arm": False, "gpu": False},
    # Larger runners — x64
    "linux_4_core": {"cost": 0.016, "os": "linux", "cores": 4, "arm": False, "gpu": False},
    "linux_8_core": {"cost": 0.032, "os": "linux", "cores": 8, "arm": False, "gpu": False},
    "linux_16_core": {"cost": 0.064, "os": "linux", "cores": 16, "arm": False, "gpu": False},
    "linux_32_core": {"cost": 0.128, "os": "linux", "cores": 32, "arm": False, "gpu": False},
    "linux_64_core": {"cost": 0.256, "os": "linux", "cores": 64, "arm": False, "gpu": False},
    "windows_4_core": {"cost": 0.032, "os": "windows", "cores": 4, "arm": False, "gpu": False},
    "windows_8_core": {"cost": 0.064, "os": "windows", "cores": 8, "arm": False, "gpu": False},
    "windows_16_core": {"cost": 0.128, "os": "windows", "cores": 16, "arm": False, "gpu": False},
    "windows_32_core": {"cost": 0.256, "os": "windows", "cores": 32, "arm": False, "gpu": False},
    "windows_64_core": {"cost": 0.512, "os": "windows", "cores": 64, "arm": False, "gpu": False},
    "macos_l": {"cost": 0.160, "os": "macos", "cores": 12, "arm": False, "gpu": False},
    # ARM larger runners
    "linux_4_core_arm": {"cost": 0.010, "os": "linux", "cores": 4, "arm": True, "gpu": False},
    "linux_8_core_arm": {"cost": 0.020, "os": "linux", "cores": 8, "arm": True, "gpu": False},
    "linux_16_core_arm": {"cost": 0.040, "os": "linux", "cores": 16, "arm": True, "gpu": False},
    "linux_32_core_arm": {"cost": 0.080, "os": "linux", "cores": 32, "arm": True, "gpu": False},
    "linux_64_core_arm": {"cost": 0.160, "os": "linux", "cores": 64, "arm": True, "gpu": False},
    "macos_xl": {"cost": 0.120, "os": "macos", "cores": 6, "arm": True, "gpu": False},
    # GPU
    "linux_4_core_gpu": {"cost": 0.070, "os": "linux", "cores": 4, "arm": False, "gpu": True},
    "windows_4_core_gpu": {"cost": 0.140, "os": "windows", "cores": 4, "arm": False, "gpu": True},
}

# Maps common runs-on labels to SKUs
RUNNER_LABEL_TO_SKU = {
    "ubuntu-latest": "actions_linux",
    "ubuntu-24.04": "actions_linux",
    "ubuntu-22.04": "actions_linux",
    "ubuntu-20.04": "actions_linux",
    "windows-latest": "actions_windows",
    "windows-2022": "actions_windows",
    "windows-2019": "actions_windows",
    "macos-latest": "actions_macos",
    "macos-14": "actions_macos",
    "macos-13": "actions_macos",
    "macos-12": "actions_macos",
}


class PricingService:
    """Manages GitHub Actions runner pricing with caching and live refresh."""

    def __init__(self):
        self._cache: Dict[str, Dict] = dict(DEFAULT_PRICING)
        self._last_fetched: float = 0
        self._ttl = settings.PRICING_CACHE_TTL

    async def get_per_minute_cost(self, runner_label: str, runner_os: str) -> float:
        """Get per-minute cost for a runner. Uses label mapping first, then OS fallback."""
        await self._ensure_fresh()

        sku = RUNNER_LABEL_TO_SKU.get(runner_label.lower())
        if sku and sku in self._cache:
            return self._cache[sku]["cost"]

        # Fallback by OS
        os_defaults = {
            "linux": 0.008,
            "windows": 0.016,
            "macos": 0.080,
        }
        return os_defaults.get(runner_os, 0.008)

    async def get_all_pricing(self) -> Dict[str, Dict]:
        """Return full pricing table."""
        await self._ensure_fresh()
        return dict(self._cache)

    async def _ensure_fresh(self):
        """Re-fetch pricing from GitHub docs if TTL has expired."""
        if time.time() - self._last_fetched < self._ttl:
            return
        await self._fetch_pricing_from_github()

    async def _fetch_pricing_from_github(self):
        """
        Scrape/fetch pricing info from GitHub docs.
        Falls back to defaults on failure.
        """
        url = "https://docs.github.com/en/billing/reference/actions-runner-pricing"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, follow_redirects=True)
                if resp.status_code == 200:
                    self._parse_pricing_page(resp.text)
                    self._last_fetched = time.time()
                    logger.info("Refreshed pricing from GitHub docs")
                else:
                    logger.warning(f"GitHub pricing page returned {resp.status_code}")
                    self._last_fetched = time.time()
        except Exception as e:
            logger.warning(f"Could not fetch pricing from GitHub: {e}. Using defaults.")
            self._last_fetched = time.time()

    def _parse_pricing_page(self, html: str):
        """
        Parse pricing data from GitHub docs HTML.
        GitHub's pricing page uses tables; we try to extract per-minute rates.
        If parsing fails, defaults are retained.
        """
        import re
        # Look for patterns like "$0.008" near runner SKU names
        # This is a best-effort parser; defaults remain as fallback
        try:
            patterns = [
                (r"actions_linux_slim.*?\$(\d+\.\d+)", "actions_linux_slim"),
                (r"actions_linux[^_].*?\$(\d+\.\d+)", "actions_linux"),
                (r"actions_linux_arm.*?\$(\d+\.\d+)", "actions_linux_arm"),
                (r"actions_windows[^_].*?\$(\d+\.\d+)", "actions_windows"),
                (r"actions_windows_arm.*?\$(\d+\.\d+)", "actions_windows_arm"),
                (r"actions_macos.*?\$(\d+\.\d+)", "actions_macos"),
            ]
            for pattern, sku in patterns:
                match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
                if match:
                    cost = float(match.group(1))
                    if sku in self._cache:
                        self._cache[sku]["cost"] = cost

            logger.info("Successfully parsed pricing updates from GitHub docs")
        except Exception as e:
            logger.warning(f"Error parsing pricing page: {e}")

    async def persist_to_db(self, session: AsyncSession):
        """Save current pricing to database for audit/history."""
        now = datetime.now(timezone.utc)
        for sku, info in self._cache.items():
            existing = await session.execute(
                select(PricingCache).where(PricingCache.runner_sku == sku)
            )
            row = existing.scalar_one_or_none()
            if row:
                row.per_minute_cost_usd = info["cost"]
                row.updated_at = now
            else:
                session.add(PricingCache(
                    runner_sku=sku,
                    per_minute_cost_usd=info["cost"],
                    os_type=info["os"],
                    cpu_cores=info.get("cores"),
                    is_arm=1 if info.get("arm") else 0,
                    is_gpu=1 if info.get("gpu") else 0,
                    updated_at=now,
                ))
        await session.commit()

    @property
    def last_updated(self) -> Optional[datetime]:
        if self._last_fetched > 0:
            return datetime.fromtimestamp(self._last_fetched, tz=timezone.utc)
        return None


# Singleton
pricing_service = PricingService()
