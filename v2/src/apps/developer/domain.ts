export const FOUNDER_EMAIL = 'rachitchaurasia17@gmail.com';
export const DEFAULT_TRIAL_DAYS = 7;
export const DEFAULT_DEVICE_LIMIT = 4;
export const SUPPORT_PHONE = '8968017508';

export interface DealerAccount {
  dealer_id: string; brand_name: string; owner_name: string | null;
  owner_phone: string | null; login_email: string | null; primary_area: string | null;
  account_status: 'active' | 'suspended' | 'expired';
  subscription_status: string; trial_start: string | null; trial_end: string | null;
  expiry_date: string | null; plan_code: string | null; paid: boolean;
  max_devices_allowed: number; approved_device_count: number;
  developer_notes: string | null; payment_notes: string | null;
}
export interface ApprovedDevice {
  id: string; dealer_id: string; device_label: string | null; browser_info: string | null;
  status: 'approved' | 'pending' | 'revoked' | 'rejected'; last_seen: string | null;
  first_seen: string; approved_at: string | null;
}
export interface Trial {
  id: string; dealer_id: string; started_at: string; ends_at: string;
  commercial_outcome: 'open' | 'won' | 'lost' | 'deferred' | 'churned';
  acquisition_source: string; pitch_version: string; protocol_version: string;
  price_offered_paise: number | null; price_paid_paise: number | null;
}
export interface Evidence {
  id: string; dealer_id: string | null; trial_id: string | null;
  kind: string; provenance: string; body: string; occurred_at: string; recorded_at: string;
}
export interface Prediction {
  id: string; statement: string; domain: string; confidence: number;
  horizon_at: string; resolution: 'pending' | 'true' | 'false' | 'unresolvable' | 'expired';
  resolution_note: string | null;
}
export interface FounderWorkspace {
  trials: Trial[]; evidence: Evidence[]; predictions: Prediction[];
  devices: ApprovedDevice[];
  usage: { totalEvents: number; activeDays: number; events7d: number; lastActive: string | null };
  milestones: { trial_id: string; properties_added: number; add_abandoned: number;
    property_add_failures: number; active_days: number; first_link_at: string | null }[];
  buyer: { opens: number; intent_actions: number; visit_requests: number; engagement_level: string }[];
  history: { id: string; action_type: string; created_at: string; metadata: Record<string, unknown> }[];
}

export function accountState(account: DealerAccount, now = Date.now()): 'Suspended' | 'Expired' | 'Trial' | 'Paid' {
  if (account.account_status === 'suspended') return 'Suspended';
  if (account.account_status === 'expired') return 'Expired';
  const trial = account.subscription_status === 'trial';
  const end = trial ? account.trial_end : account.expiry_date;
  // An unknown/malformed entitlement must never appear active.
  if (!end || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= now) return 'Expired';
  if (trial) return 'Trial';
  return ['active', 'paid'].includes(account.subscription_status) ? 'Paid' : 'Expired';
}

/** Inclusive business date, fixed to the founder's India timezone. */
export function activeThroughToInstant(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose a valid active-through date.');
  const date = new Date(`${day}T23:59:59.999+05:30`);
  if (!Number.isFinite(date.getTime()) || date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !== day)
    throw new Error('Choose a valid active-through date.');
  return date.toISOString();
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function formatDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}
