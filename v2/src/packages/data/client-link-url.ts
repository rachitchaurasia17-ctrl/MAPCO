/**
 * The address a buyer must actually receive for a client link.
 *
 * The database stores share_links.url as a bare "/client/" — no origin and,
 * more importantly, no token. Anything that trusted that column handed the
 * buyer a link that opens nothing, and the two surfaces failed differently:
 * the Desk copied "/client/" verbatim, while the Team Workspace prepended the
 * origin and produced a tokenless "https://host/client/".
 *
 * Both adapters build the URL through here so mock and Supabase modes cannot
 * drift, and so no caller has to remember to prepend an origin.
 */
export function clientLinkUrl(token: string, storedUrl?: string | null): string {
  // Trust the stored value only when it already carries the token.
  const path = typeof storedUrl === 'string' && storedUrl.includes('token=')
    ? storedUrl
    : `/client/?token=${encodeURIComponent(token)}`;
  if (/^https?:\/\//i.test(path)) return path;

  const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
  // No origin (a test, a worker, SSR): return the path rather than an
  // "undefined"-prefixed string. It is still openable from inside the app.
  return typeof origin === 'string' && origin && origin !== 'null' ? origin + path : path;
}
