/**
 * The demo, as data.
 *
 * This module is pure: it describes two Speckle projects, the revisions each
 * one went through, and the building elements in every revision. It performs
 * no network calls, so it can be read, reasoned about and unit-tested on its
 * own. `seed.mjs` is the half that talks to Speckle and to the reactor.
 *
 * Two things in here are not arbitrary and are worth understanding before you
 * change the numbers.
 *
 * **Identity.** An element keeps the same `applicationId` across revisions.
 * That is what makes the mirror able to say "this wall was *modified*" instead
 * of "a wall vanished and a different one appeared". Speckle's own object id is
 * a hash of the content, so it changes whenever anything about the element
 * changes — it can never serve as an identity. Real authoring tools behave the
 * same way: Revit's element GUID and IFC's GlobalId both land in
 * `applicationId`.
 *
 * **Geometry.** Every element carries a `displayValue` mesh so the 3D viewer
 * has something to draw. Meshes are typed `Objects.Geometry.Mesh`, which the
 * mirror deliberately does *not* count as building elements — otherwise every
 * wall would be counted twice, once as a wall and once as its own geometry.
 */

import { createHash } from "node:crypto";

/** Metres. Speckle records a unit per object and the mirror reads it. */
const UNITS = "m";

/**
 * One axis-aligned box, as a Speckle mesh.
 *
 * `faces` is Speckle's flat encoding: each face starts with its vertex count
 * (3 for a triangle), followed by that many vertex indices. `vertices` is a
 * flat x, y, z run. Six quads become twelve triangles.
 */
export function boxMesh(origin, size) {
  const [x, y, z] = origin;
  const [w, d, h] = size;

  const vertices = [
    x, y, z,
    x + w, y, z,
    x + w, y + d, z,
    x, y + d, z,
    x, y, z + h,
    x + w, y, z + h,
    x + w, y + d, z + h,
    x, y + d, z + h,
  ];

  // bottom, top, and the four sides
  const quads = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];

  const faces = [];
  for (const [a, b, c, e] of quads) {
    faces.push(3, a, b, c, 3, a, c, e);
  }

  return {
    speckle_type: "Objects.Geometry.Mesh",
    units: UNITS,
    vertices,
    faces,
  };
}

/**
 * The catalogue of element kinds the demo builds from.
 *
 * `size` drives both the geometry and the quantities, so a "grown" element is
 * bigger in the viewer *and* heavier in the mass table — the two never
 * disagree, which is the whole point of deriving one from the other.
 */
const KINDS = {
  abutment: { type: "Objects.BuiltElements.Wall", size: [1.2, 6, 4] },
  deck: { type: "Objects.BuiltElements.Floor", size: [12, 8, 0.4] },
  girder: { type: "Objects.BuiltElements.Beam", size: [12, 0.4, 0.9] },
  column: { type: "Objects.BuiltElements.Column", size: [0.6, 0.6, 3.2] },
  slab: { type: "Objects.BuiltElements.Floor", size: [10, 10, 0.3] },
  facade: { type: "Objects.BuiltElements.Wall", size: [10, 0.3, 3.2] },
  door: { type: "Objects.BuiltElements.Door", size: [1.1, 0.2, 2.1] },
};

/**
 * One building element, ready to upload.
 *
 * `scale` is how a *modification* is expressed: the same element, same
 * `applicationId`, but larger. Everything else follows — volume, area, and the
 * mesh the viewer draws.
 */
export function element(kind, index, scale = 1) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`Unknown element kind: ${kind}`);

  const [w, d, h] = spec.size.map((value) => value * scale);

  // Laid out in a row so the viewer shows a legible model rather than a pile
  // of coincident boxes.
  const origin = [index * (w + 1), 0, 0];

  return {
    speckle_type: spec.type,
    applicationId: `${kind}-${index}`,
    units: UNITS,
    // Rounded to millimetres: floating point noise in a mass table reads as a
    // bug even when the arithmetic is right.
    volume: round(w * d * h),
    area: round(w * d),
    length: round(Math.max(w, d, h)),
    name: `${kind} ${index}`,
    displayValue: [boxMesh(origin, [w, d, h])],
  };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * A revision plan, applied to the previous revision's elements.
 *
 * - `add`: `[kind, count]` — appends new elements of that kind
 * - `grow`: `[kind, count, scale]` — modifies the first `count` elements of
 *   that kind, keeping their identity
 * - `remove`: `[kind, count]` — deletes the *last* `count` of that kind
 *
 * Deleting from the end and modifying from the front keeps a plan readable:
 * the two never fight over the same element within one revision.
 */
export function applyPlan(previous, plan) {
  const elements = previous.map((entry) => ({ ...entry }));

  for (const [kind, count, scale] of plan.grow ?? []) {
    const matching = elements.filter((entry) => entry.applicationId.startsWith(`${kind}-`));

    for (const entry of matching.slice(0, count)) {
      const index = Number(entry.applicationId.split("-").pop());
      Object.assign(entry, element(kind, index, scale));
    }
  }

  for (const [kind, count] of plan.remove ?? []) {
    const matching = elements.filter((entry) => entry.applicationId.startsWith(`${kind}-`));

    for (const entry of matching.slice(-count)) {
      elements.splice(elements.indexOf(entry), 1);
    }
  }

  for (const [kind, count] of plan.add ?? []) {
    const existing = elements.filter((entry) =>
      entry.applicationId.startsWith(`${kind}-`),
    ).length;

    for (let n = 0; n < count; n += 1) {
      elements.push(element(kind, existing + n + 1));
    }
  }

  return elements;
}

/**
 * The two projects the seed creates.
 *
 * The dates matter more than they look. Speckle stamps a version's `createdAt`
 * at upload time and its API accepts no override, so without the backdating
 * step in `seed.mjs` every revision below would land on today — and every
 * time-series chart in the demo would collapse into a single column. Spread
 * over three months, the same charts show a story.
 *
 * `sourceApplication` differs per project on purpose: it is a dimension the
 * analytics can group by, and two projects from one tool would not show that.
 */
export const DEMO_PROJECTS = [
  {
    key: "bridge",
    name: "Nordkai Bridge",
    description: "Two-span road bridge over the north basin. Seeded demo data.",
    modelName: "structure/main",
    sourceApplication: "Revit",
    revisions: [
      {
        date: "2026-06-15T09:20:00Z",
        message: "Structural concept: abutments, deck, girders",
        plan: { add: [["abutment", 2], ["deck", 2], ["girder", 6]] },
      },
      {
        date: "2026-06-29T14:05:00Z",
        message: "Girder layout revised after wind study",
        plan: { add: [["girder", 4]], grow: [["abutment", 2, 1.1]] },
      },
      {
        date: "2026-07-20T11:40:00Z",
        message: "Deck widened, two girders dropped",
        plan: { add: [["deck", 1]], grow: [["deck", 2, 1.15]], remove: [["girder", 2]] },
      },
      {
        date: "2026-08-17T16:10:00Z",
        message: "Abutment reinforcement, inspection hatches added",
        plan: { add: [["door", 2]], grow: [["abutment", 1, 1.25]], remove: [["girder", 1]] },
      },
    ],
  },
  {
    key: "tower",
    name: "Suedkai Tower",
    description: "Eight-storey office building on the south quay. Seeded demo data.",
    modelName: "architecture/shell",
    sourceApplication: "Rhino",
    revisions: [
      {
        date: "2026-06-22T10:00:00Z",
        message: "Massing: slabs, columns, facade",
        plan: { add: [["slab", 8], ["column", 12], ["facade", 8]] },
      },
      {
        date: "2026-07-13T13:30:00Z",
        message: "Core columns enlarged, entrance doors placed",
        plan: { add: [["door", 3]], grow: [["column", 4, 1.2]] },
      },
      {
        date: "2026-08-10T09:15:00Z",
        message: "Top two storeys removed after cost review",
        plan: { remove: [["slab", 2], ["facade", 2]], grow: [["slab", 1, 1.05]] },
      },
    ],
  },
];

/** Every revision of a project, with its elements resolved. */
export function buildRevisions(project) {
  const revisions = [];
  let elements = [];

  for (const revision of project.revisions) {
    elements = applyPlan(elements, revision.plan);
    revisions.push({ ...revision, elements });
  }

  return revisions;
}

/**
 * What the demo should show once seeded.
 *
 * Computed from the same data the upload uses, and by comparing consecutive
 * revisions on `applicationId` — the same rule the mirror's diff applies. So
 * these numbers are a genuine prediction of what the editors will display, not
 * a second set of figures maintained by hand.
 *
 * The first revision is marked `baseline`. It has no predecessor, so the mirror
 * records no change entry for it and the charts show no additions in that
 * period — even though every element in it is new. Reporting it as "+10 added"
 * here would set up a comparison that can never match.
 */
export function expectations(project) {
  const revisions = buildRevisions(project);
  const rows = [];
  let previous = [];
  let first = true;

  for (const revision of revisions) {
    const before = new Map(previous.map((entry) => [entry.applicationId, entry]));
    const after = new Map(revision.elements.map((entry) => [entry.applicationId, entry]));

    let added = 0;
    let modified = 0;
    let removed = 0;

    for (const [id, entry] of after) {
      const old = before.get(id);
      if (!old) added += 1;
      else if (old.volume !== entry.volume) modified += 1;
    }

    for (const id of before.keys()) if (!after.has(id)) removed += 1;

    rows.push({
      date: revision.date.slice(0, 10),
      message: revision.message,
      elements: revision.elements.length,
      volume: round(revision.elements.reduce((sum, entry) => sum + entry.volume, 0)),
      baseline: first,
      added: first ? 0 : added,
      modified: first ? 0 : modified,
      removed: first ? 0 : removed,
    });

    previous = revision.elements;
    first = false;
  }

  return rows;
}


/**
 * Turns a revision's elements into the flat set of objects Speckle stores.
 *
 * Every Speckle object is content-addressed: its `id` is a hash of what it
 * contains, which is also why an id can never serve as an element's identity —
 * that is `applicationId`'s job.
 *
 * Two rules here are not decoration, and getting either wrong breaks something
 * that is hard to trace back:
 *
 * **Every object needs an id.** The viewer builds a world-tree node per object
 * and reads `node.model.id`. A single object without one throws "can't access
 * property includes, t.model.id is undefined" from deep inside the library, and
 * the whole revision refuses to render.
 *
 * **Geometry is detached, not nested.** Speckle's own importer stores each mesh
 * as its own object and puts a `reference` in `displayValue`. The mirror also
 * depends on this: it reads a revision through the `children` query, which
 * walks the root's `__closure`, and only listed descendants are reachable.
 *
 * **Every object with detached children carries its own closure**, not just the
 * root. Speckle resolves an object's references through *that object's* closure,
 * so an element loaded on its own — which the Model Explorer does for deleted
 * elements, to show them in red — needs its geometry listed on itself. Without
 * it the reference dangles, the load never completes, and the viewer sits on
 * "loading from Speckle" over a scene that has already drawn.
 */
export function flattenForUpload(elements) {
  const objects = [];
  const closure = {};

  const hash = (object) =>
    createHash("sha256").update(JSON.stringify(object)).digest("hex").slice(0, 32);

  const store = (object, depth) => {
    const id = hash(object);
    const stored = { ...object, id };
    objects.push(stored);
    // Keep the shallowest depth if something is referenced twice.
    closure[id] = Math.min(closure[id] ?? depth, depth);
    return stored;
  };

  const references = [];

  for (const entry of elements) {
    const { displayValue, ...rest } = entry;

    const geometry = (displayValue ?? []).map((mesh) => {
      const stored = store(mesh, 2);
      return { speckle_type: "reference", referencedId: stored.id };
    });

    const stored = store(
      {
        ...rest,
        displayValue: geometry,
        // The element's own closure: its geometry, one level down.
        ...(geometry.length > 0
          ? {
              __closure: Object.fromEntries(
                geometry.map((reference) => [reference.referencedId, 1]),
              ),
            }
          : {}),
      },
      1,
    );
    references.push({ speckle_type: "reference", referencedId: stored.id });
  }

  const rootBody = {
    speckle_type: "Base",
    elements: references,
    __closure: closure,
  };

  return { root: { ...rootBody, id: hash(rootBody) }, objects };
}
