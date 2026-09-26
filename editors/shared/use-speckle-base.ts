import { useEffect, useMemo, useState } from "react";
import { fetchSpecklePublicOrigin } from "./analytics.js";
import { rememberedSpeckleBase, resolveSpeckleBase } from "./speckle.js";
import { useSwitchboardBase } from "./use-analytics.js";

/**
 * One request per Switchboard per page load: every editor asks, and the answer
 * only changes with a redeploy. A failed request is forgotten, so the next
 * editor to mount tries again.
 */
const publicOrigins = new Map<string, Promise<string | null>>();

function publicOriginOf(base: string): Promise<string | null> {
  const cached = publicOrigins.get(base);
  if (cached) return cached;

  const request = fetchSpecklePublicOrigin(base).catch(() => {
    publicOrigins.delete(base);
    return null;
  });

  publicOrigins.set(base, request);
  return request;
}

/**
 * The Speckle server the reactor publishes, or null — while it is loading,
 * when no Switchboard is known, and when the request fails. Failure is silent
 * on purpose: the caller has fallbacks, and an older reactor without the
 * `speckle-server` subgraph is not an error worth showing.
 */
export function useSpecklePublicOrigin(): string | null {
  const switchboard = useSwitchboardBase();
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    if (!switchboard) {
      setOrigin(null);
      return;
    }

    let cancelled = false;

    void publicOriginOf(switchboard).then((next) => {
      if (!cancelled) setOrigin(next);
    });

    return () => {
      cancelled = true;
    };
  }, [switchboard]);

  return origin;
}

/**
 * The Speckle server an editor should use — see resolveSpeckleBase for the
 * order. `documentServerUrl` is the document's own choice, which always wins.
 */
export function useSpeckleBase(documentServerUrl?: string | null): string {
  const publicOrigin = useSpecklePublicOrigin();

  return useMemo(
    () =>
      resolveSpeckleBase({
        document: documentServerUrl,
        publicOrigin,
        remembered: rememberedSpeckleBase(),
      }),
    [documentServerUrl, publicOrigin],
  );
}
