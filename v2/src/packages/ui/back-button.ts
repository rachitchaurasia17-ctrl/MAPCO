/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Small, consistent Back control
   ---------------------------------------------------------------
   A subtle, accessible Back button used across internal MAPCO
   surfaces. It prefers real in-app history (only when the previous
   entry is a same-origin MAPCO page) and otherwise falls back to a
   sensible logical route. It never exits fullscreen itself, so
   same-document navigation (closing a detail overlay) keeps the map
   fullscreen. For public Client-Link pages, pass no dealer fallback —
   it will only use safe browser-back or a neutral fallback.
   ═══════════════════════════════════════════════════════════════ */

export interface BackButtonOptions {
  /** 'floating' = glass square (over a map); 'bar' = pill in a header;
   *  'inline' = plain pill in flow. */
  variant?: 'floating' | 'bar' | 'inline';
  /** logical fallback route when there is no safe in-app history entry. */
  fallbackHref?: string;
  /** accessible label + tooltip. */
  label?: string;
  /** custom handler; return true if it fully handled the back action
   *  (e.g. closed an open overlay) so no navigation happens. */
  onBack?: () => boolean;
}

/** True when the previous history entry is a same-origin MAPCO page we can
 *  safely return to (not an external site, not a fresh tab). */
export function hasSafeInAppHistory(): boolean {
  try {
    if (window.history.length <= 1) return false;
    const ref = document.referrer;
    if (!ref) return false;
    return new URL(ref).origin === window.location.origin;
  } catch { return false; }
}

const STYLES: Record<NonNullable<BackButtonOptions['variant']>, string> = {
  floating:
    'display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;min-width:40px;padding:0 12px;' +
    'border-radius:12px;background:rgba(24,16,4,.55);backdrop-filter:blur(10px);color:#fff8e6;' +
    'font:inherit;font-size:14px;font-weight:800;box-shadow:0 8px 22px -10px rgba(0,0,0,.6);cursor:pointer;border:1px solid rgba(255,248,230,.16)',
  bar:
    'display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:12px;' +
    'background:rgba(120,80,220,.10);color:#4b2ea6;font:inherit;font-size:14px;font-weight:800;cursor:pointer;border:1px solid rgba(120,80,220,.18)',
  inline:
    'display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 13px;border-radius:11px;' +
    'background:#f0eaff;color:#4b2ea6;font:inherit;font-size:14px;font-weight:800;cursor:pointer;border:1px solid rgba(120,80,220,.16)',
};

/**
 * Mount a Back button into `host`. Returns a disposer that removes the
 * listener and the element.
 */
export function mountBackButton(host: HTMLElement, opts: BackButtonOptions = {}): () => void {
  const variant = opts.variant ?? 'inline';
  const label = opts.label ?? 'Go back';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pm-backbtn';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.style.cssText = STYLES[variant];
  // Icon-only floating variant stays compact; others show a short label.
  btn.innerHTML = variant === 'floating'
    ? `<i class="ph-bold ph-arrow-left" style="font-size:18px"></i>`
    : `<i class="ph-bold ph-arrow-left" style="font-size:16px"></i><span>Back</span>`;

  const go = () => {
    if (opts.onBack && opts.onBack()) return;      // handled in-page (e.g. closed overlay)
    if (hasSafeInAppHistory()) { window.history.back(); return; }
    if (opts.fallbackHref) { window.location.assign(opts.fallbackHref); return; }
    // Public/last-resort: a plain browser back or nothing (never expose dealer pages).
    if (window.history.length > 1) window.history.back();
  };

  btn.addEventListener('click', go);
  host.appendChild(btn);
  return () => { btn.removeEventListener('click', go); btn.remove(); };
}
