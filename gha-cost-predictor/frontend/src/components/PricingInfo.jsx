import React, { useState, useEffect } from "react";
import {
  DollarSign,
  RefreshCw,
  Loader2,
  Monitor,
  Server,
  Cpu,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { getPricing, refreshPricing } from "../services/api";
import { formatDate } from "../utils/formatters";

export default function PricingInfo() {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all | linux | windows | macos

  useEffect(() => {
    fetchPricing();
  }, []);

  async function fetchPricing() {
    setLoading(true);
    try {
      const data = await getPricing();
      setPricing(data);
    } catch {
      toast.error("Failed to load pricing");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshPricing();
      await fetchPricing();
      toast.success("Pricing refreshed from GitHub");
    } catch {
      toast.error("Failed to refresh pricing");
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = pricing?.runners?.filter((r) => {
    if (filter === "all") return true;
    return r.os_type === filter;
  }) || [];

  const grouped = {
    standard: filtered.filter(
      (r) => !r.is_arm && !r.is_gpu && (r.cpu_cores || 0) <= 3
    ),
    larger: filtered.filter(
      (r) => !r.is_arm && !r.is_gpu && (r.cpu_cores || 0) > 3
    ),
    arm: filtered.filter((r) => r.is_arm),
    gpu: filtered.filter((r) => r.is_gpu),
  };

  const osIcons = {
    linux: <Server size={14} className="text-amber-400" />,
    windows: <Monitor size={14} className="text-blue-400" />,
    macos: <Cpu size={14} className="text-gray-300" />,
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign size={28} className="text-green-400" />
            Runner Pricing
          </h1>
          <p className="text-gray-400 mt-1">
            Live GitHub Actions runner per-minute costs used for calculations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pricing?.last_updated && (
            <span className="text-xs text-gray-500">
              Updated: {formatDate(pricing.last_updated)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary text-sm"
          >
            {refreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh
          </button>
          <a
            href="https://docs.github.com/en/billing/reference/actions-runner-pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            <ExternalLink size={14} /> GitHub Docs
          </a>
        </div>
      </div>

      {/* OS Filter */}
      <div className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-zinc-700 w-fit">
        {["all", "linux", "windows", "macos"].map((os) => (
          <button
            key={os}
            onClick={() => setFilter(os)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all ${
              filter === os
                ? "bg-brand-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {os}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Standard Runners */}
          {grouped.standard.length > 0 && (
            <PricingSection
              title="Standard Runners"
              description="Included with GitHub plans (Linux free for public repos)"
              runners={grouped.standard}
              osIcons={osIcons}
            />
          )}

          {/* Larger Runners */}
          {grouped.larger.length > 0 && (
            <PricingSection
              title="Larger x64 Runners"
              description="Higher compute runners for demanding workloads"
              runners={grouped.larger}
              osIcons={osIcons}
            />
          )}

          {/* ARM Runners */}
          {grouped.arm.length > 0 && (
            <PricingSection
              title="ARM Runners"
              description="ARM64-powered runners with lower per-minute costs"
              runners={grouped.arm}
              osIcons={osIcons}
            />
          )}

          {/* GPU Runners */}
          {grouped.gpu.length > 0 && (
            <PricingSection
              title="GPU Runners"
              description="GPU-accelerated runners for ML/AI workloads"
              runners={grouped.gpu}
              osIcons={osIcons}
            />
          )}
        </div>
      )}

      {/* Billing Info */}
      <div className="card bg-brand-600/5 border-brand-600/20">
        <h3 className="text-white font-semibold mb-2">Billing Notes</h3>
        <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside">
          <li>
            GitHub rounds minutes up to the nearest whole minute for billing.
          </li>
          <li>
            Standard runners are free for public repositories.
          </li>
          <li>
            Larger runners are always charged, even for public repos.
          </li>
          <li>
            Windows and macOS runners cost more than Linux runners.
          </li>
          <li>
            Pricing shown is per-minute of workflow execution time.
          </li>
        </ul>
      </div>
    </div>
  );
}

function PricingSection({ title, description, runners, osIcons }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50 dark:bg-surface-900/50 border-y border-surface-200 dark:border-zinc-700 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left py-2.5 px-6 font-medium">Runner SKU</th>
              <th className="text-left py-2.5 px-4 font-medium">OS</th>
              <th className="text-center py-2.5 px-4 font-medium">Cores</th>
              <th className="text-right py-2.5 px-6 font-medium">
                Cost / Minute
              </th>
              <th className="text-right py-2.5 px-6 font-medium">
                Cost / Hour
              </th>
            </tr>
          </thead>
          <tbody>
            {runners
              .sort((a, b) => a.per_minute_cost_usd - b.per_minute_cost_usd)
              .map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-surface-200/50 dark:border-zinc-700/30 hover:bg-surface-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="py-3 px-6 font-mono text-xs text-gray-300">
                    {r.runner_sku}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 capitalize">
                      {osIcons[r.os_type]} {r.os_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-400">
                    {r.cpu_cores || "—"}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-green-400 font-medium">
                    ${r.per_minute_cost_usd.toFixed(4)}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-gray-400">
                    ${(r.per_minute_cost_usd * 60).toFixed(2)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
