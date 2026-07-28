/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Auth Types & Mock
   Source: 03_ROUTE_AND_ROLE_MATRIX.md
   ═══════════════════════════════════════════════════════════════ */

export type Role = 'owner' | 'manager' | 'team' | 'map_editor' | 'property_editor' | 'viewer';

export const SCOPE_CATALOG = [
  'presentation.view', 'properties.manage', 'mapstudio.manage', 'mapstudio.publish',
  'clients.view', 'deals.view', 'insights.view', 'exports.manage', 'audit.view',
  'dealerSettings.manage', 'team.manage', 'billing.manage'
] as const;

export type Scope = typeof SCOPE_CATALOG[number];

export interface UserProfile {
  id: string;
  name: string;
  role: Role;
  dealerId: string;
  dealerName: string;
  scopes: Scope[];
  isPlatformAdmin: boolean;
}

const ROLE_RANK: Record<Role, number> = {
  viewer: 1, team: 2, map_editor: 2, property_editor: 2, manager: 2, owner: 3
};

export function roleRank(role: Role): number { return ROLE_RANK[role] || 0; }

/** Mock profile — owner with all scopes */
export const mockProfile: UserProfile = {
  id: 'user-1',
  name: 'Rachit Chaurasia',
  role: 'owner',
  dealerId: 'dealer-1',
  dealerName: 'Chaurasia Properties',
  scopes: [...SCOPE_CATALOG],
  isPlatformAdmin: false,
};

export function getProfile(): UserProfile { return mockProfile; }
export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
export function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}
export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || '';
}
