import yaml
import re
from typing import Dict, Any, List, Tuple
from app.models.schemas import WorkflowFeatures


# Runner OS mapping
RUNNER_OS_MAP = {
    "ubuntu": 0, "linux": 0,
    "windows": 1,
    "macos": 2, "mac": 2,
}

# Known setup actions
SETUP_ACTIONS = [
    "actions/setup-node", "actions/setup-python", "actions/setup-java",
    "actions/setup-go", "actions/setup-dotnet", "actions/setup-ruby",
    "actions/setup-elixir", "actions/setup-haskell",
]

CACHE_ACTIONS = ["actions/cache", "actions/setup-node", "actions/setup-python"]
ARTIFACT_ACTIONS = ["actions/upload-artifact", "actions/download-artifact"]
DOCKER_KEYWORDS = ["docker", "container", "docker-compose", "dockerfile"]


def detect_runner_os(runs_on: Any) -> str:
    """Detect the OS from the runs-on field."""
    if isinstance(runs_on, str):
        val = runs_on.lower()
    elif isinstance(runs_on, list):
        val = str(runs_on).lower()
    elif isinstance(runs_on, dict):
        val = str(runs_on.get("group", runs_on.get("labels", ""))).lower()
    else:
        val = "linux"

    for key in RUNNER_OS_MAP:
        if key in val:
            return key if key in ("linux", "windows", "macos") else (
                "linux" if key == "ubuntu" else "macos" if key == "mac" else key
            )
    return "linux"


def get_runner_label(runs_on: Any) -> str:
    """Get the full runner label string."""
    if isinstance(runs_on, str):
        return runs_on
    elif isinstance(runs_on, list):
        return runs_on[0] if runs_on else "ubuntu-latest"
    elif isinstance(runs_on, dict):
        labels = runs_on.get("labels", runs_on.get("group", "ubuntu-latest"))
        return labels[0] if isinstance(labels, list) else str(labels)
    return "ubuntu-latest"


def count_matrix_combinations(strategy: Dict) -> int:
    """Count the number of matrix combinations."""
    matrix = strategy.get("matrix", {})
    if not matrix:
        return 0

    include = matrix.get("include", [])
    exclude = matrix.get("exclude", [])

    # Filter out include/exclude keys
    dimension_keys = [k for k in matrix if k not in ("include", "exclude")]

    if not dimension_keys:
        return len(include)

    combinations = 1
    for key in dimension_keys:
        vals = matrix[key]
        if isinstance(vals, list):
            combinations *= len(vals)

    combinations += len(include)
    combinations = max(0, combinations - len(exclude))
    return combinations


def extract_features_from_yaml(workflow_yaml: str) -> Tuple[WorkflowFeatures, List[Dict[str, Any]]]:
    """
    Extract ML features from a GitHub Actions workflow YAML string.
    Returns (WorkflowFeatures, list_of_job_info_dicts).
    """
    try:
        workflow = yaml.safe_load(workflow_yaml)
    except yaml.YAMLError:
        return WorkflowFeatures(), []

    if not isinstance(workflow, dict):
        return WorkflowFeatures(), []

    jobs = workflow.get("jobs", {})
    if not isinstance(jobs, dict):
        return WorkflowFeatures(), []

    # ── Triggers ────────────────────────────────────────────────
    triggers = workflow.get("on", workflow.get(True, {}))
    trigger_count = 1
    if isinstance(triggers, dict):
        trigger_count = len(triggers)
    elif isinstance(triggers, list):
        trigger_count = len(triggers)

    # ── Global env vars ─────────────────────────────────────────
    global_env = workflow.get("env", {})
    global_env_count = len(global_env) if isinstance(global_env, dict) else 0

    # ── Per-job analysis ────────────────────────────────────────
    num_jobs = len(jobs)
    total_steps = 0
    num_uses_actions = 0
    num_run_commands = 0
    has_matrix = 0
    matrix_combinations = 0
    has_cache = 0
    has_artifacts = 0
    has_services = 0
    has_timeout = 0
    has_conditional = 0
    has_checkout = 0
    has_setup_action = 0
    has_docker = 0
    has_needs = 0
    num_env_vars = global_env_count
    max_parallel = num_jobs
    job_infos = []
    dominant_os = "linux"

    for job_name, job_def in jobs.items():
        if not isinstance(job_def, dict):
            continue

        # Runner
        runs_on = job_def.get("runs-on", "ubuntu-latest")
        runner_os = detect_runner_os(runs_on)
        runner_label = get_runner_label(runs_on)

        # Steps
        steps = job_def.get("steps", [])
        job_step_count = len(steps) if isinstance(steps, list) else 0
        total_steps += job_step_count

        # Job env
        job_env = job_def.get("env", {})
        if isinstance(job_env, dict):
            num_env_vars += len(job_env)

        # Strategy / Matrix
        strategy = job_def.get("strategy", {})
        if isinstance(strategy, dict) and "matrix" in strategy:
            has_matrix = 1
            mc = count_matrix_combinations(strategy)
            matrix_combinations += mc

        # Needs (dependency)
        if "needs" in job_def:
            has_needs = 1

        # Timeout
        if "timeout-minutes" in job_def:
            has_timeout = 1

        # Services
        if job_def.get("services"):
            has_services = 1

        # Conditional
        if job_def.get("if"):
            has_conditional = 1

        # Concurrency
        concurrency = strategy.get("max-parallel") if isinstance(strategy, dict) else None
        if concurrency:
            max_parallel = min(max_parallel, int(concurrency))

        # ── Step-level analysis ─────────────────────────────────
        job_uses = 0
        job_runs = 0
        if isinstance(steps, list):
            for step in steps:
                if not isinstance(step, dict):
                    continue

                if step.get("if"):
                    has_conditional = 1

                step_env = step.get("env", {})
                if isinstance(step_env, dict):
                    num_env_vars += len(step_env)

                uses = step.get("uses", "")
                if uses:
                    num_uses_actions += 1
                    job_uses += 1
                    uses_lower = uses.lower()

                    if "actions/checkout" in uses_lower:
                        has_checkout = 1
                    if any(sa in uses_lower for sa in SETUP_ACTIONS):
                        has_setup_action = 1
                    if any(ca in uses_lower for ca in CACHE_ACTIONS):
                        has_cache = 1
                    if any(aa in uses_lower for aa in ARTIFACT_ACTIONS):
                        has_artifacts = 1
                    if any(dk in uses_lower for dk in DOCKER_KEYWORDS):
                        has_docker = 1

                run_cmd = step.get("run", "")
                if run_cmd:
                    num_run_commands += 1
                    job_runs += 1
                    run_lower = run_cmd.lower()
                    if any(dk in run_lower for dk in DOCKER_KEYWORDS):
                        has_docker = 1

        job_infos.append({
            "job_name": job_name,
            "runner_os": runner_os,
            "runner_label": runner_label,
            "step_count": job_step_count,
            "uses_count": job_uses,
            "run_count": job_runs,
            "has_matrix": has_matrix,
            "matrix_combinations": matrix_combinations,
        })

    # Determine dominant OS
    os_counts = {"linux": 0, "windows": 0, "macos": 0}
    for ji in job_infos:
        os_counts[ji["runner_os"]] = os_counts.get(ji["runner_os"], 0) + 1
    dominant_os = max(os_counts, key=os_counts.get) if os_counts else "linux"

    # Complexity score: weighted combination of features
    complexity = (
        num_jobs * 1.0
        + total_steps * 0.5
        + matrix_combinations * 0.8
        + has_docker * 2.0
        + has_services * 1.5
        + num_run_commands * 0.3
        + num_uses_actions * 0.2
        + has_cache * 0.5
        + has_artifacts * 0.5
    )

    features = WorkflowFeatures(
        num_jobs=num_jobs,
        total_steps=total_steps,
        runner_os_encoded=RUNNER_OS_MAP.get(dominant_os, 0),
        has_matrix=has_matrix,
        matrix_combinations=matrix_combinations,
        has_cache=has_cache,
        has_artifacts=has_artifacts,
        num_env_vars=num_env_vars,
        has_services=has_services,
        has_timeout=has_timeout,
        num_uses_actions=num_uses_actions,
        num_run_commands=num_run_commands,
        has_conditional=has_conditional,
        trigger_count=trigger_count,
        has_checkout=has_checkout,
        has_setup_action=has_setup_action,
        has_docker=has_docker,
        estimated_complexity=round(complexity, 2),
        max_parallel_jobs=max_parallel,
        has_needs_dependency=has_needs,
    )

    return features, job_infos


def features_to_array(features: WorkflowFeatures) -> list:
    """Convert WorkflowFeatures to a flat list for ML model input."""
    return [
        features.num_jobs,
        features.total_steps,
        features.runner_os_encoded,
        features.has_matrix,
        features.matrix_combinations,
        features.has_cache,
        features.has_artifacts,
        features.num_env_vars,
        features.has_services,
        features.has_timeout,
        features.num_uses_actions,
        features.num_run_commands,
        features.has_conditional,
        features.trigger_count,
        features.has_checkout,
        features.has_setup_action,
        features.has_docker,
        features.estimated_complexity,
        features.max_parallel_jobs,
        features.has_needs_dependency,
    ]


FEATURE_NAMES = [
    "num_jobs", "total_steps", "runner_os_encoded",
    "has_matrix", "matrix_combinations", "has_cache", "has_artifacts",
    "num_env_vars", "has_services", "has_timeout",
    "num_uses_actions", "num_run_commands", "has_conditional",
    "trigger_count", "has_checkout", "has_setup_action",
    "has_docker", "estimated_complexity", "max_parallel_jobs",
    "has_needs_dependency",
]
