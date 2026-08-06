import { describe, expect, it } from 'vitest';
import {
  CostAwareLruCache, PriorityLoader, SessionLearning, PredictiveRuntime,
  dealerScope, publicTokenScope, publishResourceInvalidation, resourceKey,
  scoreCandidate, type NetworkProfile, type PredictiveCandidate,
} from '../src/packages/performance';

const fast: NetworkProfile = {
  effectiveType: '4g', saveData: false, deviceMemoryGb: 8, visible: true, idle: true, online: true,
};
const slow: NetworkProfile = {
  effectiveType: '2g', saveData: true, deviceMemoryGb: 2, visible: true, idle: false, online: true,
};
const scope = dealerScope('dealer-a');
const key = (id: string, type: PredictiveCandidate['key']['type'] = 'map-metadata') => ({ scope, type, id });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('transparent candidate scoring', () => {
  it('classifies deterministic new-dealer dependencies as P1 without history', () => {
    const result = scoreCandidate({
      key: key('sector-82'), signals: { context: 0.9, relationship: 0.95, probability: 0.75 },
      cost: { bytes: 0, parse: 0 }, preferredStage: 'prepare', reason: 'masterplan → sector',
    }, fast);
    expect(result.priority).toBe('P1');
    expect(result.stage).toBe('prepare');
    expect(result.explanation.join(' ')).toContain('deterministic relationship');
  });

  it('weights direct dealer action above every predictive signal', () => {
    const direct = scoreCandidate({
      key: key('selected'), signals: { directAction: 1 }, cost: { bytes: 5_000_000, parse: 1, heavy: true },
      preferredStage: 'download', reason: 'selected',
    }, slow);
    expect(direct.priority).toBe('P0');
    expect(direct.stage).toBe('download');
  });

  it('penalizes expensive resources', () => {
    const base = { key: key('candidate'), signals: { context: 0.7, relationship: 0.5, probability: 0.7 }, preferredStage: 'download' as const, reason: 'candidate' };
    const small = scoreCandidate({ ...base, cost: { bytes: 20_000, parse: 0.05 } }, fast);
    const large = scoreCandidate({ ...base, cost: { bytes: 5_000_000, parse: 1, heavy: true } }, fast);
    expect(small.score).toBeGreaterThan(large.score);
  });

  it('keeps normal predictive 3D at prepare and permits only the documented high-confidence gate', () => {
    const ordinary = scoreCandidate({
      key: key('map:threeD', 'map-raster'), signals: { context: 1, relationship: 0.8, probability: 0.8 },
      cost: { bytes: 2_000_000, parse: 0.8, heavy: true }, preferredStage: 'download', isThreeD: true, reason: 'possible 3D',
    }, fast);
    const exceptional = scoreCandidate({
      key: key('map:threeD', 'map-raster'),
      signals: { context: 1, relationship: 1, sessionTransition: 1, dealerRecent: 1, dealerHistory: 1, recentInteraction: 1, probability: 1 },
      cost: { bytes: 200_000, parse: 0.1 }, preferredStage: 'download', isThreeD: true, reason: 'very high confidence',
    }, fast);
    expect(ordinary.stage).toBe('prepare');
    expect(exceptional.score).toBeGreaterThanOrEqual(94);
    expect(exceptional.stage).toBe('download');
  });

  it('uses recent session transitions more strongly than old dealer frequency', () => {
    const learning = new SessionLearning(scope.id, 'session-a');
    learning.record('masterplan', 'mohali', 'sector', '82', Date.now());
    expect(learning.transitionScore('masterplan', 'mohali', 'sector', '82')).toBeGreaterThan(0);
    const recent = SessionLearning.dealerScores([{ fromType: 'masterplan', fromId: 'mohali', toType: 'sector', toId: '82', count: 2, recentScore: 1, lastUsedAt: new Date().toISOString() }], 'masterplan', 'mohali', 'sector', '82');
    const old = SessionLearning.dealerScores([{ fromType: 'masterplan', fromId: 'mohali', toType: 'sector', toId: '82', count: 100, recentScore: 1, lastUsedAt: new Date(Date.now() - 180 * 86_400_000).toISOString() }], 'masterplan', 'mohali', 'sector', '82');
    expect(recent.recent).toBeGreaterThan(old.history);
  });
});

describe('shared priority loader', () => {
  it('aborts a running prediction so P0 is never blocked behind it', async () => {
    const loader = new PriorityLoader(() => ({ ...fast, effectiveType: '2g', saveData: false }), { maxEntries: 8, maxBytes: 1000 });
    const order: string[] = [];
    const predicted = loader.schedule({
      key: key('predicted'), priority: 'P2', stage: 'prepare', cost: { bytes: 0, parse: 0 }, reason: 'predicted next action',
      run: (signal) => new Promise<string>((resolve, reject) => {
        signal.addEventListener('abort', () => { order.push('prediction-aborted'); reject(new DOMException('aborted', 'AbortError')); });
        setTimeout(() => resolve('late'), 100);
      }),
    });
    await tick();
    const immediate = loader.schedule({
      key: key('visible'), priority: 'P0', stage: 'prepare', cost: { bytes: 0, parse: 0 }, reason: 'visible',
      run: async () => { order.push('p0'); return 'now'; },
    });
    await expect(predicted).rejects.toMatchObject({ name: 'AbortError' });
    await expect(immediate).resolves.toBe('now');
    expect(order).toEqual(['prediction-aborted', 'p0']);
  });

  it('shares one in-flight Promise for duplicate consumers', async () => {
    const loader = new PriorityLoader(() => fast);
    let calls = 0;
    let release!: () => void;
    const run = () => new Promise<string>((resolve) => { calls++; release = () => resolve('shared'); });
    const task = { key: key('same'), priority: 'P1' as const, stage: 'prepare' as const, cost: { bytes: 10, parse: 0 }, reason: 'same', run };
    const first = loader.schedule(task), second = loader.schedule(task);
    expect(first).toBe(second);
    release();
    await expect(first).resolves.toBe('shared');
    expect(calls).toBe(1);
  });

  it('counts a prepared prediction as correct when a direct action reuses it', async () => {
    const loader = new PriorityLoader(() => fast);
    let calls = 0;
    const predictedKey = key('likely-next');
    await loader.schedule({
      key: predictedKey, priority: 'P2', stage: 'prepare', cost: { bytes: 10, parse: 0 }, reason: 'likely next',
      run: async () => { calls++; return 'warm'; },
    });
    await expect(loader.schedule({
      key: predictedKey, priority: 'P0', stage: 'prepare', cost: { bytes: 10, parse: 0 }, reason: 'dealer opened it',
      run: async () => { calls++; return 'cold'; },
    })).resolves.toBe('warm');
    expect(calls).toBe(1);
    expect(loader.instrumentation.summary()['prediction-used']).toBe(1);
  });

  it('promotes a queued P2 task to P1', async () => {
    const loader = new PriorityLoader(() => ({ ...fast, effectiveType: '2g', saveData: false }));
    let release!: () => void;
    const blocker = loader.schedule({ key: key('blocker'), priority: 'P0', stage: 'prepare', cost: { bytes: 0, parse: 0 }, reason: 'blocker', run: () => new Promise<string>((resolve) => { release = () => resolve('done'); }) });
    const candidateKey = key('promote');
    const candidate = loader.schedule({ key: candidateKey, priority: 'P2', stage: 'prepare', cost: { bytes: 0, parse: 0 }, reason: 'predicted', run: async () => 'promoted' });
    expect(loader.promote(resourceKey(candidateKey, 'prepare'), 'P1', 'dealer clicked')).toBe(true);
    release(); await blocker;
    await expect(candidate).resolves.toBe('promoted');
    expect(loader.instrumentation.summary().promoted).toBe(1);
  });

  it('cancels obsolete context and prevents stale completion', async () => {
    const loader = new PriorityLoader(() => fast);
    const version = loader.beginContext('property');
    const old = loader.schedule({
      key: key('old'), priority: 'P2', stage: 'prepare', group: 'property', contextVersion: version,
      cost: { bytes: 0, parse: 0 }, reason: 'old property',
      run: (signal) => new Promise<string>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        setTimeout(() => resolve('old'), 30);
      }),
    });
    loader.beginContext('property');
    await expect(old).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('blocks predictive heavy downloads on Data Saver while allowing P0', async () => {
    const loader = new PriorityLoader(() => slow);
    const heavy = loader.schedule({ key: key('heavy', 'map-raster'), priority: 'P2', stage: 'download', cost: { bytes: 2_000_000, parse: 0.8, heavy: true }, reason: 'prediction', run: async () => 'no' });
    await expect(heavy).rejects.toMatchObject({ name: 'AbortError' });
    await expect(loader.schedule({ key: key('current'), priority: 'P0', stage: 'download', cost: { bytes: 2_000_000, parse: 0.8, heavy: true }, reason: 'direct', run: async () => 'yes' })).resolves.toBe('yes');
  });

  it('deduplicates by dealer/public-token scope and never crosses scopes', () => {
    const dealer = resourceKey({ scope: dealerScope('a'), type: 'property-summary', id: 'p1' }, 'prepare');
    const other = resourceKey({ scope: dealerScope('b'), type: 'property-summary', id: 'p1' }, 'prepare');
    const publicA = resourceKey({ scope: publicTokenScope('token-a'), type: 'property-summary', id: 'p1' }, 'prepare');
    const publicB = resourceKey({ scope: publicTokenScope('token-b'), type: 'property-summary', id: 'p1' }, 'prepare');
    expect(new Set([dealer, other, publicA, publicB]).size).toBe(4);
    expect(publicA).not.toContain('token-a');
  });
});

describe('bounded cache and invalidation', () => {
  it('evicts least-recent non-current resources by count/cost', () => {
    const disposed: string[] = [];
    const cache = new CostAwareLruCache<string>(2, 10, (key) => disposed.push(key));
    cache.set('current', 'a', { costBytes: 6, protected: true });
    cache.set('old', 'b', { costBytes: 3 });
    cache.set('new', 'c', { costBytes: 3 });
    expect(cache.get('current')).toBe('a');
    expect(cache.get('old')).toBeUndefined();
    expect(disposed).toContain('old');
  });

  it('does not reuse an expired signed URL entry', () => {
    const cache = new CostAwareLruCache<string>(2, 100);
    cache.set('signed', 'url', { expiresAt: 10 });
    expect(cache.get('signed', 11)).toBeUndefined();
  });

  it('invalidates only the mutated property and related bootstrap list', async () => {
    const runtime = new PredictiveRuntime(scope, undefined, () => fast);
    await runtime.prepareValue({ type: 'property-summary', id: 'p1' }, { id: 'p1' }, { reason: 'p1' });
    await runtime.prepareValue({ type: 'property-summary', id: 'p2' }, { id: 'p2' }, { reason: 'p2' });
    publishResourceInvalidation({ entity: 'property', id: 'p1' });
    await expect(runtime.prepareValue({ type: 'property-summary', id: 'p1' }, { id: 'p1-updated' }, { reason: 'p1 refreshed' }))
      .resolves.toEqual({ id: 'p1-updated' });
    await expect(runtime.prepareValue({ type: 'property-summary', id: 'p2' }, { id: 'changed' }, { reason: 'p2 hit' })).resolves.toEqual({ id: 'p2' });
    expect(runtime.loader.cacheSize).toBe(2);
    runtime.dispose();
  });

  it('invalidates prepared Client Link previews after client/link mutations', async () => {
    const runtime = new PredictiveRuntime(scope, undefined, () => fast);
    await runtime.prepareValue({ type: 'client-link-preview', id: 'selection:p1' }, 'old', { reason: 'selection' });
    publishResourceInvalidation({ entity: 'client', id: 'c1' });
    expect(runtime.loader.cacheKeys()).toEqual([]);
    await expect(runtime.prepareValue({ type: 'client-link-preview', id: 'selection:p1' }, 'client-updated', { reason: 'refresh' }))
      .resolves.toBe('client-updated');
    publishResourceInvalidation({ entity: 'client-link', id: 'link-1' });
    await expect(runtime.prepareValue({ type: 'client-link-preview', id: 'selection:p1' }, 'link-updated', { reason: 'refresh' }))
      .resolves.toBe('link-updated');
    runtime.dispose();
  });

  it('keeps full-catalog assets unscheduled when only metadata is prepared', async () => {
    const runtime = new PredictiveRuntime(scope, undefined, () => fast);
    await Promise.all(['sector-a', 'sector-b'].map((id) => runtime.prepareValue({ type: 'map-metadata', id }, { id }, { reason: 'linked sector' })));
    const summary = runtime.loader.instrumentation.summary();
    expect(summary.downloaded ?? 0).toBe(0);
    expect(summary.prepared).toBe(2);
    expect(runtime.loader.cacheSize).toBe(2);
    runtime.dispose();
  });
});
