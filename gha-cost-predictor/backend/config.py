from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./predictions.db"

    # ML Model
    MODEL_PATH: str = os.path.join(os.path.dirname(__file__), "ml_models", "model.joblib")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Pricing
    PRICING_CACHE_TTL: int = 3600

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
