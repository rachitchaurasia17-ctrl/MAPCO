/* ═══════════════════════════════════════════════════════════════
   Minimal ZIP writer — no dependencies.

   Uses the STORE method (no compression). Everything we pack is already
   compressed (PNG/JPEG), so deflate would cost CPU for ~0% gain, and
   STORE keeps this small enough to audit.

   Produces a standard .zip readable by Windows Explorer, macOS Finder
   and ChatGPT's file upload.
   ═══════════════════════════════════════════════════════════════ */

export interface ZipEntry {
  /** Path inside the archive, forward slashes, e.g. 'DAY-01/C001-HERO.jpg'. */
  readonly path: string;
  readonly data: Uint8Array;
}

/* CRC-32, table built once. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** MS-DOS date/time, as required by the ZIP header. */
function dosDateTime(d: Date): { time: number; date: number } {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, date };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private len = 0;
  get length(): number { return this.len; }
  push(bytes: Uint8Array): void { this.chunks.push(bytes); this.len += bytes.length; }
  u16(v: number): void { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.push(b); }
  u32(v: number): void { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.push(b); }
  toBlob(type = 'application/zip'): Blob { return new Blob(this.chunks as BlobPart[], { type }); }
}

/**
 * Build a ZIP archive. Entry order is preserved, so packs are byte-stable
 * for the same inputs (apart from the timestamp).
 */
export function createZip(entries: readonly ZipEntry[], now: Date = new Date()): Blob {
  const out = new ByteWriter();
  const { time, date } = dosDateTime(now);
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const entry of entries) {
    const name = utf8(entry.path);
    const crc = crc32(entry.data);
    const offset = out.length;

    out.u32(0x04034b50);      // local file header
    out.u16(20);              // version needed
    out.u16(0x0800);          // UTF-8 filename flag
    out.u16(0);               // method: store
    out.u16(time); out.u16(date);
    out.u32(crc);
    out.u32(entry.data.length);   // compressed size
    out.u32(entry.data.length);   // uncompressed size
    out.u16(name.length);
    out.u16(0);               // extra length
    out.push(name);
    out.push(entry.data);

    central.push({ name, crc, size: entry.data.length, offset });
  }

  const centralStart = out.length;
  for (const c of central) {
    out.u32(0x02014b50);      // central directory header
    out.u16(20); out.u16(20);
    out.u16(0x0800);
    out.u16(0);
    out.u16(time); out.u16(date);
    out.u32(c.crc);
    out.u32(c.size); out.u32(c.size);
    out.u16(c.name.length);
    out.u16(0); out.u16(0); out.u16(0);
    out.u32(0);               // external attrs
    out.u32(c.offset);
    out.push(c.name);
  }
  const centralSize = out.length - centralStart;

  out.u32(0x06054b50);        // end of central directory
  out.u16(0); out.u16(0);
  out.u16(central.length); out.u16(central.length);
  out.u32(centralSize);
  out.u32(centralStart);
  out.u16(0);

  return out.toBlob();
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Fetch a URL as bytes. Returns null rather than throwing. */
export async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
