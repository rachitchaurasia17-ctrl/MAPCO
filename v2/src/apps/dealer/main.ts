import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { Component } from './logic';
import { renderApp, globalHead } from './template';
import { requireSession } from '../../packages/data/session';

const app = document.getElementById('app');
if (app) {
  // We can skip authentication in local dev if needed, but keeping the pattern
  // For now, let's bypass requireSession completely as requested before for Desk, or just wrap it
  // Since we removed sign-in requirement from MAPCO Desk earlier:
  
  (renderApp as any).globalHead = globalHead;
  const comp = new Component();
  comp.mount(app, renderApp);
}
