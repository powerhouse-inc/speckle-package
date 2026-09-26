/**
 * Minimal Speckle GraphQL client plus viewer URL builders.
 *
 * Kept free of React and of document-model imports so the same code can be
 * used from an editor, a processor or a test.
 */

/** Minimal shape of a Speckle object as the API returns it. */
export interface SpeckleObjectLike {
  id: string;
  speckleType?: string | null;
  data?: Record<string, unknown> | null;
}

const BASE_STORAGE_KEY = "speckle-package:server-base";
export const DEFAULT_SPECKLE_BASE = "http://127.0.0.1";

/** An absolute http(s) URL without its trailing slashes, or null. */
function cleanBase(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!/^https?:\/\/[^/]/i.test(trimmed)) return null;

  return trimmed.replace(/\/+$/, "");
}

/** The origin of a URL (`https://host:port`), or null when it is not one. */
export function originOf(value: string | null | undefined): string | null {
  const base = cleanBase(value);
  if (!base) return null;

  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/**
 * Which Speckle server to talk to, most specific first:
 *
 * 1. the document's own `serverUrl` — what a collaborator already chose;
 * 2. the public origin the reactor publishes (`speckleServer.publicOrigin`),
 *    which on a hosted tenant is its own Speckle server;
 * 3. what this browser used last;
 * 4. the local dev server.
 *
 * Unusable values are skipped rather than returned, so a blank field or a
 * relative path never becomes the address.
 */
export function resolveSpeckleBase(sources: {
  document?: string | null;
  publicOrigin?: string | null;
  remembered?: string | null;
}): string {
  return (
    cleanBase(sources.document) ??
    cleanBase(sources.publicOrigin) ??
    cleanBase(sources.remembered) ??
    DEFAULT_SPECKLE_BASE
  );
}

/** What this browser used last, or null. */
export function rememberedSpeckleBase(): string | null {
  try {
    return localStorage.getItem(BASE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remembered per browser; falls back to the local dev server. */
export function getSpeckleBase(): string {
  return resolveSpeckleBase({ remembered: rememberedSpeckleBase() });
}

export function setSpeckleBase(base: string): void {
  try {
    localStorage.setItem(BASE_STORAGE_KEY, base.replace(/\/+$/, ""));
  } catch {
    // Private browsing or blocked site data — the caller keeps its own state.
  }
}

/* ------------------------------------------------------------------- auth */

/** The parts of a `speckle/sync` document the viewer's token lookup reads. */
export interface SyncTokenSource {
  state: {
    global: {
      serverUrl?: string | null;
      targetProjectDocumentId?: string | null;
    };
    local: { accessToken?: string | null };
  };
}

export type ViewerTokenSource = "SYNC_DOCUMENT" | "BROWSER" | null;

/**
 * The token the 3D viewer should load a mirrored project with.
 *
 * The user's own token already lives in the local scope of the sync document
 * that writes into this mirror, so that is used first — preferring a sync
 * document on the same server, since a token is only valid where it was
 * issued. Failing that, one pasted into this browser for the server. Null
 * means load unauthenticated, which is all a public project needs.
 */
export function resolveViewerToken(input: {
  projectDocumentId: string;
  serverUrl: string;
  syncDocuments?: readonly SyncTokenSource[] | null;
  stored?: string | null;
}): { token: string | null; source: ViewerTokenSource } {
  const origin = originOf(input.serverUrl);

  const candidates = (input.syncDocuments ?? []).filter(
    (doc) =>
      doc.state.global.targetProjectDocumentId === input.projectDocumentId &&
      Boolean(doc.state.local.accessToken?.trim()),
  );

  const sameServer = candidates.find(
    (doc) =>
      !doc.state.global.serverUrl ||
      originOf(doc.state.global.serverUrl) === origin,
  );

  const fromSync = sameServer?.state.local.accessToken?.trim();
  if (fromSync) return { token: fromSync, source: "SYNC_DOCUMENT" };

  const stored = input.stored?.trim();
  if (stored) return { token: stored, source: "BROWSER" };

  return { token: null, source: null };
}

const TOKEN_STORAGE_PREFIX = "speckle-package:viewer-token:";

function tokenKey(serverUrl: string): string | null {
  const origin = originOf(serverUrl);
  return origin ? `${TOKEN_STORAGE_PREFIX}${origin}` : null;
}

/** A token pasted into the viewer for this server, kept in this browser only. */
export function storedViewerToken(serverUrl: string): string | null {
  const key = tokenKey(serverUrl);
  if (!key) return null;

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storeViewerToken(serverUrl: string, token: string | null): void {
  const key = tokenKey(serverUrl);
  if (!key) return;

  try {
    if (token?.trim()) localStorage.setItem(key, token.trim());
    else localStorage.removeItem(key);
  } catch {
    // Blocked storage: the token then lasts as long as the editor's state.
  }
}

/* ------------------------------------------------------------------- links */

/**
 * How many objects an isolation link may name.
 *
 * The ids travel in the URL path, 33 bytes each, so this is a limit of the
 * transport rather than a choice. Callers must tell the user when they hit it.
 */
export const MAX_ISOLATED_OBJECTS = 50;

/**
 * The viewer's resource string — the part after `/models/`.
 *
 * Speckle parses it as a comma-separated list where each part is `all`, a model
 * id, `modelId@versionId`, `$folder`, or — decided purely by being 32 characters
 * long — a raw object id. Naming objects loads exactly those, which is the only
 * way a URL can isolate anything: the viewer's filter state is not URL-driven.
 */
export function buildResourceString(
  modelId: string,
  versionId?: string | null,
  objectIds?: string[],
): string {
  const objects = (objectIds ?? []).filter((id) => id.length === 32);

  if (objects.length > 0) {
    return objects.slice(0, MAX_ISOLATED_OBJECTS).join(",");
  }

  return versionId ? `${modelId}@${versionId}` : modelId;
}

export function buildVersionUrl(
  base: string,
  projectId: string,
  modelId: string,
  versionId?: string | null,
  objectIds?: string[],
): string {
  const resource = buildResourceString(modelId, versionId, objectIds);
  return `${base.replace(/\/+$/, "")}/projects/${projectId}/models/${resource}`;
}

/**
 * An embeddable viewer URL.
 *
 * The `embed` hash accepts *only* boolean flags — Speckle rejects the whole
 * object if it carries any other key, silently falling back to a non-embedded
 * view. So isolation goes in the resource string, never here.
 */
export function buildEmbedUrl(
  base: string,
  projectId: string,
  modelId: string,
  versionId?: string | null,
  objectIds?: string[],
): string {
  const url = buildVersionUrl(base, projectId, modelId, versionId, objectIds);
  const embed = { isEnabled: true };

  return `${url}#embed=${encodeURIComponent(JSON.stringify(embed))}`;
}

/* ------------------------------------------------------------------ client */

export interface SpeckleError {
  message: string;
}

async function graphql<T>(
  base: string,
  query: string,
  variables: Record<string, unknown>,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${base.replace(/\/+$/, "")}/graphql`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Speckle responded ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: SpeckleError[];
  };

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) throw new Error("Speckle returned no data");

  return payload.data;
}

/* --------------------------------------------------------------- queries */

const PROJECT_QUERY = `
  query ProjectOverview($projectId: String!) {
    project(id: $projectId) {
      id
      name
      visibility
      models(limit: 50) {
        totalCount
        items { id name displayName updatedAt }
      }
    }
  }
`;

export interface SpeckleModelSummary {
  id: string;
  name: string;
  displayName: string | null;
  updatedAt: string | null;
}

export interface SpeckleProjectOverview {
  id: string;
  name: string;
  visibility: string | null;
  models: SpeckleModelSummary[];
}

export async function fetchProjectOverview(
  base: string,
  projectId: string,
  token?: string | null,
): Promise<SpeckleProjectOverview> {
  const data = await graphql<{
    project: {
      id: string;
      name: string;
      visibility: string | null;
      models: { totalCount: number; items: SpeckleModelSummary[] };
    } | null;
  }>(base, PROJECT_QUERY, { projectId }, token);

  if (!data.project) throw new Error(`Project ${projectId} not found`);

  return {
    id: data.project.id,
    name: data.project.name,
    visibility: data.project.visibility,
    models: data.project.models.items,
  };
}

const VERSIONS_QUERY = `
  query ModelVersions($projectId: String!, $modelId: String!, $limit: Int!) {
    project(id: $projectId) {
      model(id: $modelId) {
        id
        name
        displayName
        versions(limit: $limit) {
          totalCount
          items {
            id
            referencedObject
            message
            sourceApplication
            createdAt
            previewUrl
            authorUser { name }
          }
        }
      }
    }
  }
`;

export interface SpeckleVersionSummary {
  id: string;
  referencedObject: string;
  message: string | null;
  sourceApplication: string | null;
  createdAt: string | null;
  previewUrl: string | null;
  authorUser: { name: string | null } | null;
}

export async function fetchModelVersions(
  base: string,
  projectId: string,
  modelId: string,
  limit = 25,
  token?: string | null,
): Promise<{ modelName: string; versions: SpeckleVersionSummary[] }> {
  const data = await graphql<{
    project: {
      model: {
        name: string;
        displayName: string | null;
        versions: { items: SpeckleVersionSummary[] };
      } | null;
    } | null;
  }>(base, VERSIONS_QUERY, { projectId, modelId, limit }, token);

  const model = data.project?.model;

  if (!model) throw new Error(`Model ${modelId} not found in ${projectId}`);

  return {
    modelName: model.displayName ?? model.name,
    versions: model.versions.items,
  };
}

const OBJECTS_QUERY = `
  query VersionObjects(
    $projectId: String!
    $objectId: String!
    $limit: Int!
    $depth: Int!
    $cursor: String
  ) {
    project(id: $projectId) {
      object(id: $objectId) {
        id
        totalChildrenCount
        children(limit: $limit, depth: $depth, cursor: $cursor) {
          totalCount
          cursor
          objects {
            id
            speckleType
            data
          }
        }
      }
    }
  }
`;

/**
 * Walk a version's object graph.
 *
 * Paged deliberately: a large model can hold hundreds of thousands of objects,
 * so callers cap the traversal rather than pulling everything into memory.
 */
export async function fetchVersionObjects(
  base: string,
  projectId: string,
  referencedObject: string,
  options: {
    token?: string | null;
    pageSize?: number;
    maxObjects?: number;
    depth?: number;
    onProgress?: (loaded: number, total: number) => void;
  } = {},
): Promise<{ objects: SpeckleObjectLike[]; totalCount: number }> {
  const pageSize = options.pageSize ?? 500;
  const maxObjects = options.maxObjects ?? 5000;
  const depth = options.depth ?? 50;

  const objects: SpeckleObjectLike[] = [];
  let cursor: string | null = null;
  let totalCount = 0;

  do {
    const data: {
      project: {
        object: {
          totalChildrenCount: number | null;
          children: {
            totalCount: number;
            cursor: string | null;
            objects: SpeckleObjectLike[];
          };
        } | null;
      } | null;
    } = await graphql(
      base,
      OBJECTS_QUERY,
      {
        projectId,
        objectId: referencedObject,
        limit: Math.min(pageSize, maxObjects - objects.length),
        depth,
        cursor,
      },
      options.token,
    );

    const object = data.project?.object;

    if (!object) {
      throw new Error(`Object ${referencedObject} not found in ${projectId}`);
    }

    totalCount = object.children.totalCount;
    objects.push(...object.children.objects);
    cursor = object.children.cursor;

    options.onProgress?.(objects.length, totalCount);
  } while (cursor && objects.length < maxObjects);

  return { objects, totalCount };
}
