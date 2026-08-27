/** Formatting helpers shared by every editor in this package. */

/**
 * Stringify an `unknown` safely.
 *
 * `String(value)` on an object produces "[object Object]" and trips
 * oxlint's `typescript/no-base-to-string`, so route everything through here.
 */
export function str(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** Format a money amount. Amount_Money is a plain number in this toolchain. */
export function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value == null) return "—";

  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return currency ? `${currency} ${formatted}` : formatted;
}

/** Compact money for KPI tiles: 4.82M / 318k / 940. */
export function formatMoneyCompact(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value == null) return "—";

  const prefix = currency ? `${currency} ` : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}k`;

  return `${prefix}${value.toFixed(0)}`;
}

/** Format a signed delta, e.g. "+61.0k" / "-4.2k". */
export function formatDelta(
  value: number | null | undefined,
  currency?: string | null,
): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatMoneyCompact(Math.abs(value), currency)}`;
}

/** Format a quantity with a sensible number of decimals. */
export function formatQuantity(value: number | null | undefined): string {
  if (value == null) return "—";

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

/** "3 minutes ago" style relative time, for the version feed. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return value;

  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

/** Shorten a content hash for display: "a1b2c3d…e4f5". */
export function shortHash(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

/** Build a CSV document from a header row and body rows. */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (cell: string | number | null | undefined): string => {
    const text = cell == null ? "" : String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");
}

/** Trigger a client-side download of a text file. */
export function downloadText(
  filename: string,
  contents: string,
  mimeType = "text/csv;charset=utf-8",
) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
