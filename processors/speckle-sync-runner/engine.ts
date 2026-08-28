/**
 * Pure reading of a Speckle object graph.
 *
 * Two jobs: total the masses that are actually in the model, and work out what
 * changed between two revisions. Both are deliberately dependency-free so they
 * can be unit tested without a reactor or a Speckle server.
 */

export interface SpeckleObjectLike {
  id: string;
  speckleType?: string | null;
  data?: Record<string, unknown> | null;
}

export interface CategoryTotal {
  speckleType: string;
  objectCount: number;
  unit: string | null;
  volume: number | null;
  area: number | null;
  length: number | null;
}

/** What a revision did to one element, with the identity that survives edits. */
export interface TouchedElement {
  objectId: string;
  identity: string;
  speckleType: string;
  kind: "ADDED" | "MODIFIED" | "REMOVED";
}

export interface GraphDiff {
  added: TouchedElement[];
  removed: TouchedElement[];
  modified: TouchedElement[];
}

export interface CategoryDelta {
  speckleType: string;
  unit: string | null;
  countBefore: number;
  countAfter: number;
  volumeBefore: number | null;
  volumeAfter: number | null;
  areaBefore: number | null;
  areaAfter: number | null;
}

/** Coerce a Speckle property to a number, unwrapping `{ value: n }` parameters. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value !== null && typeof value === "object" && "value" in value) {
    return toNumber((value as { value: unknown }).value);
  }

  return null;
}

/** IFC base quantity names, most specific first — net is what was built. */
const IFC_QUANTITY_NAMES: Record<"volume" | "area" | "length", string[]> = {
  volume: ["NetVolume", "GrossVolume"],
  area: ["NetSideArea", "NetArea", "GrossSideArea", "GrossArea", "NetFloorArea"],
  length: ["Length", "Height", "Width"],
};

function quantityGroups(object: SpeckleObjectLike): Record<string, unknown>[] {
  const properties = object.data?.properties;

  if (properties === null || typeof properties !== "object") return [];

  const quantities = (properties as Record<string, unknown>).Quantities;

  if (quantities === null || typeof quantities !== "object") return [];

  // BaseQuantities is the IFC standard set; an exporter may add its own beside
  // it, and those are worth falling back to rather than reporting nothing.
  const groups = Object.entries(quantities as Record<string, unknown>)
    .filter(
      (entry): entry is [string, Record<string, unknown>] =>
        entry[1] !== null && typeof entry[1] === "object",
    )
    .sort(([a], [b]) =>
      a === "BaseQuantities" ? -1 : b === "BaseQuantities" ? 1 : a.localeCompare(b),
    );

  return groups.map(([, group]) => group);
}

/**
 * A quantity off an object, wherever the exporter put it.
 *
 * Revit and the Speckle connectors write `volume` at the top level; an IFC
 * import nests the same fact under `properties.Quantities.BaseQuantities` as
 * `NetVolume`, wrapped as `{ name, units, value }`. Reading only the first shape
 * reports zero for every IFC-sourced model.
 */
function read(
  object: SpeckleObjectLike,
  key: "volume" | "area" | "length",
): number | null {
  const data = object.data;
  if (!data) return null;

  const direct =
    toNumber(data[key]) ??
    toNumber(data[key.charAt(0).toUpperCase() + key.slice(1)]);

  if (direct != null) return direct;

  for (const group of quantityGroups(object)) {
    for (const name of IFC_QUANTITY_NAMES[key]) {
      const value = toNumber(group[name]);

      if (value != null) return value;
    }
  }

  return null;
}

const UNIT_NAMES: Record<string, string> = {
  metre: "m",
  meter: "m",
  millimetre: "mm",
  millimeter: "mm",
  centimetre: "cm",
  centimeter: "cm",
  foot: "ft",
  feet: "ft",
  inch: "in",
};

/** `Cubic Metre` is a unit of volume; the unit we report is its length base. */
function baseUnit(name: string): string | null {
  const word = name.toLowerCase().replace(/^(cubic|square)\s+/, "").trim();

  return UNIT_NAMES[word] ?? null;
}

function unitOf(object: SpeckleObjectLike): string | null {
  const units = object.data?.units;

  if (typeof units === "string" && units.length > 0) return units;

  // An IFC quantity carries its own unit name, spelled out in full.
  for (const group of quantityGroups(object)) {
    for (const value of Object.values(group)) {
      if (value === null || typeof value !== "object") continue;

      const name = (value as { units?: unknown }).units;

      if (typeof name !== "string") continue;

      const unit = baseUnit(name);

      if (unit) return unit;
    }
  }

  return null;
}

/**
 * The category an object belongs to.
 *
 * An IFC import types everything as `Objects.Data.DataObject` and puts the real
 * class in `ifcType`, so grouping on the Speckle type alone would collapse a
 * whole building into one bucket.
 */
export function categoryOf(object: SpeckleObjectLike): string {
  const ifcType = object.data?.ifcType;

  if (typeof ifcType === "string" && ifcType.length > 0) return ifcType;

  return object.speckleType ?? "Unknown";
}

/**
 * The stable identity of an element across revisions.
 *
 * A Speckle object id is a content hash, so *any* property change produces a
 * new id. Diffing on it alone would report every touched element as
 * removed-and-added. `applicationId` is the authoring tool's own element id
 * (a Revit element id, for instance), which survives edits — so it is the key,
 * with the content hash as the fallback for objects that carry none.
 */
export function identityOf(object: SpeckleObjectLike): string {
  const applicationId = object.data?.applicationId;

  return typeof applicationId === "string" && applicationId.length > 0
    ? `app:${applicationId}`
    : `id:${object.id}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Spatial structure, not building elements.
 *
 * An IFC file describes a site containing a building containing storeys
 * containing spaces. Those carry quantities of their own — a room's volume is
 * the air in it — and adding that to the concrete in the walls would produce a
 * number that means nothing. They are context, not material.
 */
const SPATIAL_TYPES = new Set([
  "IfcProject",
  "IfcSite",
  "IfcBuilding",
  "IfcBuildingStorey",
  "IfcSpace",
  "IfcZone",
  "IfcSpatialZone",
  "IfcSpatialElement",
]);

/**
 * Whether an object is a building element worth totalling.
 *
 * Excludes the spatial containers above, and raw geometry: an IFC import walks
 * display meshes as objects in their own right, and they are the same material
 * counted twice.
 */
export function isElement(object: SpeckleObjectLike): boolean {
  const category = categoryOf(object);

  if (SPATIAL_TYPES.has(category)) return false;

  return !category.startsWith("Objects.Geometry.");
}

/** Total count, volume, area and length per Speckle type, elements only. */
export function summariseByType(
  objects: SpeckleObjectLike[],
): CategoryTotal[] {
  const byType = new Map<
    string,
    {
      objectCount: number;
      unit: string | null;
      volume: number | null;
      area: number | null;
      length: number | null;
    }
  >();

  for (const object of objects) {
    if (!isElement(object)) continue;

    const speckleType = categoryOf(object);

    const entry =
      byType.get(speckleType) ??
      { objectCount: 0, unit: null, volume: null, area: null, length: null };

    entry.objectCount += 1;
    entry.unit = entry.unit ?? unitOf(object);

    for (const key of ["volume", "area", "length"] as const) {
      const value = read(object, key);
      if (value == null) continue;

      entry[key] = (entry[key] ?? 0) + value;
    }

    byType.set(speckleType, entry);
  }

  return [...byType.entries()]
    .map(([speckleType, entry]) => ({
      speckleType,
      objectCount: entry.objectCount,
      unit: entry.unit,
      volume: entry.volume == null ? null : round(entry.volume),
      area: entry.area == null ? null : round(entry.area),
      length: entry.length == null ? null : round(entry.length),
    }))
    // Biggest categories first; stable tie-break on the type name.
    .sort(
      (a, b) =>
        b.objectCount - a.objectCount || a.speckleType.localeCompare(b.speckleType),
    );
}

/**
 * What changed between two revisions, at element level.
 *
 * Returns Speckle object ids from the *newer* graph for added and modified
 * elements, and from the older graph for removed ones, so the ids can be handed
 * straight to the viewer to isolate them.
 */
export function diffGraphs(
  before: SpeckleObjectLike[],
  after: SpeckleObjectLike[],
): GraphDiff {
  const beforeByIdentity = new Map<string, SpeckleObjectLike>();
  const afterByIdentity = new Map<string, SpeckleObjectLike>();

  for (const object of before) beforeByIdentity.set(identityOf(object), object);
  for (const object of after) afterByIdentity.set(identityOf(object), object);

  const touch = (
    object: SpeckleObjectLike,
    identity: string,
    kind: TouchedElement["kind"],
  ): TouchedElement => ({
    objectId: object.id,
    identity,
    speckleType: object.speckleType ?? "Unknown",
    kind,
  });

  const added: TouchedElement[] = [];
  const removed: TouchedElement[] = [];
  const modified: TouchedElement[] = [];

  for (const [identity, object] of afterByIdentity) {
    const previous = beforeByIdentity.get(identity);

    if (!previous) {
      added.push(touch(object, identity, "ADDED"));
      continue;
    }

    // Same element, different content hash: its properties or geometry moved.
    if (previous.id !== object.id) {
      modified.push(touch(object, identity, "MODIFIED"));
    }
  }

  for (const [identity, object] of beforeByIdentity) {
    if (!afterByIdentity.has(identity)) {
      removed.push(touch(object, identity, "REMOVED"));
    }
  }

  const byObjectId = (a: TouchedElement, b: TouchedElement) =>
    a.objectId.localeCompare(b.objectId);

  return {
    added: added.sort(byObjectId),
    removed: removed.sort(byObjectId),
    modified: modified.sort(byObjectId),
  };
}

/** Every element a revision touched, in one list. */
export function allTouched(diff: GraphDiff): TouchedElement[] {
  return [...diff.added, ...diff.modified, ...diff.removed];
}

/** Per-type before/after totals, for every type present on either side. */
export function categoryDeltas(
  before: CategoryTotal[],
  after: CategoryTotal[],
): CategoryDelta[] {
  const types = new Set<string>();
  for (const entry of before) types.add(entry.speckleType);
  for (const entry of after) types.add(entry.speckleType);

  const deltas: CategoryDelta[] = [];

  for (const speckleType of [...types].sort()) {
    const left = before.find((entry) => entry.speckleType === speckleType);
    const right = after.find((entry) => entry.speckleType === speckleType);

    const unchanged =
      left &&
      right &&
      left.objectCount === right.objectCount &&
      left.volume === right.volume &&
      left.area === right.area;

    // Only report types that actually moved.
    if (unchanged) continue;

    deltas.push({
      speckleType,
      unit: right?.unit ?? left?.unit ?? null,
      countBefore: left?.objectCount ?? 0,
      countAfter: right?.objectCount ?? 0,
      volumeBefore: left?.volume ?? null,
      volumeAfter: right?.volume ?? null,
      areaBefore: left?.area ?? null,
      areaAfter: right?.area ?? null,
    });
  }

  return deltas;
}

/**
 * Where the *server* should reach Speckle, which is not always where the
 * browser reaches it.
 *
 * In a compose stack the browser talks to the published port on localhost
 * while the reactor has to use a service name on the internal network. The
 * document stores the browser's URL — the editor and the 3D viewer need that
 * one — so only the fetch is redirected, and only when the origin matches the
 * configured public one. A document pointing at some other Speckle server is
 * left alone.
 */
export function internalUrl(
  url: string,
  publicOrigin: string | null | undefined,
  internalOrigin: string | null | undefined,
): string {
  if (!publicOrigin || !internalOrigin) return url;

  const strip = (value: string) => value.replace(/\/+$/, "");
  const wanted = strip(publicOrigin).toLowerCase();
  const actual = strip(url);

  if (actual.toLowerCase() === wanted) return strip(internalOrigin);
  if (actual.toLowerCase().startsWith(`${wanted}/`)) {
    return strip(internalOrigin) + actual.slice(wanted.length);
  }

  return url;
}
