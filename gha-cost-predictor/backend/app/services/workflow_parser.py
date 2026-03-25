import yaml
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


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
    }
