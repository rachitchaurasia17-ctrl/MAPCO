// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DCLogic } from '../src/framework/dc';

/* The Desk renders by rebuilding the whole DOM from one HTML string, so the only
   way an inline onclick can reach a method is through a global registry. Nothing
   released the previous render's entries, and the Add Property wizard re-renders
   on every keystroke: measured at ~100 new closures per character typed, each one
   retaining the component. Typing a single field leaked thousands. */

class Probe extends DCLogic {
  handlers = 12;
  renderCount = 0;
  renderVals() {
    this.renderCount += 1;
    return { label: 'render ' + this.renderCount };
  }
}

const template = (props: Record<string, unknown>) => {
  const b = props.__b as (fn: unknown) => string;
  const buttons = Array.from({ length: props.handlers as number },
    (_, i) => `<button onclick="${b(() => i)}">${i}</button>`).join('');
  // value comes from state, exactly as the Desk's form fields do — otherwise the
  // rebuilt input is empty and there is no caret position to restore.
  return `<div id="shell">${String(props.label)}<input name="area" value="${String(props.area ?? '')}">${buttons}</div>`;
};

const registry = () => Object.keys((window as unknown as { __dcEvents?: object }).__dcEvents ?? {}).length;

describe('the render handler registry', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    (window as unknown as { __dcEvents?: object }).__dcEvents = {};
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('does not grow as the component re-renders', () => {
    const probe = new Probe();
    probe.mount(document.getElementById('app')!, template);
    const afterFirst = registry();
    expect(afterFirst).toBeGreaterThan(0);

    for (let i = 0; i < 25; i += 1) probe.setState({ tick: i });

    expect(probe.renderCount).toBe(26);
    // Flat, not 26x. This is the whole point.
    expect(registry()).toBe(afterFirst);
  });

  it('keeps the handlers the CURRENT markup points at callable', () => {
    const probe = new Probe();
    probe.mount(document.getElementById('app')!, template);
    probe.setState({ tick: 1 });

    const events = (window as unknown as { __dcEvents: Record<string, unknown> }).__dcEvents;
    const ids = [...document.querySelectorAll('button')]
      .map((el) => /__dcEvents\['([^']+)'\]/.exec(el.getAttribute('onclick') ?? '')?.[1]);
    expect(ids.length).toBe(12);
    for (const id of ids) {
      expect(id, 'every button must carry a handler id').toBeTruthy();
      expect(typeof events[id!], 'id ' + id + ' must still resolve').toBe('function');
    }
  });

  it('releases only its own ids, never another component that shares the registry', () => {
    // The marketing app is a second DCLogic on the same global registry, so a
    // wholesale clear would silently kill its buttons.
    const foreign = (window as unknown as { __dcEvents: Record<string, unknown> }).__dcEvents;
    foreign['ev_from_another_component'] = () => 'intact';

    const probe = new Probe();
    probe.mount(document.getElementById('app')!, template);
    for (let i = 0; i < 5; i += 1) probe.setState({ tick: i });

    expect(typeof foreign['ev_from_another_component']).toBe('function');
  });

  it('still restores focus and caret across a re-render', () => {
    const probe = new Probe();
    probe.mount(document.getElementById('app')!, template);
    probe.setState({ area: 'Sector 79' });
    const input = document.querySelector<HTMLInputElement>('input[name="area"]')!;
    input.focus();
    input.setSelectionRange(9, 9);

    probe.setState({ tick: 1 });

    const after = document.querySelector<HTMLInputElement>('input[name="area"]')!;
    expect(document.activeElement, 'focus must survive the rebuild').toBe(after);
    expect(after.selectionStart).toBe(9);
  });
});
