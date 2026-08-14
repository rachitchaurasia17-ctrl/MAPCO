// MAPCO shared log redaction.
// Edge logs are operational, not evidential: they must never contain a
// provider key, a client-link token, a signed URL, a phone number or any
// buyer/seller identity. Everything logged goes through here first.

const PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, '[redacted:provider-key]'],
  [/\bsb_secret_[A-Za-z0-9_-]+\b/g, '[redacted:service-key]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted:jwt]'],
  [/\b[0-9a-f]{64}\b/g, '[redacted:token]'],
  [/https?:\/\/[^\s"']*[?&](token|signature|jwt|key)=[^\s"'&]+/gi, '[redacted:signed-url]'],
  [/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, '[redacted:phone]'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted:email]'],
];

export function redact(value: string): string {
  let out = String(value ?? '');
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out.length > 2000 ? `${out.slice(0, 2000)}…` : out;
}

/** Structured, always-redacted operational log line with a correlation id. */
export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fields)) {
    safe[key] = typeof raw === 'string' ? redact(raw) : raw;
  }
  const line = JSON.stringify({ level, event, ...safe });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
