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

    // Get all prototype methods (except constructor and standard Object methods)
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype) {
      Object.getOwnPropertyNames(proto).forEach(name => {
        if (name !== 'constructor' && typeof (this as any)[name] === 'function') {
          props[name] = (this as any)[name].bind(this);
        }
      });
      proto = Object.getPrototypeOf(proto);
    }

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

    (window as any).__dcEvents = (window as any).__dcEvents || {};
    props.__b = (fn: any) => {
      if (typeof fn !== 'function') return fn;
      const id = 'ev_' + Math.random().toString(36).substr(2, 9);
      (window as any).__dcEvents[id] = fn;
      return `window.__dcEvents['${id}'](event)`;
    };

    // The template.ts should expose a renderApp function that takes props
    // We expect it to be passed in from main.ts. We'll store it on the instance or inject it.
    if ((this as any).__templateFn) {
      // PRE-RENDER STATE CAPTURE
      const getSelectorPath = (el: Element, rootEl: Element): string => {
        const path: string[] = [];
        let current = el;
        while (current && current !== rootEl && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break;
          } else {
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === current.tagName) {
                index++;
              }
              sibling = sibling.previousElementSibling;
            }
            selector += `:nth-of-type(${index})`;
            path.unshift(selector);
            current = current.parentElement as Element;
          }
        }
        return path.join(' > ');
      };

      let activeIdentifier: string | null = null;
      let activeSelectionStart: number | null = null;
      let activeSelectionEnd: number | null = null;

      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && root.contains(activeEl)) {
        if (activeEl.id) {
          activeIdentifier = `#${activeEl.id}`;
        } else if (activeEl.hasAttribute('name')) {
          const name = activeEl.getAttribute('name');
          const tagName = activeEl.tagName.toLowerCase();
          activeIdentifier = `${tagName}[name="${name}"]`;
        } else {
          activeIdentifier = getSelectorPath(activeEl, root);
        }

        if (activeIdentifier && (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
          try {
            activeSelectionStart = activeEl.selectionStart;
            activeSelectionEnd = activeEl.selectionEnd;
          } catch (e) {
            // Some input types like 'number' don't support selection
          }
        }
      }

      const scrollStates: { identifier: string, scrollTop: number, scrollLeft: number }[] = [];
      const scrollableElements = root.querySelectorAll('*');
      for (let i = 0; i < scrollableElements.length; i++) {
        const el = scrollableElements[i];
        if (el.scrollTop > 0 || el.scrollLeft > 0) {
          scrollStates.push({
            identifier: el.id ? `#${el.id}` : getSelectorPath(el, root),
            scrollTop: el.scrollTop,
            scrollLeft: el.scrollLeft
          });
        }
      }
      
      if (root.scrollTop > 0 || root.scrollLeft > 0) {
        scrollStates.push({
          identifier: 'root',
          scrollTop: root.scrollTop,
          scrollLeft: root.scrollLeft
        });
      }

      // RENDER
      root.innerHTML = (this as any).__templateFn(props);

      // POST-RENDER STATE RESTORE
      for (const s of scrollStates) {
        if (s.identifier === 'root') {
          root.scrollTop = s.scrollTop;
          root.scrollLeft = s.scrollLeft;
        } else {
          const el = root.querySelector(s.identifier);
          if (el) {
            el.scrollTop = s.scrollTop;
            el.scrollLeft = s.scrollLeft;
          }
        }
      }

      if (activeIdentifier) {
        const el = root.querySelector(activeIdentifier) as HTMLInputElement | HTMLTextAreaElement;
        if (el) {
          el.focus();
          if (activeSelectionStart !== null && activeSelectionEnd !== null) {
            try {
              el.setSelectionRange(activeSelectionStart, activeSelectionEnd);
            } catch (e) {}
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
