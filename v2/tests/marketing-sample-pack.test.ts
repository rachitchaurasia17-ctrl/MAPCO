/* Generates a REAL sample weekly pack to disk from the demo inventory,
   for the founder's own visual QA.

       npx vitest run tests/marketing-sample-pack.test.ts

   Output: v2/sample-pack/  (gitignored — a QA artefact, not source)

   This writes the text side of the pack: the week summary, each day's
   ChatGPT prompt, and every brief. The image files are copied by the
   in-browser pack builder at download time; here we write a manifest
   naming exactly which asset belongs to which creative, so the naming
   scheme can be checked without downloading 200 MB of photos. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  planWeek, allBriefs, renderWeekSummary, renderBriefText, briefJson,
  buildDailyPrompt, buildRegenerationPrompt, OPERATOR_HEADER,
  dayFolder, getTemplate, templateAssetUrl,
  type DealerBrand,
} from '../src/packages/marketing';
import { PROPERTIES } from '../src/packages/data/mock-adapter';

const OUT = path.resolve(__dirname, '../sample-pack');

const BRAND: DealerBrand = {
  dealerId: 'chaurasia-properties',
  name: 'Chaurasia Properties',
  phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210',
};

describe('sample weekly pack', () => {
  it('exports a full 28-creative week to disk for visual QA', async () => {
    const plan = await planWeek({
      dealerId: BRAND.dealerId,
      brand: BRAND,
      properties: PROPERTIES,
      weekStart: '2026-08-17',
    });

    expect(allBriefs(plan)).toHaveLength(28);

    // OneDrive can hold a lock on a synced folder; overwriting in place is
    // enough for a QA artefact and avoids a spurious EPERM failure.
    try { fs.rmSync(OUT, { recursive: true, force: true }); } catch { /* locked — overwrite instead */ }
    const root = path.join(OUT, `MAPCO-WEEK-${plan.weekId}`);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'WEEK-SUMMARY.md'), renderWeekSummary(plan), 'utf8');

    const manifest: string[] = ['# Asset manifest', ''];

    for (const day of plan.days) {
      const dir = path.join(root, dayFolder(day));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'CHATGPT-PROMPT.txt'),
        `${OPERATOR_HEADER}\n\n${buildDailyPrompt(day, plan.weekId)}`, 'utf8');

      manifest.push(`## ${dayFolder(day)}`, '');
      for (const brief of day.briefs) {
        fs.writeFileSync(path.join(dir, `${brief.id}-brief.txt`), renderBriefText(brief), 'utf8');
        fs.writeFileSync(path.join(dir, `${brief.id}-brief.json`), briefJson(brief), 'utf8');
        fs.writeFileSync(
          path.join(dir, `${brief.id}-REGENERATE-PROMPT.txt`),
          buildRegenerationPrompt(brief), 'utf8');

        const template = getTemplate(brief.templateId)!;
        manifest.push(
          `- **${brief.id}** → save as \`${brief.id}.png\``,
          `  - template \`${brief.id}-TEMPLATE-${template.id}.png\` ← \`${templateAssetUrl(template)}\``,
          `  - hero \`${brief.id}-HERO.*\` ← \`${brief.heroPhoto.url}\``,
          ...brief.secondaryPhotos.map((p, i) =>
            `  - extra ${i + 1} \`${brief.id}-SECONDARY-${String(i + 1).padStart(2, '0')}.*\` ← \`${p.url}\``),
        );
      }
      manifest.push('');
    }
    fs.writeFileSync(path.join(root, 'ASSET-MANIFEST.md'), manifest.join('\n'), 'utf8');

    // Sanity: every creative got its three text files.
    const files = fs.readdirSync(path.join(root, dayFolder(plan.days[0]!)));
    expect(files).toContain('CHATGPT-PROMPT.txt');
    expect(files.filter((f) => f.endsWith('-brief.json'))).toHaveLength(4);

    // eslint-disable-next-line no-console
    console.log(`\nSample pack written to: ${root}\n`);
  });
});
