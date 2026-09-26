import { afterEach, describe, expect, it, vi } from "vitest";
import { publicOriginFrom } from "../lib.js";
import { getResolvers } from "../resolvers.js";

describe("publicOriginFrom", () => {
  it("passes an absolute origin through, without a trailing slash", () => {
    expect(publicOriginFrom("https://acme-speckle.vetra.io")).toBe(
      "https://acme-speckle.vetra.io",
    );
    expect(publicOriginFrom(" https://acme-speckle.vetra.io/ ")).toBe(
      "https://acme-speckle.vetra.io",
    );
    expect(publicOriginFrom("http://127.0.0.1")).toBe("http://127.0.0.1");
  });

  it("returns null for unset or unusable values", () => {
    expect(publicOriginFrom(undefined)).toBeNull();
    expect(publicOriginFrom(null)).toBeNull();
    expect(publicOriginFrom("")).toBeNull();
    expect(publicOriginFrom("   ")).toBeNull();
    expect(publicOriginFrom("acme-speckle.vetra.io")).toBeNull();
    expect(publicOriginFrom("https://")).toBeNull();
  });
});

describe("speckleServer resolver", () => {
  afterEach(() => vi.unstubAllEnvs());

  function resolve(): { publicOrigin: string | null } {
    const resolvers = getResolvers() as {
      Query: { speckleServer: () => { publicOrigin: string | null } };
    };
    return resolvers.Query.speckleServer();
  }

  it("publishes the public origin and nothing else", () => {
    vi.stubEnv("SPECKLE_PUBLIC_ORIGIN", "https://acme-speckle.vetra.io/");
    vi.stubEnv("SPECKLE_INTERNAL_ORIGIN", "http://speckle-server.acme:3000");
    vi.stubEnv("SPECKLE_TOKEN", "secret-token");

    const result = resolve();

    expect(result).toEqual({ publicOrigin: "https://acme-speckle.vetra.io" });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(JSON.stringify(result)).not.toContain("speckle-server.acme");
  });

  it("is null when no Speckle server is configured", () => {
    vi.stubEnv("SPECKLE_PUBLIC_ORIGIN", "");
    expect(resolve()).toEqual({ publicOrigin: null });
  });
});
