from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""

    # Database — default to PostgreSQL; falls back to SQLite for quick local dev
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/gha_cost_predictor"

    # ML Model
    MODEL_PATH: str = os.path.join(os.path.dirname(__file__), "ml_models", "model.joblib")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Pricing
    PRICING_CACHE_TTL: int = 3600

    # JWT Auth
    JWT_SECRET_KEY: str = "change-me-to-a-random-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    JWT_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # SMTP (Google SMTP for password reset emails)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "GHA Cost Predictor"
    SMTP_FROM_EMAIL: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
