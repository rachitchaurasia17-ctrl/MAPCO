import type { NetworkProfile, PredictiveCandidate, ScoreResult, ScoreWeights } from './types';

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  directAction: 100,
  context: 28,
  relationship: 24,
  sessionTransition: 18,
  dealerRecent: 13,
  dealerHistory: 7,
  recentInteraction: 20,
  probability: 15,
  byteCost: 18,
  parseCost: 12,
  constrainedNetwork: 18,
};

const clamp = (value: number | undefined): number => Math.max(0, Math.min(1, value ?? 0));

/** Transparent, replaceable rules-based scoring. New-session relationships work without history. */
export function scoreCandidate(
  candidate: PredictiveCandidate,
  profile: NetworkProfile,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): ScoreResult {
  const s = candidate.signals;
  const contributions: Array<[string, number]> = [
    ['direct action', clamp(s.directAction) * weights.directAction],
    ['current context', clamp(s.context) * weights.context],
    ['deterministic relationship', clamp(s.relationship) * weights.relationship],
    ['session transition', clamp(s.sessionTransition) * weights.sessionTransition],
    ['dealer recent history', clamp(s.dealerRecent) * weights.dealerRecent],
    ['dealer older history', clamp(s.dealerHistory) * weights.dealerHistory],
    ['recent interaction', clamp(s.recentInteraction) * weights.recentInteraction],
    ['next-use probability', clamp(s.probability) * weights.probability],
  ];
  const byteRatio = Math.min(candidate.cost.bytes / (4 * 1024 * 1024), 1);
  const constrained = profile.saveData || profile.effectiveType === 'slow-2g' || profile.effectiveType === '2g' ? 1
    : profile.effectiveType === '3g' ? 0.45 : 0;
  const penalties: Array<[string, number]> = [
    ['resource bytes', byteRatio * weights.byteCost],
    ['parse/decode cost', clamp(candidate.cost.parse) * weights.parseCost],
    ['network/device constraint', constrained * weights.constrainedNetwork],
  ];
  const score = Math.max(0, Math.round((contributions.reduce((n, [, v]) => n + v, 0) - penalties.reduce((n, [, v]) => n + v, 0)) * 10) / 10);
  const direct = clamp(s.directAction);
  const related = clamp(s.relationship);
  const priority = direct >= 0.95 ? 'P0' : (direct >= 0.5 || related >= 0.9 || score >= 70) ? 'P1'
    : score >= 42 ? 'P2' : score >= 24 ? 'P3' : 'skip';
  let stage = candidate.preferredStage;
  if (priority === 'P2' && score < 66) stage = 'prepare';
  if (priority === 'P3' && score < 78) stage = 'prepare';
  // Exact predictive-3D gate: explicit requests are P0; otherwise score >= 94,
  // 4G, >=8 GB reported memory, visible/idle, and Data Saver off.
  if (candidate.isThreeD && direct < 0.95) {
    const threeDAllowed = score >= 94 && profile.effectiveType === '4g' && (profile.deviceMemoryGb ?? 0) >= 8
      && profile.visible && profile.idle && !profile.saveData;
    if (!threeDAllowed) stage = 'prepare';
  }
  const explanation = [
    ...contributions.filter(([, value]) => value > 0).map(([name, value]) => `+${value.toFixed(1)} ${name}`),
    ...penalties.filter(([, value]) => value > 0).map(([name, value]) => `-${value.toFixed(1)} ${name}`),
    candidate.reason,
  ];
  return { score, priority, stage, explanation };
}
