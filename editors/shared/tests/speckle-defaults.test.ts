import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SPECKLE_BASE,
  getSpeckleBase,
  originOf,
  resolveSpeckleBase,
  setSpeckleBase,
} from "../speckle.js";

const TENANT = "https://acme-speckle.vetra.io";

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

describe("browser storage", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => vi.unstubAllGlobals());

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

    expect(() => setSpeckleBase(TENANT)).not.toThrow();
    expect(getSpeckleBase()).toBe(DEFAULT_SPECKLE_BASE);
  });
});
