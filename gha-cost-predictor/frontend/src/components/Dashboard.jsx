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
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Predict CI/CD Costs{" "}
          <span className="text-brand-400">Before They Run</span>
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
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
          icon={<Zap className="text-brand-400" size={28} />}
          title="Instant Predictions"
          desc="Get cost estimates in milliseconds by analyzing workflow YAML structure with trained ML models."
        />
        <FeatureCard
          icon={<TrendingUp className="text-green-400" size={28} />}
          title="Live Pricing"
          desc="Pricing data is fetched directly from GitHub docs to reflect any billing changes automatically."
        />
        <FeatureCard
          icon={<Shield className="text-amber-400" size={28} />}
          title="PR Integration"
          desc="Automatic cost prediction comments on pull requests via GitHub webhooks for full team visibility."
        />
      </section>

      {/* ── Recent Predictions Table ──────────────────────────── */}
      {recentPredictions.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Recent Predictions
            </h2>
            <Link
              to="/history"
              className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-github-border text-gray-500">
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
                    className="border-b border-github-border/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-gray-300">
                      {p.repo_owner}/{p.repo_name}
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {p.workflow_file || "—"}
                    </td>
                    <td className="py-3 pr-4 text-right text-white font-medium">
                      {formatDuration(p.predicted_duration_minutes)}
                    </td>
                    <td className="py-3 pr-4 text-right text-green-400 font-medium">
                      {formatCost(p.estimated_cost_usd)}
                    </td>
                    <td className="py-3 text-right text-gray-500 text-xs">
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
  const colors = {
    brand: "from-brand-600/20 to-brand-600/5 border-brand-600/30",
    blue: "from-blue-600/20 to-blue-600/5 border-blue-600/30",
    green: "from-green-600/20 to-green-600/5 border-green-600/30",
    amber: "from-amber-600/20 to-amber-600/5 border-amber-600/30",
  };
  const iconColors = {
    brand: "text-brand-400",
    blue: "text-blue-400",
    green: "text-green-400",
    amber: "text-amber-400",
  };
  return (
    <div
      className={`rounded-xl border p-5 bg-gradient-to-br ${colors[color]} transition-transform hover:scale-[1.02]`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Icon size={20} className={iconColors[color]} />
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value text-white">{value}</div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="card hover:border-brand-600/40 transition-colors">
      <div className="mb-4">{icon}</div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}
