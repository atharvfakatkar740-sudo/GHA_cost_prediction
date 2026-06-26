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
  Lightbulb,
  GitBranch,
  BarChart2,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getMyPredictions, getPredictionHistory, getModelInfo, checkHealth, getMyStats } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatCost, formatDuration, formatDate } from "../utils/formatters";

// ── Custom chart tooltip ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label, prefix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gh-surface2 border border-gh-border rounded-lg px-3 py-2 text-xs shadow-card">
      <div className="text-gh-muted mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-gh-text font-semibold">
          {prefix}{typeof p.value === "number" ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
}

// ── Authenticated personal dashboard ─────────────────────────────────
function PersonalDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, histResp] = await Promise.all([
          getMyStats(30).catch(() => null),
          getMyPredictions(1, 5).catch(() => ({ items: [] })),
        ]);
        setStats(statsData);
        setRecent(histResp.items || []);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gh-muted text-sm animate-pulse">Loading your dashboard…</div>
      </div>
    );
  }

  const costOverTime = stats?.cost_over_time?.map(d => ({
    date: d.date.slice(5),
    cost: d.total_cost_usd,
  })) ?? [];

  const costByRepo = stats?.cost_by_repo?.slice(0, 5).map(r => ({
    name: r.repo_name.length > 14 ? r.repo_name.slice(0, 14) + "…" : r.repo_name,
    cost: r.total_cost_usd,
  })) ?? [];

  return (
    <div className="space-y-6 fade-in">
      {/* Greeting + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            {greeting()}, <span className="text-gh-teal">{user.full_name?.split(" ")[0]}</span>
          </h1>
          <p className="text-sm text-gh-muted mt-1">Here's your workflow cost overview for the last 30 days.</p>
        </div>
        <Link to="/predict" className="btn-primary px-4 py-2 self-start sm:self-auto">
          <Zap size={14} /> New Prediction
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          glowClass="glow-card-teal"
          icon={<Activity size={18} className="text-gh-teal" />}
          label="Total Predictions"
          value={stats?.total_predictions ?? 0}
          sub="last 30 days"
        />
        <KpiCard
          glowClass="glow-card-green"
          icon={<DollarSign size={18} className="text-gh-green" />}
          label="Total Spend"
          value={formatCost(stats?.total_cost_usd ?? 0)}
          sub="last 30 days"
        />
        <KpiCard
          glowClass="glow-card-orange"
          icon={<Clock size={18} className="text-gh-orange" />}
          label="Avg Duration"
          value={formatDuration(stats?.avg_duration_minutes ?? 0)}
          sub="per workflow"
        />
        <KpiCard
          glowClass="glow-card-blue"
          icon={<Cpu size={18} className="text-gh-blue" />}
          label="Top Runner"
          value={stats?.top_runner ?? "—"}
          sub="most used"
        />
      </div>

      {/* Charts row */}
      {(costOverTime.length > 0 || costByRepo.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cost over time */}
          {costOverTime.length > 0 && (
            <div className="chart-container">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={15} className="text-gh-teal" />
                <span className="section-title">Cost Over Time</span>
                <span className="text-xs text-gh-muted ml-auto">30 days</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={costOverTime} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                  <Tooltip content={<ChartTooltip prefix="$" />} />
                  <Line
                    type="monotone" dataKey="cost" stroke="#39d0d8" strokeWidth={2}
                    dot={false} activeDot={{ r: 4, fill: "#39d0d8", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Cost by repo */}
          {costByRepo.length > 0 && (
            <div className="chart-container">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch size={15} className="text-gh-green" />
                <span className="section-title">Cost by Repository</span>
                <span className="text-xs text-gh-muted ml-auto">top 5</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={costByRepo} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip content={<ChartTooltip prefix="$" />} />
                  <Bar dataKey="cost" fill="#3fb950" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Savings tip */}
      {stats?.savings_tip && (
        <div className="flex items-start gap-3 bg-gh-yellow/8 border border-gh-yellow/20 rounded-xl px-4 py-3">
          <Lightbulb size={16} className="text-gh-yellow flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gh-text leading-relaxed">{stats.savings_tip}</p>
        </div>
      )}

      {/* Recent predictions */}
      {recent.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="section-title">Recent Predictions</span>
            <Link to="/history" className="text-xs text-gh-blue hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="gh-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Workflow</th>
                  <th className="text-right">Duration</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs text-gh-blue">{p.repo_owner}/{p.repo_name}</td>
                    <td className="text-gh-muted">{p.workflow_file || "—"}</td>
                    <td className="text-right font-medium text-gh-orange">{formatDuration(p.predicted_duration_minutes)}</td>
                    <td className="text-right font-medium text-gh-green">{formatCost(p.estimated_cost_usd)}</td>
                    <td className="text-right text-gh-muted text-xs">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recent.length === 0 && !loading && (
        <div className="card text-center py-10">
          <BarChart2 size={32} className="text-gh-border mx-auto mb-3" />
          <p className="text-gh-muted text-sm">No predictions yet.</p>
          <Link to="/predict" className="btn-primary mt-4 inline-flex">
            <Zap size={14} /> Make your first prediction
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Public landing (unauthenticated) ─────────────────────────────────
function LandingDashboard() {
  const [modelInfo, setModelInfo] = useState(null);
  const [healthy, setHealthy] = useState(null);

  useEffect(() => {
    Promise.all([
      getModelInfo().catch(() => null),
      checkHealth().catch(() => null),
    ]).then(([model, health]) => {
      setModelInfo(model);
      setHealthy(health?.status === "healthy");
    });
  }, []);

  return (
    <div className="space-y-8 fade-in">
      {/* Hero */}
      <section className="text-center py-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gh-teal/10 border border-gh-teal/20 text-gh-teal text-xs font-semibold mb-4">
          <span className="status-dot-teal" />
          ML-Powered · {healthy === true ? "System Online" : healthy === false ? "Offline" : "Checking…"}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gh-text tracking-tight leading-tight">
          Predict CI/CD Costs<br />
          <span className="text-gh-teal">Before They Run</span>
        </h1>
        <p className="mt-4 text-base text-gh-muted max-w-xl mx-auto leading-relaxed">
          ML-powered pre-run cost estimation for GitHub Actions workflows.
          Paste your YAML, get instant duration &amp; cost predictions.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/predict" className="btn-primary px-6 py-2.5 text-sm">
            <Zap size={15} /> Start Predicting
          </Link>
          <Link to="/register" className="btn-secondary px-6 py-2.5 text-sm">
            Create Account <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Status card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glow-card-teal text-center">
          <div className="text-2xl font-bold text-gh-teal">
            {modelInfo?.model_loaded ? modelInfo.model_name : "Heuristic"}
          </div>
          <div className="stat-label mt-1">Active Model</div>
        </div>
        <div className="glow-card-green text-center">
          <div className="text-2xl font-bold text-gh-green">
            {modelInfo?.feature_count ?? "18"}
          </div>
          <div className="stat-label mt-1">Features Used</div>
        </div>
        <div className="glow-card-blue text-center">
          <div className="text-2xl font-bold text-gh-blue">
            {healthy === true ? "Online" : healthy === false ? "Offline" : "—"}
          </div>
          <div className="stat-label mt-1">System Status</div>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          icon={<Zap size={22} className="text-gh-teal" />}
          title="Instant Predictions"
          desc="Analyze workflow YAML structure in milliseconds. Get cost estimates before committing a single line."
        />
        <FeatureCard
          icon={<TrendingUp size={22} className="text-gh-green" />}
          title="Live GitHub Pricing"
          desc="Pricing data synced from GitHub docs. Always reflects current runner billing rates."
        />
        <FeatureCard
          icon={<Shield size={22} className="text-gh-blue" />}
          title="PR Integration"
          desc="Automatic cost comments on pull requests via GitHub webhooks for full team cost visibility."
        />
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return null;

  return isAuthenticated
    ? <PersonalDashboard user={user} />
    : <LandingDashboard />;
}

// ── Sub-components ────────────────────────────────────────────────────
function KpiCard({ glowClass, icon, label, value, sub }) {
  return (
    <div className={glowClass}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="text-xs text-gh-muted mt-1">{sub}</div>}
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="card-hover">
      <div className="mb-3">{icon}</div>
      <div className="section-title mb-1.5">{title}</div>
      <p className="text-sm text-gh-muted leading-relaxed">{desc}</p>
    </div>
  );
}
