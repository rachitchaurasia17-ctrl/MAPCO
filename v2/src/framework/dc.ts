export class DCLogic {
  state: any = {};
  
  constructor() {
    this.setState = this.setState.bind(this);
  }

  setState(newState: any) {
    this.state = { ...this.state, ...newState };
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
      root.innerHTML = (this as any).__templateFn(props);
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
  }
}
