// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DataConfigurationError, selectDataMode } from '../src/packages/data/adapter';
import { snapshotToState } from '../src/packages/data/supabase/supabase-adapter';
import { encodeWav, resamplePcm } from '../src/packages/ui/shared-modals';
import { positionContainedPin, renderClientLinkView } from '../src/packages/ui/client-link-view';
import type { ClientSafePayload } from '../src/packages/data/contracts';

describe('production data mode', () => {
  it('uses Supabase only when production configuration is complete', () => {
    expect(selectDataMode({ requested: 'supabase', production: true, supabaseConfigured: true })).toBe('supabase');
  });

  it('never silently falls back to mock in production', () => {
    expect(() => selectDataMode({ requested: 'mock', production: true, supabaseConfigured: true }))
      .toThrow(DataConfigurationError);
    expect(() => selectDataMode({ requested: undefined, production: true, supabaseConfigured: false }))
      .toThrow(DataConfigurationError);
    expect(() => selectDataMode({ requested: 'supabase', production: true, supabaseConfigured: false }))
      .toThrow(DataConfigurationError);
  });
});

describe('mobile-compatible voice notes', () => {
  it('downsamples 48 kHz input and writes a valid mono 16-bit WAV header', async () => {
    const input = new Float32Array(48_000).fill(0.25);
    const wav = encodeWav([input], 48_000, 16_000);
    const bytes = new Uint8Array(await wav.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(wav.type).toBe('audio/wav');
    expect(wav.size).toBe(44 + 16_000 * 2);
  });

  it('keeps short and empty PCM inputs deterministic', () => {
    expect(resamplePcm(new Float32Array(), 48_000, 16_000)).toHaveLength(0);
    expect(resamplePcm(new Float32Array([0.1, 0.2]), 8_000, 16_000)).toEqual(new Float32Array([0.1, 0.2]));
  });
});

const preciseSnapshot = {
  visibility: { price: 'shown', location: 'exact' },
  branding: { brandName: 'Safe Dealer', phone: '+919000000000' },
  audio: { available: true, seconds: 3, url: 'https://signed.example/audio.wav' },
  maps: [
    { id: 'master-1', kind: 'masterplan', city: 'Mohali', label: 'Mohali', raster: 'https://maps.example/master.png', assets: { original: { path: 'https://maps.example/master.png', w: 1000, h: 800 } }, dims: { original: { w: 1000, h: 800 } } },
    { id: 'sector-1', kind: 'sector', city: 'Mohali', sector: '90', parentMapId: 'master-1', raster: 'https://maps.example/sector.png', assets: { original: { path: 'https://maps.example/sector.png', w: 900, h: 900 } }, dims: { original: { w: 900, h: 900 } } },
  ],
  properties: [
    { id: 'public-a', title: 'First plot', area: 'Sector 90', city: 'Mohali', sector: '90', size: '300 sq yd', facing: 'East', price: '4500000', masterplanId: 'master-1', sectorMapId: 'sector-1', placement: { mapId: 'sector-1', x: 0.25, y: 0.75 }, photos: [{ url: 'https://img.example/a.jpg' }] },
    { id: 'public-b', title: 'Second plot', area: 'Sector 91', city: 'Mohali', sector: '91', size: '250 sq yd', facing: 'North', price: '5200000', masterplanId: 'master-1', photos: [{ url: 'https://img.example/b.jpg' }] },
  ],
};

describe('token-scoped client-link projection', () => {
  it('carries two properties, custom prices, safe map IDs and signed audio', () => {
    const state = snapshotToState(preciseSnapshot);
    expect(state.kind).toBe('valid');
    if (state.kind !== 'valid') return;
    expect(state.payload.properties).toHaveLength(2);
    expect(state.payload.properties.map((p) => p.price)).toEqual([4_500_000, 5_200_000]);
    expect(state.payload.properties[0]!.placement).toEqual({ mapId: 'sector-1', x: 0.25, y: 0.75 });
    expect(state.payload.maps?.map((m) => m.id)).toEqual(['master-1', 'sector-1']);
    expect(state.payload.voiceNote?.url).toMatch(/^https:\/\//);
    expect(state.payload.maps?.every((m) => !m.assets?.threeD)).toBe(true);
  });

  it('does not expose maps, placement or an unsigned audio placeholder when precise location is off', () => {
    const state = snapshotToState({
      ...preciseSnapshot,
      visibility: { price: 'hidden', location: 'area' },
      audio: { available: true, seconds: 3 },
    });
    expect(state.kind).toBe('valid');
    if (state.kind !== 'valid') return;
    expect(state.payload.maps).toBeUndefined();
    expect(state.payload.voiceNote).toBeUndefined();
    expect(state.payload.properties.every((p) => !p.placement && !p.masterplanId && !p.sectorMapId)).toBe(true);
  });
});

describe('public multi-property and location interactions', () => {
  it('switches every property-dependent section from the top switcher', () => {
    const state = snapshotToState(preciseSnapshot);
    if (state.kind !== 'valid') throw new Error('fixture did not resolve');
    const host = document.createElement('div');
    renderClientLinkView(host, state.payload);
    const switchers = host.querySelectorAll<HTMLButtonElement>('.pm-cl-go[data-go="1"]');
    expect(switchers.length).toBeGreaterThan(0);
    switchers[0]!.click();
    expect(host.textContent).toContain('Sector 91');
    expect(host.textContent).toContain('₹52 L');
  });

  it('uses saved sector/masterplan IDs, offers both tabs, and hides fake 3D', () => {
    const state = snapshotToState(preciseSnapshot);
    if (state.kind !== 'valid') throw new Error('fixture did not resolve');
    const host = document.createElement('div');
    renderClientLinkView(host, state.payload);
    expect(host.querySelectorAll('.pm-cl-map-tab')).toHaveLength(2);
    expect(host.querySelectorAll('[data-mode="threeD"]')).toHaveLength(0);
    expect(host.querySelector<HTMLElement>('.pm-cl-map')?.dataset.raster).toBe('https://maps.example/sector.png');
    (host.querySelectorAll<HTMLButtonElement>('.pm-cl-map-tab')[1]!).click();
    expect(host.querySelector<HTMLElement>('.pm-cl-map')?.dataset.raster).toBe('https://maps.example/master.png');
  });

  it('positions a normalized pin against the contained raster, not the viewport gutters', () => {
    const host = document.createElement('div');
    const image = document.createElement('img');
    const pin = document.createElement('span');
    Object.defineProperty(host, 'clientWidth', { value: 400 });
    Object.defineProperty(host, 'clientHeight', { value: 300 });
    positionContainedPin(host, image, pin, 0.5, 0.5, 1000, 500);
    expect(pin.style.left).toBe('200px');
    expect(pin.style.top).toBe('150px');
  });

  it('reports public actions without exposing them in dealer previews', () => {
    const payload = snapshotToState(preciseSnapshot);
    if (payload.kind !== 'valid') throw new Error('fixture did not resolve');
    const host = document.createElement('div');
    const onEvent = vi.fn();
    renderClientLinkView(host, payload.payload as ClientSafePayload, { onEvent });
    host.querySelector<HTMLElement>('[data-client-event="call_clicked"]')?.click();
    expect(onEvent).toHaveBeenCalledWith('call_clicked', 'public-a');
  });
});
