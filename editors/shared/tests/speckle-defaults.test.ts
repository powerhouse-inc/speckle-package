import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SPECKLE_BASE,
  getSpeckleBase,
  originOf,
  resolveSpeckleBase,
  resolveViewerToken,
  setSpeckleBase,
  storedViewerToken,
  storeViewerToken,
  type SyncTokenSource,
} from "../speckle.js";

const TENANT = "https://acme-speckle.vetra.io";

function syncDoc(
  target: string | null,
  accessToken: string | null,
  serverUrl: string | null = TENANT,
): SyncTokenSource {
  return {
    state: {
      global: { serverUrl, targetProjectDocumentId: target },
      local: { accessToken },
    },
  };
}

/** A Map behind the Storage methods the helpers use. */
function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();

  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });

  return store;
}

describe("resolveSpeckleBase", () => {
  it("prefers the document's own server over everything", () => {
    expect(
      resolveSpeckleBase({
        document: "https://app.speckle.systems/",
        publicOrigin: TENANT,
        remembered: "http://localhost:8080",
      }),
    ).toBe("https://app.speckle.systems");
  });

  it("uses the reactor's public origin before the browser's memory", () => {
    expect(
      resolveSpeckleBase({
        document: null,
        publicOrigin: TENANT,
        remembered: "http://localhost:8080",
      }),
    ).toBe(TENANT);
  });

  it("falls back to the remembered value, then the dev default", () => {
    expect(resolveSpeckleBase({ remembered: "http://localhost:8080/" })).toBe(
      "http://localhost:8080",
    );
    expect(resolveSpeckleBase({})).toBe(DEFAULT_SPECKLE_BASE);
  });

  it("skips values that are not absolute http(s) URLs", () => {
    expect(
      resolveSpeckleBase({
        document: "  ",
        publicOrigin: "acme-speckle.vetra.io",
        remembered: "/relative",
      }),
    ).toBe(DEFAULT_SPECKLE_BASE);
    expect(resolveSpeckleBase({ document: "", publicOrigin: TENANT })).toBe(
      TENANT,
    );
  });
});

describe("originOf", () => {
  it("reduces a URL to its origin", () => {
    expect(originOf(`${TENANT}/projects/abc`)).toBe(TENANT);
    expect(originOf("http://127.0.0.1:8080/")).toBe("http://127.0.0.1:8080");
  });

  it("is null for anything else", () => {
    expect(originOf(null)).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });
});

describe("resolveViewerToken", () => {
  it("uses the token of the sync document that targets this mirror", () => {
    expect(
      resolveViewerToken({
        projectDocumentId: "mirror-1",
        serverUrl: TENANT,
        syncDocuments: [
          syncDoc("mirror-2", "other-token"),
          syncDoc("mirror-1", " mine "),
        ],
        stored: "pasted",
      }),
    ).toEqual({ token: "mine", source: "SYNC_DOCUMENT" });
  });

  it("ignores a sync document for the mirror that holds no token", () => {
    expect(
      resolveViewerToken({
        projectDocumentId: "mirror-1",
        serverUrl: TENANT,
        syncDocuments: [syncDoc("mirror-1", null), syncDoc("mirror-1", "  ")],
        stored: null,
      }),
    ).toEqual({ token: null, source: null });
  });

  it("does not use a token issued by a different server", () => {
    expect(
      resolveViewerToken({
        projectDocumentId: "mirror-1",
        serverUrl: TENANT,
        syncDocuments: [
          syncDoc("mirror-1", "elsewhere", "https://app.speckle.systems"),
        ],
        stored: "pasted",
      }),
    ).toEqual({ token: "pasted", source: "BROWSER" });
  });

  it("accepts a sync document that has not saved a server yet", () => {
    expect(
      resolveViewerToken({
        projectDocumentId: "mirror-1",
        serverUrl: `${TENANT}/`,
        syncDocuments: [syncDoc("mirror-1", "mine", null)],
      }),
    ).toEqual({ token: "mine", source: "SYNC_DOCUMENT" });
  });

  it("falls back to the browser's token, then to none", () => {
    expect(
      resolveViewerToken({
        projectDocumentId: "mirror-1",
        serverUrl: TENANT,
        syncDocuments: undefined,
        stored: "pasted",
      }),
    ).toEqual({ token: "pasted", source: "BROWSER" });
    expect(
      resolveViewerToken({ projectDocumentId: "mirror-1", serverUrl: TENANT }),
    ).toEqual({ token: null, source: null });
  });
});

describe("browser storage", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = stubLocalStorage();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keys a pasted token by server origin", () => {
    storeViewerToken(`${TENANT}/projects/abc`, " pasted ");

    expect(storedViewerToken(TENANT)).toBe("pasted");
    expect(storedViewerToken("https://other-speckle.vetra.io")).toBeNull();

    storeViewerToken(TENANT, null);
    expect(storedViewerToken(TENANT)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("stores nothing for a server that is not a URL", () => {
    storeViewerToken("nowhere", "pasted");

    expect(store.size).toBe(0);
    expect(storedViewerToken("nowhere")).toBeNull();
  });

  it("remembers the last server used", () => {
    expect(getSpeckleBase()).toBe(DEFAULT_SPECKLE_BASE);

    setSpeckleBase(`${TENANT}/`);
    expect(getSpeckleBase()).toBe(TENANT);
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });

    expect(() => storeViewerToken(TENANT, "pasted")).not.toThrow();
    expect(storedViewerToken(TENANT)).toBeNull();
    expect(getSpeckleBase()).toBe(DEFAULT_SPECKLE_BASE);
  });
});
