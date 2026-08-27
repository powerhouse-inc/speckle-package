import { describe, expect, it } from "vitest";
import {
  MAX_ISOLATED_OBJECTS,
  buildEmbedUrl,
  buildResourceString,
  buildVersionUrl,
  fetchModelVersions,
  fetchProjectOverview,
  fetchVersionObjects,
} from "../speckle.js";
import {
  diffGraphs,
  summariseByType,
} from "../../../processors/speckle-sync-runner/engine.js";

/**
 * Exercises the Speckle client against a real server.
 *
 * Skipped unless the environment names one, so the suite stays green offline:
 *
 *   SPECKLE_BASE=http://127.0.0.1 \
 *   SPECKLE_TOKEN=... \
 *   SPECKLE_PROJECT_ID=... \
 *   SPECKLE_MODEL_ID=... \
 *   npx vitest run editors/shared/tests/speckle-live.test.ts
 */
const BASE = process.env.SPECKLE_BASE;
const TOKEN = process.env.SPECKLE_TOKEN ?? null;
const PROJECT_ID = process.env.SPECKLE_PROJECT_ID;
const MODEL_ID = process.env.SPECKLE_MODEL_ID;

const live = BASE && PROJECT_ID && MODEL_ID ? describe : describe.skip;

describe("viewer url builders", () => {
  const OBJ_A = "a".repeat(32);
  const OBJ_B = "b".repeat(32);

  it("builds a version url, trimming trailing slashes", () => {
    expect(buildVersionUrl("http://x/", "p1", "m1", "v1")).toBe(
      "http://x/projects/p1/models/m1@v1",
    );
    expect(buildVersionUrl("http://x", "p1", "m1")).toBe(
      "http://x/projects/p1/models/m1",
    );
  });

  it("puts only boolean flags in the embed hash", () => {
    // Speckle rejects the whole embed object if it carries anything else, and
    // silently renders the full viewer instead.
    const url = buildEmbedUrl("http://x", "p1", "m1", "v1");

    expect(decodeURIComponent(url.split("#embed=")[1])).toBe(
      '{"isEnabled":true}',
    );
  });

  it("isolates objects through the resource string, not the hash", () => {
    const url = buildEmbedUrl("http://x", "p1", "m1", "v1", [OBJ_A, OBJ_B]);

    expect(url).toBe(
      `http://x/projects/p1/models/${OBJ_A},${OBJ_B}#embed=${encodeURIComponent('{"isEnabled":true}')}`,
    );
    // The version drops out: object ids are content-addressed and resolve on
    // their own, which is what makes removed elements viewable at all.
    expect(url).not.toContain("m1@v1");
  });

  it("keeps the version when no objects are named", () => {
    expect(buildResourceString("m1", "v1")).toBe("m1@v1");
    expect(buildResourceString("m1", "v1", [])).toBe("m1@v1");
    expect(buildResourceString("m1", null)).toBe("m1");
  });

  it("ignores ids that cannot be object ids", () => {
    // Speckle decides an id is an object purely by being 32 characters long,
    // so anything else in the list would be read as a model name.
    expect(buildResourceString("m1", "v1", ["short", "x".repeat(33)])).toBe(
      "m1@v1",
    );
    expect(buildResourceString("m1", "v1", ["short", OBJ_A])).toBe(OBJ_A);
  });

  it("caps how many objects a link names", () => {
    const ids = Array.from({ length: 150 }, (_, index) =>
      String(index).padStart(32, "0"),
    );

    const resource = buildResourceString("m1", "v1", ids);

    expect(resource.split(",")).toHaveLength(MAX_ISOLATED_OBJECTS);
    expect(resource.split(",")[0]).toBe(ids[0]);
  });
});

live("against a live Speckle server", () => {
  it("reads the project and its models", async () => {
    const overview = await fetchProjectOverview(BASE!, PROJECT_ID!, TOKEN);

    expect(overview.id).toBe(PROJECT_ID);
    expect(overview.name.length).toBeGreaterThan(0);
    expect(overview.models.length).toBeGreaterThan(0);
  });

  it("reads model versions newest first", async () => {
    const { versions } = await fetchModelVersions(
      BASE!,
      PROJECT_ID!,
      MODEL_ID!,
      10,
      TOKEN,
    );

    expect(versions.length).toBeGreaterThan(0);
    expect(versions[0].referencedObject.length).toBeGreaterThan(0);
    // Speckle normalises sourceApplication to lower case on write.
    expect(versions[0].sourceApplication?.toLowerCase()).toBe("revit");
  });

  it("walks a version's objects and totals them per Speckle type", async () => {
    const { versions } = await fetchModelVersions(
      BASE!,
      PROJECT_ID!,
      MODEL_ID!,
      10,
      TOKEN,
    );

    // Oldest version, so expected numbers stay stable as more are pushed.
    const first = versions[versions.length - 1];

    const { objects } = await fetchVersionObjects(
      BASE!,
      PROJECT_ID!,
      first.referencedObject,
      { token: TOKEN, maxObjects: 2000 },
    );

    expect(objects.length).toBeGreaterThan(0);

    const totals = summariseByType(objects);

    expect(totals.length).toBeGreaterThan(0);
    // Real geometry, totalled through the real client.
    expect(totals.some((entry) => (entry.volume ?? 0) > 0)).toBe(true);
    expect(
      totals.reduce((sum, entry) => sum + entry.objectCount, 0),
    ).toBe(objects.length);
  });

  it("reports what changed between two revisions", async () => {
    const { versions } = await fetchModelVersions(
      BASE!,
      PROJECT_ID!,
      MODEL_ID!,
      10,
      TOKEN,
    );

    if (versions.length < 2) return;

    const newer = versions[0];
    const older = versions[1];

    const [beforeGraph, afterGraph] = await Promise.all([
      fetchVersionObjects(BASE!, PROJECT_ID!, older.referencedObject, {
        token: TOKEN,
        maxObjects: 2000,
      }),
      fetchVersionObjects(BASE!, PROJECT_ID!, newer.referencedObject, {
        token: TOKEN,
        maxObjects: 2000,
      }),
    ]);

    const diff = diffGraphs(beforeGraph.objects, afterGraph.objects);

    // Something must have moved between two distinct revisions.
    expect(
      diff.added.length + diff.removed.length + diff.modified.length,
    ).toBeGreaterThan(0);
  });
});
