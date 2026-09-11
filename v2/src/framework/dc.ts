/* Every node currently on screen that this framework put there, and the
   attributes it wrote on each one.

   The distinction matters because the page is not ours alone: a live Google
   Maps instance, a client-link preview and anything else mounted imperatively
   put nodes and attributes inside our tree. Those are not in `owned`, so the
   patcher below walks straight past them instead of reconciling them against a
   template that has never heard of them. Before, `innerHTML` destroyed them on
   every render and each one had to be rescued by hand afterwards. */
const owned = new WeakSet<Node>();
const attrsWritten = new WeakMap<Element, string[]>();

/** Claim a freshly created subtree, recording the attributes it arrived with. */
function claim(node: Node): void {
  owned.add(node);
  if (node.nodeType !== 1) return;
  const el = node as Element;
  const names: string[] = [];
  for (let i = 0; i < el.attributes.length; i++) names.push(el.attributes[i].name);
  attrsWritten.set(el, names);
  for (let c = el.firstChild; c; c = c.nextSibling) claim(c);
}

function claimAll(parent: Node): void {
  for (let c = parent.firstChild; c; c = c.nextSibling) claim(c);
}

/**
 * Can `next` be applied onto `current`, or does the node have to be replaced?
 * Same kind, same tag, and — when either side is identified — the same id.
 */
function compatible(current: Node, next: Node): boolean {
  if (current.nodeType !== next.nodeType) return false;
  if (current.nodeType !== 1) return true;
  const a = current as Element;
  const b = next as Element;
  if (a.tagName !== b.tagName) return false;
  if (a.id || b.id) return a.id === b.id;
  return true;
}

function nextOwned(node: Node | null): Node | null {
  let n = node;
  while (n && !owned.has(n)) n = n.nextSibling;
  return n;
}

function patchAttributes(current: Element, next: Element): void {
  const ours = attrsWritten.get(current);
  const names: string[] = [];
  for (let i = 0; i < next.attributes.length; i++) {
    const { name, value } = next.attributes[i];
    names.push(name);
    if (current.getAttribute(name) !== value) current.setAttribute(name, value);
  }
  /* Only attributes this framework wrote are candidates for removal. An
     attribute somebody else parked on the element — `data-mounted` on the map
     host, the inline styles Maps manages itself — is left exactly where it is. */
  if (ours) {
    for (const name of ours) {
      if (!next.hasAttribute(name)) current.removeAttribute(name);
    }
  }
  attrsWritten.set(current, names);
}

/**
 * Push a form control's value across, without fighting the person typing into
 * it. `current`'s attribute still holds what the previous render asked for
 * (typing changes the property, never the attribute), so an attribute that
 * changed means the state genuinely moved and must win. An attribute that did
 * not change means this render had nothing to say about the field, and the
 * text in it is the user's.
 */
function patchControlValue(current: Element, next: Element, before: string | null): void {
  const tag = current.tagName;
  const el = current as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  if (tag === 'INPUT') {
    const type = (current.getAttribute('type') || 'text').toLowerCase();
    if (type === 'file') return;
    if (type === 'checkbox' || type === 'radio') {
      const input = el as HTMLInputElement;
      const wanted = next.hasAttribute('checked');
      if (input.checked === wanted) return;
      if (wanted !== (before !== null) || document.activeElement !== input) input.checked = wanted;
      return;
    }
  }

  // A field the template does not drive keeps whatever is in it.
  const wanted = tag === 'TEXTAREA' && !next.hasAttribute('value')
    ? next.textContent ?? ''
    : next.getAttribute('value');
  if (wanted === null) return;
  // Already right: assigning would only shove the caret to the end for nothing.
  if (el.value === wanted) return;
  // An unchanged declaration means this render had no opinion about the field,
  // and the text in a field somebody is typing into is theirs.
  if (wanted === before && document.activeElement === el) return;

  if (document.activeElement !== el) {
    el.value = wanted;
    return;
  }
  /* The state really did rewrite a field under the caret — a price being
     reformatted as it is typed. Keep the caret where the typist left it. */
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  let at: number | null = null;
  try {
    at = input.selectionStart;
  } catch {
    // Number and other input types do not expose a selection.
  }
  input.value = wanted;
  if (at !== null) {
    try {
      input.setSelectionRange(Math.min(at, wanted.length), Math.min(at, wanted.length));
    } catch {
      // As above.
    }
  }
}

/** The value the previous render asked this control to hold. */
function declaredValue(el: Element): string | null {
  const type = (el.getAttribute('type') || '').toLowerCase();
  if (el.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio')) {
    return el.hasAttribute('checked') ? '' : null;
  }
  if (el.tagName === 'TEXTAREA' && !el.hasAttribute('value')) return el.textContent ?? '';
  return el.getAttribute('value');
}

function patchNode(current: Node, next: Node): void {
  if (current.nodeType !== 1) {
    const a = current as CharacterData;
    const b = next as CharacterData;
    if (a.data !== b.data) a.data = b.data;
    return;
  }

  const el = current as Element;
  const isControl = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
  // Read what the last render asked for before the new attributes overwrite it.
  const before = isControl ? declaredValue(el) : null;

  patchAttributes(el, next as Element);
  patchChildren(el, next);
  if (isControl) patchControlValue(el, next as Element, before);
}

function patchChildren(currentParent: Node, nextParent: Node): void {
  // Nothing of ours is here yet: hand the whole subtree over in one go.
  if (!currentParent.firstChild && nextParent.firstChild) {
    const fragment = document.createDocumentFragment();
    for (let c: ChildNode | null = nextParent.firstChild; c; c = c.nextSibling) {
      fragment.appendChild(document.importNode(c, true));
    }
    claimAll(fragment);
    currentParent.appendChild(fragment);
    return;
  }

  let mine = nextOwned(currentParent.firstChild);
  let theirs = nextParent.firstChild;

  while (theirs) {
    const following = theirs.nextSibling;

    if (mine && !compatible(mine, theirs)) {
      /* Nodes may have been dropped between renders. Look a little way ahead
         for the node this one really matches before giving up and replacing —
         without it, one removed row shunts every row below it onto a different
         element and each one repaints for no reason. */
      let probe = nextOwned(mine.nextSibling);
      for (let hops = 0; probe && hops < 6 && !compatible(probe, theirs); hops++) {
        probe = nextOwned(probe.nextSibling);
      }
      if (probe && compatible(probe, theirs)) {
        let cursor: Node | null = mine;
        while (cursor && cursor !== probe) {
          const after: Node | null = cursor.nextSibling;
          if (owned.has(cursor)) currentParent.removeChild(cursor);
          cursor = after;
        }
        mine = probe;
      }
    }

    if (mine && compatible(mine, theirs)) {
      patchNode(mine, theirs);
      mine = nextOwned(mine.nextSibling);
    } else {
      const fresh = document.importNode(theirs, true);
      claim(fresh);
      currentParent.insertBefore(fresh, mine);
    }
    theirs = following;
  }

  // Whatever of ours is left over belongs to a render that is over.
  while (mine) {
    const after = nextOwned(mine.nextSibling);
    currentParent.removeChild(mine);
    mine = after;
  }
}

let instances = 0;

export class DCLogic {
  state: any = {};

  constructor() {
    this.setState = this.setState.bind(this);
    this.forceUpdate = this.forceUpdate.bind(this);
  }

  setState(newState: any) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  /**
   * Re-render after mutating data held on the instance rather than in `state`
   * (collections like `properties`, `clients`, `clientLinks`, `deals`).
   * `setState` cannot be used there because the change is not a state patch,
   * and without this the DOM keeps showing the pre-mutation value.
   */
  forceUpdate() {
    this.render();
  }

  render() {
    const root = document.getElementById('app');
    if (!root) return;

    // We bind all methods of this instance into the scope so that the template compiler can access them via 'props'
    const props = { ...this.state };

    /* Every method of the component, bound — built once per instance rather
       than on every render. The Desk has hundreds of them and a render happens
       on every keystroke, so walking the prototype chain and allocating a fresh
       bound copy of each one was work repeated per character typed for a result
       that never changes. */
    const bound: Record<string, unknown> = ((this as any).__dcMethods ??= (() => {
      const found: Record<string, unknown> = {};
      let proto = Object.getPrototypeOf(this);
      while (proto && proto !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(proto)) {
          if (name !== 'constructor' && !(name in found) && typeof (this as any)[name] === 'function') {
            found[name] = (this as any)[name].bind(this);
          }
        }
        proto = Object.getPrototypeOf(proto);
      }
      return found;
    })());
    Object.assign(props, bound);

    if (typeof (this as any).renderVals === 'function') {
      try {
        const computed = (this as any).renderVals();
        if (computed) {
          Object.assign(props, computed);
        }
      } catch (err) {
        console.error("renderVals failed:", err);
      }
    }

    // Also include class properties directly mapped
    Object.keys(this).forEach(key => {
      if (key !== 'state') {
        props[key] = (this as any)[key];
      }
    });

    /* An inline onclick string can only reach a method through a global, so
       every bound handler is parked on window.__dcEvents under an id.

       The id is this instance's namespace plus the order the template asked for
       it, never a random string. A render that produces the same screen
       therefore produces the same id for the same button, so its onclick
       attribute is identical to the one already in the DOM and the patcher has
       nothing to write. Random ids made every handler attribute in the app
       differ on every keystroke. The closure behind the id is replaced here on
       every render, so an unchanged attribute still points at this render's
       handler, holding this render's data. */
    const registry: Record<string, unknown> = ((window as any).__dcEvents ??= {});
    const ns: string = ((this as any).__dcNs ??= 'e' + (++instances) + '_');
    let minted = 0;
    props.__b = (fn: any) => {
      if (typeof fn !== 'function') return fn;
      const id = ns + minted++;
      registry[id] = fn;
      return `window.__dcEvents['${id}'](event)`;
    };

    // The template.ts should expose a renderApp function that takes props
    // We expect it to be passed in from main.ts. We'll store it on the instance or inject it.
    if ((this as any).__templateFn) {
      /* The screen used to be thrown away and built again from scratch on every
         setState — and every keystroke in every form is a setState. Rebuilding
         a few thousand nodes to change one of them is what produced the blink:
         backgrounds and images repainted, CSS animations restarted from frame
         zero, and the caret, the focus and every scroll position had to be
         measured and put back by hand afterwards.

         The new markup is parsed inert, then applied onto the DOM that is
         already on screen: only what genuinely differs is written. A node that
         did not change is not touched, so there is nothing to repaint. Focus,
         selection and scroll survive because the elements holding them are
         never destroyed. */
      const html: string = (this as any).__templateFn(props);
      /* Renders that change nothing are common — a repository notifying every
         subscriber, a state key the screen does not read. Parsing a hundred
         kilobytes of identical markup to discover that is pure waste. The ids
         already in the DOM are this render's ids, so the handlers behind them
         are current. */
      if (html === (this as any).__dcHtml) {
        (this as any).__dcMinted = minted;
        const unchangedDidUpdate = (this as unknown as { componentDidUpdate?: () => void }).componentDidUpdate;
        if (typeof unchangedDidUpdate === 'function') {
          try {
            unchangedDidUpdate.call(this);
          } catch (error) {
            console.error('componentDidUpdate failed:', error);
          }
        }
        return;
      }
      (this as any).__dcHtml = html;

      const parsed = document.createElement('template');
      parsed.innerHTML = html;

      const wasFocused = document.activeElement as HTMLElement | null;
      const hadFocus = !!wasFocused && root.contains(wasFocused);
      let caret: [number, number] | null = null;
      if (hadFocus && (wasFocused instanceof HTMLInputElement || wasFocused instanceof HTMLTextAreaElement)) {
        try {
          caret = [wasFocused.selectionStart ?? 0, wasFocused.selectionEnd ?? 0];
        } catch {
          // Number and other input types do not expose a selection.
        }
      }

      patchChildren(root, parsed.content);

      /* Handlers this render did not ask for again cannot be reached from any
         attribute now, so the registry does not carry them for the life of the
         tab. Ids are sequential, so everything past this render's count is gone. */
      const retired: number = (this as any).__dcMinted || 0;
      for (let i = minted; i < retired; i++) delete registry[ns + i];
      (this as any).__dcMinted = minted;

      /* Almost always a no-op: the focused field is normally patched in place
         and never loses focus. It only earns its keep when a render genuinely
         replaces the element under the caret. */
      if (hadFocus && wasFocused && !wasFocused.isConnected) {
        const escape = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape : (s: string) => s;
        const id = wasFocused.id ? '#' + escape(wasFocused.id) : null;
        const name = wasFocused.getAttribute('name');
        const selector = id || (name
          ? wasFocused.tagName.toLowerCase() + '[name="' + name + '"]'
          : null);
        const again = selector ? root.querySelector(selector) as HTMLElement | null : null;
        if (again) {
          again.focus();
          if (caret && (again instanceof HTMLInputElement || again instanceof HTMLTextAreaElement)) {
            try {
              again.setSelectionRange(caret[0], caret[1]);
            } catch {
              // As above.
            }
          }
        }
      }

      const didUpdate = (this as unknown as { componentDidUpdate?: () => void }).componentDidUpdate;
      if (typeof didUpdate === 'function') {
        try {
          didUpdate.call(this);
        } catch (error) {
          console.error('componentDidUpdate failed:', error);
        }
      }
    }
  }

  mount(rootElement: HTMLElement, templateFn: (props: any) => string) {
    (this as any).__templateFn = templateFn;

    // Create global head if not present (templateFn might provide globalHead)
    if (!document.getElementById('global-head') && (templateFn as any).globalHead) {
      const d = document.createElement('div');
      d.id = 'global-head';
      d.innerHTML = (templateFn as any).globalHead;
      document.head.appendChild(d);
    }

    this.render();

    // Both app components define componentDidMount() — the dealer Desk uses it
    // to seed contacts/links/theme and to kick off canonical data loads — but
    // nothing ever invoked it, so all of that was dead code. Run it once after
    // the first paint. Errors are contained so a failing hook cannot leave the
    // screen blank.
    const didMount = (this as unknown as { componentDidMount?: () => void }).componentDidMount;
    if (typeof didMount === 'function') {
      try {
        didMount.call(this);
      } catch (error) {
        console.error('componentDidMount failed:', error);
      }
    }
  }
}
