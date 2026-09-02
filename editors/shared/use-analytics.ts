import {
  useSelectedDriveSafe,
  useSwitchboardUrl,
} from "@powerhousedao/reactor-browser";
import { useEffect, useMemo, useState } from "react";
import {
  fetchHotspots,
  fetchSeries,
  switchboardBase,
  type Hotspot,
  type SeriesPeriod,
  type SeriesQuery,
} from "./analytics.js";

/** Said in the chart when no address is known, instead of drawing nothing. */
const NO_SWITCHBOARD =
  "No Switchboard address is known, so the analytics cannot be queried. " +
  "Open the drive through its link (…/?driveUrl=http://host:port/d/<id>) " +
  "or configure the Switchboard URL for this Connect instance.";

/**
 * The Switchboard base this editor should query.
 *
 * A static Connect build leaves `useSwitchboardUrl` unset, so the address has
 * to come from somewhere real — see switchboardBase for the order and for why
 * guessing a port is worse than admitting ignorance.
 */
const REMEMBERED_KEY = "speckle-package:switchboard-base";

/**
 * Keeps the address across a rewritten address bar.
 *
 * Connect may replace `?driveUrl=…` with a tidy path once it has loaded the
 * drive, and an editor mounting after that would see nothing. Per tab, so two
 * tabs on two reactors do not confuse each other; wrapped because storage
 * throws outright in some privacy modes.
 */
function rememberBase(search: string | null): string | null {
  try {
    const fromSearch = switchboardBase({ search });
    if (fromSearch) {
      sessionStorage.setItem(REMEMBERED_KEY, fromSearch);
      return fromSearch;
    }

    return sessionStorage.getItem(REMEMBERED_KEY);
  } catch {
    return null;
  }
}

export function useSwitchboardBase(): string | null {
  const configured = useSwitchboardUrl();
  // The "safe" hook hands back a tuple and tolerates having no drive at all,
  // which is the case in a document editor opened outside a drive.
  const [drive] = useSelectedDriveSafe();

  // A remote drive keeps the reactor it pulls from in its own triggers.
  const driveUrl = drive?.state.local.triggers.find(
    (trigger) =>
      trigger.data !== null &&
      "url" in trigger.data &&
      typeof trigger.data.url === "string",
  )?.data?.url;

  return useMemo(() => {
    const search = typeof window === "undefined" ? null : window.location.search;

    return switchboardBase({
      configured,
      search,
      remembered: rememberBase(search),
      driveUrl,
    });
  }, [configured, driveUrl]);
}

interface Result<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/**
 * Runs one analytics query against Switchboard.
 *
 * The query is serialised into the effect's dependency, so callers can build it
 * inline without memoising and without re-fetching on every render.
 */
export function useSeries(query: SeriesQuery | null): Result<SeriesPeriod[]> {
  const base = useSwitchboardBase();
  const [data, setData] = useState<SeriesPeriod[]>([]);
  const [loading, setLoading] = useState(query !== null);
  const [error, setError] = useState<string | null>(null);

  const key = useMemo(() => (query ? JSON.stringify(query) : null), [query]);

  useEffect(() => {
    if (!key) {
      setData([]);
      setLoading(false);
      return;
    }

    if (!base) {
      setData([]);
      setLoading(false);
      setError(NO_SWITCHBOARD);
      return;
    }

    const abort = new AbortController();
    const cancelled = () => abort.signal.aborted;

    setLoading(true);
    setError(null);

    fetchSeries(base, JSON.parse(key) as SeriesQuery)
      .then((periods) => {
        if (cancelled()) return;
        setData(periods);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled()) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      });

    return () => abort.abort();
  }, [key, base]);

  return { data, loading, error };
}

export function useHotspots(
  projectDocumentId: string | null,
  minTouches = 2,
  limit = 20,
): Result<Hotspot[]> {
  const base = useSwitchboardBase();
  const [data, setData] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(projectDocumentId !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectDocumentId) {
      setData([]);
      setLoading(false);
      return;
    }

    if (!base) {
      setData([]);
      setLoading(false);
      setError(NO_SWITCHBOARD);
      return;
    }

    const abort = new AbortController();
    const cancelled = () => abort.signal.aborted;

    setLoading(true);
    setError(null);

    fetchHotspots(base, projectDocumentId, minTouches, limit)
      .then((spots) => {
        if (cancelled()) return;
        setData(spots);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled()) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      });

    return () => abort.abort();
  }, [projectDocumentId, minTouches, limit, base]);

  return { data, loading, error };
}
