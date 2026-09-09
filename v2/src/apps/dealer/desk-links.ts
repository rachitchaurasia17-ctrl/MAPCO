import { adapter } from '../../packages/data/adapter';
import type { ClientLinkWorkspace } from '../../packages/data/contracts';
import type { ClientLink } from '../../packages/data/types';

const kinds = { opened: 'open', property_viewed: 'view', photos_viewed: 'photos',
  map_opened: 'earth', audio_played: 'audio', call_clicked: 'call',
  whatsapp_clicked: 'wa', visit_requested: 'visit' } as const;

export function deskLink(link: ClientLink, workspace: ClientLinkWorkspace, now = Date.now()) {
  const s = workspace.summary;
  const expired = s.status === 'active' && !!s.expiresAt && Date.parse(s.expiresAt) <= now;
  return {
    id: s.id, clientId: s.clientId, client: s.clientName, props: [...s.propertyIds],
    created: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '',
    expires: s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('en-IN') : '',
    status: expired ? 'expired' : s.status, loc: link.loc,
    price: link.price === 'shown' ? 'exact' : 'hidden', audio: link.audio === 'done',
    events: workspace.history.flatMap(e => {
      const k = kinds[e.kind];
      const at = Date.parse(e.at);
      return k && Number.isFinite(at) ? [{ k, p: e.propertyId,
        m: Math.max(0, Math.floor((now - at) / 60000)) }] : [];
    }),
  };
}

/** Real event history only; aggregate counters never become invented events. */
export async function loadDeskLinks() {
  const records: ClientLink[] = [];
  let cursor: string | undefined;
  while (true) {
    const result = await adapter.clientLinks.list({ limit: 100, cursor });
    if (!result.ok) throw new Error('Client links could not be loaded. Please retry.');
    records.push(...result.value.items);
    if (!result.value.nextCursor || !result.value.items.length) break;
    if (result.value.nextCursor === cursor) throw new Error('Client link pagination could not continue. Please retry.');
    cursor = result.value.nextCursor;
  }
  return Promise.all(records.map(async link => {
    const result = await adapter.clientLinks.workspace(link.id);
    if (!result.ok) throw new Error('Client link activity could not be loaded. Please retry.');
    return deskLink(link, result.value);
  }));
}
