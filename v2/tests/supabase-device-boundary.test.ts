import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adapter = readFileSync(resolve(import.meta.dirname, '../src/packages/data/supabase/supabase-adapter.ts'), 'utf8');
const landing = readFileSync(resolve(import.meta.dirname, '../src/main.ts'), 'utf8');

describe('Supabase device boundary wiring', () => {
  it('derives activation and account states from the server access command', () => {
    expect(adapter).toContain('const access = await readDealerAccess()');
    expect(adapter).toContain('await requestDeviceActivation');
    expect(adapter).not.toContain('a live session ⇒ activated');
    expect(adapter).not.toContain("catch { return ok({ kind: 'active' })");
  });

  it('accepts the same eight-digit code produced by Founder Control', () => {
    expect(landing).toContain('Enter the 8-digit activation code');
    expect(landing).toContain("length === 8");
    expect(landing).toContain('placeholder="0000-0000"');
    expect(landing).not.toContain('6-digit activation code');
  });
});
