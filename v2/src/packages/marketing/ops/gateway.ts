/* MAPCO Marketing Ops runtime boundary.

   Production/Supabase mode talks only to persisted RPC + Storage state.
   LocalOpsStore remains an explicit mock-mode implementation; it is never
   selected as a fallback when Supabase is configured or a request fails. */
import type { Property } from '../../data/types';
import type { DealerBrand } from '../types';
import { activeDataMode } from '../../data/adapter';
import { getSupabase } from '../../data/supabase/client';
import { createWeek, mergeWeek } from './slots';
import { localOpsStore } from './ops-store';
import type { CreativeAsset, OperatorDealerAccess, OpsWeek, OutputSlot } from './types';

export interface OpsDealerRecord {
  readonly id: string;
  readonly brand: DealerBrand;
  readonly marketableProperties: number;
  readonly properties: readonly Property[];
}

export interface NewInventoryItem {
  readonly id: string;
  readonly propertyId: string;
  readonly propertyLabel: string;
  readonly stage: 'detected' | 'assigned' | 'uploaded' | 'approved' | 'dismissed';
  readonly recommendedSlotId?: string;
  readonly recommendedSlotRef?: string;
}

export interface OpsLoadResult {
  readonly operator: OperatorDealerAccess & { name: string };
  readonly dealers: readonly OpsDealerRecord[];
}

export interface OpsWeekResult {
  readonly week: OpsWeek;
  readonly assets: readonly CreativeAsset[];
  readonly packDownloadedAt?: string;
  readonly newProperties: readonly NewInventoryItem[];
}

export interface MarketingOpsGateway {
  load(): Promise<OpsLoadResult>;
  inventory(dealerId: string): Promise<readonly Property[]>;
  openWeek(dealerId: string, weekId: string, weekStart: string): Promise<OpsWeekResult>;
  updateSlot(slot: OutputSlot): Promise<void>;
  upload(slot: OutputSlot, file: File): Promise<void>;
  approve(slot: OutputSlot): Promise<void>;
  markPackDownloaded(dealerId: string, weekId: string): Promise<void>;
  assignNewProperty(actionId: string, slotId: string): Promise<void>;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const integer = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined;

function responseError(data: unknown, fallback: string): Error | null {
  const row = asRecord(data);
  if (row.ok === false) return new Error(text(row.reason) || fallback);
  return null;
}

function mapProperty(raw: unknown): Property {
  const row = asRecord(raw);
  const photos = asArray(row.photos).map(text).filter(Boolean);
  return {
    id: text(row.id), type: (text(row.type) || 'Residential Plot') as Property['type'],
    want: (text(row.want) || 'Plot') as Property['want'], city: text(row.city),
    area: text(row.area), loc: text(row.loc), sector: text(row.sector), size: text(row.size),
    facing: (text(row.facing) || 'East') as Property['facing'], position: text(row.position),
    approvals: asArray(row.approvals).map(text).filter(Boolean),
    landmarks: asArray(row.landmarks).map((entry) => {
      const landmark = asRecord(entry);
      return { name: text(landmark.name), distance: text(landmark.distance), icon: text(landmark.icon) };
    }).filter((entry) => entry.name && entry.distance),
    // Price is intentionally withheld from the downloadable operator pack
    // unless a future explicit marketing-price approval field is introduced.
    price: 0, photos, published: true, sold: false, views: 0,
  };
}

function mapSlot(raw: unknown): OutputSlot {
  const row = asRecord(raw);
  return {
    id: text(row.id), ref: text(row.ref), dealerId: text(row.dealerId), weekId: text(row.weekId),
    dayIndex: integer(row.dayIndex) ?? 0, localDate: text(row.localDate),
    slotIndex: integer(row.slotIndex) ?? 0,
    status: text(row.status) as OutputSlot['status'],
    propertyIds: asArray(row.propertyIds).map(text).filter(Boolean),
    channels: asArray(row.channels).map(text).filter((v): v is NonNullable<OutputSlot['channels']>[number] =>
      v === 'instagram' || v === 'facebook_page' || v === 'google_business' || v === 'whatsapp_business'),
    caption: text(row.caption) || undefined, note: text(row.note) || undefined,
    assetId: text(row.assetId) || undefined, uploadedBy: text(row.uploadedBy) || undefined,
    uploadedAt: text(row.uploadedAt) || undefined, approvedBy: text(row.approvedBy) || undefined,
    approvedAt: text(row.approvedAt) || undefined,
  };
}

function mapWeek(raw: unknown): OpsWeekResult {
  const envelope = asRecord(raw);
  const plan = asRecord(envelope.week);
  const slots = asArray(plan.slots).map(mapSlot);
  const week: OpsWeek = {
    dealerId: text(plan.dealerId), weekId: text(plan.weekId), weekStart: text(plan.weekStart),
    timezone: text(plan.timezone) || 'Asia/Kolkata', perDay: 4, slots,
    createdAt: text(plan.createdAt),
  };
  const assets = asArray(envelope.assets).map((entry): CreativeAsset => {
    const row = asRecord(entry);
    return {
      id: text(row.id), dealerId: text(row.dealerId), slotRef: text(row.slotRef),
      weekId: text(row.weekId), fileName: text(row.fileName), mime: text(row.mime),
      bytes: integer(row.bytes) ?? 0, width: integer(row.width), height: integer(row.height),
      displayUrl: text(row.displayUrl) || undefined, uploadedBy: text(row.uploadedBy),
      uploadedAt: text(row.uploadedAt),
    };
  });
  const newProperties = asArray(envelope.newProperties).map((entry): NewInventoryItem => {
    const row = asRecord(entry);
    return {
      id: text(row.id), propertyId: text(row.propertyId), propertyLabel: text(row.propertyLabel),
      stage: text(row.stage) as NewInventoryItem['stage'],
      recommendedSlotId: text(row.recommendedSlotId) || undefined,
      recommendedSlotRef: text(row.recommendedSlotRef) || undefined,
    };
  });
  return { week, assets, newProperties, packDownloadedAt: text(envelope.packDownloadedAt) || undefined };
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function dimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url); };
    image.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
    image.src = url;
  });
}

async function mockDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read creative'));
    reader.readAsDataURL(file);
  });
}

class SupabaseOpsGateway implements MarketingOpsGateway {
  private async client() {
    const client = await getSupabase();
    if (!client) throw new Error('MAPCO-DEV is not configured');
    return client;
  }

  async load(): Promise<OpsLoadResult> {
    const client = await this.client();
    const { data, error } = await client.rpc('plotmap_marketing_ops_dealers');
    if (error) throw error;
    const rejected = responseError(data, 'Marketing Ops access denied'); if (rejected) throw rejected;
    const envelope = asRecord(data); const actor = asRecord(envelope.operator);
    const dealers = asArray(envelope.dealers).map((entry): OpsDealerRecord => {
      const row = asRecord(entry); const brand = asRecord(row.brand);
      return {
        id: text(row.id), marketableProperties: integer(row.marketableProperties) ?? 0, properties: [],
        brand: { dealerId: text(row.id), name: text(brand.name), tagline: text(brand.tagline) || undefined,
          phone: text(brand.phone) || undefined, whatsapp: text(brand.whatsapp) || undefined,
          logoUrl: text(brand.logoUrl) || undefined },
      };
    });
    return {
      operator: { operatorId: text(actor.id), name: text(actor.name) || 'MAPCO operator',
        dealerIds: dealers.map((dealer) => dealer.id), isPlatformAdmin: actor.platformAdmin === true },
      dealers,
    };
  }

  async inventory(dealerId: string): Promise<readonly Property[]> {
    const client = await this.client();
    const { data, error } = await client.functions.invoke('marketing-ops', { body: { action: 'inventory', dealerId } });
    if (error) throw error;
    const rejected = responseError(data, 'Inventory unavailable'); if (rejected) throw rejected;
    return asArray(asRecord(data).properties).map(mapProperty);
  }

  async openWeek(dealerId: string, weekId: string, weekStart: string): Promise<OpsWeekResult> {
    const client = await this.client();
    const { data: opened, error: openError } = await client.rpc('plotmap_marketing_open_week', {
      p_dealer_id: dealerId, p_week_id: weekId, p_week_start: weekStart,
      p_timezone: 'Asia/Kolkata', p_per_day: 4,
    });
    if (openError) throw openError;
    const rejected = responseError(opened, 'Could not open week'); if (rejected) throw rejected;
    const { data: detected, error: detectError } = await client.rpc('plotmap_marketing_detect_new_properties', {
      p_dealer_id: dealerId, p_week_id: weekId,
    });
    if (detectError) throw detectError;
    const detectRejected = responseError(detected, 'Could not check new inventory');
    if (detectRejected) throw detectRejected;
    const { data, error } = await client.functions.invoke('marketing-ops', { body: { action: 'week', dealerId, weekId } });
    if (error) throw error;
    const loadRejected = responseError(data, 'Could not load week'); if (loadRejected) throw loadRejected;
    return mapWeek(data);
  }

  async updateSlot(slot: OutputSlot): Promise<void> {
    if (!slot.id) throw new Error('Persisted slot id missing');
    const client = await this.client();
    const { data, error } = await client.rpc('plotmap_marketing_update_slot', {
      p_slot_id: slot.id, p_property_ids: slot.propertyIds,
      p_caption: slot.caption ?? null, p_channels: slot.channels ?? [], p_note: slot.note ?? null,
    });
    if (error) throw error;
    const rejected = responseError(data, 'Slot update failed'); if (rejected) throw rejected;
  }

  async upload(slot: OutputSlot, file: File): Promise<void> {
    if (!slot.id) throw new Error('Persisted slot id missing');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('unsupported_file_type');
    if (!file.size || file.size > 15 * 1024 * 1024) throw new Error('file_too_large');
    const client = await this.client();
    const hash = await sha256(file); const dim = await dimensions(file);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${slot.dealerId}/${slot.weekId}/${slot.ref}/${hash}.${ext}`;
    const { error: uploadError } = await client.storage.from('marketing-creatives').upload(path, file, {
      contentType: file.type, upsert: false, cacheControl: '3600',
    });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
    const { data, error } = await client.rpc('plotmap_marketing_record_result', {
      p_slot_id: slot.id, p_asset_path: path, p_mime: file.type, p_bytes: file.size,
      p_width: dim.width ?? null, p_height: dim.height ?? null, p_content_hash: hash,
      p_property_ids: slot.propertyIds, p_caption: slot.caption ?? null,
    });
    if (error) throw error;
    const rejected = responseError(data, 'Creative upload failed');
    if (rejected) {
      if (!/duplicate/i.test(rejected.message)) await client.storage.from('marketing-creatives').remove([path]);
      throw rejected;
    }
  }

  async approve(slot: OutputSlot): Promise<void> {
    if (!slot.id) throw new Error('Persisted slot id missing');
    const client = await this.client();
    const { data, error } = await client.rpc('plotmap_marketing_approve_slot', { p_slot_id: slot.id });
    if (error) throw error;
    const rejected = responseError(data, 'Approval failed'); if (rejected) throw rejected;
  }

  async markPackDownloaded(dealerId: string, weekId: string): Promise<void> {
    const client = await this.client();
    const { data, error } = await client.rpc('plotmap_marketing_mark_pack_downloaded', {
      p_dealer_id: dealerId, p_week_id: weekId,
    });
    if (error) throw error;
    const rejected = responseError(data, 'Could not record pack download'); if (rejected) throw rejected;
  }

  async assignNewProperty(actionId: string, slotId: string): Promise<void> {
    const client = await this.client();
    const { data, error } = await client.rpc('plotmap_marketing_assign_new_property', {
      p_action_id: actionId, p_slot_id: slotId,
    });
    if (error) throw error;
    const rejected = responseError(data, 'Could not assign new property'); if (rejected) throw rejected;
  }
}

class MockOpsGateway implements MarketingOpsGateway {
  private readonly operator: OperatorDealerAccess & { name: string } = {
    operatorId: 'operator-local', name: 'Local operator', dealerIds: ['dealer-1'], isPlatformAdmin: false,
  };
  private readonly dealer: OpsDealerRecord = {
    id: 'dealer-1', brand: { dealerId: 'dealer-1', name: 'Local mock dealer' },
    marketableProperties: 0, properties: [],
  };
  async load(): Promise<OpsLoadResult> { return { operator: this.operator, dealers: [this.dealer] }; }
  async inventory(): Promise<readonly Property[]> { return []; }
  async openWeek(dealerId: string, weekId: string, weekStart: string): Promise<OpsWeekResult> {
    const existing = await localOpsStore.getWeek(this.operator, dealerId, weekId);
    const week = mergeWeek(existing, createWeek(dealerId, weekStart));
    await localOpsStore.saveWeek(this.operator, week);
    return {
      week,
      assets: await localOpsStore.listAssets(this.operator, dealerId, weekId),
      newProperties: [],
      packDownloadedAt: await localOpsStore.packDownloadedAt(this.operator, dealerId, weekId),
    };
  }
  async updateSlot(slot: OutputSlot): Promise<void> { await localOpsStore.updateSlot(this.operator, slot.dealerId, slot.weekId, slot); }
  async upload(slot: OutputSlot, file: File): Promise<void> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('unsupported_file_type');
    if (!file.size || file.size > 15 * 1024 * 1024) throw new Error('file_too_large');
    const now = new Date().toISOString();
    const assetId = `local-${await sha256(file)}`;
    const dim = await dimensions(file);
    const dataUrl = await mockDataUrl(file);
    await localOpsStore.saveAsset(this.operator, {
      id: assetId, dealerId: slot.dealerId, slotRef: slot.ref, weekId: slot.weekId,
      fileName: file.name, mime: file.type, bytes: file.size, width: dim.width, height: dim.height,
      displayUrl: dataUrl, dataUrl, uploadedBy: this.operator.operatorId, uploadedAt: now,
    });
    await this.updateSlot({
      ...slot, status: 'uploaded', assetId, uploadedBy: this.operator.operatorId, uploadedAt: now,
    });
  }
  async approve(slot: OutputSlot): Promise<void> {
    await this.updateSlot({ ...slot, status: 'ready', approvedBy: this.operator.operatorId, approvedAt: new Date().toISOString() });
  }
  async markPackDownloaded(dealerId: string, weekId: string): Promise<void> {
    await localOpsStore.markPackDownloaded(this.operator, dealerId, weekId);
  }
  async assignNewProperty(): Promise<void> { throw new Error('No persisted new-property actions in mock mode'); }
}

export const marketingOpsGateway: MarketingOpsGateway = activeDataMode() === 'supabase'
  ? new SupabaseOpsGateway() : new MockOpsGateway();
