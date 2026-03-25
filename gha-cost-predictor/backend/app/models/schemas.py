from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


# ─── Request Schemas ────────────────────────────────────────────────

class WorkflowPredictionRequest(BaseModel):
    workflow_yaml: str = Field(..., description="Raw YAML content of the GitHub Actions workflow")
    repo_owner: Optional[str] = Field(None, description="Repository owner")
    repo_name: Optional[str] = Field(None, description="Repository name")
    pr_number: Optional[int] = Field(None, description="Pull request number")
    workflow_file: Optional[str] = Field(None, description="Workflow file path")
    trigger_type: Optional[str] = Field("manual", description="How the prediction was triggered: push, pull_request, manual")
    commit_sha: Optional[str] = Field(None, description="Commit SHA that triggered the prediction")
    branch: Optional[str] = Field(None, description="Branch name")


class RepoPredictionRequest(BaseModel):
    repo_owner: str = Field(..., description="Repository owner")
    repo_name: str = Field(..., description="Repository name")
    pr_number: Optional[int] = Field(None, description="Pull request number")
    branch: Optional[str] = Field("main", description="Branch to fetch workflows from")


# ─── Response Schemas ───────────────────────────────────────────────

class JobPrediction(BaseModel):
    job_name: str
    runner_type: str
    runner_os: str
    predicted_duration_minutes: float
    estimated_cost_usd: float
    step_count: int


class PredictionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    id: Optional[int] = None
    repo_owner: Optional[str] = None
    repo_name: Optional[str] = None
    pr_number: Optional[int] = None
    workflow_file: Optional[str] = None
    total_predicted_duration_minutes: float
    total_estimated_cost_usd: float
    jobs: List[JobPrediction]
    model_used: str = "xgboost"
    confidence_score: Optional[float] = None
    runner_type: str = "ubuntu-latest"
    runner_os: str = "linux"
    num_jobs: int
    total_steps: int
    created_at: Optional[datetime] = None
    status: str = "completed"
    trigger_type: Optional[str] = "manual"
    commit_sha: Optional[str] = None
    branch: Optional[str] = None
    cost_breakdown: Optional[Dict[str, Any]] = None


class PredictionHistoryItem(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    id: int
    repo_owner: str
    repo_name: str
    pr_number: Optional[int]
    workflow_file: Optional[str]
    predicted_duration_minutes: float
    estimated_cost_usd: float
    runner_type: str
    num_jobs: Optional[int]
    total_steps: Optional[int]
    model_used: Optional[str]
    status: str
    trigger_type: Optional[str] = None
    commit_sha: Optional[str] = None
    branch: Optional[str] = None
    created_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


class PredictionHistoryResponse(BaseModel):
    items: List[PredictionHistoryItem]
    total: int
    page: int
    page_size: int


# ─── Pricing Schemas ────────────────────────────────────────────────

class RunnerPricing(BaseModel):
    runner_sku: str
    per_minute_cost_usd: float
    os_type: str
    cpu_cores: Optional[int] = None
    is_arm: bool = False
    is_gpu: bool = False


class PricingResponse(BaseModel):
    runners: List[RunnerPricing]
    last_updated: Optional[datetime] = None
    source: str = "github_docs"


# ─── Webhook Schemas ────────────────────────────────────────────────

class WebhookPayload(BaseModel):
    action: str
    number: Optional[int] = None
    pull_request: Optional[Dict[str, Any]] = None
    repository: Optional[Dict[str, Any]] = None


# ─── Feature Schemas ────────────────────────────────────────────────

class WorkflowFeatures(BaseModel):
    num_jobs: int = 0
    total_steps: int = 0
    runner_os_encoded: int = 0  # 0=linux, 1=windows, 2=macos
    has_matrix: int = 0
    matrix_combinations: int = 0
    has_cache: int = 0
    has_artifacts: int = 0
    num_env_vars: int = 0
    has_services: int = 0
    has_timeout: int = 0
    num_uses_actions: int = 0
    num_run_commands: int = 0
    has_conditional: int = 0
    trigger_count: int = 0
    has_checkout: int = 0
    has_setup_action: int = 0
    has_docker: int = 0
    estimated_complexity: float = 0.0
    max_parallel_jobs: int = 1
    has_needs_dependency: int = 0
