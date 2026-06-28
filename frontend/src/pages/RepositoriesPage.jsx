import React, { useState, useEffect } from "react";
import {
  GitBranch, Plus, Trash2, Key, Copy, Check, ExternalLink,
  Calendar, DollarSign, Clock, BarChart2, TrendingUp, Loader2,
  AlertCircle, Webhook, Eye, EyeOff,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  trackRepository, listTrackedRepositories, getWebhookInfo,
  rotateWebhookSecret, untrackRepository, getRepoStats,
} from "../services/api";
import { formatCost, formatDuration } from "../utils/formatters";

const GH_COLORS = ["#39d0d8", "#3fb950", "#58a6ff", "#f0883e"];

function ChartTooltip({ active, payload, label, prefix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gh-surface2 border border-gh-border rounded-lg px-3 py-2 text-xs shadow-card">
      <div className="text-gh-muted mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#c9d1d9" }} className="font-semibold">
          {prefix}{typeof p.value === "number" ? p.value.toFixed(5) : p.value}
        </div>
      ))}
    </div>
  );
}

function WebhookSetupModal({ repo, webhook, onClose }) {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(null);

  function copy(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleRotate() {
    if (!confirm("Rotate webhook secret? You'll need to update GitHub.")) return;
    try {
      const data = await rotateWebhookSecret(repo.id);
      toast.success("Secret rotated");
      onClose(data);
    } catch {
      toast.error("Failed to rotate secret");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in">
      <div className="bg-gh-surface border border-gh-border rounded-xl max-w-2xl w-full shadow-card-hover overflow-hidden">
        <div className="px-6 py-4 border-b border-gh-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook size={18} className="text-gh-teal" />
            <h3 className="text-base font-semibold text-gh-text">Webhook Setup</h3>
          </div>
          <button onClick={() => onClose()} className="text-gh-muted hover:text-gh-text">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm text-gh-muted mb-3">
              Configure a webhook in <strong>{repo.repo_owner}/{repo.repo_name}</strong> on GitHub:
            </p>
            <a
              href={`https://github.com/${repo.repo_owner}/${repo.repo_name}/settings/hooks/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-xs inline-flex"
            >
              <ExternalLink size={13} /> Open GitHub Webhook Settings
            </a>
          </div>

          <div className="gh-divider" />

          <div>
            <label className="block text-xs font-medium text-gh-muted mb-1.5">Payload URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={webhook.payload_url}
                readOnly
                className="input-field flex-1 font-mono text-xs"
              />
              <button
                onClick={() => copy(webhook.payload_url, "URL")}
                className="btn-secondary text-xs px-3 py-2"
              >
                {copied === "URL" ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gh-muted mb-1.5">Content type</label>
            <input
              type="text"
              value={webhook.content_type}
              readOnly
              className="input-field font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gh-muted mb-1.5">Secret</label>
            <div className="flex items-center gap-2">
              <input
                type={showSecret ? "text" : "password"}
                value={webhook.secret}
                readOnly
                className="input-field flex-1 font-mono text-xs"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="btn-secondary text-xs px-3 py-2"
              >
                {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                onClick={() => copy(webhook.secret, "Secret")}
                className="btn-secondary text-xs px-3 py-2"
              >
                {copied === "Secret" ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gh-muted mb-1.5">Events</label>
            <div className="flex flex-wrap gap-2">
              {webhook.events.map(e => (
                <span key={e} className="badge-teal text-xs">{e}</span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={handleRotate} className="btn-secondary text-xs">
              <Key size={13} /> Rotate Secret
            </button>
            <button onClick={() => onClose()} className="btn-primary text-xs">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RepoStatsModal({ repo, onClose }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRepoStats(repo.id, days)
      .then(setStats)
      .catch(() => toast.error("Failed to load stats"))
      .finally(() => setLoading(false));
  }, [repo.id, days]);

  const costOverTime = stats?.cost_over_time?.map(d => ({
    date: d.date.slice(5),
    cost: d.total_cost_usd,
    count: d.prediction_count,
  })) ?? [];

  const costByWorkflow = stats?.cost_by_workflow ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 fade-in overflow-auto">
      <div className="bg-gh-surface border border-gh-border rounded-xl max-w-4xl w-full shadow-card-hover my-8">
        <div className="px-6 py-4 border-b border-gh-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-gh-teal" />
            <h3 className="text-base font-semibold text-gh-text">
              {repo.repo_owner}/{repo.repo_name}
            </h3>
          </div>
          <button onClick={onClose} className="text-gh-muted hover:text-gh-text">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Date selector */}
          <div className="flex items-center gap-2 justify-end">
            <Calendar size={14} className="text-gh-muted" />
            <span className="text-xs text-gh-muted">Last</span>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === d
                    ? "bg-gh-teal/20 text-gh-teal border border-gh-teal/30"
                    : "text-gh-muted hover:text-gh-text hover:bg-gh-surface2"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-gh-teal" />
            </div>
          ) : !stats || stats.total_predictions === 0 ? (
            <div className="text-center py-12">
              <AlertCircle size={32} className="text-gh-border mx-auto mb-2" />
              <p className="text-sm text-gh-muted">No predictions in the last {days} days</p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="glow-card-teal">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart2 size={14} className="text-gh-teal" />
                    <span className="stat-label text-xs">Predictions</span>
                  </div>
                  <div className="stat-value text-lg">{stats.total_predictions}</div>
                </div>
                <div className="glow-card-green">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-gh-green" />
                    <span className="stat-label text-xs">Total Cost</span>
                  </div>
                  <div className="stat-value text-lg">{formatCost(stats.total_cost_usd)}</div>
                </div>
                <div className="glow-card-orange">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} className="text-gh-orange" />
                    <span className="stat-label text-xs">Avg Duration</span>
                  </div>
                  <div className="stat-value text-lg">{formatDuration(stats.avg_duration_minutes)}</div>
                </div>
                <div className="glow-card-blue">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-gh-blue" />
                    <span className="stat-label text-xs">Avg Cost</span>
                  </div>
                  <div className="stat-value text-lg">{formatCost(stats.avg_cost_usd)}</div>
                </div>
              </div>

              {/* Charts */}
              {costOverTime.length > 0 && (
                <div className="chart-container">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} className="text-gh-teal" />
                    <span className="section-title text-sm">Daily Cost</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={costOverTime} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                      <Tooltip content={<ChartTooltip prefix="$" />} />
                      <Line type="monotone" dataKey="cost" stroke="#39d0d8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {costByWorkflow.length > 0 && (
                <div className="chart-container">
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch size={14} className="text-gh-green" />
                    <span className="section-title text-sm">Cost by Workflow</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={costByWorkflow.slice(0, 8).map(w => ({
                        name: w.workflow_file.length > 20 ? w.workflow_file.slice(0, 20) + "…" : w.workflow_file,
                        cost: w.total_cost_usd,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
                      <Tooltip content={<ChartTooltip prefix="$" />} />
                      <Bar dataKey="cost" fill="#3fb950" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Recent predictions */}
              {stats.recent_predictions?.length > 0 && (
                <div>
                  <div className="section-title text-sm mb-2">Recent Predictions</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {stats.recent_predictions.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs bg-gh-surface2 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gh-text truncate">{p.workflow_file || "Unknown"}</div>
                          <div className="text-gh-muted text-[10px]">
                            {p.branch} · {p.commit_sha?.slice(0, 7)} · {p.trigger_type}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div className="font-semibold text-gh-teal">{formatCost(p.estimated_cost_usd)}</div>
                          <div className="text-gh-muted text-[10px]">{formatDuration(p.predicted_duration_minutes)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RepositoriesPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [webhookModal, setWebhookModal] = useState(null);
  const [statsModal, setStatsModal] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate("/login"); return; }
    loadRepos();
  }, [isAuthenticated]);

  async function loadRepos() {
    setLoading(true);
    try {
      const data = await listTrackedRepositories();
      setRepos(data);
    } catch {
      toast.error("Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!owner.trim() || !name.trim()) {
      toast.error("Owner and name are required");
      return;
    }
    setAdding(true);
    try {
      const data = await trackRepository(owner.trim(), name.trim());
      toast.success("Repository tracked");
      setOwner("");
      setName("");
      setWebhookModal({ repo: data.repository, webhook: data.webhook });
      loadRepos();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to track repository");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(repo) {
    if (!confirm(`Stop tracking ${repo.repo_owner}/${repo.repo_name}?`)) return;
    try {
      await untrackRepository(repo.id);
      toast.success("Repository untracked");
      loadRepos();
    } catch {
      toast.error("Failed to untrack repository");
    }
  }

  async function showWebhook(repo) {
    try {
      const webhook = await getWebhookInfo(repo.id);
      setWebhookModal({ repo, webhook });
    } catch {
      toast.error("Failed to load webhook info");
    }
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <GitBranch size={22} className="text-gh-teal" /> Tracked Repositories
        </h1>
        <p className="text-sm text-gh-muted mt-1">
          Set up webhooks to automatically track workflow costs for your repositories.
        </p>
      </div>

      {/* Add repo form */}
      <div className="card">
        <div className="section-title flex items-center gap-2 mb-4">
          <Plus size={15} className="text-gh-teal" /> Track New Repository
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="owner"
            value={owner}
            onChange={e => setOwner(e.target.value)}
            className="input-field flex-1"
          />
          <input
            type="text"
            placeholder="repository"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input-field flex-1"
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="btn-primary px-4 py-2"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Track
          </button>
        </div>
      </div>

      {/* Repos list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-gh-teal" />
        </div>
      ) : repos.length === 0 ? (
        <div className="card text-center py-12">
          <GitBranch size={40} className="text-gh-border mx-auto mb-3" />
          <p className="text-gh-muted text-sm">No tracked repositories yet.</p>
          <p className="text-gh-muted text-xs mt-1">Add one above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {repos.map(repo => (
            <div key={repo.id} className="card hover:border-gh-teal/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gh-text text-sm truncate">
                    {repo.repo_owner}/{repo.repo_name}
                  </div>
                  <div className="text-xs text-gh-muted mt-0.5">
                    {repo.prediction_count} predictions · {formatCost(repo.total_cost_usd)} total
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => showWebhook(repo)}
                    className="p-1.5 text-gh-muted hover:text-gh-teal transition-colors rounded"
                    title="Webhook setup"
                  >
                    <Webhook size={14} />
                  </button>
                  <button
                    onClick={() => setStatsModal(repo)}
                    className="p-1.5 text-gh-muted hover:text-gh-blue transition-colors rounded"
                    title="View stats"
                  >
                    <BarChart2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(repo)}
                    className="p-1.5 text-gh-muted hover:text-gh-red transition-colors rounded"
                    title="Untrack"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gh-surface2 rounded-lg px-3 py-2">
                  <div className="text-gh-muted mb-0.5">Avg Duration</div>
                  <div className="font-semibold text-gh-text">
                    {repo.avg_duration_minutes > 0 ? formatDuration(repo.avg_duration_minutes) : "—"}
                  </div>
                </div>
                <div className="bg-gh-surface2 rounded-lg px-3 py-2">
                  <div className="text-gh-muted mb-0.5">Last Event</div>
                  <div className="font-semibold text-gh-text">
                    {repo.last_event_at
                      ? new Date(repo.last_event_at).toLocaleDateString()
                      : "Never"}
                  </div>
                </div>
              </div>

              {!repo.is_active && (
                <div className="mt-2 text-xs text-gh-yellow flex items-center gap-1">
                  <AlertCircle size={12} /> Inactive
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {webhookModal && (
        <WebhookSetupModal
          repo={webhookModal.repo}
          webhook={webhookModal.webhook}
          onClose={(newWebhook) => {
            if (newWebhook) setWebhookModal({ ...webhookModal, webhook: newWebhook });
            else setWebhookModal(null);
          }}
        />
      )}

      {statsModal && (
        <RepoStatsModal repo={statsModal} onClose={() => setStatsModal(null)} />
      )}
    </div>
  );
}
