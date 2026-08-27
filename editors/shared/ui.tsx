import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDelta } from "./format.js";

/**
 * The rendered width of an element.
 *
 * Charts use it to draw at their real pixel size: scaling an SVG by aspect ratio
 * either blows the height out or shrinks the labels, and neither is readable.
 */
export function useElementWidth<T extends HTMLElement>(): [
  (node: T | null) => void,
  number,
] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const attach = useCallback((node: T | null) => {
    observer.current?.disconnect();

    if (!node) return;

    setWidth(node.clientWidth);
    observer.current = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.current.observe(node);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [attach, width];
}

/* ------------------------------------------------------------------ layout */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white text-slate-900 dark:text-slate-100 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-600">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {title}
      </p>
      {hint && (
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- KPIs */

export function KpiTile({
  label,
  value,
  delta,
  currency,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  currency?: string | null;
  hint?: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "text-slate-900 dark:text-slate-100",
    positive: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  }[tone];

  const deltaTone =
    delta == null || delta === 0
      ? "text-slate-400 dark:text-slate-500"
      : delta > 0
        ? "text-red-600 dark:text-red-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white text-slate-900 dark:text-slate-100 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
      <FieldLabel>{label}</FieldLabel>
      <div className={`mt-1 truncate text-lg font-semibold ${toneClass}`}>
        {value}
      </div>
      {delta != null && (
        <div className={`mt-0.5 text-xs font-medium ${deltaTone}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"}{" "}
          {formatDelta(delta, currency)} vs previous
        </div>
      )}
      {hint && (
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ status */

const STATUS_TONES: Record<string, string> = {
  // sync status
  IDLE: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  REQUESTED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RUNNING: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  // run outcome
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  SUCCESS:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  FAILURE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  CANCELLED:
    "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};


export function StatusPill({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const tone =
    STATUS_TONES[status] ??
    "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone} ${className}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Chip({
  children,
  mono = false,
  title,
}: {
  children: ReactNode;
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 ${
        mono ? "font-mono" : ""
      }`}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- buttons */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  onClick,
  disabled = false,
  variant = "secondary",
  title,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
    secondary:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    danger:
      "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950",
  };

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "bg-emerald-500"
          : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ inputs */

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500";

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  mono = false,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  type?: "text" | "password";
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`${INPUT_CLASS} ${mono ? "font-mono" : ""} ${className}`}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
      className={`${INPUT_CLASS} ${className}`}
    >
      {options.map((option) => (
        <option key={option} value={option} className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
          {option.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

/**
 * A numeric cell that behaves like a spreadsheet: type freely, Enter or blur
 * commits, Escape reverts. Never commits an unparseable value.
 */
export function NumberCell({
  value,
  onCommit,
  disabled = false,
  align = "right",
  placeholder = "—",
  min,
  max,
  suffix,
}: {
  value: number | null | undefined;
  onCommit: (next: number) => void;
  disabled?: boolean;
  align?: "left" | "right";
  placeholder?: string;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const asText = value == null ? "" : String(value);
  const [draft, setDraft] = useState(asText);
  const [editing, setEditing] = useState(false);
  const committed = useRef(asText);

  // Keep the field in step with the document unless the user is mid-edit.
  useEffect(() => {
    if (!editing) {
      committed.current = asText;
      setDraft(asText);
    }
  }, [asText, editing]);

  function commit() {
    setEditing(false);

    const parsed = Number(draft);

    if (draft.trim() === "" || Number.isNaN(parsed)) {
      setDraft(committed.current);
      return;
    }

    if (min != null && parsed < min) return setDraft(committed.current);
    if (max != null && parsed > max) return setDraft(committed.current);
    if (parsed === Number(committed.current)) return;

    onCommit(parsed);
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(committed.current);
            setEditing(false);
            event.currentTarget.blur();
          }
        }}
        className={`${INPUT_CLASS} font-mono tabular-nums ${
          align === "right" ? "text-right" : ""
        }`}
      />
      {suffix && (
        <span className="shrink-0 text-[11px] text-slate-400">{suffix}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- table */

export function Table({
  headers,
  children,
  className = "",
}: {
  headers: ReactNode[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({
  children,
  selected = false,
  onClick,
  className = "",
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
        onClick ? "cursor-pointer" : ""
      } ${
        selected
          ? "bg-sky-50 dark:bg-sky-950"
          : onClick
            ? "hover:bg-slate-50 dark:hover:bg-slate-800/60"
            : ""
      } ${className}`}
    >
      {children}
    </tr>
  );
}

export function Cell({
  children,
  align = "left",
  mono = false,
  className = "",
  title,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  className?: string;
  title?: string;
}) {
  const alignClass = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  }[align];

  return (
    <td
      title={title}
      className={`px-2 py-1.5 text-slate-700 dark:text-slate-200 ${alignClass} ${
        mono ? "font-mono tabular-nums" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/** A banner for surfacing the error a rejected operation recorded. */
export function Banner({
  tone = "info",
  children,
  onDismiss,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
    error:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  }[tone];

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-xs ${tones}`}
    >
      <div className="min-w-0">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 font-semibold opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
