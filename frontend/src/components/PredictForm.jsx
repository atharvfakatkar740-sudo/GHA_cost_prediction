import React, { useState } from "react";
import {
  Wand2,
  Upload,
  GitBranch,
  Loader2,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { predictWorkflow, predictRepoWorkflows } from "../services/api";
import {
  formatCost,
  formatDuration,
  formatConfidence,
  getConfidenceColor,
  getOsIcon,
} from "../utils/formatters";

const SAMPLE_YAML = `name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
`;

export default function PredictForm() {
  const [mode, setMode] = useState("yaml"); // "yaml" | "repo"
  const [yamlContent, setYamlContent] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [branch, setBranch] = useState("main");
  const [workflowFile, setWorkflowFile] = useState("");
  const [postToPr, setPostToPr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      if (mode === "yaml") {
        if (!yamlContent.trim()) {
          setError("Please enter workflow YAML content");
          setLoading(false);
          return;
        }
        const result = await predictWorkflow(yamlContent, {
          repoOwner: repoOwner || undefined,
          repoName: repoName || undefined,
          prNumber: prNumber ? parseInt(prNumber) : undefined,
          workflowFile: workflowFile || undefined,
          postToPr,
        });
        setResults([result]);
        toast.success("Prediction complete!");
      } else {
        if (!repoOwner.trim() || !repoName.trim()) {
          setError("Please enter repository owner and name");
          setLoading(false);
          return;
        }
        const result = await predictRepoWorkflows(repoOwner, repoName, {
          branch,
          prNumber: prNumber ? parseInt(prNumber) : undefined,
          postToPr,
        });
        setResults(result);
        toast.success(`Predicted ${result.length} workflow(s)!`);
      }
    } catch (err) {
      const msg =
        err.response?.data?.detail || err.message || "Prediction failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setYamlContent(ev.target.result);
      setWorkflowFile(file.name);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Cost Prediction</h1>
        <p className="text-gray-400 mt-1">
          Analyze a workflow to estimate duration and cost before it runs.
        </p>
      </div>

      {/* ── Mode Toggle ─────────────────────────────────────────── */}
      <div className="flex gap-2 p-1 bg-surface-50 dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-zinc-700 w-fit">
        <button
          onClick={() => setMode("yaml")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === "yaml"
              ? "bg-brand-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Paste YAML
        </button>
        <button
          onClick={() => setMode("repo")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === "repo"
              ? "bg-brand-600 text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          From Repository
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === "yaml" ? (
          /* ── YAML Mode ──────────────────────────────────────── */
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Workflow YAML
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setYamlContent(SAMPLE_YAML)}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Load sample
                </button>
                <label className="text-xs text-brand-400 hover:text-brand-300 cursor-pointer flex items-center gap-1">
                  <Upload size={12} />
                  Upload file
                  <input
                    type="file"
                    accept=".yml,.yaml"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              placeholder="Paste your GitHub Actions workflow YAML here..."
              rows={16}
              className="textarea-field"
            />
          </div>
        ) : (
          /* ── Repo Mode ──────────────────────────────────────── */
          <div className="card space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Repository Owner
                </label>
                <input
                  type="text"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  placeholder="e.g. facebook"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="e.g. react"
                  className="input-field"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Branch
                </label>
                <div className="relative">
                  <GitBranch
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="input-field pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  PR Number (optional)
                </label>
                <input
                  type="number"
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                  placeholder="e.g. 42"
                  className="input-field"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Advanced Options ─────────────────────────────────── */}
        <div className="card">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors w-full"
          >
            {showAdvanced ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
            Advanced Options
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-4 pt-4 border-t border-surface-200 dark:border-zinc-700">
              {mode === "yaml" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Repo Owner
                    </label>
                    <input
                      type="text"
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                      placeholder="Optional"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Repo Name
                    </label>
                    <input
                      type="text"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="Optional"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      PR Number
                    </label>
                    <input
                      type="number"
                      value={prNumber}
                      onChange={(e) => setPrNumber(e.target.value)}
                      placeholder="Optional"
                      className="input-field"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="postToPr"
                  checked={postToPr}
                  onChange={(e) => setPostToPr(e.target.checked)}
                  className="rounded border-surface-300 dark:border-zinc-600 bg-white dark:bg-surface-800 text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="postToPr"
                  className="text-sm text-gray-300 cursor-pointer"
                >
                  Post prediction as a comment on the PR (requires GitHub token
                  &amp; repo/PR info)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Error ────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Submit ───────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary text-base px-8 py-3 w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              <Wand2 size={18} /> Predict Cost
            </>
          )}
        </button>
      </form>

      {/* ── Results ────────────────────────────────────────────── */}
      {results && results.length > 0 && (
        <div className="space-y-6 fade-in">
          {results.map((res, idx) => (
            <PredictionResultCard key={idx} result={res} />
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionResultCard({ result }) {
  const [copied, setCopied] = useState(false);

  const summaryText = `Duration: ${formatDuration(
    result.total_predicted_duration_minutes
  )} | Cost: ${formatCost(result.total_estimated_cost_usd)} | Jobs: ${
    result.num_jobs
  }`;

  function copyToClipboard() {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card space-y-6 pulse-glow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {result.workflow_file || "Prediction Result"}
            </h3>
            {result.repo_owner && result.repo_name && (
              <span className="text-sm text-gray-500 font-mono">
                {result.repo_owner}/{result.repo_name}
                {result.pr_number && ` #${result.pr_number}`}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={copyToClipboard}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs mb-1">
            <Clock size={14} /> Duration
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">
            {formatDuration(result.total_predicted_duration_minutes)}
          </div>
        </div>
        <div className="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs mb-1">
            <DollarSign size={14} /> Cost
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCost(result.total_estimated_cost_usd)}
          </div>
        </div>
        <div className="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-zinc-700">
          <div className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">Model</div>
          <div className="text-lg font-semibold text-zinc-900 dark:text-white">
            {result.model_used}
          </div>
        </div>
        <div className="bg-surface-50 dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-zinc-700">
          <div className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">Confidence</div>
          <div
            className={`text-lg font-semibold ${getConfidenceColor(
              result.confidence_score
            )}`}
          >
            {formatConfidence(result.confidence_score)}
          </div>
        </div>
      </div>

      {/* Job Breakdown */}
      {result.jobs && result.jobs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">
            Job Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-zinc-700 text-zinc-500">
                  <th className="text-left py-2.5 pr-4 font-medium">Job</th>
                  <th className="text-left py-2.5 pr-4 font-medium">Runner</th>
                  <th className="text-center py-2.5 pr-4 font-medium">Steps</th>
                  <th className="text-right py-2.5 pr-4 font-medium">Duration</th>
                  <th className="text-right py-2.5 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {result.jobs.map((job, i) => (
                  <tr
                    key={i}
                    className="border-b border-surface-200/60 dark:border-zinc-700/40 hover:bg-surface-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-300">
                      {job.job_name}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs">
                      {getOsIcon(job.runner_os)} {job.runner_type}
                    </td>
                    <td className="py-2.5 pr-4 text-center text-gray-400">
                      {job.step_count}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-white">
                      {formatDuration(job.predicted_duration_minutes)}
                    </td>
                    <td className="py-2.5 text-right text-green-400">
                      {formatCost(job.estimated_cost_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost Breakdown Info */}
      {result.cost_breakdown && (
        <div className="text-xs text-gray-500 flex flex-wrap gap-4 pt-2 border-t border-surface-200 dark:border-zinc-700">
          <span>
            Billing: {result.cost_breakdown.billing_model}
          </span>
          <span>
            Rounding: {result.cost_breakdown.rounding}
          </span>
          <span>
            Source: {result.cost_breakdown.pricing_source}
          </span>
        </div>
      )}
    </div>
  );
}
