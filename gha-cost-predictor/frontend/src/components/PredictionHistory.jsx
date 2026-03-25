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
import { getPredictionHistory } from "../services/api";
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (filterOwner.trim()) filters.repo_owner = filterOwner.trim();
      if (filterRepo.trim()) filters.repo_name = filterRepo.trim();
      const resp = await getPredictionHistory(page, pageSize, filters);
      setItems(resp.items || []);
      setTotal(resp.total || 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchApplied]);

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
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <History size={28} className="text-brand-400" />
          Prediction History
        </h1>
        <p className="text-gray-400 mt-1">
          Browse all past cost predictions — {total} total records.
        </p>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        className="card flex flex-col sm:flex-row items-end gap-4"
      >
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Repository Owner
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              placeholder="Filter by owner..."
              className="input-field pl-9 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Repository Name
          </label>
          <input
            type="text"
            value={filterRepo}
            onChange={(e) => setFilterRepo(e.target.value)}
            placeholder="Filter by repo..."
            className="input-field text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-sm px-4 py-2.5">
            <Filter size={14} /> Filter
          </button>
          {(filterOwner || filterRepo) && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary text-sm px-4 py-2.5"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <History size={40} className="mb-3 opacity-30" />
            <p>No predictions found.</p>
            <p className="text-xs mt-1">
              Run a prediction to see results here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-github-dark/50 border-b border-github-border text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">ID</th>
                  <th className="text-left py-3 px-4 font-medium">
                    Repository
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Workflow</th>
                  <th className="text-left py-3 px-4 font-medium">Runner</th>
                  <th className="text-center py-3 px-4 font-medium">Jobs</th>
                  <th className="text-left py-3 px-4 font-medium">Trigger</th>
                  <th className="text-left py-3 px-4 font-medium">Branch</th>
                  <th className="text-right py-3 px-4 font-medium">
                    Duration
                  </th>
                  <th className="text-right py-3 px-4 font-medium">Cost</th>
                  <th className="text-left py-3 px-4 font-medium">Model</th>
                  <th className="text-right py-3 px-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-github-border/40 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                      #{p.id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-gray-300">
                        {truncate(`${p.repo_owner}/${p.repo_name}`, 30)}
                      </span>
                      {p.pr_number && (
                        <span className="ml-1.5 badge-blue text-[10px]">
                          PR #{p.pr_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {p.workflow_file || "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {getOsIcon(p.runner_type)} {truncate(p.runner_type, 20)}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-400">
                      {p.num_jobs ?? "—"}
                    </td>
                    <td className="py-3 px-4">
                      <TriggerBadge type={p.trigger_type} />
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {p.branch ? (
                        <span className="inline-flex items-center gap-1">
                          <GitBranch size={11} className="text-gray-500" />
                          {truncate(p.branch, 20)}
                        </span>
                      ) : "—"}
                      {p.commit_sha && (
                        <span className="ml-1.5 font-mono text-[10px] text-gray-600">
                          {p.commit_sha.slice(0, 7)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-white font-medium">
                        <Clock size={12} className="text-blue-400" />
                        {formatDuration(p.predicted_duration_minutes)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-green-400 font-medium">
                        <DollarSign size={12} />
                        {formatCost(p.estimated_cost_usd).replace("$", "")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge-blue text-[10px]">
                        {p.model_used || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────── */}
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-github-border bg-github-dark/30">
            <span className="text-xs text-gray-500">
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
    push: { label: "Push", cls: "badge-amber" },
    pull_request: { label: "PR", cls: "badge-blue" },
    workflow_run: { label: "Run", cls: "badge-green" },
    manual: { label: "Manual", cls: "badge-blue" },
  };
  const { label, cls } = config[type] || { label: type || "—", cls: "badge-blue" };
  return <span className={`${cls} text-[10px]`}>{label}</span>;
}
