import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import {
  DeskStore, toDeskClient, toCanonicalClient,
  clientKnownDepth, clientMissingFields, budgetLabel,
} from '../src/apps/dealer/desk-store';
import type { Client } from '../src/packages/data/types';

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const FULL_FORM = {
  name: 'Requirement Buyer', phone: '+91 90000 88001', phone2: '+91 90000 88002',
  business: 'Buyer Traders', city: 'Mohali',
  types: ['Residential Plot'], areas: ['Sector 79', 'Aerocity'],
  budgetFrom: '1.2', budgetTo: '1.8', sizeFrom: '250', sizeTo: '350',
  prefs: ['Corner', 'Park facing'], stage: 'Actively searching',
  note: 'Wants registry-ready.',
};

describe('Desk ↔ canonical client round trip', () => {
  it('lifts the flat form into canonical requirements', () => {
    const canonical = toCanonicalClient(FULL_FORM, undefined, 'c1');
    expect(canonical.requirements).toMatchObject({
      types: ['Residential Plot'],
      areas: ['Sector 79', 'Aerocity'],
      budgetMin: 12_000_000,
      budgetMax: 18_000_000,
      sizeMin: '250', sizeMax: '350',
      preferences: ['Corner', 'Park facing'],
      stage: 'Actively searching',
    });
    expect(canonical.alternatePhone).toBe('+91 90000 88002');
    expect(canonical.business).toBe('Buyer Traders');
  });

  it('derives want and the budget label from what was recorded', () => {
    const canonical = toCanonicalClient(FULL_FORM, undefined, 'c2');
    expect(canonical.want).toBe('Plot');
    expect(canonical.budget).toBe('₹1.2–1.8 Cr');
    expect(canonical.budgetMax).toBe(18_000_000);
  });

  it('flattens requirements back onto the shape Contacts reads', () => {
    const canonical = toCanonicalClient(FULL_FORM, undefined, 'c3');
    const desk = toDeskClient(canonical);
    expect(desk.types).toEqual(['Residential Plot']);
    expect(desk.prefs).toEqual(['Corner', 'Park facing']);
    expect(desk.bFrom).toBe(1.2);
    expect(desk.bTo).toBe(1.8);
    expect(desk.phone2).toBe('+91 90000 88002');
  });

  it('records nothing the dealer did not enter', () => {
    const minimal = toCanonicalClient({ name: 'Bare Buyer', phone: '+91 90000 88003' }, undefined, 'c4');
    expect(minimal.requirements).toBeUndefined();
    expect(minimal.budget).toBe('');
    expect(minimal.budgetMax).toBe(0);
    expect(minimal.notes).toBeUndefined();
    expect(toDeskClient(minimal).types).toEqual([]);
  });

  it('never fabricates a budget band', () => {
    expect(budgetLabel(undefined, undefined)).toBe('');
    expect(budgetLabel(undefined, 9_000_000)).toBe('₹90 L');
    expect(budgetLabel(12_000_000, 18_000_000)).toBe('₹1.2–1.8 Cr');
  });

  it('prepends a new note and keeps the existing ones', () => {
    const first = toCanonicalClient({ ...FULL_FORM, note: 'First note' }, undefined, 'c5');
    const second = toCanonicalClient({ ...FULL_FORM, note: 'Second note' }, first, 'c5');
    expect(second.notes).toHaveLength(2);
    expect(second.notes![0]!.text).toBe('Second note');
    expect(second.notes![1]!.text).toBe('First note');
  });
});

describe('Needs Attention', () => {
  const bare = { id: 'x', name: 'Bare', phone: '+91 1', city: '', want: '', budget: '',
    budgetMax: 0, status: 'active', seen: '', note: '', viewed: [], interest: [], purchased: [] } as unknown as Client;

  it('treats a name-and-number-only client as needing details', () => {
    expect(clientKnownDepth(bare)).toBe(0);
    expect(clientMissingFields(bare)).toEqual(
      expect.arrayContaining(['city', 'property type', 'preferred areas', 'budget']));
  });

  it('stops needing attention once real requirements are recorded', () => {
    const full = toCanonicalClient(FULL_FORM, undefined, 'c6');
    expect(clientKnownDepth(full)).toBeGreaterThanOrEqual(2);
    expect(clientMissingFields(full)).toEqual([]);
  });

  it('counts only what was genuinely recorded', () => {
    const partial = toCanonicalClient({ name: 'A', phone: '+91 2', types: ['Flat'] }, undefined, 'c7');
    expect(clientKnownDepth(partial)).toBe(1);
    expect(clientMissingFields(partial)).toContain('budget');
  });
});

describe('client store', () => {
  it('keeps the array reference so the renderer stays attached', async () => {
    const store = new DeskStore();
    const reference = store.clients;
    await store.loadClients();
    expect(store.clients).toBe(reference);
    expect(store.clientsStatus.state).toBe('ready');
  });

  it('creates a client and reuses the same record on edit', async () => {
    const store = new DeskStore();
    await store.loadClients();
    const before = store.clients.length;

    const id = await store.saveClient({ ...FULL_FORM, phone: '+91 90000 88010' });
    expect(id).toBeTruthy();
    expect(store.clients.length).toBe(before + 1);

    const same = await store.saveClient(
      { ...FULL_FORM, phone: '+91 90000 88010', name: 'Renamed Buyer' }, id!);
    expect(same).toBe(id);
    expect(store.clients.length).toBe(before + 1);
    expect(store.clients.find((c) => c.id === id)!.name).toBe('Renamed Buyer');

    await store.archiveClient(id!);
  });

  it('rejects a client with no name or no phone', async () => {
    const store = new DeskStore();
    expect(await store.saveClient({ name: '  ', phone: '+91 90000 88011' })).toBeNull();
    expect(await store.saveClient({ name: 'No Phone', phone: '  ' })).toBeNull();
    expect(store.lastWriteError).toMatch(/name and a phone/i);
  });

  it('finds an existing client by phone so Add does not duplicate', async () => {
    const store = new DeskStore();
    await store.loadClients();
    const id = await store.saveClient({ name: 'Dupe Buyer', phone: '+91 90000 88012' });
    expect(store.findClientByPhone('9000088012')?.id).toBe(id);
    expect(store.findClientByPhone('+91-90000-88012')?.id).toBe(id);
    expect(store.findClientByPhone('+91 90000 88012', id!)).toBeNull();
    await store.archiveClient(id!);
  });

  it('persists requirements across a fresh load', async () => {
    const store = new DeskStore();
    await store.loadClients();
    const id = await store.saveClient({ ...FULL_FORM, phone: '+91 90000 88013' });

    const fresh = new DeskStore();
    await fresh.loadClients();
    const found = fresh.clients.find((c) => c.id === id)!;
    expect(found.types).toEqual(['Residential Plot']);
    expect(found.bTo).toBe(1.8);
    expect(found.prefs).toEqual(['Corner', 'Park facing']);

    await fresh.archiveClient(id!);
  });

  it('appends a dated note without losing the earlier ones', async () => {
    const store = new DeskStore();
    await store.loadClients();
    const id = (await store.saveClient({ name: 'Note Buyer', phone: '+91 90000 88014' }))!;
    expect(await store.addClientNote(id, 'Called, wants a site visit')).toBe(true);
    expect(await store.addClientNote(id, 'Visited on Sunday')).toBe(true);

    const fresh = new DeskStore();
    await fresh.loadClients();
    const notes = fresh.clients.find((c) => c.id === id)!.notes as { x: string }[];
    expect(notes).toHaveLength(2);
    expect(notes[0]!.x).toBe('Visited on Sunday');
    await fresh.archiveClient(id);
  });

  it('ignores an empty note rather than storing a blank one', async () => {
    const store = new DeskStore();
    await store.loadClients();
    const id = (await store.saveClient({ name: 'Blank Note', phone: '+91 90000 88015' }))!;
    expect(await store.addClientNote(id, '   ')).toBe(false);
    await store.archiveClient(id);
  });

  it('archiving hides the client but keeps the record', async () => {
    const store = new DeskStore();
    await store.loadClients();
    const id = (await store.saveClient({ name: 'Archive Buyer', phone: '+91 90000 88016' }))!;
    expect(store.clients.some((c) => c.id === id)).toBe(true);

    expect(await store.archiveClient(id)).toBe(true);
    expect(store.clients.some((c) => c.id === id)).toBe(false);
    // The canonical record still exists — links and deals still resolve it.
    const still = await adapter.customers.get(id);
    expect(still.ok).toBe(true);
    if (still.ok) expect(still.value.archived).toBe(true);
  });

  it('surfaces a truthful error instead of an empty list when loading fails', async () => {
    const store = new DeskStore();
    const original = adapter.customers.list;
    (adapter.customers as { list: unknown }).list = async () =>
      ({ ok: false, error: { code: 'network', message: 'boom', retryable: true } });
    await store.loadClients();
    expect(store.clientsStatus.state).toBe('error');
    expect(store.clientsStatus.error).toMatch(/could not reach/i);
    expect(store.clients).toHaveLength(0);
    (adapter.customers as { list: unknown }).list = original;
  });

  it('builds a profile from canonical purchases', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    await store.loadClients();
    await store.loadProperties();
    const id = store.clients[0]!.id as string;
    await store.loadClientWorkspace(id);
    expect(store.clientWorkspaceStatus.state).toBe('ready');
    const workspace = store.clientWorkspace!;
    expect((workspace.client as { id: string }).id).toBe(id);
    // Purchases come from the canonical purchased[] list, never invented.
    expect(Array.isArray(workspace.purchased)).toBe(true);
  });
});
