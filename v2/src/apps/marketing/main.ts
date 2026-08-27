import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { Component } from './logic';
import { renderApp, globalHead } from './template';
import { requireSession } from '../../packages/data/session';

/**
 * Marketing production boundary (fail-closed):
 * - Publishing not connected
 * - Only publish when provider credential and connector report success
 * - No verified platform metrics yet
 * - Format: creative.caption || 'No caption was supplied with this creative.'
 */

const app = document.getElementById('app');
if (app) {
  requireSession(app, () => {
    (renderApp as any).globalHead = globalHead;
    const comp = new Component();
    comp.mount(app, renderApp);
  });
}
