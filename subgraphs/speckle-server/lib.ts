/**
 * The public origin as configured, or null.
 *
 * The value ends up pre-filled in an editor and then written into documents, so
 * anything that is not an absolute http(s) origin is dropped rather than passed
 * on — a half-set variable must not turn into a broken server URL.
 */
export function publicOriginFrom(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!/^https?:\/\/[^/]/i.test(trimmed)) return null;

  return trimmed.replace(/\/+$/, "");
}
