import React, { useState, useEffect, useCallback } from "react";
import {
  History,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Clock,
  DollarSign,
  ExternalLink,
  GitBranch,
  Webhook,
} from "lucide-react";
import { getPredictionHistory, getMyPredictions } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  formatCost,
  formatDuration,
  formatDate,
  getOsIcon,
  truncate,
} from "../utils/formatters";

export default function PredictionHistory() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [filterOwner, setFilterOwner] = useState("");
  const [filterRepo, setFilterRepo] = useState("");
  const [searchApplied, setSearchApplied] = useState(false);
  const { isAuthenticated } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let resp;
      if (isAuthenticated) {
        resp = await getMyPredictions(page, pageSize);
      } else {
        const filters = {};
        if (filterOwner.trim()) filters.repo_owner = filterOwner.trim();
        if (filterRepo.trim()) filters.repo_name = filterRepo.trim();
        resp = await getPredictionHistory(page, pageSize, filters);
      }
      setItems(resp.items || []);
      setTotal(resp.total || 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchApplied, isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setSearchApplied((v) => !v);
  }

  function clearFilters() {
    setFilterOwner("");
    setFilterRepo("");
    setPage(1);
    setSearchApplied((v) => !v);
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <History size={22} className="text-gh-teal" />
            {isAuthenticated ? "My Predictions" : "Prediction History"}
          </h1>
          <p className="text-gh-muted text-sm mt-1">
            {isAuthenticated
              ? `Your predictions — ${total} total records`
              : `All predictions — ${total} total records`}
          </p>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      {!isAuthenticated && (
        <form
          onSubmit={handleSearch}
          className="card flex flex-col sm:flex-row items-end gap-4"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-gh-muted mb-1">Repository Owner</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gh-muted" />
              <input
                type="text" value={filterOwner}
                onChange={(e) => setFilterOwner(e.target.value)}
                placeholder="Filter by owner..."
                className="input-field pl-9"
              />
            </div>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-gh-muted mb-1">Repository Name</label>
            <input
              type="text" value={filterRepo}
              onChange={(e) => setFilterRepo(e.target.value)}
              placeholder="Filter by repo..."
              className="input-field"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              <Filter size={14} /> Filter
            </button>
            {(filterOwner || filterRepo) && (
              <button type="button" onClick={clearFilters} className="btn-secondary">Clear</button>
            )}
          </div>
        </form>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-gh-teal" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gh-muted">
            <History size={36} className="mb-3 opacity-30" />
            <p className="text-sm">No predictions found.</p>
            <p className="text-xs mt-1">Run a prediction to see results here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gh-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Repository</th>
                  <th>Workflow</th>
                  <th>Runner</th>
                  <th className="text-center">Jobs</th>
                  <th>Trigger</th>
                  <th>Branch</th>
                  <th className="text-right">Duration</th>
                  <th className="text-right">Cost</th>
                  <th>Model</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td className="text-gh-muted font-mono text-xs">#{p.id}</td>
                    <td>
                      <span className="font-mono text-xs text-gh-blue">
                        {truncate(`${p.repo_owner}/${p.repo_name}`, 30)}
                      </span>
                      {p.pr_number && (
                        <span className="ml-1.5 badge-blue">PR #{p.pr_number}</span>
                      )}
                    </td>
                    <td className="text-gh-muted text-xs">{p.workflow_file || "—"}</td>
                    <td className="text-gh-muted text-xs">
                      {getOsIcon(p.runner_type)} {truncate(p.runner_type, 20)}
                    </td>
                    <td className="text-center text-gh-muted">{p.num_jobs ?? "—"}</td>
                    <td><TriggerBadge type={p.trigger_type} /></td>
                    <td className="text-xs text-gh-muted">
                      {p.branch ? (
                        <span className="inline-flex items-center gap-1">
                          <GitBranch size={11} />
                          {truncate(p.branch, 20)}
                        </span>
                      ) : "—"}
                      {p.commit_sha && (
                        <span className="ml-1.5 font-mono text-[10px] text-gh-border">
                          {p.commit_sha.slice(0, 7)}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-1 text-gh-orange font-medium">
                        <Clock size={11} />
                        {formatDuration(p.predicted_duration_minutes)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-1 text-gh-green font-medium">
                        <DollarSign size={11} />
                        {formatCost(p.estimated_cost_usd).replace("$", "")}
                      </span>
                    </td>
                    <td><span className="badge-blue">{p.model_used || "—"}</span></td>
                    <td className="text-right text-gh-muted text-xs whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gh-border">
            <span className="text-xs text-gh-muted">
              Page {page} of {totalPages} ({total} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TriggerBadge({ type }) {
  const config = {
    push: { label: "Push", cls: "badge-orange" },
    pull_request: { label: "PR", cls: "badge-blue" },
    workflow_run: { label: "Run", cls: "badge-green" },
    manual: { label: "Manual", cls: "badge-muted" },
  };
  const { label, cls } = config[type] || { label: type || "—", cls: "badge-muted" };
  return <span className={cls}>{label}</span>;
}
