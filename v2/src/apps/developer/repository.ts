import { getSupabase } from '../../packages/data/supabase/client';
import type { DealerAccount, FounderWorkspace, Prediction } from './domain';
import { provisionDealer } from './provisioning';

async function connection() {
  const client = await getSupabase();
  if (!client) throw new Error('Founder Control requires the configured MAPCO backend.');
  return client;
}

async function rpc<T>(name: string, payload: Record<string, unknown> = {}): Promise<T> {
  const client = await connection();
  const { data, error } = await client.rpc(name, payload);
  if (error) throw new Error(error.message || 'The request could not be completed.');
  return data as T;
}

export const founderRepository = {
  provisionDealer,
  async bootstrap(): Promise<boolean> {
    return rpc<boolean>('plotmap_founder_bootstrap');
  },
  async dealers(): Promise<DealerAccount[]> {
    const rows = await rpc<DealerAccount[]>('plotmap_admin_dealer_directory');
    if (!Array.isArray(rows)) throw new Error('Dealer directory returned an invalid response.');
    return rows.filter(d => d.dealer_id !== 'dealsetu-platform');
  },
  workspace(dealerId: string): Promise<FounderWorkspace> {
    return rpc('plotmap_founder_dealer_workspace', { p_dealer_id: dealerId });
  },
  setAccount(input: { dealerId: string; action: 'paid' | 'suspend' | 'resume' | 'extend_trial';
    expiresAt?: string; plan?: string; paymentNote?: string; amountPaise?: number }): Promise<void> {
    return rpc('plotmap_founder_set_account', { p_payload: input });
  },
  async setDeviceStatus(deviceId: string, status: 'revoked' | 'approved'): Promise<void> {
    await rpc('plotmap_admin_set_device_status', { p_device_id: deviceId, p_status: status });
  },
  async setDeviceLimit(dealerId: string, limit: number): Promise<void> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Device limit must be between 1 and 20.');
    await rpc('plotmap_admin_set_dealer_device_limit', { p_dealer_id: dealerId, p_max_devices_allowed: limit });
  },
  createActivationCode(dealerId: string): Promise<{ code: string; expires_at: string }> {
    return rpc('plotmap_founder_create_device_code', { p_dealer_id: dealerId });
  },
  addEvidence(input: { dealerId: string; trialId?: string; kind: string; provenance: string; body: string; occurredAt: string }): Promise<void> {
    return rpc('plotmap_founder_add_evidence', { p_payload: input });
  },
  addPrediction(input: { dealerId: string; trialId?: string; statement: string; domain: string; confidence: number; horizonAt: string }): Promise<void> {
    return rpc('plotmap_founder_add_prediction', { p_payload: input });
  },
  resolvePrediction(id: string, resolution: Exclude<Prediction['resolution'], 'pending'>, note: string): Promise<void> {
    return rpc('plotmap_founder_resolve_prediction', { p_id: id, p_resolution: resolution, p_note: note });
  },
};
