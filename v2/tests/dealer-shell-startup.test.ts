// @vitest-environment jsdom
/*
 * Dealer shell startup boundary.
 *
 * This suite used to drive src/apps/dealer/shell.ts — a multi-route shell with
 * per-page render functions, a data-deal-count badge and data-section anchors.
 * That router was replaced by a single mounted Component whose `section` is
 * state, so initDealerShell and the eight page modules this file mocked no
 * longer exist. Rewriting the old DOM assertions would test markup nobody
 * agreed to.
 *
 * The invariant that DOES carry over is the one that mattered: the dealer
 * screen must render every section while its repository data is still pending
 * or empty, and must never take the whole app down because one field was
 * absent. That is not hypothetical — an undefined `city` on a property row
 * previously threw a ReferenceError out of the template and blanked the entire
 * dashboard, because DCLogic rebuilds the whole DOM from one template call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { renderApp } from '../src/apps/dealer/template';
import { toDeskProperty } from '../src/apps/dealer/desk-store';
import type { Property } from '../src/packages/data/types';

const SECTIONS = ['areas', 'properties', 'clients', 'links', 'deals'];

function mount() {
  const component = new Component() as any;
  component.__templateFn = renderApp;
  document.body.innerHTML = '<div id="app"></div>';
  return component;
}

beforeEach(() => {
  // componentDidMount is not run here: these tests assert the screen renders
  // BEFORE any repository load resolves, which is the pending case.
  document.body.innerHTML = '';
});
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('dealer shell startup boundary', () => {
  it('renders every section with empty stores, before any load resolves', () => {
    const component = mount();
    component.properties = [];
    component.clients = [];
    component.sellers = [];
    component.deals = [];
    component.clientLinks = [];

    for (const section of SECTIONS) {
      component.state = { ...component.state, section };
      expect(() => component.render(), `section "${section}" threw on empty stores`).not.toThrow();
      expect(document.body.innerHTML, `section "${section}" rendered nothing`).not.toBe('');
    }
  });

  it('renders every section while the loading flags are still set', () => {
    const component = mount();
    component.properties = []; component.clients = []; component.sellers = [];
    component.deals = []; component.clientLinks = [];
    component.state = { ...component.state, loadingDeals: true, loadingLinks: true };

    for (const section of SECTIONS) {
      component.state = { ...component.state, section };
      expect(() => component.render(), `section "${section}" threw while loading`).not.toThrow();
    }
  });

  it('renders every section when a load has failed', () => {
    const component = mount();
    component.properties = []; component.clients = []; component.sellers = [];
    component.deals = []; component.clientLinks = [];
    component.state = {
      ...component.state,
      linkLoadError: 'Client links could not be loaded.',
      dashboardError: 'Presentation activity could not be loaded.',
      propError: 'Could not reach MAPCO.',
    };

    for (const section of SECTIONS) {
      component.state = { ...component.state, section };
      expect(() => component.render(), `section "${section}" threw on a failed load`).not.toThrow();
    }
    component.state = { ...component.state, section: 'links' };
    component.render();
    expect(document.body.textContent).toContain('Client links could not be loaded.');
  });

  it('survives a property row that is missing every optional field', () => {
    /* Built through the real mapper, so this is a row the repository can
       actually hand over — an imported or legacy crm_records payload with
       nothing but an id. The mapper defaults the fields the Desk calls
       string methods on, precisely so a missing one degrades to a blank
       card and never to a blank SCREEN: DCLogic rebuilds the whole DOM
       from one template call, so one throw inside renderVals takes the
       entire dashboard with it. */
    const component = mount();
    component.properties = [toDeskProperty({ id: 'bare' } as unknown as Property)];
    component.clients = []; component.sellers = []; component.deals = []; component.clientLinks = [];

    for (const section of SECTIONS) {
      component.state = { ...component.state, section };
      expect(() => component.render(), `section "${section}" threw on a bare property`).not.toThrow();
    }
    expect(document.body.innerHTML).not.toBe('');
  });

  it('survives a deal that carries no money, papers or history', () => {
    const component = mount();
    component.properties = []; component.clients = []; component.sellers = []; component.clientLinks = [];
    component.deals = [{
      id: 'bare-deal', clientId: 'c', propId: '', stage: 'negotiating',
      value: 0, comm: 0, docs: [], propDocs: [], pay: [], hist: [], log: [],
    }];

    for (const section of SECTIONS) {
      component.state = { ...component.state, section };
      expect(() => component.render(), `section "${section}" threw on a bare deal`).not.toThrow();
    }
  });

  it('keeps the navigation reachable from every section', () => {
    const component = mount();
    component.properties = []; component.clients = []; component.sellers = [];
    component.deals = []; component.clientLinks = [];

    for (const section of SECTIONS) {
      component.state = { ...component.state, section };
      component.render();
      // Every nav destination stays rendered, so no section is a dead end.
      for (const nav of component.NAV) {
        expect(document.body.textContent, `"${nav.label}" missing from section "${section}"`)
          .toContain(nav.label);
      }
    }
  });
});
