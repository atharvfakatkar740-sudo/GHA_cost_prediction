import React, { useState, useEffect } from "react";
import { BarChart2, TrendingUp, DollarSign, Clock, GitBranch, Zap, Calendar } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { getMyStats } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatCost, formatDuration } from "../utils/formatters";

const GH_COLORS = ["#39d0d8", "#3fb950", "#58a6ff", "#f0883e", "#bc8cff", "#e3b341"];

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

export default function AnalyticsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate("/login"); return; }
    setLoading(true);
    getMyStats(days)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days, isAuthenticated]);

  const costOverTime = stats?.cost_over_time?.map(d => ({
    date: d.date.slice(5),
    cost: d.total_cost_usd,
    count: d.prediction_count,
  })) ?? [];

  const costByRepo = stats?.cost_by_repo ?? [];

  const pieData = costByRepo.slice(0, 6).map((r, i) => ({
    name: r.repo_name.length > 16 ? r.repo_name.slice(0, 16) + "…" : r.repo_name,
    value: r.total_cost_usd,
    color: GH_COLORS[i % GH_COLORS.length],
  }));

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart2 size={22} className="text-gh-teal" /> Analytics
          </h1>
          <p className="text-sm text-gh-muted mt-1">Detailed cost and usage analytics for your workflows.</p>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-2">
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gh-teal" />
        </div>
      ) : !stats || stats.total_predictions === 0 ? (
        <div className="card text-center py-16">
          <BarChart2 size={40} className="text-gh-border mx-auto mb-3" />
          <p className="text-gh-muted text-sm">No prediction data for the last {days} days.</p>
          <button onClick={() => navigate("/predict")} className="btn-primary mt-4 inline-flex">
            <Zap size={14} /> Make a prediction
          </button>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glow-card-teal">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 size={16} className="text-gh-teal" />
                <span className="stat-label">Predictions</span>
              </div>
              <div className="stat-value">{stats.total_predictions}</div>
              <div className="text-xs text-gh-muted mt-1">last {days} days</div>
            </div>
            <div className="glow-card-green">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-gh-green" />
                <span className="stat-label">Total Spend</span>
              </div>
              <div className="stat-value">{formatCost(stats.total_cost_usd)}</div>
              <div className="text-xs text-gh-muted mt-1">last {days} days</div>
            </div>
            <div className="glow-card-orange">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-gh-orange" />
                <span className="stat-label">Avg Duration</span>
              </div>
              <div className="stat-value">{formatDuration(stats.avg_duration_minutes)}</div>
              <div className="text-xs text-gh-muted mt-1">per workflow</div>
            </div>
            <div className="glow-card-blue">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-gh-blue" />
                <span className="stat-label">Avg Cost</span>
              </div>
              <div className="stat-value">{formatCost(stats.avg_cost_usd)}</div>
              <div className="text-xs text-gh-muted mt-1">per prediction</div>
            </div>
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cost over time */}
            {costOverTime.length > 0 && (
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={15} className="text-gh-teal" />
                  <span className="section-title">Daily Cost</span>
                  <span className="text-xs text-gh-muted ml-auto">{days} days</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={costOverTime} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                    <Tooltip content={<ChartTooltip prefix="$" />} />
                    <Line type="monotone" dataKey="cost" stroke="#39d0d8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#39d0d8", strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Predictions per day */}
            {costOverTime.length > 0 && (
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={15} className="text-gh-blue" />
                  <span className="section-title">Daily Predictions</span>
                  <span className="text-xs text-gh-muted ml-auto">{days} days</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={costOverTime} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" fill="#58a6ff" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Charts row 2 */}
          {costByRepo.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Horizontal bar — cost per repo */}
              <div className="chart-container">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch size={15} className="text-gh-green" />
                  <span className="section-title">Cost by Repository</span>
                  <span className="text-xs text-gh-muted ml-auto">top 10</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={costByRepo.slice(0, 10).map(r => ({
                      name: r.repo_name.length > 16 ? r.repo_name.slice(0, 16) + "…" : r.repo_name,
                      cost: r.total_cost_usd,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip content={<ChartTooltip prefix="$" />} />
                    <Bar dataKey="cost" fill="#3fb950" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              {pieData.length > 0 && (
                <div className="chart-container">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign size={15} className="text-gh-orange" />
                    <span className="section-title">Spend Distribution</span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0];
                          return (
                            <div className="bg-gh-surface2 border border-gh-border rounded-lg px-3 py-2 text-xs">
                              <div className="text-gh-text font-semibold">{d.name}</div>
                              <div className="text-gh-muted">${d.value?.toFixed(5)}</div>
                            </div>
                          );
                        }}
                      />
                      <Legend
                        formatter={(v) => <span style={{ color: "#8b949e", fontSize: 11 }}>{v}</span>}
                        iconType="circle"
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Savings tip */}
          {stats.savings_tip && (
            <div className="flex items-start gap-3 bg-gh-yellow/8 border border-gh-yellow/20 rounded-xl px-4 py-3">
              <Zap size={15} className="text-gh-yellow flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gh-text leading-relaxed">{stats.savings_tip}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
