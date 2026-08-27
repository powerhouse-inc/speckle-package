# Speckle analytics: design

**Date:** 2026-08-27
**Status:** implemented and verified

## Purpose

Give the Speckle demo fast, multi-dimensional analytics over the mirrored model
history: how quantities develop over calendar time, when and by whom revisions
land, which trades are volatile in which period, which elements keep being
touched, and how projects compare in a portfolio.

The existing *Trends* tab already plots per-revision series straight from one
mirror document. That stays. Analytics adds what a single document cannot
answer: calendar-time axes, cross-project aggregation, and rankings.

## Constraints

- The analytics processor runs **only in switchboard**, never in Connect.
- The editors query **over GraphQL**.
- Queries must be fast, and their cost must scale with periods × categories, not
  with object count.

## Carrier decision

**A, B, C, F use the Powerhouse analytics store**, written server-side by a
processor and read through the already-mounted `/graphql/analytics` endpoint.

**D (hot-spot elements) uses a relational table plus our own subgraph**, because
the analytics query language cannot express it: there is no `count`, no `having`
and no ordering by an aggregate — every result row carries only `value` (the
per-period delta) and `sum` (the running cumulative).

### Why the analytics store fits at all

The engine models *flows*, not *stocks*: it discretises records into periods and
reports a delta and a running total. Quantities in a model are stocks. The fit
comes from the mirror's own shape — change entries are already deltas. So the
processor writes quantity **deltas** and the UI reads `sum` for the absolute
mass and `value` for the movement. The baseline revision writes the opening
balance.

## The analyses

| # | Analysis | Metrics | Grouped by |
| --- | --- | --- | --- |
| A | Quantity development over calendar time | `Volume`, `Area`, `Length`, `Elements` | period × category (× project) |
| B | Model activity per date | `Revisions` | period × tool × author |
| C | Churn per trade per period | `Added`, `Modified`, `Removed` | period × category |
| D | Hot-spot elements | — (relational) | element identity |
| F | Portfolio comparison | `Volume`, `Elements` | period × project |

`Truncated` is written alongside as a data-quality counter, so no chart presents
a capped read as if it were complete.

## What the processor writes

One processor, `processorApps: ["switchboard"]`, `startFrom: "beginning"` — the
scaffold does not set the latter, and without it existing history is never
backfilled.

It reacts to operations on `speckle/project` documents, reads `resultingState`,
and per document does `clearSeriesBySource(source, true)` followed by the series
for that document. Clear-and-rewrite is this store's idempotency primitive:
there is no per-processor namespace and no migration step.

- **Source path:** `speckle/analytics/<projectDocumentId>` — the unit of
  clear-and-rewrite, and what an editor subscribes to.
- **Timestamp:** the revision's `createdAt` — when someone pushed, which is the
  only calendar axis that means anything. Falls back to `syncedAt`.
- **Dimensions as paths:** `project/<projectId>`, `model/<speckleModelId>`,
  `category/Objects/BuiltElements/Wall`, `tool/<sourceApplication>`,
  `author/<authorName>`. The Speckle type's dots become path segments, so
  `lod: 3` rolls up to `Objects/BuiltElements` and `lod: 4` reaches the leaf —
  trade-level aggregation falls out of the path hierarchy for free.

## Document model change

Hot spots need stable element identity across revisions. The mirror currently
stores only Speckle object ids, which are content hashes and therefore change on
every edit.

`RECORD_CHANGE` replaces `addedObjectIds` / `modifiedObjectIds` /
`removedObjectIds` with:

```graphql
type TouchedElement {
    id: OID!
    identity: String!      # applicationId where present, else id:<hash>
    objectId: String!      # the Speckle object id, for the viewer
    speckleType: String!
    kind: ChangeKind!      # ADDED | MODIFIED | REMOVED
}
```

The 3D view is unaffected: it consumes `highlight`, which the editor derives.

This keeps the read models rebuildable from the document's own operation history,
without touching Speckle — the property that makes a read model trustworthy.

## Query surface

```graphql
{ analytics { series(filter: {
      start: "…", end: "…", granularity: daily,
      metrics: ["Volume"],
      dimensions: [{ name: "category", select: "speckle/category", lod: 4 }]
    }) { period start end rows { metric unit value sum dimensions { name path label } } } } }
```

Hot spots come from our own subgraph over the relational table, grouped by
element identity with a `HAVING` on the touch count.

## Where the charts live

- **Mirror editor** — A with a granularity switch, B, C as a category × period
  heatmap, D as a ranked table. Scoped to that project.
- **Drive app** — F: quantity per project per period, plus activity across all
  projects.

## Demo data

A second project is seeded (Südkai Tower, three revisions, a different category
mix) so the portfolio axis has something to compare.

## Known costs, accepted

- `addSeriesValues` issues one INSERT round-trip per value, sequentially, with no
  transaction. At a few hundred rows per sync this is irrelevant; on a real
  portfolio it is the first thing to optimise.
- The store's `value` column is `real` (float4, ~7 significant digits). Fine for
  cubic metres; it would not be fine for money.
- `AnalyticsSeries` has seven single-column indexes and no composite index, and
  the engine applies `end` but not `start` as a SQL filter, so every query reads
  the matching metric's full history. Bounded and acceptable at demo scale.

## Testing

- Series construction is a pure function of document state, unit tested against
  a fixed mirror state: metric names, delta arithmetic, path building, period
  timestamps, the baseline opening balance, and truncation counting.
- Hot-spot ranking is a pure function over touched elements, unit tested.
- Reducer coverage stays at 100% on every metric.
- Query latency is measured against the seeded data in a browser, with the
  acceptance bar: a chart query well under 200 ms warm, the tab painted under
  ~500 ms, and no dependence on object count.

## What implementation changed about this design

Three things only became visible while building, and the design above is written
as it now stands rather than as it was first drafted.

**The processor must be registered once per reactor, not once per drive.** The
factory is called per drive, but this processor subscribes to every
`speckle/project` document and writes into one analytics store. Registered per
drive, two instances rebuilt the same document and interleaved one instance's
`clearSeriesBySource` with the other's writes — every series counted four times
over. The factory now builds exactly one record and returns an empty list for
every later drive, and its relational namespace is keyed on a constant rather
than a drive id so the subgraph can find the table.

**Rebuilds are serialised per document.** Each rebuild is total, so two of them
overlapping for one document corrupts the result the same way. A burst of
batches now collapses into a single rerun.

**`clearSeriesBySource` returns a driver result, not a count.** Worth knowing
before using its return value for anything.

## Verified

Against both seeded projects, checked by hand from the source data:

| | Bridge | Tower |
| --- | --- | --- |
| Revisions | 4 | 3 |
| Elements (newest revision) | 38 | 37 |
| Added / Modified / Removed | 9 / 16 / 5 | 24 / 8 / 1 |
| Volume | 543.76 | 324.79 |

Query latency, warm, against `/graphql/analytics` and `/graphql/speckle-hotspots`:
**11–22 ms** — well inside the 200 ms bar, and independent of object count
because the series are pre-aggregated per period and category.

The seeded revision dates were spread across June to August in Speckle's own
database, interleaved between the two projects. Without that every revision fell
on the day it was seeded and the calendar axis was degenerate.
