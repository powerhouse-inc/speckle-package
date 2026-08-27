/**
 * Pure reading of a mirrored Speckle project.
 *
 * The editor keeps no derived state of its own: everything on screen is a
 * function of the document plus the selected model and revision. Kept free of
 * React so it can be tested directly.
 */

import type { StackedSeries } from "../shared/chart-model.js";
import { shortHash } from "../shared/format.js";
import type {
  CategoryTotal,
  ChangeEntry,
  Revision,
  SpeckleModel,
  SpeckleProjectState,
} from "document-models/speckle-project";

/** Which subset of a change the 3D view isolates. */
export type IsolationMode = "ALL" | "ADDED" | "MODIFIED" | "REMOVED";

export const ISOLATION_MODES: readonly IsolationMode[] = [
  "ALL",
  "ADDED",
  "MODIFIED",
  "REMOVED",
];

export interface MassRow {
  speckleType: string;
  shortType: string;
  objectCount: number;
  unit: string | null;
  volume: number | null;
  area: number | null;
  length: number | null;
  /** Change against the previous revision, or null where nothing moved. */
  countDelta: number | null;
  volumeDelta: number | null;
  areaDelta: number | null;
}

export interface MassSummary {
  objectCount: number;
  volume: number | null;
  area: number | null;
  length: number | null;
  categoryCount: number;
}

/** `Objects.BuiltElements.Wall` reads as `Wall` in a table. */
export function shortType(speckleType: string): string {
  const parts = speckleType.split(/[.:]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : speckleType;
}

export function modelOf(
  state: SpeckleProjectState,
  speckleModelId: string | null,
): SpeckleModel | null {
  if (!speckleModelId) return null;
  return (
    state.models.find((model) => model.speckleModelId === speckleModelId) ?? null
  );
}

/** Revisions of one model, newest first — the reducer already sorts them. */
export function revisionsForModel(
  state: SpeckleProjectState,
  speckleModelId: string | null,
): Revision[] {
  if (!speckleModelId) return [];
  return state.revisions.filter(
    (revision) => revision.speckleModelId === speckleModelId,
  );
}

export function revisionOf(
  revisions: Revision[],
  versionId: string | null,
): Revision | null {
  if (!versionId) return null;
  return revisions.find((revision) => revision.versionId === versionId) ?? null;
}

/**
 * The revision that came before the selected one, which is what its change
 * entry is measured against.
 */
export function previousRevision(
  revisions: Revision[],
  versionId: string | null,
): Revision | null {
  const index = revisions.findIndex(
    (revision) => revision.versionId === versionId,
  );

  if (index < 0) return null;

  return revisions[index + 1] ?? null;
}

/** The change that produced this revision, if the sync recorded one. */
export function changeForRevision(
  state: SpeckleProjectState,
  versionId: string | null,
): ChangeEntry | null {
  if (!versionId) return null;
  return (
    state.changes.find((change) => change.toVersionId === versionId) ?? null
  );
}

/**
 * Which revision to show when none is picked yet: the model's latest, falling
 * back to the newest one actually mirrored.
 */
export function defaultVersionId(
  revisions: Revision[],
  model: SpeckleModel | null,
): string | null {
  const latest = model?.latestVersionId;

  if (latest && revisions.some((revision) => revision.versionId === latest)) {
    return latest;
  }

  return revisions[0]?.versionId ?? null;
}

export function defaultModelId(state: SpeckleProjectState): string | null {
  return state.models[0]?.speckleModelId ?? null;
}

function sum(
  categories: CategoryTotal[],
  key: "volume" | "area" | "length",
): number | null {
  let total: number | null = null;

  for (const category of categories) {
    const value = category[key];
    if (value == null) continue;

    total = (total ?? 0) + value;
  }

  return total == null ? null : Math.round(total * 1000) / 1000;
}

export function massSummary(revision: Revision | null): MassSummary {
  if (!revision) {
    return {
      objectCount: 0,
      volume: null,
      area: null,
      length: null,
      categoryCount: 0,
    };
  }

  return {
    objectCount: revision.objectCount,
    volume: sum(revision.categories, "volume"),
    area: sum(revision.categories, "area"),
    length: sum(revision.categories, "length"),
    categoryCount: revision.categories.length,
  };
}

function delta(
  after: number | null | undefined,
  before: number | null | undefined,
): number | null {
  if (after == null && before == null) return null;
  const moved = (after ?? 0) - (before ?? 0);
  return moved === 0 ? null : Math.round(moved * 1000) / 1000;
}

/**
 * The selected revision's categories, each carrying how far it moved since the
 * previous revision. The change entry is the source of the before-values, so a
 * revision with no recorded change simply shows no deltas.
 */
export function massRows(
  revision: Revision | null,
  change: ChangeEntry | null,
): MassRow[] {
  if (!revision) return [];

  return revision.categories.map((category) => {
    const moved = change?.deltas.find(
      (entry) => entry.speckleType === category.speckleType,
    );

    return {
      speckleType: category.speckleType,
      shortType: shortType(category.speckleType),
      objectCount: category.objectCount,
      unit: category.unit ?? null,
      volume: category.volume ?? null,
      area: category.area ?? null,
      length: category.length ?? null,
      countDelta: moved
        ? delta(moved.countAfter, moved.countBefore)
        : null,
      volumeDelta: moved ? delta(moved.volumeAfter, moved.volumeBefore) : null,
      areaDelta: moved ? delta(moved.areaAfter, moved.areaBefore) : null,
    };
  });
}

/**
 * Categories a change touched that are no longer in the revision at all —
 * a whole type having been deleted is a change worth seeing.
 */
export function vanishedTypes(
  revision: Revision | null,
  change: ChangeEntry | null,
): string[] {
  if (!change) return [];

  const present = new Set(
    (revision?.categories ?? []).map((category) => category.speckleType),
  );

  return change.deltas
    .filter((entry) => entry.countAfter === 0 && !present.has(entry.speckleType))
    .map((entry) => entry.speckleType);
}

/**
 * The object ids to paint, split by what happened to each element.
 *
 * The document stores one list of touched elements carrying their identity; the
 * viewer wants ids grouped by kind, so the split happens here rather than in the
 * document.
 */
export function highlightOf(change: ChangeEntry | null): {
  added: string[];
  modified: string[];
  removed: string[];
} {
  const of = (kind: string) =>
    (change?.touchedElements ?? [])
      .filter((element) => element.kind === kind)
      .map((element) => element.objectId);

  return {
    added: of("ADDED"),
    modified: of("MODIFIED"),
    removed: of("REMOVED"),
  };
}

export function changeTotal(change: ChangeEntry | null): number {
  if (!change) return 0;
  return change.addedCount + change.removedCount + change.modifiedCount;
}

/* ------------------------------------------------------------------ trends */

/** Which quantity the trend charts plot. */
export type Measure = "COUNT" | "VOLUME" | "AREA" | "LENGTH";

export const MEASURES: readonly Measure[] = [
  "COUNT",
  "VOLUME",
  "AREA",
  "LENGTH",
];

export const MEASURE_LABELS: Record<Measure, string> = {
  COUNT: "Elements",
  VOLUME: "Volume",
  AREA: "Area",
  LENGTH: "Length",
};

/**
 * Colours for category series. Chosen to stay apart on both a light and a dark
 * ground, and deliberately not the change colours — those mean something else.
 */
export const SERIES_COLOURS = [
  "#0ea5e9",
  "#8b5cf6",
  "#14b8a6",
  "#f472b6",
  "#facc15",
  "#64748b",
] as const;

export interface TrendPoint {
  versionId: string;
  label: string;
  createdAt: string | null;
  /** Value per category, zero where the revision has no such category. */
  values: Record<string, number>;
  total: number;
}

export interface TrendSeries {
  /** Category types, biggest total last so the stack reads bottom-heavy. */
  categories: string[];
  points: TrendPoint[];
  max: number;
  unit: string | null;
}

export interface ChurnPoint {
  versionId: string;
  label: string;
  detectedAt: string;
  added: number;
  modified: number;
  removed: number;
  total: number;
}

/** Oldest first, which is the only order a time axis can be read in. */
export function chronological(revisions: Revision[]): Revision[] {
  return [...revisions].reverse();
}

function measureOf(category: CategoryTotal, measure: Measure): number {
  if (measure === "COUNT") return category.objectCount;
  if (measure === "VOLUME") return category.volume ?? 0;
  if (measure === "AREA") return category.area ?? 0;
  return category.length ?? 0;
}

/**
 * One series per Speckle type across the model's revisions.
 *
 * Three dimensions at once: the category, the quantity, and the revision it was
 * measured in — which is what makes a stacked area readable here. Categories
 * that are flat zero for the chosen measure are dropped rather than drawn as a
 * line on the axis.
 */
export function categorySeries(
  revisions: Revision[],
  measure: Measure,
): TrendSeries {
  const ordered = chronological(revisions);
  const totals = new Map<string, number>();
  let unit: string | null = null;

  for (const revision of ordered) {
    for (const category of revision.categories) {
      const value = measureOf(category, measure);

      totals.set(
        category.speckleType,
        (totals.get(category.speckleType) ?? 0) + value,
      );

      unit = unit ?? category.unit ?? null;
    }
  }

  const categories = [...totals.entries()]
    .filter(([, total]) => total > 0)
    // Smallest first, so the biggest band sits at the top of the stack where
    // its shape is easiest to follow.
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([speckleType]) => speckleType);

  const points = ordered.map((revision) => {
    const values: Record<string, number> = {};
    let total = 0;

    for (const speckleType of categories) {
      const category = revision.categories.find(
        (entry) => entry.speckleType === speckleType,
      );
      const value = category ? measureOf(category, measure) : 0;

      values[speckleType] = value;
      total += value;
    }

    return {
      versionId: revision.versionId,
      label: shortHash(revision.versionId),
      createdAt: revision.createdAt ?? null,
      values,
      total,
    };
  });

  return {
    categories,
    points,
    max: points.reduce((peak, point) => Math.max(peak, point.total), 0),
    unit: measure === "COUNT" ? null : unit,
  };
}

/** Added, modified and removed per revision step, oldest first. */
export function churnSeries(
  revisions: Revision[],
  changes: ChangeEntry[],
): ChurnPoint[] {
  return chronological(revisions)
    .map((revision) => {
      const change = changes.find(
        (entry) => entry.toVersionId === revision.versionId,
      );

      if (!change) return null;

      return {
        versionId: revision.versionId,
        label: shortHash(revision.versionId),
        detectedAt: change.detectedAt,
        added: change.addedCount,
        modified: change.modifiedCount,
        removed: change.removedCount,
        total: change.addedCount + change.modifiedCount + change.removedCount,
      };
    })
    .filter((point): point is ChurnPoint => point !== null);
}

export function churnMax(points: ChurnPoint[]): number {
  return points.reduce((peak, point) => Math.max(peak, point.total), 0);
}

/** A compact axis label: 1234.5 reads as 1.2k. */
export function axisLabel(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  if (abs >= 10) return value.toFixed(0);
  if (abs === 0) return "0";

  return value.toFixed(1);
}


/* ---------------------------------------------------- to the chart shape */

/**
 * The revision-axis series in the shape the shared charts draw.
 *
 * The charts know one data shape, so both the document-derived series and the
 * analytics ones render through the same component — which is the only way they
 * stay looking like the same product.
 */
export function trendToStacked(series: TrendSeries): StackedSeries {
  return {
    keys: series.categories,
    periods: series.points.map((point) => ({
      period: point.label,
      start: point.createdAt ?? "",
      values: point.values,
      total: point.total,
    })),
    max: series.max,
    unit: series.unit,
  };
}

const CHURN_KEYS = ["added", "modified", "removed"] as const;

export function churnToStacked(points: ChurnPoint[]): StackedSeries {
  return {
    // Removed first so it sits at the bottom of the stack, reading as a
    // subtraction that the additions grow out of.
    keys: ["removed", "modified", "added"],
    periods: points.map((point) => ({
      period: point.label,
      start: point.detectedAt,
      values: {
        added: point.added,
        modified: point.modified,
        removed: point.removed,
      },
      total: point.total,
    })),
    max: points.reduce((peak, point) => Math.max(peak, point.total), 0),
    unit: null,
  };
}

export { CHURN_KEYS };


/* ------------------------------------------------- one element, in detail */

export interface ElementQuantity {
  key: string;
  label: string;
  value: number;
  /** The unit as printed: a length unit cubed for volume, squared for area. */
  unit: string | null;
}

export interface ElementAttribute {
  label: string;
  value: string;
}

export interface ElementDetail {
  objectId: string | null;
  identity: string | null;
  speckleType: string | null;
  quantities: ElementQuantity[];
  attributes: ElementAttribute[];
}

/** Keys that describe the model's plumbing rather than the element. */
const PLUMBING = new Set([
  "id",
  "speckle_type",
  "speckleType",
  "applicationId",
  "displayValue",
  "elements",
  "units",
  "totalChildrenCount",
  "bbox",
  "renderMaterial",
  "__closure",
]);

const QUANTITIES: [key: string, label: string, dimension: 3 | 2 | 1][] = [
  ["volume", "Volume", 3],
  ["area", "Area", 2],
  ["length", "Length", 1],
  ["height", "Height", 1],
  ["width", "Width", 1],
  ["thickness", "Thickness", 1],
];

/** Revit writes parameters as `{ value: n }`; everything else writes plainly. */
function plainValue(input: unknown): unknown {
  if (
    input !== null &&
    typeof input === "object" &&
    "value" in input &&
    Object.keys(input).length <= 3
  ) {
    return (input as { value: unknown }).value;
  }

  return input;
}

function asNumber(input: unknown): number | null {
  const value = plainValue(input);

  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asText(input: unknown): string | null {
  const value = plainValue(input);

  if (value == null) return null;
  if (typeof value === "string") return value.length > 0 ? value : null;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function titleCase(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function unitOf(unit: string | null, dimension: 3 | 2 | 1): string | null {
  if (!unit) return null;
  if (dimension === 3) return `${unit}\u00b3`;
  if (dimension === 2) return `${unit}\u00b2`;
  return unit;
}

/**
 * A Speckle object as something worth reading.
 *
 * Quantities come first because they are what anyone opens an element for;
 * everything else follows, with the model's own plumbing left out and nested
 * property bags flattened one level so a material does not hide behind a
 * disclosure triangle.
 */
export function readElement(raw: Record<string, unknown> | null): ElementDetail {
  if (!raw) {
    return {
      objectId: null,
      identity: null,
      speckleType: null,
      quantities: [],
      attributes: [],
    };
  }

  const unit = asText(raw.units);

  const quantities: ElementQuantity[] = [];

  for (const [key, label, dimension] of QUANTITIES) {
    const value = asNumber(raw[key]) ?? asNumber(raw[titleCase(key)]);

    if (value == null) continue;

    quantities.push({ key, label, value, unit: unitOf(unit, dimension) });
  }

  const attributes: ElementAttribute[] = [];
  const seen = new Set<string>();

  const take = (key: string, value: unknown) => {
    if (PLUMBING.has(key) || key.startsWith("__")) return;
    if (QUANTITIES.some(([known]) => known === key.toLowerCase())) return;

    const text = asText(value);

    if (text == null || seen.has(key)) return;

    seen.add(key);
    attributes.push({ label: titleCase(key), value: text });
  };

  // A `properties` bag is where authoring tools put the interesting parts.
  const bag = raw.properties;

  if (bag !== null && typeof bag === "object") {
    for (const [key, value] of Object.entries(bag)) take(key, value);
  }

  for (const [key, value] of Object.entries(raw)) {
    if (key === "properties") continue;
    take(key, value);
  }

  return {
    objectId: asText(raw.id),
    identity: asText(raw.applicationId),
    speckleType: asText(raw.speckle_type) ?? asText(raw.speckleType),
    quantities,
    attributes,
  };
}

export interface ElementTouch {
  versionId: string;
  kind: string;
  detectedAt: string;
}

/**
 * What the mirrored history says happened to one element.
 *
 * This is the part a viewer cannot answer on its own: the document holds every
 * revision's element-level diff, so a click can say not just what an element is
 * but how often it has moved.
 */
export function elementHistory(
  changes: ChangeEntry[],
  identity: string | null,
  objectId: string | null,
): ElementTouch[] {
  if (!identity && !objectId) return [];

  const touches: ElementTouch[] = [];

  for (const change of changes) {
    for (const element of change.touchedElements) {
      const matches = identity
        ? element.identity === identity || element.identity === `app:${identity}`
        : element.objectId === objectId;

      if (!matches) continue;

      touches.push({
        versionId: change.toVersionId,
        kind: element.kind,
        detectedAt: change.detectedAt,
      });
    }
  }

  return touches.sort(
    (a, b) =>
      a.detectedAt.localeCompare(b.detectedAt) ||
      a.versionId.localeCompare(b.versionId),
  );
}
