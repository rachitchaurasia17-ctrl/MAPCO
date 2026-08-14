// MAPCO AI · Task catalog
// ---------------------------------------------------------------
// A task is a WORKLOAD, defined by purpose and expected output — never by
// a model name. This separation is what lets MAPCO route weekly deep
// analysis and a one-line marketing headline to different providers
// without a single change to product logic.
//
// `costClass` is the routing input. `artifactKind` is the storage slot, or
// null for a task whose result is returned rather than persisted.

import { OUTPUT_SCHEMAS, type OutputSchemaName } from './schemas.ts';
import type { Schema } from './schema.ts';

export type CostClass = 'cheap' | 'standard' | 'deep';

export type ArtifactKind =
  | 'intelligence_snapshot'
  | 'signal_set'
  | 'recommendation_set'
  | 'weekly_report'
  | 'marketing_suggestion'
  | 'generated_copy'
  | 'answer';

export interface TaskDefinition {
  readonly id: string;
  readonly description: string;
  readonly outputSchema: OutputSchemaName;
  readonly artifactKind: ArtifactKind | null;
  readonly costClass: CostClass;
  readonly maxOutputTokens: number;
  readonly temperature: number;
  /** Bumped whenever the prompt text changes; stored on every execution. */
  readonly promptVersion: string;
  /**
   * Reusing a stored result requires identical facts AND an unexpired
   * window. 0 disables reuse (an ad-hoc question is always fresh).
   */
  readonly reuseWindowMinutes: number;
}

export const TASKS = {
  daily_intelligence: {
    id: 'daily_intelligence',
    description: 'Interpret one day of dealer-owned activity into a small stored snapshot.',
    outputSchema: 'intelligence_snapshot',
    artifactKind: 'intelligence_snapshot',
    costClass: 'standard',
    maxOutputTokens: 1800,
    temperature: 0.2,
    promptVersion: 'daily-1',
    reuseWindowMinutes: 720,
  },
  weekly_report: {
    id: 'weekly_report',
    description: 'Deep weekly business interpretation across presentation, property, area and marketing.',
    outputSchema: 'weekly_report',
    artifactKind: 'weekly_report',
    costClass: 'deep',
    maxOutputTokens: 4000,
    temperature: 0.25,
    promptVersion: 'weekly-1',
    reuseWindowMinutes: 4320,
  },
  signal_scan: {
    id: 'signal_scan',
    description: 'Identify evidenced changes in activity without wider narrative.',
    outputSchema: 'signal_set',
    artifactKind: 'signal_set',
    costClass: 'cheap',
    maxOutputTokens: 1400,
    temperature: 0.1,
    promptVersion: 'signals-1',
    reuseWindowMinutes: 360,
  },
  marketing_copy: {
    id: 'marketing_copy',
    description: 'Write structured marketing copy for one property from its frozen content context.',
    outputSchema: 'generated_copy',
    artifactKind: 'generated_copy',
    costClass: 'cheap',
    maxOutputTokens: 900,
    temperature: 0.6,
    promptVersion: 'copy-1',
    reuseWindowMinutes: 20160,
  },
  marketing_suggestion: {
    id: 'marketing_suggestion',
    description: 'Choose a marketing angle for a property and produce copy for it.',
    outputSchema: 'marketing_suggestion',
    artifactKind: 'marketing_suggestion',
    costClass: 'standard',
    maxOutputTokens: 1200,
    temperature: 0.5,
    promptVersion: 'marketing-1',
    reuseWindowMinutes: 10080,
  },
  action_proposals: {
    id: 'action_proposals',
    description: 'Request controlled MAPCO actions from the allowed catalog.',
    outputSchema: 'action_proposal_set',
    artifactKind: null,
    costClass: 'standard',
    maxOutputTokens: 1200,
    temperature: 0.2,
    promptVersion: 'actions-1',
    reuseWindowMinutes: 0,
  },
  ask_mapco: {
    id: 'ask_mapco',
    description: 'Answer a dealer question strictly from the supplied deterministic facts.',
    outputSchema: 'answer',
    artifactKind: 'answer',
    costClass: 'standard',
    maxOutputTokens: 1200,
    temperature: 0.1,
    promptVersion: 'ask-1',
    reuseWindowMinutes: 0,
  },
} as const satisfies Record<string, TaskDefinition>;

export type TaskId = keyof typeof TASKS;

export function getTask(id: string): TaskDefinition | null {
  return (TASKS as Record<string, TaskDefinition>)[id] ?? null;
}

export function schemaForTask(task: TaskDefinition): Schema {
  return OUTPUT_SCHEMAS[task.outputSchema];
}
