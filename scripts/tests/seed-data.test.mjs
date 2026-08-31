import { describe, expect, it } from "vitest";
import {
  applyPlan,
  boxMesh,
  buildRevisions,
  DEMO_PROJECTS,
  element,
  expectations,
  flattenForUpload,
} from "../seed-data.mjs";

describe("boxMesh", () => {
  it("emits eight vertices and twelve triangles", () => {
    const mesh = boxMesh([0, 0, 0], [2, 3, 4]);

    expect(mesh.vertices).toHaveLength(24);
    // Twelve triangles, each written as a count plus three indices.
    expect(mesh.faces).toHaveLength(12 * 4);
    expect(mesh.faces.filter((value, index) => index % 4 === 0)).toStrictEqual(
      Array.from({ length: 12 }, () => 3),
    );
  });

  it("indexes only vertices that exist", () => {
    const mesh = boxMesh([0, 0, 0], [1, 1, 1]);
    const indices = mesh.faces.filter((_, index) => index % 4 !== 0);

    expect(Math.min(...indices)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...indices)).toBeLessThan(mesh.vertices.length / 3);
  });

  it("places the box at its origin", () => {
    const mesh = boxMesh([5, 6, 7], [1, 1, 1]);

    expect(mesh.vertices.slice(0, 3)).toStrictEqual([5, 6, 7]);
  });
});

describe("element", () => {
  it("derives the quantities from the geometry, so the two cannot disagree", () => {
    const wall = element("abutment", 1);

    // 1.2 x 6 x 4
    expect(wall.volume).toBe(28.8);
    expect(wall.area).toBe(7.2);
    expect(wall.units).toBe("m");
  });

  it("keeps identity but changes content when it grows", () => {
    const before = element("abutment", 1);
    const after = element("abutment", 1, 1.25);

    expect(after.applicationId).toBe(before.applicationId);
    expect(after.volume).toBeGreaterThan(before.volume);
  });

  it("refuses an unknown kind rather than seeding something meaningless", () => {
    expect(() => element("teleporter", 1)).toThrow("Unknown element kind");
  });
});

describe("applyPlan", () => {
  it("adds elements with running indices", () => {
    const first = applyPlan([], { add: [["girder", 2]] });
    const second = applyPlan(first, { add: [["girder", 1]] });

    expect(second.map((entry) => entry.applicationId)).toStrictEqual([
      "girder-1",
      "girder-2",
      "girder-3",
    ]);
  });

  it("grows from the front and removes from the back, so they never collide", () => {
    const before = applyPlan([], { add: [["girder", 3]] });
    const after = applyPlan(before, { grow: [["girder", 1, 2]], remove: [["girder", 1]] });

    expect(after.map((entry) => entry.applicationId)).toStrictEqual([
      "girder-1",
      "girder-2",
    ]);
    expect(after[0].volume).toBeGreaterThan(before[0].volume);
  });

  it("leaves the previous revision untouched", () => {
    const before = applyPlan([], { add: [["girder", 1]] });
    const volume = before[0].volume;

    applyPlan(before, { grow: [["girder", 1, 3]] });

    expect(before[0].volume).toBe(volume);
  });
});

describe("the demo projects", () => {
  it("gives every element a stable identity within a revision", () => {
    for (const project of DEMO_PROJECTS) {
      for (const revision of buildRevisions(project)) {
        const ids = revision.elements.map((entry) => entry.applicationId);

        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("carries geometry on every element, or the viewer shows nothing", () => {
    for (const project of DEMO_PROJECTS) {
      for (const revision of buildRevisions(project)) {
        for (const entry of revision.elements) {
          expect(entry.displayValue[0].speckle_type).toBe("Objects.Geometry.Mesh");
        }
      }
    }
  });

  it("spreads revisions over distinct months, which the charts depend on", () => {
    for (const project of DEMO_PROJECTS) {
      const months = project.revisions.map((revision) => revision.date.slice(0, 7));

      expect(new Set(months).size).toBeGreaterThan(1);
    }
  });

  it("keeps the revisions in chronological order", () => {
    for (const project of DEMO_PROJECTS) {
      const dates = project.revisions.map((revision) => Date.parse(revision.date));

      expect([...dates].sort((a, b) => a - b)).toStrictEqual(dates);
    }
  });

  it("produces additions, modifications and removals — the demo needs all three", () => {
    for (const project of DEMO_PROJECTS) {
      const rows = expectations(project);

      expect(rows.reduce((sum, row) => sum + row.added, 0)).toBeGreaterThan(0);
      expect(rows.reduce((sum, row) => sum + row.modified, 0)).toBeGreaterThan(0);
      expect(rows.reduce((sum, row) => sum + row.removed, 0)).toBeGreaterThan(0);
    }
  });

  it("reports no changes for a first revision, because the mirror records none", () => {
    for (const project of DEMO_PROJECTS) {
      const [first] = expectations(project);

      // A baseline has no predecessor to diff against. Claiming its elements as
      // additions would predict a number the charts never show.
      expect(first.baseline).toBe(true);
      expect(first.added).toBe(0);
      expect(first.modified).toBe(0);
      expect(first.removed).toBe(0);
      expect(first.elements).toBeGreaterThan(0);
    }
  });

  it("marks only the first revision as the baseline", () => {
    for (const project of DEMO_PROJECTS) {
      const rows = expectations(project);

      expect(rows.filter((row) => row.baseline)).toHaveLength(1);
      expect(rows[0].baseline).toBe(true);
    }
  });
});

describe("flattenForUpload", () => {
  const elements = [element("abutment", 1), element("deck", 1)];

  it("gives every uploaded object an id", () => {
    const { objects, root } = flattenForUpload(elements);

    // The viewer builds a world-tree node per object and reads node.model.id.
    // One object without an id throws "can't access property includes,
    // t.model.id is undefined" and the revision will not render.
    expect(root.id).toBeTruthy();
    for (const object of objects) expect(object.id).toBeTruthy();
  });

  it("detaches geometry, the way Speckle's own importer does", () => {
    const { objects } = flattenForUpload(elements);

    const built = objects.filter((o) => o.speckle_type.startsWith("Objects.BuiltElements"));
    const meshes = objects.filter((o) => o.speckle_type === "Objects.Geometry.Mesh");

    expect(built).toHaveLength(2);
    expect(meshes).toHaveLength(2);

    // displayValue holds references, not the mesh itself.
    for (const entry of built) {
      expect(entry.displayValue[0].speckle_type).toBe("reference");
      expect(meshes.some((m) => m.id === entry.displayValue[0].referencedId)).toBe(true);
    }
  });

  it("lists every descendant in the root closure, which is how children are read", () => {
    const { root, objects } = flattenForUpload(elements);

    for (const object of objects) {
      expect(root.__closure[object.id]).toBeGreaterThan(0);
    }
    // Elements sit one level down, their geometry two.
    const mesh = objects.find((o) => o.speckle_type === "Objects.Geometry.Mesh");
    const built = objects.find((o) => o.speckle_type.startsWith("Objects.BuiltElements"));
    expect(root.__closure[built.id]).toBe(1);
    expect(root.__closure[mesh.id]).toBe(2);
  });

  it("hashes content, so an unchanged element keeps its id and a grown one does not", () => {
    const same = flattenForUpload([element("abutment", 1)]);
    const again = flattenForUpload([element("abutment", 1)]);
    const grown = flattenForUpload([element("abutment", 1, 1.25)]);

    expect(same.root.id).toBe(again.root.id);
    expect(grown.root.id).not.toBe(same.root.id);
  });
});
