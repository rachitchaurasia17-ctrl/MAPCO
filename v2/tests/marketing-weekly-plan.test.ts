import { describe, expect, it } from 'vitest';
import {
  planWeek, assessEligibility, allBriefs, toHistory,
  weekStartOf, weekIdOf, creativeIdFor, signatureOf,
  buildFactPack, hasSufficientFacts, PROHIBITED_CLAIMS, EXCLUDED_FIELDS,
  allTemplates, getTemplate,
  extractCreativeId, matchFiles, summarise,
  buildDailyPrompt, buildRegenerationPrompt, MASTER_BLOCK,
  renderWeekSummary, renderBriefText, briefJson, createZip,
  DeterministicPhotoIntelligence, candidatesFrom,
  LocalPlanStore,
  type DealerBrand,
} from '../src/packages/marketing';
import { PROPERTIES } from '../src/packages/data/mock-adapter';
import type { Property } from '../src/packages/data/types';

const BRAND: DealerBrand = {
  dealerId: 'dealer-a',
  name: 'Chaurasia Properties',
  phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210',
};

const plan = (over: Partial<Parameters<typeof planWeek>[0]> = {}) => planWeek({
  dealerId: 'dealer-a',
  brand: BRAND,
  properties: PROPERTIES,
  weekStart: '2026-08-17',
  ...over,
});

describe('weekly planner — the 28 hard requirement', () => {
  it('always produces exactly 28 creatives across 7 days', async () => {
    const p = await plan();
    expect(p.days).toHaveLength(7);
    expect(allBriefs(p)).toHaveLength(28);
    for (const day of p.days) expect(day.briefs).toHaveLength(4);
  });

  it('gives every creative a globally unique combination', async () => {
    const briefs = allBriefs(await plan());
    const signatures = new Set(briefs.map((b) => b.signature));
    expect(signatures.size).toBe(28);
  });

  it('issues stable sequential creative ids C001..C028', async () => {
    const briefs = allBriefs(await plan());
    expect(briefs[0]!.id).toBe('C001');
    expect(briefs[27]!.id).toBe('C028');
    expect(new Set(briefs.map((b) => b.id)).size).toBe(28);
  });

  it('is idempotent — same inputs produce the same plan', async () => {
    const a = allBriefs(await plan());
    const b = allBriefs(await plan());
    expect(a.map((x) => x.signature)).toEqual(b.map((x) => x.signature));
    expect(a.map((x) => x.propertyId)).toEqual(b.map((x) => x.propertyId));
    expect(a.map((x) => x.templateId)).toEqual(b.map((x) => x.templateId));
  });

  it('never leads all four of a day with the same creative angle', async () => {
    for (const day of (await plan()).days) {
      const angles = day.briefs.map((b) => b.angle);
      // Four identical angles in one day reads as four versions of one post.
      expect(new Set(angles).size).toBeGreaterThan(1);
    }
  });

  it('never repeats a template within a single day', async () => {
    for (const day of (await plan()).days) {
      const ids = day.briefs.map((b) => b.templateId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('spreads properties — no property dominates the week', async () => {
    const briefs = allBriefs(await plan());
    const counts = new Map<string, number>();
    for (const b of briefs) counts.set(b.propertyId, (counts.get(b.propertyId) ?? 0) + 1);
    const values = [...counts.values()];
    // With small inventory a property recurs, but usage must stay even.
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });

  it('varies the hero photo when a property recurs', async () => {
    const briefs = allBriefs(await plan());
    const byProperty = new Map<string, string[]>();
    for (const b of briefs) {
      const list = byProperty.get(b.propertyId) ?? [];
      list.push(b.heroPhoto.id);
      byProperty.set(b.propertyId, list);
    }
    for (const [, photos] of byProperty) {
      if (photos.length > 1) expect(new Set(photos).size).toBeGreaterThan(1);
    }
  });

  it('varies the creative angle when a property recurs', async () => {
    const briefs = allBriefs(await plan());
    const byProperty = new Map<string, string[]>();
    for (const b of briefs) {
      const list = byProperty.get(b.propertyId) ?? [];
      list.push(b.angle);
      byProperty.set(b.propertyId, list);
    }
    for (const [, angles] of byProperty) {
      if (angles.length > 2) expect(new Set(angles).size).toBeGreaterThan(1);
    }
  });

  it('does not reuse last week’s combinations', async () => {
    const first = await plan();
    const second = await plan({ weekStart: '2026-08-24', history: toHistory(first) });
    const before = new Set(allBriefs(first).map((b) => b.signature));
    for (const b of allBriefs(second)) expect(before.has(b.signature)).toBe(false);
  });
});

describe('eligibility gate', () => {
  it('excludes sold stock and says why', async () => {
    const sold: Property = { ...PROPERTIES[0]!, id: 'sold-1', sold: true };
    const { eligible, rejected } = assessEligibility([sold]);
    expect(eligible).toHaveLength(0);
    expect(rejected[0]).toMatchObject({ propertyId: 'sold-1', reason: 'sold' });
  });

  it('excludes unpublished stock', () => {
    const hidden: Property = { ...PROPERTIES[0]!, id: 'hidden-1', published: false };
    const { eligible, rejected } = assessEligibility([hidden]);
    expect(eligible).toHaveLength(0);
    expect(rejected[0]!.reason).toBe('not published');
  });

  it('excludes property with no usable photo', () => {
    const noPhoto: Property = { ...PROPERTIES[0]!, id: 'nophoto-1', photos: [] };
    const { rejected } = assessEligibility([noPhoto]);
    expect(rejected[0]!.reason).toBe('no usable photo');
  });

  it('drops a property that becomes sold on the next rebuild', async () => {
    const before = allBriefs(await plan());
    expect(before.some((b) => b.propertyId === PROPERTIES[0]!.id)).toBe(true);

    const withSold = PROPERTIES.map((p, i) => (i === 0 ? { ...p, sold: true } : p));
    const after = allBriefs(await plan({ properties: withSold }));
    expect(after.some((b) => b.propertyId === PROPERTIES[0]!.id)).toBe(false);
    expect(after).toHaveLength(28);
  });

  it('produces an empty, explained plan when nothing is marketable', async () => {
    const p = await plan({ properties: PROPERTIES.map((x) => ({ ...x, sold: true })) });
    expect(allBriefs(p)).toHaveLength(0);
    expect(p.notes.join(' ')).toMatch(/no property is currently marketable/i);
  });
});

describe('verified facts', () => {
  it('never projects a private field', () => {
    const pack = buildFactPack(PROPERTIES.find((p) => p.published && !p.sold)!)!;
    const blob = JSON.stringify(pack.facts).toLowerCase();
    for (const forbidden of ['price', 'owner', 'commission', 'seller', 'views', 'internalstatus']) {
      expect(blob).not.toContain(forbidden);
    }
  });

  it('refuses to build a pack for sold or unpublished stock', () => {
    expect(buildFactPack({ ...PROPERTIES[0]!, sold: true })).toBeNull();
    expect(buildFactPack({ ...PROPERTIES[0]!, published: false })).toBeNull();
  });

  it('numbers facts F001.. with provenance', () => {
    const pack = buildFactPack(PROPERTIES.find((p) => p.published && !p.sold)!)!;
    expect(pack.facts[0]!.id).toBe('F001');
    for (const f of pack.facts) {
      expect(f.id).toMatch(/^F\d{3}$/);
      expect(f.source).toMatch(/^property\./);
      expect(f.value.trim()).not.toBe('');
    }
  });

  it('drops a landmark that has no stored distance', () => {
    const p: Property = {
      ...PROPERTIES[0]!,
      landmarks: [{ name: 'Ghost Mall', distance: '', icon: 'x' } as never],
    };
    const pack = buildFactPack(p)!;
    expect(JSON.stringify(pack.facts)).not.toContain('Ghost Mall');
  });

  it('carries the prohibited-claim list into every pack', () => {
    const pack = buildFactPack(PROPERTIES.find((p) => p.published && !p.sold)!)!;
    expect(pack.prohibitedClaims).toEqual(PROHIBITED_CLAIMS);
    expect(pack.excluded).toEqual(EXCLUDED_FIELDS);
  });
});

describe('no private data escapes into a pack', () => {
  it('carries no private VALUE — only the guardrail lists name those fields', async () => {
    for (const brief of allBriefs(await plan())) {
      const json = JSON.parse(briefJson(brief));
      // The payload that actually reaches a creative.
      const payload = JSON.stringify({
        facts: json.facts, brand: json.brand, property: json.property,
        direction: json.direction, cta: json.cta,
      }).toLowerCase();

      for (const forbidden of ['commission', 'seller', 'internalstatus', 'photostorage', 'buyerdata', 'owner']) {
        expect(payload).not.toContain(forbidden);
      }
      // No bare price/rate figure anywhere in the fact values.
      for (const fact of json.facts as { value: string }[]) {
        expect(fact.value).not.toMatch(/₹|\bcr\b|\blakh\b|\bper sq\b/i);
      }
      // The private field names appear ONLY inside the withheld list.
      expect(json.excludedFields).toContain('commission');
    }
  });

  it('the daily prompt states the fact-only rule', async () => {
    const p = await plan();
    const prompt = buildDailyPrompt(p.days[0]!, p.weekId);
    expect(prompt).toContain('ONLY THE SUPPLIED FACTS MAY BE STATED');
    expect(prompt).toContain('NEVER MAKE A MARKET CLAIM');
    expect(prompt).toMatch(/must NOT redraw, regenerate/i);
    // Model-agnostic by design.
    expect(prompt).not.toMatch(/gpt-[0-9]/i);
    expect(prompt).toContain('highest-quality');
  });

  it('regeneration prompt targets exactly one creative', async () => {
    const brief = allBriefs(await plan())[5]!;
    const prompt = buildRegenerationPrompt(brief, 'text was misspelled');
    expect(prompt).toContain(brief.id);
    expect(prompt).toContain('text was misspelled');
    expect(prompt).toContain(MASTER_BLOCK.slice(0, 40));
  });
});

describe('cross-dealer isolation', () => {
  it('keeps two dealers’ plans separate in the store', async () => {
    const store = new LocalPlanStore();
    const a = await plan({ dealerId: 'dealer-a' });
    const b = await plan({ dealerId: 'dealer-b', brand: { ...BRAND, dealerId: 'dealer-b' } });
    await store.savePlan(a);
    await store.savePlan(b);

    expect((await store.getPlan('dealer-a', a.weekId))!.dealerId).toBe('dealer-a');
    expect((await store.getPlan('dealer-b', b.weekId))!.dealerId).toBe('dealer-b');
    const listA = await store.listPlans('dealer-a');
    expect(listA.every((p) => p.dealerId === 'dealer-a')).toBe(true);
  });

  it('stamps every brief with its own dealer id', async () => {
    for (const b of allBriefs(await plan({ dealerId: 'dealer-x', brand: { ...BRAND, dealerId: 'dealer-x' } }))) {
      expect(b.dealerId).toBe('dealer-x');
    }
  });
});

describe('week identity and timezone boundaries', () => {
  it('anchors the week to Monday', () => {
    expect(weekStartOf(new Date('2026-08-19T10:00:00Z'))).toBe('2026-08-17'); // Wed → Mon
    expect(weekStartOf(new Date('2026-08-17T00:00:00Z'))).toBe('2026-08-17'); // Mon → Mon
    expect(weekStartOf(new Date('2026-08-23T23:59:00Z'))).toBe('2026-08-17'); // Sun → Mon
  });

  it('produces a stable ISO week id', () => {
    expect(weekIdOf(new Date('2026-08-17T00:00:00Z'))).toMatch(/^2026-W\d{2}$/);
    expect(weekIdOf(new Date('2026-08-19T00:00:00Z')))
      .toBe(weekIdOf(new Date('2026-08-17T00:00:00Z')));
  });

  it('uses the same plan id for a duplicate run — no duplicate week', async () => {
    const a = await plan();
    const b = await plan();
    expect(a.id).toBe(b.id);
  });

  it('a rebuild bumps the revision without changing week identity', async () => {
    const a = await plan();
    const b = await plan({ revision: 2 });
    expect(b.weekId).toBe(a.weekId);
    expect(b.id).not.toBe(a.id);
    expect(b.revision).toBe(2);
  });
});

describe('templates', () => {
  it('ingested every approved template with a stable id', () => {
    const all = allTemplates();
    expect(all.length).toBeGreaterThanOrEqual(35);
    expect(all[0]!.id).toBe('T001');
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
  });

  it('gives every template an intrinsic size and aspect ratio', () => {
    for (const t of allTemplates()) {
      expect(t.intrinsic.w).toBeGreaterThan(0);
      expect(t.intrinsic.h).toBeGreaterThan(0);
      expect(['4:5', '1:1', '9:16']).toContain(t.aspectRatio);
      expect(t.hasPoweredByMapco).toBe(true);
    }
  });

  it('only plans templates that exist in the registry', async () => {
    for (const b of allBriefs(await plan())) {
      expect(getTemplate(b.templateId)).toBeTruthy();
    }
  });
});

describe('photo intelligence', () => {
  it('is honest that it cannot judge photo content', () => {
    expect(new DeterministicPhotoIntelligence().semantic).toBe(false);
  });

  it('is deterministic and explains every ranking', async () => {
    const ai = new DeterministicPhotoIntelligence();
    const photos = candidatesFrom('p1', ['/a.jpg', '/b.jpg', '/c.jpg']);
    const ctx = { propertyType: 'Residential Plot', preferredOrientation: 'landscape' as const, recentlyUsedIds: [] };
    const first = await ai.rank(photos, ctx);
    const second = await ai.rank(photos, ctx);
    expect(first.map((p) => p.id)).toEqual(second.map((p) => p.id));
    for (const p of first) expect(p.reasons.length).toBeGreaterThan(0);
  });

  it('deprioritises a recently used photo', async () => {
    const ai = new DeterministicPhotoIntelligence();
    const photos = candidatesFrom('p1', ['/a.jpg', '/b.jpg']);
    const ranked = await ai.rank(photos, {
      propertyType: 'Plot', preferredOrientation: 'any', recentlyUsedIds: ['p1#0'],
    });
    expect(ranked[0]!.id).toBe('p1#1');
  });
});

describe('bulk return from ChatGPT', () => {
  const file = (name: string, type = 'image/png', size = 1024): File =>
    ({ name, type, size } as File);

  it('extracts a creative id from realistic filenames', () => {
    expect(extractCreativeId('C001.png')).toBe('C001');
    expect(extractCreativeId('C017-final.jpg')).toBe('C017');
    expect(extractCreativeId('MAPCO-C028 (1).png')).toBe('C028');
    expect(extractCreativeId('c009.PNG')).toBe('C009');
    expect(extractCreativeId('final-design.png')).toBeNull();
    // Ambiguous — two different ids in one name must never be guessed.
    expect(extractCreativeId('C001-and-C002.png')).toBeNull();
  });

  it('matches, and reports rather than guesses', async () => {
    const briefs = allBriefs(await plan());
    const result = await matchFiles(
      [file('C001.png'), file('C002.png'), file('C001-copy.png'),
       file('nope.png'), file('C999.png'), file('doc.pdf', 'application/pdf')],
      { briefs, alreadyUploaded: [] },
    );
    const s = summarise(result);
    expect(s.matched).toBe(2);
    expect(s.duplicate).toBe(1);
    expect(s.invalid).toBe(1);
    expect(s.unmatched).toBe(2);   // 'nope' and the out-of-week C999
    expect(result.find((r) => r.fileName === 'C999.png')!.note).toMatch(/not part of this week/i);
  });

  it('rejects an oversized file', async () => {
    const briefs = allBriefs(await plan());
    const [r] = await matchFiles([file('C001.png', 'image/png', 40 * 1024 * 1024)], { briefs, alreadyUploaded: [] });
    expect(r!.outcome).toBe('invalid');
    expect(r!.note).toMatch(/too large/i);
  });

  it('flags a replacement of an already-uploaded creative', async () => {
    const briefs = allBriefs(await plan());
    const [r] = await matchFiles([file('C003.png')], { briefs, alreadyUploaded: ['C003'] });
    expect(r!.outcome).toBe('matched');
    expect(r!.note).toMatch(/replaces/i);
  });
});

describe('pack generation', () => {
  it('writes a readable zip with a correct end-of-central-directory', async () => {
    const blob = createZip([
      { path: 'DAY-01/CHATGPT-PROMPT.txt', data: new TextEncoder().encode('hello') },
      { path: 'DAY-01/C001-brief.txt', data: new TextEncoder().encode('brief') },
    ]);
    expect(blob.size).toBeGreaterThan(0);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // local file header
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // end of central directory, with the entry count
    const eocd = bytes.length - 22;
    expect([bytes[eocd], bytes[eocd + 1], bytes[eocd + 2], bytes[eocd + 3]]).toEqual([0x50, 0x4b, 0x05, 0x06]);
    expect(bytes[eocd + 10]).toBe(2);
  });

  it('summarises the week with every creative listed', async () => {
    const p = await plan();
    const md = renderWeekSummary(p);
    expect(md).toContain(`Week ${p.weekId}`);
    expect(md).toContain('28 creatives');
    for (const b of allBriefs(p)) expect(md).toContain(b.id);
  });

  it('tells the operator the exact filename to save', async () => {
    const brief = allBriefs(await plan())[0]!;
    expect(renderBriefText(brief)).toContain(`${brief.id}.png`);
    expect(JSON.parse(briefJson(brief)).saveAs).toBe(`${brief.id}.png`);
  });

  it('names every asset with its creative id so files cannot be confused', async () => {
    const brief = allBriefs(await plan())[3]!;
    const files = JSON.parse(briefJson(brief)).files;
    expect(files.template).toBe(`${brief.id}-TEMPLATE-${brief.templateId}.png`);
    expect(files.hero.startsWith(`${brief.id}-HERO.`)).toBe(true);
  });
});
