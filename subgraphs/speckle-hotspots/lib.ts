/**
 * Folding element touches into hot spots.
 *
 * The database groups by (identity, kind) — that is the expensive part and it
 * belongs in SQL. Turning those groups into one ranked row per element is
 * cheap, pure, and therefore lives here where it can be tested.
 */

export interface TouchGroup {
  identity: string;
  kind: string;
  touches: number;
  speckleType: string;
  speckleModelId: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  objectId: string;
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

export function foldHotspots(
  groups: TouchGroup[],
  minTouches: number,
  limit: number,
): Hotspot[] {
  const byIdentity = new Map<string, Hotspot>();

  for (const group of groups) {
    const existing = byIdentity.get(group.identity);

    const spot: Hotspot = existing ?? {
      identity: group.identity,
      speckleType: group.speckleType,
      speckleModelId: group.speckleModelId,
      touches: 0,
      added: 0,
      modified: 0,
      removed: 0,
      firstDetectedAt: group.firstDetectedAt,
      lastDetectedAt: group.lastDetectedAt,
      objectId: group.objectId,
    };

    spot.touches += group.touches;

    if (group.kind === "ADDED") spot.added += group.touches;
    else if (group.kind === "MODIFIED") spot.modified += group.touches;
    else if (group.kind === "REMOVED") spot.removed += group.touches;

    if (group.firstDetectedAt < spot.firstDetectedAt) {
      spot.firstDetectedAt = group.firstDetectedAt;
    }

    // The newest touch decides which object id a viewer should isolate.
    if (group.lastDetectedAt >= spot.lastDetectedAt) {
      spot.lastDetectedAt = group.lastDetectedAt;
      spot.objectId = group.objectId;
    }

    byIdentity.set(group.identity, spot);
  }

  return [...byIdentity.values()]
    .filter((spot) => spot.touches >= minTouches)
    .sort(
      (a, b) => b.touches - a.touches || a.identity.localeCompare(b.identity),
    )
    .slice(0, Math.max(limit, 0));
}
