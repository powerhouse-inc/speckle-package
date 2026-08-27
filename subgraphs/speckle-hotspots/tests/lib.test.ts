import { describe, expect, it } from "vitest";
import { foldHotspots, type TouchGroup } from "../lib.js";

function group(
  identity: string,
  kind: string,
  touches: number,
  extra: Partial<TouchGroup> = {},
): TouchGroup {
  return {
    identity,
    kind,
    touches,
    speckleType: "Objects.BuiltElements.Wall",
    speckleModelId: "m-1",
    firstDetectedAt: "2026-08-01T00:00:00.000Z",
    lastDetectedAt: "2026-08-01T00:00:00.000Z",
    objectId: `hash-${identity}-1`,
    ...extra,
  };
}

describe("foldHotspots", () => {
  it("sums the kinds of one element into a single row", () => {
    const spots = foldHotspots(
      [
        group("app:wall-1", "MODIFIED", 3),
        group("app:wall-1", "ADDED", 1),
        group("app:wall-1", "REMOVED", 1),
      ],
      2,
      25,
    );

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      identity: "app:wall-1",
      touches: 5,
      added: 1,
      modified: 3,
      removed: 1,
    });
  });

  it("ranks by how often an element was touched", () => {
    const spots = foldHotspots(
      [
        group("app:quiet", "MODIFIED", 2),
        group("app:hot", "MODIFIED", 7),
        group("app:middling", "MODIFIED", 4),
      ],
      2,
      25,
    );

    expect(spots.map((s) => s.identity)).toStrictEqual([
      "app:hot",
      "app:middling",
      "app:quiet",
    ]);
  });

  it("drops elements below the threshold", () => {
    const spots = foldHotspots(
      [group("app:once", "ADDED", 1), group("app:twice", "MODIFIED", 2)],
      2,
      25,
    );

    expect(spots.map((s) => s.identity)).toStrictEqual(["app:twice"]);

    // A threshold of one keeps everything.
    expect(foldHotspots([group("app:once", "ADDED", 1)], 1, 25)).toHaveLength(1);
  });

  it("honours the limit, and a limit of zero returns nothing", () => {
    const groups = Array.from({ length: 10 }, (_, i) =>
      group(`app:${i}`, "MODIFIED", 10 - i),
    );

    expect(foldHotspots(groups, 1, 3).map((s) => s.identity)).toStrictEqual([
      "app:0",
      "app:1",
      "app:2",
    ]);
    expect(foldHotspots(groups, 1, 0)).toStrictEqual([]);
    expect(foldHotspots(groups, 1, -5)).toStrictEqual([]);
  });

  it("spans the touches with the earliest and latest dates", () => {
    const spots = foldHotspots(
      [
        group("app:wall-1", "MODIFIED", 1, {
          firstDetectedAt: "2026-08-10T00:00:00.000Z",
          lastDetectedAt: "2026-08-10T00:00:00.000Z",
          objectId: "hash-mid",
        }),
        group("app:wall-1", "ADDED", 1, {
          firstDetectedAt: "2026-08-01T00:00:00.000Z",
          lastDetectedAt: "2026-08-01T00:00:00.000Z",
          objectId: "hash-first",
        }),
        group("app:wall-1", "REMOVED", 1, {
          firstDetectedAt: "2026-08-20T00:00:00.000Z",
          lastDetectedAt: "2026-08-20T00:00:00.000Z",
          objectId: "hash-last",
        }),
      ],
      1,
      25,
    );

    expect(spots[0].firstDetectedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(spots[0].lastDetectedAt).toBe("2026-08-20T00:00:00.000Z");
    // The newest touch decides which object a viewer would isolate.
    expect(spots[0].objectId).toBe("hash-last");
  });

  it("breaks a tie on identity, so the order never wobbles", () => {
    const spots = foldHotspots(
      [group("app:b", "MODIFIED", 3), group("app:a", "MODIFIED", 3)],
      1,
      25,
    );

    expect(spots.map((s) => s.identity)).toStrictEqual(["app:a", "app:b"]);
  });

  it("returns nothing for no groups", () => {
    expect(foldHotspots([], 2, 25)).toStrictEqual([]);
  });
});
