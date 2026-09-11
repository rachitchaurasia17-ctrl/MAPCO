// @vitest-environment jsdom
/*
 * Rendering used to be `root.innerHTML = html`.
 *
 * Every keystroke in every form goes through setState, so every keystroke threw
 * the whole screen away and built it again — a few thousand nodes rebuilt to
 * change one of them. That is what the blink was: backgrounds and images
 * repainting, CSS animations restarting from frame zero, and the caret, focus
 * and scroll positions having to be measured and put back by hand.
 *
 * These tests are about NODE IDENTITY. If the elements on screen are the same
 * objects before and after a render, the browser has nothing to repaint and
 * there is nothing to blink.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DCLogic } from '../src/framework/dc';

class Probe extends DCLogic {
  __tpl: (props: any) => string = () => '';
  renderVals() { return {}; }
}

const mount = (template: (props: any) => string, state: Record<string, unknown> = {}) => {
  const probe = new Probe();
  probe.state = { ...state };
  probe.mount(document.getElementById('app')!, template);
  return probe;
};

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  (window as unknown as { __dcEvents?: object }).__dcEvents = {};
});
afterEach(() => { document.body.innerHTML = ''; });

describe('the screen survives a re-render', () => {
  const form = (p: any) => `
    <div id="shell">
      <div class="hero" style="background-image:url('/assets/hero.png')"></div>
      <img id="cover" src="${String(p.cover ?? '/a.png')}">
      <input name="city" value="${String(p.city ?? '')}">
      <p id="count">${String(p.city ?? '').length} characters</p>
    </div>`;

  it('keeps every unchanged element as the same node', () => {
    const probe = mount(form, { city: '' });
    const hero = document.querySelector('.hero')!;
    const shell = document.getElementById('shell')!;
    const input = document.querySelector('input[name="city"]')!;
    const img = document.getElementById('cover')!;

    probe.setState({ city: 'Mohali' });

    // Same objects — the browser never saw them leave, so nothing repainted.
    expect(document.querySelector('.hero')).toBe(hero);
    expect(document.getElementById('shell')).toBe(shell);
    expect(document.querySelector('input[name="city"]')).toBe(input);
    expect(document.getElementById('cover')).toBe(img);
  });

  it('does not touch the src of an image whose src did not change', () => {
    const probe = mount(form, { city: '', cover: '/a.png' });
    const img = document.getElementById('cover') as HTMLImageElement;
    let writes = 0;
    const setAttribute = img.setAttribute.bind(img);
    img.setAttribute = (name: string, value: string) => { writes += 1; setAttribute(name, value); };

    probe.setState({ city: 'Moh' });
    probe.setState({ city: 'Moha' });

    // A rewritten src is a refetch and a visible flash even when the bytes match.
    expect(writes).toBe(0);
  });

  it('still applies what genuinely changed', () => {
    const probe = mount(form, { city: '' });
    probe.setState({ city: 'Mohali', cover: '/b.png' });

    expect(document.getElementById('count')!.textContent).toBe('6 characters');
    expect(document.getElementById('cover')!.getAttribute('src')).toBe('/b.png');
  });

  it('leaves focus and the caret alone instead of restoring them', () => {
    const probe = mount(form, { city: 'Sector 79' });
    const input = document.querySelector<HTMLInputElement>('input[name="city"]')!;
    input.focus();
    input.setSelectionRange(3, 3);

    probe.setState({ tick: 1 });

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(3);
  });
});

describe('form controls', () => {
  it('lets a textarea the template drives through a value attribute hold text', () => {
    /* The Desk writes some textareas as <textarea value="${x}"></textarea>.
       HTML ignores that attribute, so rebuilding the element produced an EMPTY
       textarea: the note field cleared itself on every keystroke and could not
       be typed into at all. */
    const probe = mount((p: any) => `<textarea name="note" value="${String(p.note ?? '')}"></textarea>`);
    probe.setState({ note: 'Prefers calls after 6 pm' });

    const area = document.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(area.value).toBe('Prefers calls after 6 pm');
  });

  it('drives a textarea written as content too', () => {
    const probe = mount((p: any) => `<textarea name="note">${String(p.note ?? '')}</textarea>`);
    probe.setState({ note: 'Brother must also sign' });
    expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Brother must also sign');
  });

  it('does not shove the caret to the end of a field it is only re-confirming', () => {
    const probe = mount((p: any) => `<input name="city" value="${String(p.city ?? '')}">`, { city: 'Mohali' });
    const input = document.querySelector<HTMLInputElement>('input')!;
    input.focus();
    input.setSelectionRange(2, 2);

    probe.setState({ unrelated: true });

    expect(input.selectionStart).toBe(2);
    expect(input.value).toBe('Mohali');
  });

  it('keeps the caret where the typist left it when state rewrites the field', () => {
    // A price reformatting itself as it is typed must not send the caret away.
    const probe = mount((p: any) => `<input name="price" value="${String(p.price ?? '')}">`, { price: '1600000' });
    const input = document.querySelector<HTMLInputElement>('input')!;
    input.focus();
    input.setSelectionRange(4, 4);

    probe.setState({ price: '16,00,000' });

    expect(input.value).toBe('16,00,000');
    expect(input.selectionStart).toBe(4);
  });

  it('will not wipe a field the template does not drive', () => {
    const probe = mount(() => '<input name="scratch">');
    const input = document.querySelector<HTMLInputElement>('input')!;
    input.value = 'typed by hand';

    probe.setState({ tick: 1 });

    expect(input.value).toBe('typed by hand');
  });

  it('moves a checkbox when the state moves it', () => {
    const probe = mount((p: any) => `<input type="checkbox" name="ok"${p.ok ? ' checked' : ''}>`);
    const box = document.querySelector<HTMLInputElement>('input')!;
    expect(box.checked).toBe(false);

    probe.setState({ ok: true });
    expect(box.checked).toBe(true);

    probe.setState({ ok: false });
    expect(box.checked).toBe(false);
  });
});

describe('lists', () => {
  const list = (p: any) => `<ul>${(p.rows as string[] ?? []).map((r) => `<li id="row-${r}">${r}</li>`).join('')}</ul>`;

  it('keeps the rows that stayed when one is removed from the middle', () => {
    const probe = mount(list, { rows: ['a', 'b', 'c', 'd'] });
    const a = document.getElementById('row-a')!;
    const d = document.getElementById('row-d')!;

    probe.setState({ rows: ['a', 'c', 'd'] });

    expect([...document.querySelectorAll('li')].map((el) => el.id))
      .toEqual(['row-a', 'row-c', 'row-d']);
    expect(document.getElementById('row-a')).toBe(a);
    expect(document.getElementById('row-d')).toBe(d);
  });

  it('adds a row without disturbing the ones already there', () => {
    const probe = mount(list, { rows: ['a', 'b'] });
    const a = document.getElementById('row-a')!;

    probe.setState({ rows: ['a', 'b', 'c'] });

    expect([...document.querySelectorAll('li')].map((el) => el.id)).toEqual(['row-a', 'row-b', 'row-c']);
    expect(document.getElementById('row-a')).toBe(a);
  });

  it('empties the list when the state empties it', () => {
    const probe = mount(list, { rows: ['a', 'b'] });
    probe.setState({ rows: [] });
    expect(document.querySelectorAll('li').length).toBe(0);
  });
});

describe('DOM this framework does not own', () => {
  /* A live Google Maps instance and the client-link preview are mounted into
     the page imperatively. innerHTML destroyed them on every render and the
     Desk had to re-parent the map by hand afterwards. */
  const withHost = (p: any) => `<div id="wrap"><div id="map-host"></div><span>${String(p.label ?? '')}</span></div>`;

  it('walks past a subtree another module rendered into the page', () => {
    const probe = mount(withHost, { label: 'a' });
    const host = document.getElementById('map-host')!;
    host.innerHTML = '<canvas id="tiles"></canvas>';
    host.dataset.mounted = 'true';
    const canvas = document.getElementById('tiles')!;

    probe.setState({ label: 'b' });

    expect(document.getElementById('map-host')).toBe(host);
    expect(document.getElementById('tiles')).toBe(canvas);
    expect(document.querySelector('span')!.textContent).toBe('b');
  });

  it('leaves an attribute it never wrote where it is', () => {
    const probe = mount(withHost, { label: 'a' });
    const host = document.getElementById('map-host')!;
    host.dataset.mounted = 'true';

    probe.setState({ label: 'b' });

    // Stripping this sent the Desk into mounting a second map on every render.
    expect(host.dataset.mounted).toBe('true');
  });

  it('still removes an attribute that it did write and the template dropped', () => {
    const probe = mount((p: any) => `<div id="x"${p.busy ? ' aria-busy="true"' : ''}></div>`, { busy: true });
    const el = document.getElementById('x')!;
    expect(el.getAttribute('aria-busy')).toBe('true');

    probe.setState({ busy: false });
    expect(el.hasAttribute('aria-busy')).toBe(false);
  });
});

describe('handler ids', () => {
  it('are stable across renders that did not change the screen', () => {
    const probe = mount((p: any) => `<button onclick="${p.__b(() => 1)}">${String(p.label ?? '')}</button>`);
    const button = document.querySelector('button')!;
    const before = button.getAttribute('onclick');

    probe.setState({ label: 'go' });

    // An id that churned rewrote every handler attribute in the app per keystroke.
    expect(button.getAttribute('onclick')).toBe(before);
  });

  it('resolve to the current closure even when the render changed nothing', () => {
    /* A render whose markup is byte-identical is skipped entirely — a
       repository notifying every subscriber should not cost a parse. The
       handlers behind the ids already in the DOM still have to be this
       render's, holding this render's data. */
    let seen = '';
    const probe = mount((p: any) => `<button onclick="${p.__b(() => { seen = String(p.hidden); })}">x</button>`, { hidden: 'first' });
    probe.setState({ hidden: 'second' });

    const onclick = document.querySelector('button')!.getAttribute('onclick')!;
    (window as any).__dcEvents[/__dcEvents\['([^']+)'\]/.exec(onclick)![1]]();

    expect(seen).toBe('second');
  });

  it('still resolve to the CURRENT render\'s closure', () => {
    let seen = '';
    const probe = mount((p: any) => `<button onclick="${p.__b(() => { seen = String(p.label); })}">x</button>`);
    probe.setState({ label: 'second' });

    const onclick = document.querySelector('button')!.getAttribute('onclick')!;
    const id = /__dcEvents\['([^']+)'\]/.exec(onclick)![1];
    (window as any).__dcEvents[id]();

    expect(seen).toBe('second');
  });
});
