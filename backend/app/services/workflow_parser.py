import math
import yaml
import logging
import re
from typing import Dict, Any, List, Optional, Set

logger = logging.getLogger(__name__)


SETUP_ACTIONS = {
    "actions/setup-node",
    "actions/setup-python",
    "actions/setup-java",
    "actions/setup-go",
    "actions/setup-dotnet",
    "actions/setup-ruby",
    "actions/setup-elixir",
    "actions/setup-haskell",
}


CACHE_ACTIONS = {
    "actions/cache",
    "actions/setup-node",
    "actions/setup-python",
}


DOCKER_KEYWORDS = ("docker", "container", "docker-compose", "dockerfile")


def _yaml_max_indent_depth(yaml_content: str) -> int:
    lines = yaml_content.splitlines()
    max_indent = 0
    for line in lines:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        if indent > max_indent:
            max_indent = indent
    return max_indent // 2


def _count_env_vars(node: Any) -> int:
    if not isinstance(node, dict):
        return 0
    env = node.get("env")
    return len(env) if isinstance(env, dict) else 0


def _count_if_conditions(node: Any) -> int:
    if not isinstance(node, dict):
        return 0
    return 1 if node.get("if") else 0


def _normalize_uses_value(uses: str) -> str:
    uses = (uses or "").strip()
    if not uses:
        return ""
    return uses.split("@")[0].lower()


def _extract_matrix_info(strategy: Any) -> Dict[str, int]:
    if not isinstance(strategy, dict):
        return {"uses_matrix_strategy": 0, "matrix_dimensions": 0, "matrix_permutations": 0, "fail_fast": 0}

    fail_fast_val = strategy.get("fail-fast")
    fail_fast = 1 if (fail_fast_val is True) else 0

    matrix = strategy.get("matrix")
    if not isinstance(matrix, dict):
        return {"uses_matrix_strategy": 0, "matrix_dimensions": 0, "matrix_permutations": 0, "fail_fast": fail_fast}

    dimension_keys = [k for k in matrix.keys() if k not in ("include", "exclude")]
    matrix_dimensions = len(dimension_keys)

    permutations = 1
    has_any_dimension = False
    for k in dimension_keys:
        v = matrix.get(k)
        if isinstance(v, list) and len(v) > 0:
            permutations *= len(v)
            has_any_dimension = True
        else:
            permutations *= 1

    include = matrix.get("include")
    exclude = matrix.get("exclude")
    include_count = len(include) if isinstance(include, list) else 0
    exclude_count = len(exclude) if isinstance(exclude, list) else 0

    if not has_any_dimension:
        permutations = include_count
    else:
        permutations = permutations + include_count

    permutations = max(0, permutations - exclude_count)
    uses_matrix_strategy = 1

    return {
        "uses_matrix_strategy": uses_matrix_strategy,
        "matrix_dimensions": matrix_dimensions,
        "matrix_permutations": int(permutations),
        "fail_fast": fail_fast,
    }


def extract_workflow_features(
    yaml_content: str,
    *,
    repo_name: Optional[str] = None,
    head_sha: Optional[str] = None,
    total_cost_usd: Optional[float] = None,
    duration_minutes: Optional[float] = None,
    primary_language: Optional[str] = None,
    repo_size_kb: int = 0,
) -> Dict[str, Any]:
    workflow = parse_workflow(yaml_content) or {}
    jobs = get_jobs(workflow)

    yaml_line_count = len(yaml_content.splitlines())
    yaml_depth = _yaml_max_indent_depth(yaml_content)
    workflow_name = get_workflow_name(workflow) if workflow else "Unknown"

    job_count = 0
    total_steps = 0
    timeout_minutes: Optional[int] = None
    os_label = ""
    container_image = ""

    uses_matrix_strategy = 0
    matrix_dimensions = 0
    matrix_permutations = 0
    fail_fast = 0

    unique_actions: Set[str] = set()
    is_using_setup_actions = 0
    is_using_docker_actions = 0
    is_using_cache = 0
    env_var_count = 0
    if_condition_count = 0
    needs_dependencies_count = 0
    has_container = 0
    run_command_line_count = 0

    if isinstance(workflow, dict):
        env_var_count += _count_env_vars(workflow)

    for _, job_def in jobs.items():
        if not isinstance(job_def, dict):
            continue
        job_count += 1

        runs_on = job_def.get("runs-on")
        if not os_label:
            if isinstance(runs_on, str):
                os_label = runs_on
            elif isinstance(runs_on, list) and runs_on:
                os_label = str(runs_on[0])
            elif isinstance(runs_on, dict):
                labels = runs_on.get("labels", runs_on.get("group"))
                if isinstance(labels, list) and labels:
                    os_label = str(labels[0])
                elif labels is not None:
                    os_label = str(labels)

        needs = job_def.get("needs")
        if isinstance(needs, list):
            needs_dependencies_count += len(needs)
        elif isinstance(needs, str):
            needs_dependencies_count += 1

        if_condition_count += _count_if_conditions(job_def)
        env_var_count += _count_env_vars(job_def)

        tm = job_def.get("timeout-minutes")
        if isinstance(tm, int):
            timeout_minutes = tm if timeout_minutes is None else max(timeout_minutes, tm)
        elif isinstance(tm, str) and tm.isdigit():
            tm_i = int(tm)
            timeout_minutes = tm_i if timeout_minutes is None else max(timeout_minutes, tm_i)

        # Container
        job_container = job_def.get("container")
        if job_container:
            has_container = 1

        strategy = job_def.get("strategy")
        matrix_info = _extract_matrix_info(strategy)
        uses_matrix_strategy = max(uses_matrix_strategy, matrix_info["uses_matrix_strategy"])
        fail_fast = max(fail_fast, matrix_info["fail_fast"])
        matrix_dimensions = max(matrix_dimensions, matrix_info["matrix_dimensions"])
        matrix_permutations = max(matrix_permutations, matrix_info["matrix_permutations"])

        steps = job_def.get("steps")
        if not isinstance(steps, list):
            continue
        total_steps += len(steps)

        for step in steps:
            if not isinstance(step, dict):
                continue

            if_condition_count += _count_if_conditions(step)
            env_var_count += _count_env_vars(step)

            uses = step.get("uses")
            if isinstance(uses, str) and uses.strip():
                normalized = _normalize_uses_value(uses)
                if normalized:
                    unique_actions.add(normalized)

                if any(sa in normalized for sa in SETUP_ACTIONS):
                    is_using_setup_actions = 1
                if any(ca in normalized for ca in CACHE_ACTIONS):
                    is_using_cache = 1
                if any(k in normalized for k in DOCKER_KEYWORDS):
                    is_using_docker_actions = 1

            run = step.get("run")
            if isinstance(run, str) and run:
                run_command_line_count += len([l for l in run.splitlines() if l.strip()])
                run_lower = run.lower()
                if any(k in run_lower for k in DOCKER_KEYWORDS):
                    is_using_docker_actions = 1

    avg_steps_per_job = (float(total_steps) / float(job_count)) if job_count > 0 else 0.0
    unique_actions_used = len(unique_actions)

    # Detect workflow_trigger_is_pr from on: triggers
    triggers_raw = workflow.get("on", workflow.get(True, {}))
    workflow_trigger_is_pr = 0
    if isinstance(triggers_raw, str):
        workflow_trigger_is_pr = 1 if "pull_request" in triggers_raw else 0
    elif isinstance(triggers_raw, list):
        workflow_trigger_is_pr = 1 if any("pull_request" in str(t) for t in triggers_raw) else 0
    elif isinstance(triggers_raw, dict):
        workflow_trigger_is_pr = 1 if "pull_request" in triggers_raw else 0

    # Composite code_complexity: weighted log-scale combination
    code_complexity = (
        0.4 * math.log1p(repo_size_kb)
        + 0.3 * math.log1p(run_command_line_count)
        + 0.15 * math.log1p(total_steps)
        + 0.1 * math.log1p(yaml_depth)
        + 0.05 * math.log1p(needs_dependencies_count)
    )

    if timeout_minutes is None:
        timeout_minutes = 0

    return {
        "total_cost_usd": float(total_cost_usd) if total_cost_usd is not None else 0.0,
        "duration_minutes": float(duration_minutes) if duration_minutes is not None else 0.0,
        "repo_name": repo_name or "",
        "head_sha": head_sha or "",
        "workflow_name": workflow_name,
        "yaml_line_count": int(yaml_line_count),
        "yaml_depth": int(yaml_depth),
        "job_count": int(job_count),
        "total_steps": int(total_steps),
        "avg_steps_per_job": float(round(avg_steps_per_job, 4)),
        "uses_matrix_strategy": int(uses_matrix_strategy),
        "matrix_dimensions": int(matrix_dimensions),
        "matrix_permutations": int(matrix_permutations),
        "fail_fast": int(fail_fast),
        "os_label": os_label or "ubuntu-latest",
        "timeout_minutes": int(timeout_minutes),
        "unique_actions_used": int(unique_actions_used),
        "is_using_setup_actions": int(is_using_setup_actions),
        "is_using_docker_actions": int(is_using_docker_actions),
        "is_using_cache": int(is_using_cache),
        "env_var_count": int(env_var_count),
        "if_condition_count": int(if_condition_count),
        "needs_dependencies_count": int(needs_dependencies_count),
        "code_complexity": float(round(code_complexity, 6)),
        "primary_language": primary_language or "",
        "has_container": int(has_container),
        "run_command_line_count": int(run_command_line_count),
        "workflow_trigger_is_pr": int(workflow_trigger_is_pr),
        "repo_size_kb": int(repo_size_kb),
    }


def parse_workflow(yaml_content: str) -> Optional[Dict[str, Any]]:
    """Parse a GitHub Actions workflow YAML string into a dict."""
    try:
        workflow = yaml.safe_load(yaml_content)
        if not isinstance(workflow, dict):
            logger.warning("Parsed YAML is not a dict")
            return None
        return workflow
    except yaml.YAMLError as e:
        logger.error(f"YAML parse error: {e}")
        return None


def get_workflow_name(workflow: Dict[str, Any]) -> str:
    """Extract the workflow name."""
    return workflow.get("name", "Unnamed Workflow")


def get_triggers(workflow: Dict[str, Any]) -> List[str]:
    """Extract trigger event names."""
    triggers = workflow.get("on", workflow.get(True, {}))
    if isinstance(triggers, str):
        return [triggers]
    elif isinstance(triggers, list):
        return triggers
    elif isinstance(triggers, dict):
        return list(triggers.keys())
    return []


def get_jobs(workflow: Dict[str, Any]) -> Dict[str, Dict]:
    """Extract jobs dict from workflow."""
    jobs = workflow.get("jobs", {})
    return jobs if isinstance(jobs, dict) else {}


def get_job_runner(job_def: Dict[str, Any]) -> str:
    """Get the runs-on label for a job."""
    runs_on = job_def.get("runs-on", "ubuntu-latest")
    if isinstance(runs_on, str):
        return runs_on
    elif isinstance(runs_on, list):
        return runs_on[0] if runs_on else "ubuntu-latest"
    elif isinstance(runs_on, dict):
        labels = runs_on.get("labels", runs_on.get("group", "ubuntu-latest"))
        return labels[0] if isinstance(labels, list) else str(labels)
    return "ubuntu-latest"


def get_job_steps(job_def: Dict[str, Any]) -> List[Dict]:
    """Get the steps list for a job."""
    steps = job_def.get("steps", [])
    return steps if isinstance(steps, list) else []


def summarize_workflow(yaml_content: str) -> Dict[str, Any]:
    """
    Generate a human-readable summary of a workflow for display purposes.
    """
    workflow = parse_workflow(yaml_content)
    if not workflow:
        return {"error": "Invalid workflow YAML"}

    jobs = get_jobs(workflow)
    job_summaries = []

    for name, jdef in jobs.items():
        if not isinstance(jdef, dict):
            continue
        steps = get_job_steps(jdef)
        runner = get_job_runner(jdef)
        strategy = jdef.get("strategy", {})
        has_matrix = isinstance(strategy, dict) and "matrix" in strategy
        # Container
        container_image = False
        container = jdef.get("container")
        if container:
            if isinstance(container, str):
                container_image = container
            elif isinstance(container, dict):
                container_image = container.get("image", True)
            else:
                container_image = True

        job_summaries.append({
            "name": name,
            "runner": runner,
            "steps": len(steps),
            "has_matrix": has_matrix,
            "needs": jdef.get("needs", []),
            "timeout_minutes": jdef.get("timeout-minutes"),
        })

    return {
        "name": get_workflow_name(workflow),
        "triggers": get_triggers(workflow),
        "job_count": len(jobs),
        "jobs": job_summaries,
        "total_steps": sum(j["steps"] for j in job_summaries),
        "has_container": container_image,
    }
