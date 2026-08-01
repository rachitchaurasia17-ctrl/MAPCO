/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Utility: Currency formatting
   ═══════════════════════════════════════════════════════════════ */
export function formatINR(n: number): string {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1).replace(/\.0$/, '') + ' Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + ' L';
  return '₹' + n.toLocaleString('en-IN');
}

export function formatDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    + ' · ' + now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateShort(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Generate a street-view URL for a location */
export function streetViewUrl(label: string): string {
  return 'https://www.google.com/maps?q=' + encodeURIComponent(label.split(' · ')[0] + ', Punjab') + '&layer=c';
}

/** Generate a WhatsApp share URL */
export function waShareUrl(text: string): string {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}
