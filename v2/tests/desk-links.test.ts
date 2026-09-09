import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { deskLink, loadDeskLinks } from '../src/apps/dealer/desk-links';
import type { ClientLinkWorkspace } from '../src/packages/data/contracts';
import type { ClientLink } from '../src/packages/data/types';

const link: ClientLink = { id: 'link-1', clientId: 'client-1', clientName: 'Buyer',
  props: ['property-1'], propNames: ['Plot'], expiry: '', loc: 'exact', price: 'shown',
  audio: 'none', audioSecs: 0, status: 'active', lastOpen: '',
  events: { opens: 99, played: 0, called: 0, wa: 0, visit: 0 } };
const workspace: ClientLinkWorkspace = { summary: {
  id: link.id, clientId: link.clientId, clientName: 'Recorded buyer', clientPhone: '',
  propertyIds: link.props, status: 'revoked',
  activity: { opens: 99, propertyViews: 0, photoViews: 0, mapOpens: 0,
    audioPlays: 0, calls: 0, whatsapp: 0, visitRequests: 0 },
}, properties: [], history: [] };

afterEach(() => vi.restoreAllMocks());
describe('canonical Desk client links', () => {
  it('never labels an elapsed link live even when the stored status remains active', () => {
    const mapped = deskLink(link, { ...workspace, summary: { ...workspace.summary,
      status: 'active', expiresAt: '2026-08-13T10:00:00Z' } }, Date.parse('2026-09-09T10:00:00Z'));
    expect(mapped.status).toBe('expired');
    expect(mapped.price).toBe('exact');
  });
  it('does not invent dated history from aggregate counts', () => {
    const mapped = deskLink(link, workspace);
    expect(mapped.events).toEqual([]);
    expect(mapped.status).toBe('revoked');
    expect(mapped.client).toBe('Recorded buyer');
    expect(mapped.loc).toBe('exact');
  });
  it('preserves real event identity and elapsed time', () => {
    const mapped = deskLink(link, { ...workspace, history: [
      { kind: 'opened', at: '2026-09-09T10:00:00Z' },
      { kind: 'map_opened', at: '2026-09-09T10:01:00Z', propertyId: 'property-1' },
    ] }, Date.parse('2026-09-09T10:03:00Z'));
    expect(mapped.events).toEqual([{ k: 'open', p: undefined, m: 3 },
      { k: 'earth', p: 'property-1', m: 2 }]);
  });
  it('reads every page and fails visibly when a workspace fails', async () => {
    const list = vi.spyOn(adapter.clientLinks, 'list')
      .mockResolvedValueOnce({ ok: true, value: { items: [link], nextCursor: 'next' } })
      .mockResolvedValueOnce({ ok: true, value: { items: [], nextCursor: null } });
    vi.spyOn(adapter.clientLinks, 'workspace').mockResolvedValue({ ok: false,
      error: { code: 'network', message: 'offline' } });
    await expect(loadDeskLinks()).rejects.toThrow(/activity could not be loaded/i);
    expect(list).toHaveBeenLastCalledWith({ limit: 100, cursor: 'next' });
  });
});
