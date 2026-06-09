export const NODE_COLORS: Record<string, string> = {
  entry_point: "#22c55e",
  component: "#3b82f6",
  service: "#f97316",
  utility: "#94a3b8",
  config: "#a855f7",
  test: "#eab308",
};

export const LANGUAGE_COLORS: Record<string, string> = {
  python: "#3776ab",
  javascript: "#f7df1e",
  typescript: "#3178c6",
  tsx: "#3178c6",
  jsx: "#61dafb",
  markdown: "#083fa1",
  json: "#292929",
};

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}
