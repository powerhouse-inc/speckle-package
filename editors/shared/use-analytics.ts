import { useSwitchboardUrl } from "@powerhousedao/reactor-browser";
import { useEffect, useMemo, useState } from "react";
import {
  fetchHotspots,
  fetchSeries,
  type Hotspot,
  type SeriesPeriod,
  type SeriesQuery,
} from "./analytics.js";

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
  const switchboardUrl = useSwitchboardUrl();
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

    const abort = new AbortController();
    const cancelled = () => abort.signal.aborted;

    setLoading(true);
    setError(null);

    fetchSeries(switchboardUrl, JSON.parse(key) as SeriesQuery)
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
  }, [key, switchboardUrl]);

  return { data, loading, error };
}

export function useHotspots(
  projectDocumentId: string | null,
  minTouches = 2,
  limit = 20,
): Result<Hotspot[]> {
  const switchboardUrl = useSwitchboardUrl();
  const [data, setData] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(projectDocumentId !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectDocumentId) {
      setData([]);
      setLoading(false);
      return;
    }

    const abort = new AbortController();
    const cancelled = () => abort.signal.aborted;

    setLoading(true);
    setError(null);

    fetchHotspots(switchboardUrl, projectDocumentId, minTouches, limit)
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
  }, [projectDocumentId, minTouches, limit, switchboardUrl]);

  return { data, loading, error };
}
