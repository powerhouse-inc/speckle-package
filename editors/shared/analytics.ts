/**
 * Reading the analytics read models over GraphQL.
 *
 * The series are built server-side by the Speckle Analytics processor and
 * queried from Switchboard's `/graphql/analytics`, so nothing is recomputed in
 * the browser. Hot spots come from this package's own subgraph, because ranking
 * by how often something changed is a query the analytics language cannot
 * express.
 */

export type { StackedSeries } from "./chart-model.js";
import type { StackedSeries as Stacked } from "./chart-model.js";

export type Granularity =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annual"
  | "total";

export interface SeriesDimension {
  name: string;
  path: string;
  label?: string | null;
}

export interface SeriesRow {
  metric: string;
  unit: string | null;
  /** Movement within the period. */
  value: number;
  /** Running cumulative up to the end of the period — the stock. */
  sum: number;
  dimensions: SeriesDimension[];
}

export interface SeriesPeriod {
  period: string;
  start: string;
  end: string;
  rows: SeriesRow[];
}

export interface DimensionFilter {
  name: string;
  select: string;
  lod: number;
}

export interface SeriesQuery {
  start: string;
  end: string;
  granularity: Granularity;
  metrics: string[];
  dimensions: DimensionFilter[];
}

export interface Hotspot {
  identity: string;
  speckleType: string;
  speckleModelId: string;
  touches: number;
  added: number;
  modified: number;
  removed: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  objectId: string;
}

const SERIES_QUERY = `
  query Series($filter: AnalyticsFilter) {
    analytics {
      series(filter: $filter) {
        period
        start
        end
        rows {
          metric
          unit
          value
          sum
          dimensions { name path label }
        }
      }
    }
  }
`;

const HOTSPOTS_QUERY = `
  query Hotspots($projectDocumentId: String!, $minTouches: Int, $limit: Int) {
    speckleHotspots {
      hotspots(
        projectDocumentId: $projectDocumentId
        minTouches: $minTouches
        limit: $limit
      ) {
        identity
        speckleType
        speckleModelId
        touches
        added
        modified
        removed
        firstDetectedAt
        lastDetectedAt
        objectId
      }
    }
  }
`;

/** Switchboard serves each subgraph under its own path below the base. */
export function subgraphUrl(base: string, subgraph: string): string {
  return `${base}/graphql/${subgraph}`;
}

/**
 * Strips whatever path an editor happens to know down to the server root.
 *
 * The URL at hand may point at a drive (`/d/<id>`), at the supergraph
 * (`/graphql`) or at one subgraph (`/graphql/analytics`). Anything that is not
 * an absolute http(s) URL is rejected rather than repaired: a relative path
 * cannot tell us which host to ask.
 */
function normaliseBase(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  const base = trimmed
    .replace(/\/graphql.*$/, "")
    .replace(/\/d\/[^/]*$/, "")
    .replace(/\/+$/, "");

  return base.length > 0 ? base : null;
}

/** The `driveUrl` parameter Connect is opened with, if there is one. */
function driveUrlFromSearch(search: string | null | undefined): string | null {
  if (!search) return null;

  try {
    // URLSearchParams decodes for us; decoding again would corrupt the value.
    return new URLSearchParams(search).get("driveUrl");
  } catch {
    // A malformed query string is not worth throwing over.
    return null;
  }
}

/**
 * Where Switchboard is — worked out, not assumed.
 *
 * This used to fall back to a hardcoded `http://localhost:4001`, which is a
 * silent trap: whatever else is listening on that port answers, an analytics
 * query against the wrong reactor returns an empty series rather than an
 * error, and the charts draw nothing while looking perfectly healthy. A
 * different port — or another project's dev server on the usual one — was
 * enough to empty the whole dashboard with no clue as to why.
 *
 * So the address is derived from what is actually known, in order:
 *
 * 1. the `driveUrl` parameter Connect was opened with — the drive the user
 *    actually chose, and therefore the reactor that holds its analytics;
 * 2. that same parameter as remembered earlier in this tab, since Connect may
 *    rewrite the address bar once it has the drive;
 * 3. the drive's own remote URL, for a drive added by hand;
 * 4. only then what the host configured (`useSwitchboardUrl`).
 *
 * Configuration comes *last* on purpose. Connect ships a default of
 * `http://localhost:4001/graphql`, so that value is never absent and cannot be
 * read as knowledge — preferring it re-creates the very bug this function
 * replaced, just with a library's guess instead of mine. Where the config is
 * genuinely right, as under `ph vetra`, no drive parameter exists and it wins
 * anyway. Where a drive parameter does exist, it names the server being looked
 * at, which beats any default.
 *
 * When none of those is usable it returns null, and the caller says so.
 */
export function switchboardBase(sources: {
  configured?: string | null;
  search?: string | null;
  remembered?: string | null;
  driveUrl?: string | null;
}): string | null {
  const candidates = [
    driveUrlFromSearch(sources.search),
    sources.remembered,
    sources.driveUrl,
    sources.configured,
  ];

  for (const candidate of candidates) {
    const base = normaliseBase(candidate);
    if (base) return base;
  }

  return null;
}

async function post<T>(
  url: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `${url} responded ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) throw new Error(`${url} returned no data`);

  return payload.data;
}

export async function fetchSeries(
  base: string,
  query: SeriesQuery,
): Promise<SeriesPeriod[]> {
  const data = await post<{ analytics: { series: SeriesPeriod[] | null } }>(
    subgraphUrl(base, "analytics"),
    SERIES_QUERY,
    { filter: query },
  );

  return data.analytics.series ?? [];
}

export async function fetchHotspots(
  base: string,
  projectDocumentId: string,
  minTouches = 2,
  limit = 20,
): Promise<Hotspot[]> {
  const data = await post<{
    speckleHotspots: { hotspots: Hotspot[] | null };
  }>(subgraphUrl(base, "speckle-hotspots"), HOTSPOTS_QUERY, {
    projectDocumentId,
    minTouches,
    limit,
  });

  return data.speckleHotspots.hotspots ?? [];
}

/* -------------------------------------------------------------- reshaping */

/**
 * The last segment of a key, which is the part worth showing.
 *
 * Dimension paths are slash-delimited and raw Speckle types are dot-delimited,
 * and both end up as chart keys, so both separators count.
 */
export function leafOf(path: string): string {
  const parts = path.split(/[/.]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

/**
 * The unit to print for a metric.
 *
 * Speckle records a *length* unit on its objects, so a volume summed from those
 * objects is in that unit cubed and an area in it squared. Printing the raw
 * `units` value against a volume axis is simply wrong.
 */
export function unitFor(
  metric: string,
  unit: string | null,
): string | null {
  if (!unit) return null;

  if (metric === "Volume") return `${unit}\u00b3`;
  if (metric === "Area") return `${unit}\u00b2`;
  if (metric === "Length") return unit;

  // Counts are dimensionless: elements, revisions, changes.
  return null;
}

export function dimensionOf(row: SeriesRow, name: string): string | null {
  return row.dimensions.find((entry) => entry.name === name)?.path ?? null;
}

/**
 * Turns the analytics result into a stacked series over periods.
 *
 * `useSum` picks the cumulative value — the stock — rather than the movement,
 * which is what a quantity curve should show.
 */
export function stackByDimension(
  periods: SeriesPeriod[],
  dimension: string,
  useSum: boolean,
): Stacked {
  const totals = new Map<string, number>();
  let unit: string | null = null;

  for (const period of periods) {
    for (const row of period.rows) {
      const path = dimensionOf(row, dimension);
      if (!path) continue;

      const amount = useSum ? row.sum : row.value;

      totals.set(path, (totals.get(path) ?? 0) + Math.abs(amount));
      unit = unit ?? row.unit;
    }
  }

  const keys = [...totals.entries()]
    .filter(([, total]) => total !== 0)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([path]) => path);

  const shaped = periods.map((period) => {
    const values: Record<string, number> = {};
    let total = 0;

    for (const key of keys) values[key] = 0;

    for (const row of period.rows) {
      const path = dimensionOf(row, dimension);
      if (!path || !(path in values)) continue;

      const amount = useSum ? row.sum : row.value;

      values[path] += amount;
      total += amount;
    }

    return { period: period.period, start: period.start, values, total };
  });

  return {
    keys,
    periods: shaped,
    max: shaped.reduce((peak, point) => Math.max(peak, point.total), 0),
    unit,
  };
}

/** A period by key grid, for a heatmap. */
export interface Grid {
  keys: string[];
  periods: string[];
  cells: Map<string, number>;
  max: number;
}

export function gridKey(period: string, key: string): string {
  return `${period} ${key}`;
}

export function gridByDimension(
  periods: SeriesPeriod[],
  dimension: string,
): Grid {
  const keys = new Set<string>();
  const cells = new Map<string, number>();
  let max = 0;

  for (const period of periods) {
    for (const row of period.rows) {
      const path = dimensionOf(row, dimension);
      if (!path || row.value === 0) continue;

      keys.add(path);

      const id = gridKey(period.period, path);
      const next = (cells.get(id) ?? 0) + row.value;

      cells.set(id, next);
      max = Math.max(max, Math.abs(next));
    }
  }

  const present = [...keys];

  return {
    keys: present.sort((a, b) => a.localeCompare(b)),
    // Only periods that carry something, so empty months do not pad the grid.
    periods: periods
      .filter((period) =>
        present.some((key) => cells.has(gridKey(period.period, key))),
      )
      .map((period) => period.period),
    cells,
    max,
  };
}
