import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ─── Predictions ──────────────────────────────────────────────────

export async function predictWorkflow(yamlContent, options = {}) {
  const { repoOwner, repoName, prNumber, workflowFile, postToPr } = options;
  const resp = await api.post(
    "/api/predictions/predict",
    {
      workflow_yaml: yamlContent,
      repo_owner: repoOwner || null,
      repo_name: repoName || null,
      pr_number: prNumber || null,
      workflow_file: workflowFile || null,
    },
    { params: { post_to_pr: postToPr || false } }
  );
  return resp.data;
}

export async function predictRepoWorkflows(repoOwner, repoName, options = {}) {
  const { branch, prNumber, postToPr } = options;
  const resp = await api.post(
    "/api/predictions/predict-repo",
    {
      repo_owner: repoOwner,
      repo_name: repoName,
      branch: branch || "main",
      pr_number: prNumber || null,
    },
    { params: { post_to_pr: postToPr || false } }
  );
  return resp.data;
}

export async function getPredictionHistory(page = 1, pageSize = 20, filters = {}) {
  const params = { page, page_size: pageSize, ...filters };
  const resp = await api.get("/api/predictions/history", { params });
  return resp.data;
}

export async function getPrediction(id) {
  const resp = await api.get(`/api/predictions/${id}`);
  return resp.data;
}

export async function getModelInfo() {
  const resp = await api.get("/api/predictions/model/info");
  return resp.data;
}

// ─── Pricing ──────────────────────────────────────────────────────

export async function getPricing() {
  const resp = await api.get("/api/pricing/");
  return resp.data;
}

export async function refreshPricing() {
  const resp = await api.post("/api/pricing/refresh");
  return resp.data;
}

// ─── Health ───────────────────────────────────────────────────────

export async function checkHealth() {
  const resp = await api.get("/health");
  return resp.data;
}

export default api;
