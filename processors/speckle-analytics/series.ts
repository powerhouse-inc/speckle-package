/**
 * Turning a mirrored Speckle project into analytics series.
 *
 * Pure and dependency-free: it emits plain records with ISO timestamps and path
 * strings, and the processor converts those into the store's own types. That
 * keeps every decision here — which metric, which period, which delta —
 * testable without a store, a reactor or luxon.
 *
 * The engine models flows, not stocks: each result row reports the delta over a
 * period and the running cumulative. Quantities in a model are stocks, so we
 * write the *change* in quantity and read the cumulative back. The first
 * revision writes the opening balance.
 */

export interface SeriesRecord {
  startIso: string;
  source: string;
  metric: string;
  value: number;
  unit: string | null;
  dimensions: Record<string, string>;
}

interface CategoryTotalLike {
  speckleType: string;
  objectCount: number;
  unit?: string | null;
  volume?: number | null;
  area?: number | null;
  length?: number | null;
}

interface RevisionLike {
  speckleModelId: string;
  versionId: string;
  createdAt?: string | null;
  syncedAt: string;
  sourceApplication?: string | null;
  authorName?: string | null;
  truncated: boolean;
  categories: CategoryTotalLike[];
}

interface TouchedElementLike {
  speckleType: string;
  kind: string;
}

interface ChangeEntryLike {
  speckleModelId: string;
  toVersionId: string;
  touchedElements: TouchedElementLike[];
}

export interface ProjectStateLike {
  projectId?: string | null;
  name?: string | null;
  revisions: RevisionLike[];
  changes: ChangeEntryLike[];
}

/** The unit of clear-and-rewrite, and what an editor subscribes to. */
export function sourceFor(projectDocumentId: string): string {
  return `speckle/analytics/${projectDocumentId}`;
}

/**
 * A Speckle type as a dimension path.
 *
 * The dots become path segments, so a level-of-detail of 3 rolls up to
 * `Objects/BuiltElements` while 4 reaches the leaf — trade-level aggregation
 * falls out of the hierarchy instead of needing its own query.
 */
export function categoryPath(speckleType: string): string {
  return `speckle/category/${speckleType.split(".").filter(Boolean).join("/")}`;
}

/** Path segments must not carry slashes of their own. */
function segment(value: string): string {
  return value.replace(/[/\\]+/g, "-").trim() || "unknown";
}

const QUANTITIES = [
  ["Volume", "volume"],
  ["Area", "area"],
  ["Length", "length"],
] as const;

function quantityOf(
  category: CategoryTotalLike,
  key: "volume" | "area" | "length",
): number {
  return category[key] ?? 0;
}

/** Oldest first: a cumulative series can only be built forwards. */
function chronological(revisions: RevisionLike[]): RevisionLike[] {
  return [...revisions].sort((a, b) => {
    const left = a.createdAt ?? a.syncedAt;
    const right = b.createdAt ?? b.syncedAt;

    return left.localeCompare(right) || a.versionId.localeCompare(b.versionId);
  });
}

/**
 * Everything worth measuring about one mirrored project.
 *
 * Deltas are taken between consecutive revisions *of the same model*, so two
 * models in one project never contaminate each other's curve.
 */
export function buildSeries(
  state: ProjectStateLike,
  projectDocumentId: string,
): SeriesRecord[] {
  const source = sourceFor(projectDocumentId);
  const projectId = state.projectId ?? projectDocumentId;
  const projectPath = `speckle/project/${segment(projectId)}`;
  const records: SeriesRecord[] = [];

  // Per model, the previous revision's totals per category.
  const previous = new Map<string, Map<string, CategoryTotalLike>>();

  for (const revision of chronological(state.revisions)) {
    const startIso = revision.createdAt ?? revision.syncedAt;
    const modelPath = `speckle/model/${segment(revision.speckleModelId)}`;
    const base = {
      project: projectPath,
      model: modelPath,
    };

    records.push({
      startIso,
      source,
      metric: "Revisions",
      value: 1,
      unit: null,
      dimensions: {
        ...base,
        tool: `speckle/tool/${segment(revision.sourceApplication ?? "unknown")}`,
        author: `speckle/author/${segment(revision.authorName ?? "unknown")}`,
      },
    });

    if (revision.truncated) {
      records.push({
        startIso,
        source,
        metric: "Truncated",
        value: 1,
        unit: null,
        dimensions: base,
      });
    }

    const before: Map<string, CategoryTotalLike> =
      previous.get(revision.speckleModelId) ??
      new Map<string, CategoryTotalLike>();
    const after = new Map<string, CategoryTotalLike>();

    for (const category of revision.categories) {
      after.set(category.speckleType, category);
    }

    // Every category on either side, so a category that vanished reports its
    // quantity leaving rather than silently flat-lining.
    for (const speckleType of new Set([...before.keys(), ...after.keys()])) {
      const was = before.get(speckleType);
      const now = after.get(speckleType);
      const dimensions = { ...base, category: categoryPath(speckleType) };
      const unit = now?.unit ?? was?.unit ?? null;

      const elements = (now?.objectCount ?? 0) - (was?.objectCount ?? 0);

      if (elements !== 0) {
        records.push({
          startIso,
          source,
          metric: "Elements",
          value: elements,
          unit: null,
          dimensions,
        });
      }

      for (const [metric, key] of QUANTITIES) {
        const delta =
          (now ? quantityOf(now, key) : 0) - (was ? quantityOf(was, key) : 0);

        if (delta === 0) continue;

        records.push({
          startIso,
          source,
          metric,
          value: Math.round(delta * 1000) / 1000,
          unit,
          dimensions,
        });
      }
    }

    previous.set(revision.speckleModelId, after);

    // Churn, per category, attributed to the revision that caused it.
    const change = state.changes.find(
      (entry) =>
        entry.toVersionId === revision.versionId &&
        entry.speckleModelId === revision.speckleModelId,
    );

    if (!change) continue;

    const churn = new Map<string, Map<string, number>>();

    for (const element of change.touchedElements) {
      const byKind = churn.get(element.speckleType) ?? new Map<string, number>();

      byKind.set(element.kind, (byKind.get(element.kind) ?? 0) + 1);
      churn.set(element.speckleType, byKind);
    }

    for (const [speckleType, byKind] of churn) {
      for (const [kind, count] of byKind) {
        records.push({
          startIso,
          source,
          metric: kind.charAt(0) + kind.slice(1).toLowerCase(),
          value: count,
          unit: null,
          dimensions: { ...base, category: categoryPath(speckleType) },
        });
      }
    }
  }

  return records;
}

export interface ElementTouchRow {
  project_document_id: string;
  identity: string;
  speckle_model_id: string;
  speckle_type: string;
  version_id: string;
  kind: string;
  object_id: string;
  detected_at: string;
}

/**
 * One row per element per revision that touched it.
 *
 * This is the only element-granular thing written, and it exists because the
 * analytics query language cannot rank: "group by element, keep those touched
 * more than once, order by how often" needs SQL.
 */
export function buildElementTouches(
  state: ProjectStateLike,
  projectDocumentId: string,
  detectedAtOf: (change: ChangeEntryLike) => string,
): ElementTouchRow[] {
  const rows: ElementTouchRow[] = [];

  for (const change of state.changes) {
    for (const element of change.touchedElements as (TouchedElementLike & {
      identity: string;
      objectId: string;
    })[]) {
      rows.push({
        project_document_id: projectDocumentId,
        identity: element.identity,
        speckle_model_id: change.speckleModelId,
        speckle_type: element.speckleType,
        version_id: change.toVersionId,
        kind: element.kind,
        object_id: element.objectId,
        detected_at: detectedAtOf(change),
      });
    }
  }

  return rows;
}
