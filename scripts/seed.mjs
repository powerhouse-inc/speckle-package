#!/usr/bin/env node
/**
 * Seeds the whole demo: two Speckle projects with a revision history, then the
 * Powerhouse drive, mirrors and sync jobs that read them.
 *
 * Run it against a stack that is already up (see docs/SETUP.md):
 *
 *   node scripts/seed.mjs                        # everything, local Docker stack
 *   node scripts/seed.mjs --only powerhouse      # skip Speckle, mirror what is there
 *   node scripts/seed.mjs --no-ifc               # skip the IFC import
 *   node scripts/seed.mjs --mirror ad9d45dd0b    # also mirror an existing project
 *   node scripts/seed.mjs --help
 *
 * It is safe to re-run: it creates new Speckle projects and a new drive each
 * time rather than trying to reconcile with what exists. Nothing is deleted.
 *
 * ---------------------------------------------------------------------------
 * Five things in here are not obvious, and each one cost real time to find out.
 * ---------------------------------------------------------------------------
 *
 * 1. **No clicking required.** A fresh Speckle has no account and no token, and
 *    the sync runner needs one. Rather than asking you to register in the web
 *    UI, this script drives Speckle's own local-strategy flow: register, take
 *    the `access_code` out of the redirect, exchange it for a session token
 *    through the pre-seeded `spklwebapp` app, then mint a personal access
 *    token with that session. It prints the credentials so you can also log in
 *    by hand afterwards.
 *
 * 2. **Detached children, not nested objects.** The mirror reads a version's
 *    elements through Speckle's `project.object.children` query, and that query
 *    walks the root object's `__closure` map. Elements nested inside the root
 *    object would be invisible to it. So every element is uploaded as its own
 *    object, and the root references them and lists them in `__closure`.
 *
 * 3. **Backdating needs SQL.** Speckle stamps a version's `createdAt` at upload
 *    time, and neither `CreateVersionInput` nor the older `CommitCreateInput`
 *    accepts a date. Without a fix every seeded revision would land on today,
 *    and every time-series chart in the demo would collapse into one column.
 *    There is no API for it, so the script rewrites the `commits` rows through
 *    `docker compose exec postgres psql`. That only works for the local Docker
 *    Speckle; against any other server the step is skipped and said out loud.
 *
 * 4. **S3 wants its ETag quoted.** The IFC upload is three calls —
 *    generateUploadUrl, a PUT to the presigned URL, then startFileImport — and
 *    the last one hands back the ETag the PUT returned. It must be passed
 *    *including* the surrounding quotes, exactly as S3 wrote them. Stripping
 *    them fails with "ETag mismatch: expected <the very value you sent>",
 *    which reads like a server bug and is not one.
 *
 * 5. **A drive needs its editor set at creation.** Connect picks the drive app
 *    from the drive header's `meta.preferredEditor`, and falls back to the
 *    generic "Drive Explorer App" without explaining itself. The
 *    `createDocument` mutation takes `preferredEditor` and sets it properly —
 *    unlike `addDrive` over MCP, which accepts the field and applies neither it
 *    nor the name. The visible drive name is separate state and needs
 *    `setDriveName`.
 */

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  DEMO_PROJECTS,
  buildRevisions,
  expectations,
  flattenForUpload,
} from "./seed-data.mjs";

const run = promisify(execFile);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const HELP = `
Seed the Speckle x Powerhouse demo.

  --speckle <url>       Speckle server            (default http://127.0.0.1)
  --switchboard <url>   Powerhouse switchboard    (default http://localhost:4001)
  --token <pat>         Speckle personal access token
                        (default $SPECKLE_TOKEN; a new account is registered
                        if neither is given)
  --only speckle        Create the Speckle projects and stop
  --only powerhouse     Skip Speckle; mirror projects named with --mirror
  --mirror <id>         Also mirror an existing Speckle project id.
                        Repeatable. Use this for a real IFC you uploaded.
  --ifc <path>          IFC file to import (.ifc or .ifc.gz)
                        (default samples/Duplex_A_20110907.ifc.gz)
  --no-ifc              Skip the IFC project
  --no-backdate         Leave version dates at today
  --drive <id>          Add to an existing drive instead of creating one
  --help
`;

function parseOptions(argv) {
  const options = {
    speckle: "http://127.0.0.1",
    switchboard: "http://localhost:4001",
    token: process.env.SPECKLE_TOKEN ?? null,
    only: null,
    mirror: [],
    backdate: true,
    drive: null,
    ifc: "samples/Duplex_A_20110907.ifc.gz",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) fail(`${argument} needs a value`);
      i += 1;
      return next;
    };

    switch (argument) {
      case "--speckle": options.speckle = trimSlash(value()); break;
      case "--switchboard": options.switchboard = trimSlash(value()); break;
      case "--token": options.token = value(); break;
      case "--only": options.only = value(); break;
      case "--mirror": options.mirror.push(value()); break;
      case "--drive": options.drive = value(); break;
      case "--ifc": options.ifc = value(); break;
      case "--no-ifc": options.ifc = null; break;
      case "--no-backdate": options.backdate = false; break;
      case "--help": case "-h": console.log(HELP); process.exit(0); break;
      default: fail(`unknown option ${argument} (try --help)`);
    }
  }

  if (options.only && !["speckle", "powerhouse"].includes(options.only)) {
    fail(`--only takes "speckle" or "powerhouse"`);
  }

  return options;
}

const trimSlash = (value) => value.replace(/\/+$/, "");

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const step = (message) => console.log(`\n\x1b[1;36m==>\x1b[0m ${message}`);
const note = (message) => console.log(`    ${message}`);
const warn = (message) => console.warn(`\x1b[1;33m!!\x1b[0m  ${message}`);

function fail(message) {
  console.error(`\x1b[1;31mxx\x1b[0m  ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Talking to Speckle
// ---------------------------------------------------------------------------

async function speckleGraphql(options, query, variables, token = options.token) {
  const response = await fetch(`${options.speckle}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    fail(`Speckle answered ${response.status} for a GraphQL call. Is ${options.speckle} the right address?`);
  }

  const body = await response.json();
  if (body.errors) fail(`Speckle rejected a call: ${JSON.stringify(body.errors).slice(0, 400)}`);

  return body.data;
}

/**
 * Waits until Speckle's API answers.
 *
 * Its frontend comes up well before the server has finished migrating, and a
 * seed that starts in that window gets a 404 from /auth — which reads like
 * "registration is disabled" and is really "not yet". So ask the API a trivial
 * question until it replies.
 */
async function waitForSpeckle(options, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  let announced = false;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${options.speckle}/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{ serverInfo { version } }" }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const body = await response.json();
        if (body.data?.serverInfo) {
          if (announced) note(`Speckle ${body.data.serverInfo.version} is up.`);
          return;
        }
      }
    } catch {
      // Not up yet; that is what the loop is for.
    }

    if (!announced) {
      step(`Waiting for Speckle at ${options.speckle}`);
      announced = true;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  fail(`Speckle at ${options.speckle} did not answer within ${timeoutMs / 1000}s.`);
}

/**
 * Gets a personal access token without anyone touching a browser.
 *
 * Speckle's local strategy answers a registration with a 302 whose query
 * carries a one-shot `access_code`. That code plus the pre-seeded `spklwebapp`
 * credentials buys a session token, and a session token can mint a personal
 * access token — which is the durable credential the sync runner wants.
 */
async function ensureToken(options) {
  if (options.token) {
    note("Using the Speckle token you supplied.");
    return options;
  }

  step("No Speckle token given — registering an account.");

  const challenge = randomUUID();
  const account = {
    name: "Demo Seed",
    email: `demo-${Date.now()}@example.org`,
    password: randomUUID().replaceAll("-", ""),
  };

  const registration = await fetch(
    `${options.speckle}/auth/local/register?challenge=${challenge}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      redirect: "manual",
      body: JSON.stringify(account),
    },
  );

  if (registration.status !== 302) {
    fail(
      `Registration returned ${registration.status} instead of a redirect. ` +
      `If this server has local registration disabled, create a token by hand ` +
      `and pass it with --token.`,
    );
  }

  const accessCode = new URL(registration.headers.get("location")).searchParams.get("access_code");

  const exchange = await fetch(`${options.speckle}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accessCode,
      // Seeded into every Speckle server as the web app's own credentials.
      appId: "spklwebapp",
      appSecret: "spklwebapp",
      challenge,
    }),
  });

  const session = (await exchange.json()).token;
  if (!session) fail("Speckle did not return a session token.");

  const minted = await speckleGraphql(
    options,
    `mutation($token: ApiTokenCreateInput!) { apiTokenCreate(token: $token) }`,
    {
      token: {
        name: "demo-seed",
        scopes: ["streams:read", "streams:write", "users:read", "profile:read"],
      },
    },
    session,
  );

  note(`Speckle account : ${account.email}`);
  note(`      password  : ${account.password}`);
  note(`Access token    : ${minted.apiTokenCreate}`);
  note("Put that token in .env as SPECKLE_TOKEN and restart the switchboard if");
  note("you later want it to read private projects.");

  return { ...options, token: minted.apiTokenCreate };
}

/**
 * Uploads one revision and returns the root object id.
 *
 * The shape — every object with an id, geometry detached and referenced, all
 * descendants in the root's `__closure` — is decided by flattenForUpload, which
 * documents why each part matters.
 */
async function uploadRevision(options, projectId, elements) {
  const { root, objects } = flattenForUpload(elements);

  const form = new FormData();
  form.append(
    "batch-1",
    new Blob([JSON.stringify([root, ...objects])], { type: "application/json" }),
    "batch-1.json",
  );

  const response = await fetch(`${options.speckle}/objects/${projectId}`, {
    method: "POST",
    headers: { authorization: `Bearer ${options.token}` },
    body: form,
  });

  if (!response.ok) {
    fail(`Object upload failed with ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  return root.id;
}

async function seedSpeckle(options) {
  const created = [];

  for (const project of DEMO_PROJECTS) {
    step(`Speckle: creating "${project.name}"`);

    const { projectMutations } = await speckleGraphql(
      options,
      `mutation($input: ProjectCreateInput) {
         projectMutations { create(input: $input) { id } }
       }`,
      {
        input: {
          name: project.name,
          description: project.description,
          // Public, so the demo works even with no token in the switchboard.
          visibility: "PUBLIC",
        },
      },
    );
    const projectId = projectMutations.create.id;

    const { modelMutations } = await speckleGraphql(
      options,
      `mutation($input: CreateModelInput!) {
         modelMutations { create(input: $input) { id } }
       }`,
      { input: { projectId, name: project.modelName } },
    );
    const modelId = modelMutations.create.id;

    const versions = [];

    for (const revision of buildRevisions(project)) {
      const objectId = await uploadRevision(options, projectId, revision.elements);

      const { versionMutations } = await speckleGraphql(
        options,
        `mutation($input: CreateVersionInput!) {
           versionMutations { create(input: $input) { id } }
         }`,
        {
          input: {
            projectId,
            modelId,
            objectId,
            message: revision.message,
            sourceApplication: project.sourceApplication,
            totalChildrenCount: revision.elements.length,
          },
        },
      );

      versions.push({ id: versionMutations.create.id, date: revision.date });
      note(`${revision.date.slice(0, 10)}  ${revision.elements.length} elements  ${revision.message}`);
    }

    created.push({ name: project.name, projectId, versions, plan: project });
    note(`project id: ${projectId}`);
  }

  return created;
}

/**
 * The date the imported IFC lands on.
 *
 * After both generated projects, so the portfolio charts also show the case a
 * client cares about: a project joining an existing portfolio partway through.
 */
const IFC_DATE = "2026-08-24T10:30:00Z";

/**
 * Imports a real IFC file, as a third project.
 *
 * Worth having because Speckle's IFC importer produces a different shape from
 * a native connector — objects typed `Objects.Data.DataObject` with the real
 * class in `ifcType`, quantities under `properties.Quantities.BaseQuantities` —
 * and the mirror reads both. Generated geometry cannot exercise that path.
 *
 * A file import produces exactly one version, so this project has masses and
 * categories but no change history. That is a property of file imports, not a
 * shortcoming of the seed.
 */
async function seedIfc(options) {
  step(`Speckle: importing ${options.ifc}`);

  let bytes;
  try {
    bytes = await readFile(options.ifc);
  } catch {
    warn(`Cannot read ${options.ifc} — skipping the IFC project.`);
    return null;
  }

  // Stored gzipped so a 2.4 MB sample costs 450 KB in the repository.
  if (options.ifc.endsWith(".gz")) bytes = gunzipSync(bytes);

  const fileName = options.ifc.split("/").pop().replace(/\.gz$/, "");
  const name = "Duplex Apartment (IFC import)";

  const { projectMutations } = await speckleGraphql(
    options,
    `mutation($input: ProjectCreateInput) {
       projectMutations { create(input: $input) { id } }
     }`,
    {
      input: {
        name,
        description: "Imported from a real IFC file. Seeded demo data.",
        visibility: "PUBLIC",
      },
    },
  );
  const projectId = projectMutations.create.id;

  const { modelMutations } = await speckleGraphql(
    options,
    `mutation($input: CreateModelInput!) {
       modelMutations { create(input: $input) { id } }
     }`,
    { input: { projectId, name: "ifc/duplex" } },
  );
  const modelId = modelMutations.create.id;

  const { fileUploadMutations } = await speckleGraphql(
    options,
    `mutation($input: GenerateFileUploadUrlInput!) {
       fileUploadMutations { generateUploadUrl(input: $input) { url fileId } }
     }`,
    { input: { projectId, fileName } },
  );
  const { url, fileId } = fileUploadMutations.generateUploadUrl;

  const upload = await fetch(url, { method: "PUT", body: bytes });
  if (!upload.ok) fail(`Uploading the IFC to storage failed with ${upload.status}.`);

  // Quotes included, deliberately — see note 4 at the top of the file.
  const etag = upload.headers.get("etag");
  if (!etag) fail("Storage returned no ETag, which startFileImport requires.");

  await speckleGraphql(
    options,
    `mutation($input: StartFileImportInput!) {
       fileUploadMutations { startFileImport(input: $input) { id convertedStatus } }
     }`,
    { input: { projectId, modelId, fileId, etag } },
  );

  note(`${(bytes.length / 1048576).toFixed(1)} MB uploaded, import queued.`);

  // The importer is a separate service working off a queue, so this waits for
  // a version to exist rather than assuming one does.
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const data = await speckleGraphql(
      options,
      `query($projectId: String!, $modelId: String!) {
         project(id: $projectId) {
           model(id: $modelId) {
             versions(limit: 1) { totalCount items { id message } }
           }
         }
       }`,
      { projectId, modelId },
    );

    const versions = data.project.model.versions;
    if (versions.totalCount > 0) {
      note(`imported: ${versions.items[0].message}`);
      note(`project id: ${projectId}`);
      return {
        name,
        projectId,
        versions: [{ id: versions.items[0].id, date: IFC_DATE }],
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  warn("The IFC import did not finish within 5 minutes.");
  warn("Check the importer: docker compose logs ifc-import-server");
  return null;
}

/**
 * Moves the seeded versions back in time.
 *
 * Speckle has no API for this — see note 3 at the top of the file — so it goes
 * straight at the database of the local Docker stack. Anywhere else, the demo
 * still works; it just shows every revision in the current month.
 */
async function backdate(options, projects) {
  step("Backdating the versions");

  const updates = projects.flatMap((project) =>
    project.versions.map(
      ({ id, date }) =>
        `update commits set "createdAt" = '${date}' where id = '${id}';`,
    ),
  );

  try {
    await run("docker", [
      "compose", "exec", "-T", "postgres",
      "psql", "-U", "speckle", "-d", "speckle", "-v", "ON_ERROR_STOP=1",
      "-c", updates.join("\n"),
    ]);
    note(`${updates.length} versions moved into June–August.`);
  } catch (error) {
    warn("Could not reach the local Speckle database, so the dates stay at today.");
    warn(`(${String(error.message).split("\n")[0]})`);
    warn("The demo still works; the time-series charts will show a single period.");
  }
}

// ---------------------------------------------------------------------------
// Talking to the switchboard
// ---------------------------------------------------------------------------

async function reactorGraphql(options, subgraph, query, variables) {
  const response = await fetch(`${options.switchboard}/graphql/${subgraph}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  // A GraphQL validation error arrives as 400 *with* a useful body, so read the
  // body before judging the status.
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail(`The switchboard answered ${response.status} with no JSON. Is it running at ${options.switchboard}?\n${text.slice(0, 300)}`);
  }

  if (body.errors) {
    fail(`The switchboard rejected a call:\n${body.errors.map((entry) => `  ${entry.message}`).join("\n")}`);
  }

  if (!response.ok) fail(`The switchboard answered ${response.status}.`);

  return body.data;
}

async function createDrive(options) {
  step("Creating the drive");

  const data = await reactorGraphql(
    options,
    "document-drive",
    `mutation($name: String!, $editor: String) {
       DocumentDrive {
         createDocument(name: $name, preferredEditor: $editor) { id }
       }
     }`,
    // preferredEditor is what makes Connect open the drive app rather than the
    // generic file listing — see note 4 at the top of the file.
    { name: "Speckle Portfolio", editor: "speckle-workspace" },
  );

  const driveId = data.DocumentDrive.createDocument.id;

  // The header name above is not the name the drive shows; that lives in state.
  await reactorGraphql(
    options,
    "document-drive",
    `mutation($id: PHID!, $input: DocumentDrive_SetDriveNameInput!) {
       DocumentDrive { setDriveName(docId: $id, input: $input) { id } }
     }`,
    { id: driveId, input: { name: "Speckle Portfolio" } },
  );

  note(`drive id: ${driveId}`);
  return driveId;
}

/** One mirror plus one sync job, wired to each other and to a Speckle project. */
async function mirrorProject(options, driveId, { name, projectId }) {
  step(`Mirroring ${name} (${projectId})`);

  const mirror = await reactorGraphql(
    options,
    "speckle-project",
    `mutation($name: String!, $parent: String) {
       SpeckleProject { createDocument(name: $name, parentIdentifier: $parent) { id } }
     }`,
    { name, parent: driveId },
  );
  const mirrorId = mirror.SpeckleProject.createDocument.id;

  const sync = await reactorGraphql(
    options,
    "speckle-sync",
    `mutation($name: String!, $parent: String) {
       SpeckleSync { createDocument(name: $name, parentIdentifier: $parent) { id } }
     }`,
    { name: `Sync — ${name}`, parent: driveId },
  );
  const syncId = sync.SpeckleSync.createDocument.id;

  await reactorGraphql(
    options,
    "speckle-sync",
    `mutation($id: PHID!, $input: SpeckleSync_SetServerConnectionInput!) {
       SpeckleSync { setServerConnection(docId: $id, input: $input) { id } }
     }`,
    // The *browser's* address for Speckle. The runner may need another one; the
    // switchboard's SPECKLE_PUBLIC_ORIGIN / SPECKLE_INTERNAL_ORIGIN handle that.
    { id: syncId, input: { serverUrl: options.speckle, projectId, projectName: name } },
  );

  await reactorGraphql(
    options,
    "speckle-sync",
    `mutation($id: PHID!, $input: SpeckleSync_SetTargetProjectDocumentInput!) {
       SpeckleSync { setTargetProjectDocument(docId: $id, input: $input) { id } }
     }`,
    { id: syncId, input: { targetProjectDocumentId: mirrorId } },
  );

  await reactorGraphql(
    options,
    "speckle-sync",
    `mutation($id: PHID!, $input: SpeckleSync_RequestSyncInput!) {
       SpeckleSync { requestSync(docId: $id, input: $input) { id } }
     }`,
    // Requesting a sync is an operation, not an API call: the runner is a
    // processor reacting to it. That is why there is no "start" endpoint.
    { id: syncId, input: { id: randomUUID(), requestedAt: new Date().toISOString() } },
  );

  return { name, mirrorId, syncId };
}

/** Waits for the runner to finish, and reports what it did. */
async function awaitSync(options, { name, syncId }, timeoutMs = 120_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const data = await reactorGraphql(
      options,
      "speckle-sync",
      // Note the double `document`: the query returns a document-with-children
       // wrapper, and the document itself sits inside it.
      `query($id: String!) {
         SpeckleSync {
           document(identifier: $id) {
             document { state { global {
               status
               runs { outcome message versionsAdded objectsScanned }
             } } }
           }
         }
       }`,
      { id: syncId },
    );

    const global = data.SpeckleSync.document.document.state.global;
    const run = global.runs?.[0];

    if (run && run.outcome !== "PENDING") {
      if (run.outcome === "SUCCESS") {
        note(`${name}: ${run.message} (${run.objectsScanned} objects scanned)`);
        return true;
      }

      warn(`${name}: sync ${run.outcome} — ${run.message}`);
      return false;
    }

    if (global.status === "FAILED") {
      warn(`${name}: sync failed`);
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  warn(`${name}: the runner did not finish within ${timeoutMs / 1000}s.`);
  warn("Check that the switchboard is the one running the processors: docker compose logs switchboard");
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let options = parseOptions(process.argv.slice(2));

  let projects = [];

  if (options.only !== "powerhouse") {
    await waitForSpeckle(options);
    options = await ensureToken(options);
    projects = await seedSpeckle(options);

    if (options.ifc) {
      const imported = await seedIfc(options);
      if (imported) projects.push(imported);
    }

    if (options.backdate) await backdate(options, projects);
  }

  if (options.mirror.length > 0) await waitForSpeckle(options);

  for (const projectId of options.mirror) {
    // Ask Speckle what it is called rather than labelling it with its id.
    const { project } = await speckleGraphql(
      options,
      `query($id: String!) { project(id: $id) { name } }`,
      { id: projectId },
    );

    projects.push({ name: project.name, projectId });
  }

  if (options.only === "speckle") {
    step("Done with Speckle. Run again with --only powerhouse to mirror it.");
    for (const project of projects) note(`${project.name}: ${project.projectId}`);
    return;
  }

  if (projects.length === 0) {
    fail("Nothing to mirror. Name an existing project with --mirror <id>, or drop --only powerhouse.");
  }

  const driveId = options.drive ?? (await createDrive(options));

  const jobs = [];
  for (const project of projects) {
    jobs.push(await mirrorProject(options, driveId, project));
  }

  step("Waiting for the syncs");
  let allWell = true;
  for (const job of jobs) allWell = (await awaitSync(options, job)) && allWell;

  step("What the demo should now show");
  for (const { plan: project } of projects) {
    // A project mirrored with --mirror has no plan here: its history was made
    // elsewhere, so there is nothing for this script to predict.
    if (!project) continue;

    console.log(`\n  ${project.name} — ${project.sourceApplication}`);
    console.log("    date         elements    volume m³   added  modified  removed");
    for (const row of expectations(project)) {
      // A first revision has nothing to be compared against, so the mirror
      // records no change entry and the charts show no movement for it.
      const change = row.baseline
        ? "  baseline (no predecessor)"
        : `   ${String(row.added).padStart(5)}  ${String(row.modified).padStart(8)}  ${String(row.removed).padStart(7)}`;

      console.log(
        `    ${row.date}   ${String(row.elements).padStart(6)}   ${String(row.volume).padStart(9)}${change}`,
      );
    }
  }

  // The imported project has no plan to predict, and one thing about it is
  // surprising enough to say out loud rather than let someone discover it.
  if (projects.some((entry) => !entry.plan && entry.name.includes("IFC"))) {
    console.log(`
  Duplex Apartment (IFC import) — one version, so no change history.
    Its mass columns are empty because that export carries no element
    quantities, only GSA space areas on IfcSpace. Categories come through
    in full: 56 IfcWallStandardCase, 24 IfcWindow, 21 IfcSlab, 14 IfcDoor
    and ten more classes. See samples/NOTICE.md.`);
  }

  const driveUrl = `${options.switchboard}/d/${driveId}`;
  console.log(`
  Open the demo:

    ${connectUrl(options, driveUrl)}

  Drive URL for adding it by hand in Connect:

    ${driveUrl}
`);

  if (!allWell) process.exitCode = 1;
}

/**
 * Connect reads a `driveUrl` query parameter, which saves adding the drive by
 * hand. Its own port is a guess — the stack publishes it on 3000 — so the raw
 * drive URL is printed too.
 */
function connectUrl(options, driveUrl) {
  const connect = process.env.CONNECT_URL ?? "http://localhost:3000";
  return `${trimSlash(connect)}/?driveUrl=${encodeURIComponent(driveUrl)}`;
}

await main();
