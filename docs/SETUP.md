# Setup

This walks from an empty machine to a demo you can click through: three building
projects in Speckle — two with three months of revision history, one imported
from a real IFC file — mirrored into Powerhouse documents, with mass
development, change activity and hot-spot elements coming out of the analytics.

There are two ways to run it. Take the first unless you have a reason not to.

- **[Everything in Docker](#everything-in-docker)** — one stack, three commands.
- **[Without Docker](#without-docker)** — you bring a Speckle server, Powerhouse
  runs from source.

Both end at the same place, and both use the same seed script.

## What you should end up with

| | |
|---|---|
| Speckle | <http://127.0.0.1> — the projects, the versions, Speckle's own viewer |
| Connect | <http://localhost:3000> — the drive app, the editors, the charts |
| Switchboard | <http://localhost:4001> — `/graphql`, `/graphql/analytics`, `/mcp` |

## Everything in Docker

### What you need

- Docker with Compose v2 (`docker compose version` must work — not the old
  `docker-compose`)
- Node 24 or newer, only to run the seed script
- Ports 80, 3000, 4001, 5432, 6379 and 9000 free. If a standalone Speckle stack
  is already running it holds four of them; stop it first, or change the ports
  in `.env`.
- About 6 GB of disk for the images and roughly 10 minutes for the first build

### Bring it up

```bash
git clone git@github.com:powerhouse-inc/speckle-package.git
cd speckle-package
./start.sh
```

The first run builds two images and pulls Speckle's nine, so it takes a while.
It creates `.env` from `.env.example`, checks the ports before binding them, and
waits until Speckle, the switchboard and Connect all answer before printing the
URLs. Later runs reuse the build cache.

If it stops with a port conflict, it names the container holding the port. Stop
that container, or edit the port in `.env` and run it again.

### Seed the demo

```bash
node scripts/seed.mjs
```

One command, no clicks. It registers a Speckle account, mints an access token,
creates the two generated projects with their revisions, imports the sample IFC
as a third, moves the revision dates into June–August, then creates the
Powerhouse drive, the mirrors and the sync jobs and waits for them to finish. It prints the account it created, the token, a
table of what the demo should now show, and the link to open.

Read `scripts/seed.mjs` if you want to know *why* each step is the way it is —
the four things that are not obvious are written down at the top of the file.

### Look at it

Open the link the script printed. It looks like this:

```
http://localhost:3000/?driveUrl=http%3A%2F%2Flocalhost%3A4001%2Fd%2F<drive-id>
```

The `driveUrl` parameter saves you adding the drive by hand. You should land on
the **Speckle Portfolio** drive app: two mirrors, two sync jobs, and portfolio
charts across both projects. Open a mirror for the Model Explorer — the 3D view,
the revision timeline, the mass table, and the change list. Click an element in
the 3D view for its properties and its history.

### Check it worked

The seed script ends with a table of what the analytics should report. It is
computed from the same data it uploaded, using the same comparison rule the
mirror applies, so it is a real prediction rather than a second set of figures.
For the seeded data it reads:

```
  Nordkai Bridge — Revit
    date         elements    volume m³   added  modified  removed
    2026-06-15       10      160.32    baseline (no predecessor)
    2026-06-29       14     196.666       4         2        0
    2026-07-20       13      266.43       1         2        2
    2026-08-17       14     280.951       2         1        1

  Suedkai Tower — Rhino
    date         elements    volume m³   added  modified  removed
    2026-06-22       28     330.624    baseline (no predecessor)
    2026-07-13       31     335.366       3         4        0
    2026-08-10       27     260.895       0         1        4
```

A first revision has no predecessor, so the mirror records no change entry for
it and the charts show no movement in that period. That is why the first row
says *baseline* instead of claiming ten additions.

To see the same numbers coming out of the API rather than the browser:

```bash
curl -s -X POST http://localhost:4001/graphql/analytics \
  -H 'content-type: application/json' \
  -d '{"query":"query($f: AnalyticsFilter) { analytics { series(filter: $f) { period rows { metric value sum dimensions { name path } } } } }",
       "variables":{"f":{"start":"2026-05-01","end":"2026-09-30","granularity":"monthly","metrics":["Volume","Elements"],"dimensions":[{"name":"project","select":"speckle/project","lod":3}]}}}'
```

### Day to day

```bash
./start.sh --no-build   # start without rebuilding
./start.sh --rebuild    # rebuild the two images from scratch
./start.sh --debug      # also start maildev, to read Speckle's outgoing mail
./start.sh --down       # stop, keep the data
./start.sh --down-all   # stop and delete the data, so the next start is empty
docker compose logs -f switchboard
```

`--down-all` followed by `./start.sh` and `node scripts/seed.mjs` puts you back
at a clean demo in a few minutes. That is the fastest way out of a confusing
state.

### The third project: a real IFC

Besides the two generated projects, the seed imports a real IFC file —
`samples/Duplex_A_20110907.ifc.gz`, a small two-storey residential building
published under CC BY 4.0 (see `samples/NOTICE.md`). It goes through Speckle's
own importer, so the demo covers the second data shape the package has to read:
imported objects are typed `Objects.Data.DataObject` with the real class in
`ifcType`, and quantities live under `properties.Quantities.BaseQuantities`.

Two honest limits on this project. A file import produces exactly **one**
version, so it has masses and categories but no change history — nothing to
diff against. And its **mass columns stay empty**, because this particular
export carries no element quantities at all: its only quantity sets are "GSA
Space Areas" on `IfcSpace`, not the standard `BaseQuantities` on elements. The
categories come through in full — 56 `IfcWallStandardCase`, 24 `IfcWindow`, 21
`IfcSlab`, 14 `IfcDoor` and ten more classes — which is what makes it worth
having. Many real exports are like this; it is worth knowing before a client
asks why the tonnage is blank.

Skip it with `--no-ifc`, or use your own model with `--ifc <path>` (plain or
gzipped). To mirror something already sitting in Speckle — an IFC you uploaded
through the web UI, say — copy the project id out of its URL:

```bash
node scripts/seed.mjs --only powerhouse --mirror <project-id> --drive <drive-id>
```

## Without Docker

**Read this first:** Speckle is only distributed as container images. There is
no supported way to run a Speckle server without Docker, and this package cannot
change that. So "without Docker" means: **you bring a Speckle server** — your
own instance, or a hosted one such as `app.speckle.systems` — and only the
Powerhouse half runs from source on your machine.

If you have no Speckle server at all, use the Docker path.

### What you need

- Node 24 or newer
- A Speckle server you can reach, and a personal access token for it
  (Speckle: your avatar → *Settings* → *Access tokens*, scopes `streams:read`,
  `streams:write`, `users:read`)
- Ports 3001 and 4001 free

### Bring it up

```bash
git clone git@github.com:powerhouse-inc/speckle-package.git
cd speckle-package
npm ci
npm run vetra -- --dev
```

`ph vetra --dev` starts two things: Vetra Connect on <http://localhost:3001>,
which is Connect with this package's editors loaded from source, and a
switchboard on <http://localhost:4001> with the processors, the subgraphs and
the MCP endpoint. It reloads when you edit the source, which is why this is the
path to take when you are developing rather than demonstrating.

The port is 3001 here and 3000 in the Docker stack, and 3001 is not a fallback
from a busy 3000: Vetra Connect's own default is 3001 (`ph`'s
`DEFAULT_VETRA_CONNECT_PORT`), separate from the 3000 used by `ph connect` in
studio mode. The `studio.port` setting in `powerhouse.config.json` configures
that other one, so changing it does not move Vetra Connect.

Storage is a local PGlite database under `.ph/`, not Postgres. Nothing else is
needed.

### Seed the demo

```bash
export SPECKLE_TOKEN=<your token>
export CONNECT_URL=http://localhost:3001   # so the printed link points at Vetra Connect
node scripts/seed.mjs --speckle https://your-speckle.example.com
```

Two differences from the Docker path, both of which the script tells you about
as it runs:

**The revision dates stay at today.** Speckle stamps a version's `createdAt` at
upload time and offers no way to override it, so the Docker path rewrites the
dates directly in its own database. Against a Speckle you do not own, that is
neither possible nor appropriate. The demo still works, but every revision falls
in the current month, so the time-series charts show one period instead of
three. If that matters for a presentation, use the Docker path.

**The runner uses your token.** With no `SPECKLE_TOKEN` in the switchboard's
environment the background runner can only read public projects. Started through
`ph vetra`, the switchboard inherits the variable from your shell, so exporting
it as above is enough.

### If Speckle runs in Docker but Powerhouse does not

A useful middle: keep the Docker stack for Speckle and Postgres, and run
Powerhouse from source against it.

```bash
docker compose up -d postgres redis minio speckle-server speckle-frontend-2 \
  speckle-ingress preview-service webhook-service ifc-import-server
npm run vetra -- --dev
CONNECT_URL=http://localhost:3001 node scripts/seed.mjs
```

Backdating works here, because the script can still reach the stack's own
database. The runner also reaches Speckle without any rewriting, since it runs
on the host where `http://127.0.0.1` means what it says.

If Speckle already holds the projects and you only want the Powerhouse half:

```bash
CONNECT_URL=http://localhost:3001 node scripts/seed.mjs --only powerhouse \
  --mirror <project-id> --mirror <project-id>
```

## When something looks wrong

**Connect shows a plain file list instead of the drive app.** Connect chooses the
drive app from the drive header's `meta.preferredEditor` and falls back to the
generic explorer without saying so. The seed script sets it at creation. If you
made the drive by hand — especially through MCP's `addDrive`, which accepts the
field and applies neither it nor the name — set it afterwards:

```bash
curl -s -X POST http://localhost:4001/graphql/r \
  -H 'content-type: application/json' \
  -d '{"query":"mutation($d:String!,$e:String){ setPreferredEditor(documentIdentifier:$d, preferredEditor:$e){ id preferredEditor } }",
       "variables":{"d":"<drive-id>","e":"speckle-workspace"}}'
```

Connect is a PWA, so a stale service worker can also serve you the old page —
reload with Ctrl+Shift+R.

**The switchboard starts but serves no document models.** In Docker this cannot
happen silently any more: the image asserts at build time that the package
resolves. If you see it, check that `PH_PACKAGES` is set in the container and
that `ph build` ran — the long explanation is in the README under *Notes for
anyone extending this package*.

**A sync stays REQUESTED and never finishes.** The runner is a processor, and
processors are registered when the reactor starts. If you generated or changed a
processor, restart the switchboard. `docker compose logs switchboard` shows what
loaded.

**A sync fails with a connection error.** The sync document holds the URL the
*browser* uses, which inside a container points at the container itself. The
compose file sets `SPECKLE_PUBLIC_ORIGIN` and `SPECKLE_INTERNAL_ORIGIN` so the
runner rewrites just the origin for its own fetches. Outside Docker neither is
set and nothing is rewritten.

**Charts are empty but the mirror has revisions.** The analytics processor writes
its read model on each mirror change. Check the range you are asking for covers
the revision dates — with backdating skipped, that is the current month, not
June to August.

## Starting over

```bash
./start.sh --down-all     # Docker: delete Speckle's and Powerhouse's data
rm -rf .ph                # Without Docker: delete the local reactor storage
```

Then bring it up and seed again. The seed script never edits what exists; it
creates fresh projects and a fresh drive each run, so re-running it after a
partial failure is safe and leaves nothing half-written behind.
