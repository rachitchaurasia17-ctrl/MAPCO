import { adapter } from '../../packages/data/adapter';
import type { DealWorkspace } from '../../packages/data/types';
import type { Page, PageParams, Result } from '../../packages/data/contracts';

export function deskDeal(workspace: DealWorkspace) {
  const d = workspace.deal;
  const m = workspace.money;
  const date = (value?: string) => value ? new Date(value).toLocaleDateString('en-IN') : '';
  const day = (value?: string) => value ? new Date(value).getDate() : 0;
  const paymentKinds = { token: 'token', 'commission-buyer': 'commB', 'commission-seller': 'commS' };
  return {
    id: d.id, clientId: d.buyerId, client: d.buyer, phone: workspace.buyer?.phone || '',
    name: d.name || d.prop, prop: d.prop, propSub: d.propSub, propId: d.propertyId,
    area: d.city, stage: d.stage, value: m.value, comm: m.expected,
    token: m.token, created: date(d.createdAt), createdDay: day(d.createdAt),
    registryDay: day(d.registryDate), registryDate: d.registryDate,
    lostReason: d.lostReason, lostOn: date(d.lostOn),
    cBMode: d.commission.buyer.mode, cB: d.commission.buyer.percent,
    cBFix: d.commission.buyer.fixed, cSMode: d.commission.seller.mode,
    cS: d.commission.seller.percent, cSFix: d.commission.seller.fixed,
    next: d.nextAction ? { k: d.nextAction.kind, note: d.nextAction.note || '',
      day: day(d.nextAction.dueOn), dueOn: d.nextAction.dueOn } : undefined,
    pay: workspace.payments.map(p => ({ id: p.id, k: paymentKinds[p.kind], amt: p.amount,
      d: p.receivedOn, note: p.note || '' })),
    hist: workspace.stageHistory.map(e => ({ s: e.stage, d: date(e.occurredAt) })),
    log: workspace.stageHistory.map(e => ({ d: date(e.occurredAt),
      t: e.note || `Stage changed to ${e.stage}`, i: 'ph-fill ph-flag-banner', c: '#1a5aa8' })),
    docs: workspace.dealPapers.map(p => ({ id: p.id, n: p.title, have: true, d: date(p.createdAt) })),
    seller: { name: workspace.seller?.name || d.seller || '',
      phone: workspace.seller?.primaryPhone || d.sellerPhone || '' },
    money: m,
  };
}

async function allPages<T>(read: (params: PageParams) => Promise<Result<Page<T>>>): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  do {
    const result = await read({ limit: 100, cursor });
    if (!result.ok) throw new Error('Deals could not be loaded. Open Deals again to retry.');
    rows.push(...result.value.items);
    const next = result.value.nextCursor ?? undefined;
    if (next && next === cursor) throw new Error('Deal pagination could not continue. Please retry.');
    cursor = next;
  } while (cursor);
  return rows;
}

export async function loadDeskDeals() {
  const [pipeline, completed] = await Promise.all([
    allPages(p => adapter.deals.listPipeline(p)), allPages(p => adapter.deals.list(p)),
  ]);
  const ids = [...new Set([...pipeline, ...completed].map(d => d.id))];
  return Promise.all(ids.map(async id => {
    const result = await adapter.deals.workspace(id);
    if (!result.ok) throw new Error('A deal workspace could not be loaded. Open Deals again to retry.');
    return deskDeal(result.value);
  }));
}
