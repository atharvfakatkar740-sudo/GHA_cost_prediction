import logging
import httpx
from typing import Optional, Dict, Any, List

from config import settings

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


class GitHubService:
    """Handles all interactions with the GitHub API."""

    def __init__(self):
        self.token = settings.GITHUB_TOKEN

    @property
    def _headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_workflow_files(
        self, owner: str, repo: str, branch: str = "main"
    ) -> List[Dict[str, Any]]:
        """Fetch all workflow YAML files from .github/workflows/ directory."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents/.github/workflows"
        params = {"ref": branch}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=self._headers, params=params)

        if resp.status_code != 200:
            logger.error(f"Failed to list workflows: {resp.status_code} {resp.text}")
            return []

        files = resp.json()
        return [
            {"name": f["name"], "path": f["path"], "download_url": f["download_url"]}
            for f in files
            if isinstance(f, dict)
            and f.get("name", "").endswith((".yml", ".yaml"))
        ]

    async def get_file_content(
        self, owner: str, repo: str, path: str, ref: Optional[str] = None
    ) -> Optional[str]:
        """Fetch raw content of a file from a repo."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
        params = {}
        if ref:
            params["ref"] = ref

        headers = dict(self._headers)
        headers["Accept"] = "application/vnd.github.raw+json"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers, params=params)

        if resp.status_code == 200:
            return resp.text
        logger.error(f"Failed to fetch file {path}: {resp.status_code}")
        return None

    async def post_pr_comment(
        self, owner: str, repo: str, pr_number: int, body: str
    ) -> Optional[int]:
        """Post a comment on a pull request. Returns the comment ID."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues/{pr_number}/comments"
        payload = {"body": body}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url, headers=self._headers, json=payload
            )

        if resp.status_code == 201:
            comment_id = resp.json().get("id")
            logger.info(f"Posted PR comment #{comment_id} on {owner}/{repo}#{pr_number}")
            return comment_id
        else:
            logger.error(f"Failed to post PR comment: {resp.status_code} {resp.text}")
            return None

    async def update_pr_comment(
        self, owner: str, repo: str, comment_id: int, body: str
    ) -> bool:
        """Update an existing PR comment."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues/comments/{comment_id}"
        payload = {"body": body}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.patch(
                url, headers=self._headers, json=payload
            )

        return resp.status_code == 200

    async def get_pr_changed_files(
        self, owner: str, repo: str, pr_number: int
    ) -> List[str]:
        """Get list of files changed in a PR."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}/files"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=self._headers)

        if resp.status_code == 200:
            return [f["filename"] for f in resp.json()]
        return []

    async def get_pr_info(
        self, owner: str, repo: str, pr_number: int
    ) -> Optional[Dict[str, Any]]:
        """Get PR details."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=self._headers)

        if resp.status_code == 200:
            return resp.json()
        return None

    async def post_commit_comment(
        self, owner: str, repo: str, commit_sha: str, body: str
    ) -> Optional[int]:
        """Post a comment on a specific commit. Returns the comment ID."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{commit_sha}/comments"
        payload = {"body": body}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url, headers=self._headers, json=payload
            )

        if resp.status_code == 201:
            comment_id = resp.json().get("id")
            logger.info(
                f"Posted commit comment #{comment_id} on {owner}/{repo}@{commit_sha[:7]}"
            )
            return comment_id
        else:
            logger.error(
                f"Failed to post commit comment: {resp.status_code} {resp.text}"
            )
            return None

    async def find_open_prs_for_branch(
        self, owner: str, repo: str, branch: str
    ) -> List[Dict[str, Any]]:
        """
        Find all open PRs whose head branch matches the given branch name.
        Returns a list of {number, title, head_ref, base_ref}.
        """
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls"
        params = {"state": "open", "head": f"{owner}:{branch}", "per_page": 10}

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=self._headers, params=params)

        if resp.status_code == 200:
            return [
                {
                    "number": pr["number"],
                    "title": pr["title"],
                    "head_ref": pr["head"]["ref"],
                    "base_ref": pr["base"]["ref"],
                }
                for pr in resp.json()
            ]
        logger.warning(f"Failed to find PRs for branch {branch}: {resp.status_code}")
        return []

    async def get_repo_metadata(
        self, owner: str, repo: str
    ) -> Dict[str, Any]:
        """Fetch lightweight repo metadata: size_kb, primary language. Single API call."""
        if not owner or not repo:
            return {}
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, headers=self._headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "repo_size_kb": int(data.get("size", 0)),
                    "primary_language": (data.get("language") or "unknown").lower(),
                }
        except Exception as e:
            logger.warning(f"get_repo_metadata failed for {owner}/{repo}: {e}")
        return {}

    def format_prediction_comment(
        self,
        workflow_name: str,
        total_duration: float,
        total_cost: float,
        jobs: list,
        model_used: str,
        confidence: float,
        trigger_type: str = "pull_request",
        commit_sha: str = "",
        branch: str = "",
    ) -> str:
        """Format a beautifully structured PR/commit comment with prediction results."""
        # Header
        trigger_label = {
            "push": "Push",
            "pull_request": "Pull Request",
            "workflow_dispatch": "Manual Dispatch",
            "manual": "Manual",
        }.get(trigger_type, trigger_type.replace("_", " ").title())

        context_parts = []
        if branch:
            context_parts.append(f"**Branch:** `{branch}`")
        if commit_sha:
            context_parts.append(f"**Commit:** `{commit_sha[:7]}`")
        context_line = " | ".join(context_parts) if context_parts else ""

        lines = [
            "## \U0001f52e GitHub Actions Cost Prediction",
            "",
            f"**Workflow:** `{workflow_name}` | **Trigger:** {trigger_label}",
            f"**Model:** {model_used} | **Confidence:** {confidence:.0%}",
            *(([context_line] if context_line else [])),
            "",
            "---",
            "",
            "### 📊 Summary",
            "",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| ⏱️ **Estimated Duration** | **{total_duration:.1f} minutes** |",
            f"| 💰 **Estimated Cost** | **${total_cost:.4f} USD** |",
            f"| 🔧 **Total Jobs** | {len(jobs)} |",
            "",
        ]

        # Per-job breakdown
        if len(jobs) > 0:
            lines.extend([
                "### 📋 Job Breakdown",
                "",
                "| Job | Runner | Steps | Duration (min) | Cost (USD) |",
                "|-----|--------|-------|----------------|------------|",
            ])
            for job in jobs:
                lines.append(
                    f"| `{job['job_name']}` "
                    f"| {job['runner_type']} "
                    f"| {job['step_count']} "
                    f"| {job['predicted_duration_minutes']:.1f} "
                    f"| ${job['estimated_cost_usd']:.4f} |"
                )
            lines.append("")

        # Footer
        lines.extend([
            "---",
            "",
            "<details>",
            "<summary>ℹ️ About this prediction</summary>",
            "",
            "This cost estimate is generated by an ML model that analyzes the workflow "
            "YAML structure. Actual costs may vary based on execution conditions, "
            "network latency, and external dependencies.",
            "",
            "Pricing is based on the latest GitHub Actions runner rates.",
            "",
            "</details>",
            "",
            "*Generated by [GHA Cost Predictor](https://github.com) — "
            "Pre-run cost estimation for GitHub Actions*",
        ])

        return "\n".join(lines)


# Singleton
github_service = GitHubService()
