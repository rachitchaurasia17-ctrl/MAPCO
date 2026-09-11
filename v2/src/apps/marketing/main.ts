import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { Component } from './logic';
import { renderApp, globalHead } from './template';
import { requireSession } from '../../packages/data/session';

const app = document.getElementById('app');
if (app) {
  requireSession(app, () => {
    (renderApp as any).globalHead = globalHead;
    const comp = new Component();
    comp.mount(app, renderApp);
  });
}
