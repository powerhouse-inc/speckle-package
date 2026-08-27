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

/** Remembered per browser; falls back to the local dev server. */
export function getSpeckleBase(): string {
  try {
    return localStorage.getItem(BASE_STORAGE_KEY) ?? DEFAULT_SPECKLE_BASE;
  } catch {
    return DEFAULT_SPECKLE_BASE;
  }
}

export function setSpeckleBase(base: string): void {
  try {
    localStorage.setItem(BASE_STORAGE_KEY, base.replace(/\/+$/, ""));
  } catch {
    // Private browsing or blocked site data — the caller keeps its own state.
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
