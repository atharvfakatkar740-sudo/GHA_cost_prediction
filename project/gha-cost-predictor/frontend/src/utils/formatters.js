export function formatCost(usd) {
  if (usd === null || usd === undefined) return "$0.0000";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "0m";
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs}h ${mins}m`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatConfidence(score) {
  if (score === null || score === undefined) return "—";
  return `${Math.round(score * 100)}%`;
}

export function getConfidenceColor(score) {
  if (score >= 0.8) return "text-green-400";
  if (score >= 0.6) return "text-amber-400";
  return "text-red-400";
}

export function getConfidenceBadge(score) {
  if (score >= 0.8) return "badge-green";
  if (score >= 0.6) return "badge-amber";
  return "badge-red";
}

export function getOsIcon(os) {
  switch (os?.toLowerCase()) {
    case "linux":
    case "ubuntu":
      return "🐧";
    case "windows":
      return "🪟";
    case "macos":
    case "mac":
      return "🍎";
    default:
      return "💻";
  }
}

export function truncate(str, len = 40) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}
