import type { LoadPriority, LoadStage, NetworkProfile, ResourceCost } from './types';

interface NavigatorConnection {
  effectiveType?: NetworkProfile['effectiveType'];
  saveData?: boolean;
}

export function readNetworkProfile(): NetworkProfile {
  if (typeof navigator === 'undefined') {
    return { effectiveType: 'unknown', saveData: false, visible: true, idle: true, online: true };
  }
  const n = navigator as Navigator & { connection?: NavigatorConnection; deviceMemory?: number };
  const type = n.connection?.effectiveType;
  return {
    effectiveType: type === 'slow-2g' || type === '2g' || type === '3g' || type === '4g' ? type : 'unknown',
    saveData: n.connection?.saveData === true,
    deviceMemoryGb: n.deviceMemory,
    visible: typeof document === 'undefined' || document.visibilityState === 'visible',
    idle: true,
    online: n.onLine !== false,
  };
}

export function concurrencyFor(profile: NetworkProfile): number {
  if (profile.saveData || profile.effectiveType === 'slow-2g' || profile.effectiveType === '2g') return 1;
  if ((profile.deviceMemoryGb ?? 8) <= 2 || profile.effectiveType === '3g') return 2;
  return 4;
}

export function allowsTask(
  profile: NetworkProfile,
  priority: LoadPriority,
  stage: LoadStage,
  cost: ResourceCost,
): boolean {
  if (!profile.online) return false;
  if (priority === 'P0' || priority === 'P1') return true;
  if (!profile.visible) return false;
  if (stage === 'prepare' && !cost.heavy) return true;
  if (profile.saveData) return false;
  if (profile.effectiveType === 'slow-2g' || profile.effectiveType === '2g') return false;
  if (priority === 'P3' && (!profile.idle || profile.effectiveType !== '4g')) return false;
  if (cost.heavy && (profile.effectiveType === '3g' || (profile.deviceMemoryGb ?? 8) <= 2)) return false;
  return true;
}
