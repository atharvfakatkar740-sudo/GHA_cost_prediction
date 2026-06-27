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

// ─── Auth ─────────────────────────────────────────────────────────

export async function registerUser(email, fullName, password) {
  const resp = await api.post("/api/auth/register", {
    email, full_name: fullName, password,
  });
  return resp.data;
}

export async function loginUser(email, password) {
  const resp = await api.post("/api/auth/login", { email, password });
  return resp.data;
}

export async function forgotPassword(email) {
  const resp = await api.post("/api/auth/forgot-password", { email });
  return resp.data;
}

export async function resetPassword(token, newPassword) {
  const resp = await api.post("/api/auth/reset-password", {
    token, new_password: newPassword,
  });
  return resp.data;
}

export async function getMyPredictions(page = 1, pageSize = 20) {
  const resp = await api.get("/api/predictions/me", {
    params: { page, page_size: pageSize },
  });
  return resp.data;
}

export async function getMyStats(days = 30) {
  const resp = await api.get("/api/predictions/stats/me", {
    params: { days },
  });
  return resp.data;
}

// ─── Health ───────────────────────────────────────────────────────

export async function checkHealth() {
  const resp = await api.get("/health");
  return resp.data;
}

export default api;
