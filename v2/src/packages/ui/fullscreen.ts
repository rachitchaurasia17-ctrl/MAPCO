/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Full Screen control (Fullscreen API)
   ---------------------------------------------------------------
   MAPCO runs in fullscreen almost all the time. This mounts a single
   toggle button and keeps it in sync with the real fullscreen state
   (including Esc), calling an onResize hook so the map engine can
   recompute its cover-fit after the viewport changes. Chrome/Edge +
   tablet browsers; graceful fallback when the API is unavailable.
   No PWA / offline — just fullscreen.
   ═══════════════════════════════════════════════════════════════ */

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

async function enter(): Promise<void> {
  const el = document.documentElement as FsEl;
  if (el.requestFullscreen) await el.requestFullscreen();
  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
}

async function exit(): Promise<void> {
  const d = document as FsDoc;
  if (d.exitFullscreen) await d.exitFullscreen();
  else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
}

export async function toggleFullscreen(): Promise<void> {
  try { if (isFullscreen()) await exit(); else await enter(); }
  catch { /* user denied / not allowed — button state syncs via the event */ }
}

export interface FullscreenButtonOptions {
  /** 'bar' = labelled pill for the dealer shell; 'floating' = compact glass square for the map. */
  readonly variant?: 'bar' | 'floating';
  /** Called after enter/exit (and on Esc), on the next frame so layout has settled. */
  readonly onResize?: () => void;
  /** Optional label prefix for the bar variant. */
  readonly title?: string;
}

/**
 * Mount a fullscreen toggle into `host`. Returns a cleanup function that removes
 * the button and its listeners (no duplicate listeners, no layout jumps).
 */
export function mountFullscreenButton(host: HTMLElement, opts: FullscreenButtonOptions = {}): () => void {
  const variant = opts.variant ?? 'bar';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-pressed', String(isFullscreen()));

  if (variant === 'floating') {
    btn.className = 'pm-fs-btn pm-fs-floating';
    btn.style.cssText = 'display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:rgba(24,16,4,.5);backdrop-filter:blur(10px);color:#fff8e6;cursor:pointer;border:none';
  } else {
    btn.className = 'pm-fs-btn';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:12px;background:#f0eaff;color:#5b32c4;font-size:14px;font-weight:800;cursor:pointer;border:none';
  }

  if (!fullscreenSupported()) {
    // Graceful fallback: a disabled control with a hint, never a broken button.
    btn.disabled = true;
    btn.style.opacity = '.5';
    btn.title = 'Full screen is not available in this browser';
    btn.innerHTML = variant === 'floating'
      ? '<i class="ph-bold ph-arrows-out"></i>'
      : '<i class="ph-bold ph-arrows-out" style="font-size:17px"></i>Full screen unavailable';
    host.appendChild(btn);
    return () => btn.remove();
  }

  const paint = () => {
    const on = isFullscreen();
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
    if (variant === 'floating') {
      btn.title = on ? 'Exit full screen' : 'Full screen';
      btn.innerHTML = `<i class="ph-bold ph-arrows-${on ? 'in' : 'out'}" style="font-size:18px"></i>`;
    } else {
      btn.innerHTML = `<i class="ph-bold ph-arrows-${on ? 'in' : 'out'}" style="font-size:17px"></i>${on ? 'Exit Full Screen' : 'Full Screen'}`;
    }
  };

  const onClick = () => { void toggleFullscreen(); };
  // Fires on enter, exit AND Esc — the single source of truth for button state.
  const onChange = () => { paint(); if (opts.onResize) requestAnimationFrame(() => requestAnimationFrame(opts.onResize!)); };

  btn.addEventListener('click', onClick);
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  paint();
  host.appendChild(btn);

  return () => {
    btn.removeEventListener('click', onClick);
    document.removeEventListener('fullscreenchange', onChange);
    document.removeEventListener('webkitfullscreenchange', onChange);
    btn.remove();
  };
}

/** Keep fullscreen mode synchronized and support Ctrl+F11 / F11 shortcuts. */
export function setupAppFullscreenSync(): void {
  const tryEnter = async () => {
    const doc = document as any;
    const el = document.documentElement as any;
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) await el.msRequestFullscreen();
      } catch {
        // browser may require user gesture
      }
    }
  };

  if (sessionStorage.getItem('mapco_wants_fullscreen') === '1') {
    void tryEnter();
    const onUserGesture = () => {
      void tryEnter();
      window.removeEventListener('pointerdown', onUserGesture, true);
      window.removeEventListener('keydown', onUserGesture, true);
      window.removeEventListener('click', onUserGesture, true);
    };
    window.addEventListener('pointerdown', onUserGesture, { capture: true, once: true });
    window.addEventListener('keydown', onUserGesture, { capture: true, once: true });
    window.addEventListener('click', onUserGesture, { capture: true, once: true });
  }

  // Ctrl+F11 / F11 keyboard shortcut support
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11' || (e.ctrlKey && (e.key === 'F11' || e.key === 'f11'))) {
      e.preventDefault();
      void toggleFullscreen();
    }
  });
}
