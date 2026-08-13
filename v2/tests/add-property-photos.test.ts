// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adapter, err, ok } from '../src/packages/data/adapter';
import type { Property } from '../src/packages/data/types';
import { AddPropertyFlow } from '../src/packages/ui/shared-modals';

let objectId = 0;

function setFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setField(name: string, value: string, change = false) {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  if (change) field.dispatchEvent(new Event('change', { bubbles: true }));
}

function enterRequiredBasics(city = 'Mohali') {
  setField('city', city, true);
  setField('area', 'Sector 90');
  setField('size', '250 sq yd');
  setField('facing', 'East');
  setField('position', 'Inside plot');
  setField('type', 'Residential Plot');
}

describe('Add Property photo workflow', () => {
  beforeEach(() => {
    objectId = 0;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:http://localhost/${++objectId}`),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists selected cover and gallery refs for Save Draft', async () => {
    const completed = vi.fn();
    const flow = new AddPropertyFlow([], completed, () => flow.unmount());
    flow.mount(document.body);
    enterRequiredBasics();
    document.querySelector<HTMLButtonElement>('[data-step="2"]')!.click();
    setFiles(document.querySelector<HTMLInputElement>('#pm-cover-photo-input')!, [
      new File(['cover'], 'cover.jpg', { type: 'image/jpeg' }),
    ]);
    setFiles(document.querySelector<HTMLInputElement>('#pm-gallery-photo-input')!, [
      new File(['gallery'], 'gallery.webp', { type: 'image/webp' }),
    ]);
    document.querySelector<HTMLButtonElement>('[data-act="save-draft"]')!.click();

    await vi.waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
    const saved = completed.mock.calls[0]![0] as Property;
    expect(saved.published).toBe(false);
    expect(saved.photoStorage).toHaveLength(2);
    expect(saved.photoStorage?.every((photo) => photo.path.includes(`/properties/${saved.id}/`))).toBe(true);
    expect(JSON.stringify(saved.photoStorage)).not.toContain('blob:');
    flow.unmount();
  });

  it('persists the exact sector and parent masterplan ids in the shared flow', async () => {
    const completed = vi.fn();
    const flow = new AddPropertyFlow([], completed, () => flow.unmount());
    flow.mount(document.body);

    await vi.waitFor(() => {
      expect(document.querySelector('#pm-property-cities option[value="Mohali"]')).not.toBeNull();
    });
    enterRequiredBasics();

    const sector = document.querySelector<HTMLSelectElement>('select[name="sectorMapId"]')!;
    expect(sector.value).toBe('mohali-sector-90-91');
    document.querySelector<HTMLButtonElement>('[data-act="save-draft"]')!.click();

    await vi.waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
    const saved = completed.mock.calls[0]![0] as Property;
    expect(saved.sectorMapId).toBe('mohali-sector-90-91');
    expect(saved.masterplanId).toBe('mohali-master');
    flow.unmount();
  });

  it('removes successful uploads when a later gallery upload fails', async () => {
    let prepared: Property | undefined;
    vi.spyOn(adapter.properties, 'save').mockImplementation(async (property) => {
      prepared = { ...property, photos: [] };
      return ok(prepared);
    });
    const uploaded = { kind: 'storage' as const, id: 'cover', path: 'dealers/dealer-mock/properties/prop-test/cover.jpg' };
    vi.spyOn(adapter.media, 'uploadPropertyPhoto')
      .mockResolvedValueOnce(ok(uploaded))
      .mockResolvedValueOnce(err('network', 'Gallery upload failed'));
    const cleanup = vi.spyOn(adapter.media, 'removePropertyPhotos').mockResolvedValue(ok(undefined));

    const completed = vi.fn();
    const flow = new AddPropertyFlow([], completed, () => flow.unmount());
    flow.mount(document.body);
    enterRequiredBasics();
    document.querySelector<HTMLButtonElement>('[data-step="2"]')!.click();
    setFiles(document.querySelector<HTMLInputElement>('#pm-cover-photo-input')!, [
      new File(['cover'], 'cover.jpg', { type: 'image/jpeg' }),
    ]);
    setFiles(document.querySelector<HTMLInputElement>('#pm-gallery-photo-input')!, [
      new File(['gallery'], 'gallery.png', { type: 'image/png' }),
    ]);
    document.querySelector<HTMLButtonElement>('[data-act="save-draft"]')!.click();

    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledWith([uploaded.path]));
    expect(prepared?.published).toBe(false);
    expect(completed).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Gallery upload failed');
    flow.unmount();
  });
});
