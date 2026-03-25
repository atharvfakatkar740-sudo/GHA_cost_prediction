from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from datetime import datetime, timezone

from config import settings


engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_owner = Column(String(255), nullable=False)
    repo_name = Column(String(255), nullable=False)
    pr_number = Column(Integer, nullable=True)
    workflow_file = Column(String(500), nullable=True)
    workflow_content = Column(Text, nullable=True)
    predicted_duration_minutes = Column(Float, nullable=False)
    estimated_cost_usd = Column(Float, nullable=False)
    runner_type = Column(String(100), nullable=False, default="ubuntu-latest")
    runner_os = Column(String(50), nullable=False, default="linux")
    num_jobs = Column(Integer, nullable=True)
    total_steps = Column(Integer, nullable=True)
    features_json = Column(JSON, nullable=True)
    model_used = Column(String(100), nullable=True, default="xgboost")
    confidence_score = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="completed")
    trigger_type = Column(String(50), nullable=True, default="manual")
    commit_sha = Column(String(64), nullable=True)
    branch = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    github_comment_id = Column(Integer, nullable=True)


class PricingCache(Base):
    __tablename__ = "pricing_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    runner_sku = Column(String(100), unique=True, nullable=False)
    per_minute_cost_usd = Column(Float, nullable=False)
    os_type = Column(String(50), nullable=False)
    cpu_cores = Column(Integer, nullable=True)
    is_arm = Column(Integer, default=0)
    is_gpu = Column(Integer, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
