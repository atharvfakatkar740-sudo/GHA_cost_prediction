import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  DollarSign,
  Activity,
  Cpu,
  ArrowRight,
  TrendingUp,
  Zap,
  Shield,
} from "lucide-react";
import { getPredictionHistory, getModelInfo, checkHealth } from "../services/api";
import { formatCost, formatDuration, formatDate } from "../utils/formatters";

export default function Dashboard() {
  const [recentPredictions, setRecentPredictions] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [healthy, setHealthy] = useState(null);
  const [stats, setStats] = useState({ total: 0, avgDuration: 0, avgCost: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [histResp, model, health] = await Promise.all([
          getPredictionHistory(1, 5).catch(() => ({ items: [], total: 0 })),
          getModelInfo().catch(() => null),
          checkHealth().catch(() => null),
        ]);
        setRecentPredictions(histResp.items || []);
        setModelInfo(model);
        setHealthy(health?.status === "healthy");

        const items = histResp.items || [];
        if (items.length > 0) {
          const avgD =
            items.reduce((s, i) => s + i.predicted_duration_minutes, 0) /
            items.length;
          const avgC =
            items.reduce((s, i) => s + i.estimated_cost_usd, 0) / items.length;
          setStats({ total: histResp.total, avgDuration: avgD, avgCost: avgC });
        } else {
          setStats({ total: histResp.total, avgDuration: 0, avgCost: 0 });
        }
      } catch {
        /* silent */
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8 fade-in">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="text-center py-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Predict CI/CD Costs{" "}
          <span className="text-brand-600 dark:text-brand-400">Before They Run</span>
        </h1>
        <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
          ML-powered pre-run cost estimation for GitHub Actions workflows.
          Paste your YAML, get instant duration &amp; cost predictions.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/predict" className="btn-primary text-base px-8 py-3">
            <Zap size={18} />
            Start Predicting
          </Link>
          <Link to="/history" className="btn-secondary text-base px-8 py-3">
            View History
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Stat Cards ────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Predictions"
          value={stats.total}
          color="brand"
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={formatDuration(stats.avgDuration)}
          color="blue"
        />
        <StatCard
          icon={DollarSign}
          label="Avg Cost"
          value={formatCost(stats.avgCost)}
          color="green"
        />
        <StatCard
          icon={Cpu}
          label="Model Status"
          value={modelInfo?.model_loaded ? modelInfo.model_name : "Heuristic"}
          color={modelInfo?.model_loaded ? "green" : "amber"}
          subtitle={
            healthy === true
              ? "System healthy"
              : healthy === false
              ? "System offline"
              : "Checking…"
          }
        />
      </section>

      {/* ── Feature Highlights ────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<Zap className="text-brand-600 dark:text-brand-400" size={28} />}
          title="Instant Predictions"
          desc="Get cost estimates in milliseconds by analyzing workflow YAML structure with trained ML models."
        />
        <FeatureCard
          icon={<TrendingUp className="text-emerald-600 dark:text-emerald-400" size={28} />}
          title="Live Pricing"
          desc="Pricing data is fetched directly from GitHub docs to reflect any billing changes automatically."
        />
        <FeatureCard
          icon={<Shield className="text-amber-600 dark:text-amber-400" size={28} />}
          title="PR Integration"
          desc="Automatic cost prediction comments on pull requests via GitHub webhooks for full team visibility."
        />
      </section>

      {/* ── Recent Predictions Table ──────────────────────────── */}
      {recentPredictions.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Recent Predictions
            </h2>
            <Link
              to="/history"
              className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-zinc-700 text-zinc-500">
                  <th className="text-left py-3 pr-4 font-medium">Repository</th>
                  <th className="text-left py-3 pr-4 font-medium">Workflow</th>
                  <th className="text-right py-3 pr-4 font-medium">Duration</th>
                  <th className="text-right py-3 pr-4 font-medium">Cost</th>
                  <th className="text-right py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentPredictions.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-surface-200 dark:border-zinc-700/50 hover:bg-surface-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {p.repo_owner}/{p.repo_name}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500 dark:text-zinc-400">
                      {p.workflow_file || "—"}
                    </td>
                    <td className="py-3 pr-4 text-right text-zinc-900 dark:text-white font-medium">
                      {formatDuration(p.predicted_duration_minutes)}
                    </td>
                    <td className="py-3 pr-4 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatCost(p.estimated_cost_usd)}
                    </td>
                    <td className="py-3 text-right text-zinc-400 dark:text-zinc-500 text-xs">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subtitle }) {
  const bg = {
    brand: "bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800/40",
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/40",
    green: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/40",
    amber: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40",
  };
  const iconColors = {
    brand: "text-brand-600 dark:text-brand-400",
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className={`rounded-2xl border p-5 ${bg[color]} transition-transform hover:scale-[1.02]`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon size={20} className={iconColors[color]} />
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value text-zinc-900 dark:text-white">{value}</div>
      {subtitle && (
        <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="card hover:border-brand-300 dark:hover:border-brand-700/60 transition-colors">
      <div className="mb-4">{icon}</div>
      <h3 className="text-zinc-900 dark:text-white font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{desc}</p>
    </div>
  );
}
