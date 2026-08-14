// MAPCO AI · Controlled action catalog
// ---------------------------------------------------------------
// The boundary between "the model suggested something" and "MAPCO did
// something". A model can only ever REQUEST a named action from this
// catalog. It has no database access, no SQL, no write path, and no way
// to name an action that is not listed here.
//
// The pipeline for every action:
//   model requests  →  name resolved against this catalog
//                   →  parameters validated against the action's schema
//                   →  proposal row stored with its risk level
//                   →  dealer approval where required
//                   →  MAPCO's own executor runs it
//                   →  outcome written to the append-only audit log
//
// Executors are registered separately (see EXECUTORS). An approved action
// with no registered executor fails loudly as `executor_not_registered` —
// it is never silently treated as done.

import { S, validate, type Schema } from './schema.ts';

export type ActionRisk = 'internal' | 'external' | 'consequential';

export interface ActionDefinition {
  readonly type: string;
  /** Sent to the model. Written for the model, not for a dealer. */
  readonly description: string;
  readonly risk: ActionRisk;
  readonly params: Schema;
}

export const ACTIONS = {
  create_internal_task: {
    type: 'create_internal_task',
    description: 'Create an internal follow-up task for the dealer team. Stays inside MAPCO.',
    risk: 'internal',
    params: S.object(
      {
        title: S.string({ maxLength: 120 }),
        note: S.string({ maxLength: 500 }),
        dueDate: S.string({ maxLength: 10, description: 'ISO yyyy-mm-dd.' }),
        propertyIds: S.array(S.string({ maxLength: 120 }), 12),
      },
      { optional: ['note', 'dueDate', 'propertyIds'] },
    ),
  },
  prepare_message: {
    type: 'prepare_message',
    description: 'Draft a message for the dealer to review. Preparing is not sending.',
    risk: 'internal',
    params: S.object(
      {
        purpose: S.enum(['follow_up', 'new_listing', 'price_update', 'visit_invite']),
        body: S.string({ maxLength: 900 }),
        propertyIds: S.array(S.string({ maxLength: 120 }), 8),
      },
      { optional: ['propertyIds'] },
    ),
  },
  select_properties_for_marketing: {
    type: 'select_properties_for_marketing',
    description: 'Choose which properties deserve marketing attention next, with a reason.',
    risk: 'internal',
    params: S.object({
      propertyIds: S.array(S.string({ maxLength: 120 }), 10, { minItems: 1 }),
      reason: S.string({ maxLength: 400 }),
    }),
  },
  create_marketing_pack: {
    type: 'create_marketing_pack',
    description: 'Prepare a set of marketing creatives for a group of properties.',
    risk: 'internal',
    params: S.object(
      {
        propertyIds: S.array(S.string({ maxLength: 120 }), 10, { minItems: 1 }),
        theme: S.string({ maxLength: 120 }),
      },
      { optional: ['theme'] },
    ),
  },
  prepare_client_presentation: {
    type: 'prepare_client_presentation',
    description: 'Assemble a presentation set of properties for the dealer to show.',
    risk: 'internal',
    params: S.object({
      propertyIds: S.array(S.string({ maxLength: 120 }), 8, { minItems: 1 }),
      focus: S.string({ maxLength: 200 }),
    }),
  },
  assign_internal_work: {
    type: 'assign_internal_work',
    description: 'Assign an internal task to a team role. Never assigns to a named individual.',
    risk: 'internal',
    params: S.object({
      role: S.enum(['manager', 'map_editor', 'property_editor', 'team']),
      title: S.string({ maxLength: 120 }),
      note: S.string({ maxLength: 500 }),
    }),
  },
  schedule_marketing_item: {
    type: 'schedule_marketing_item',
    description: 'Place an approved creative into a publishing slot. Requires dealer approval.',
    risk: 'external',
    params: S.object({
      creativeId: S.string({ maxLength: 60 }),
      channel: S.enum(['instagram', 'google_business', 'whatsapp']),
      scheduledFor: S.string({ maxLength: 30, description: 'ISO 8601 timestamp.' }),
    }),
  },
  prepare_publishing_operation: {
    type: 'prepare_publishing_operation',
    description: 'Stage a publish to an external channel for dealer approval. Never publishes directly.',
    risk: 'external',
    params: S.object({
      creativeId: S.string({ maxLength: 60 }),
      channel: S.enum(['instagram', 'google_business', 'whatsapp']),
      note: S.string({ maxLength: 300 }),
    }),
  },
} as const satisfies Record<string, ActionDefinition>;

export type ActionType = keyof typeof ACTIONS;

export function getAction(type: string): ActionDefinition | null {
  return (ACTIONS as Record<string, ActionDefinition>)[type] ?? null;
}

/** Compact catalog sent to the model. Risk is included so it can self-limit. */
export function actionCatalogForPrompt(): readonly {
  type: string;
  description: string;
  risk: ActionRisk;
  requiresApproval: boolean;
}[] {
  return Object.values(ACTIONS as Record<string, ActionDefinition>).map((action) => ({
    type: action.type,
    description: action.description,
    risk: action.risk,
    requiresApproval: action.risk !== 'internal',
  }));
}

export type ActionValidation =
  | { readonly ok: true; readonly action: ActionDefinition; readonly params: Record<string, unknown> }
  | { readonly ok: false; readonly reason: 'unknown_action' | 'invalid_params'; readonly errors?: readonly string[] };

/**
 * Resolve and validate one model-requested action. An unknown name or a
 * parameter that fails its schema is rejected outright — MAPCO never
 * "best-effort" repairs a request it did not understand.
 */
export function validateActionRequest(type: unknown, params: unknown): ActionValidation {
  const action = typeof type === 'string' ? getAction(type) : null;
  if (!action) return { ok: false, reason: 'unknown_action' };
  const result = validate<Record<string, unknown>>(action.params, params ?? {});
  if (!result.ok) return { ok: false, reason: 'invalid_params', errors: result.errors };
  return { ok: true, action, params: result.value };
}

/* ── executors ──────────────────────────────────────────────────── */

export interface ActionExecutionContext {
  readonly dealerId: string;
  readonly proposalId: string;
}

export type ActionExecutor = (
  params: Record<string, unknown>,
  context: ActionExecutionContext,
) => Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }>;

/**
 * Intentionally empty. The catalog, validation, approval gate and audit
 * trail are live; the side-effecting implementations belong to the phases
 * that build the surfaces they act on (tasks, marketing packs, publishing).
 * Registering one is the only step needed to switch an action on.
 */
const EXECUTORS: Record<string, ActionExecutor> = {};

export function registerExecutor(type: ActionType, executor: ActionExecutor): void {
  EXECUTORS[type] = executor;
}

export function getExecutor(type: string): ActionExecutor | null {
  return EXECUTORS[type] ?? null;
}
