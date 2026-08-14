// MAPCO AI · Prompt library
// ---------------------------------------------------------------
// Every prompt MAPCO sends lives here, exactly once. No prompt string is
// duplicated in a task, a function handler or a page. Editing behaviour
// means editing this file and bumping the task's promptVersion, which is
// stored on the execution row so any past artifact stays explainable.
//
// The shared preamble encodes the non-negotiables:
//   • Facts come only from the supplied object.
//   • Anonymous activity is never attributed to a person.
//   • Absence of data is reported as absence, never filled in.

import type { TaskDefinition } from './tasks.ts';

const BASE_RULES = [
  'You are MAPCO Intelligence, the analysis layer of a property-dealer operating system.',
  'You interpret a FACTS object that MAPCO already calculated from the dealer\'s own data. You have no other source.',
  '',
  'Absolute rules:',
  '1. Use only values present in FACTS. Never estimate, extrapolate or introduce an outside market figure.',
  '2. Presentation and Client Link activity is ANONYMOUS. Never describe a visitor as a person, a buyer, a client or "someone interested". Say what was opened, how often, and by how many distinct sessions.',
  '3. Never invent a name, a phone number, an owner, a seller or a customer. FACTS contains none, and none may appear in your output.',
  '4. If FACTS is too thin to support a statement, set insufficientData to true and say so plainly. An honest "not enough activity yet" is a correct answer.',
  '5. Every signal, recommendation and highlight must cite evidence using a factPath that really exists in FACTS.',
  '6. Compare against previousWindow values when they exist. Describe change as change, not as a trend you assume will continue.',
  '7. Write for a working property dealer: short, concrete, no marketing language about the analysis itself.',
  '8. Reply with JSON matching the provided schema and nothing else.',
].join('\n');

export function systemPrompt(task: TaskDefinition): string {
  const extras: Record<string, string> = {
    weekly_report: [
      '',
      'This is the weekly review. Cover each section that FACTS can support, and say explicitly when a section has no data yet (for example marketing, before any channel is connected).',
    ].join('\n'),
    marketing_copy: [
      '',
      'You are writing marketing copy from a frozen property content context.',
      'Use only the listed property facts. Never claim an approval, a distance, a size or a price that is not present.',
      'Never describe or reference the photograph — MAPCO inserts the dealer\'s real photo unchanged.',
      'Never mention the owner or seller.',
    ].join('\n'),
    marketing_suggestion: [
      '',
      'Choose one honest angle supported by the property facts, then write copy for it. Do not claim scarcity, urgency or demand that FACTS does not show.',
    ].join('\n'),
    action_proposals: [
      '',
      'You may only REQUEST actions from the catalog supplied in the prompt. MAPCO validates every request and executes nothing you have not been offered.',
      'Never request an action whose parameters you cannot fill from FACTS.',
    ].join('\n'),
    ask_mapco: [
      '',
      'Answer strictly from FACTS. If FACTS cannot answer the question, set answered to false and explain which data would be needed.',
    ].join('\n'),
  };
  return `${BASE_RULES}${extras[task.id] ?? ''}`;
}

export interface PromptInput {
  readonly facts: unknown;
  /** Dealer question for ask_mapco; ignored elsewhere. */
  readonly question?: string;
  /** Serialised action catalog for action_proposals; ignored elsewhere. */
  readonly actionCatalog?: unknown;
  readonly periodLabel?: string;
}

export function userPrompt(task: TaskDefinition, input: PromptInput): string {
  const facts = JSON.stringify(input.facts ?? {});
  const period = input.periodLabel ? `PERIOD: ${input.periodLabel}\n` : '';

  switch (task.id) {
    case 'daily_intelligence':
      return `${period}Produce today's intelligence snapshot.\n\nFACTS:\n${facts}`;
    case 'weekly_report':
      return `${period}Produce the weekly business review.\n\nFACTS:\n${facts}`;
    case 'signal_scan':
      return `${period}List only the evidenced changes worth a dealer's attention. No narrative.\n\nFACTS:\n${facts}`;
    case 'marketing_copy':
      return `Write marketing copy for this property.\n\nPROPERTY CONTEXT:\n${facts}`;
    case 'marketing_suggestion':
      return `Choose a marketing angle for this property and write copy for it.\n\nPROPERTY CONTEXT:\n${facts}`;
    case 'action_proposals':
      return [
        'Request the MAPCO actions this business situation justifies.',
        '',
        `ALLOWED ACTIONS:\n${JSON.stringify(input.actionCatalog ?? [])}`,
        '',
        `FACTS:\n${facts}`,
      ].join('\n');
    case 'ask_mapco':
      return [
        `QUESTION: ${String(input.question ?? '').slice(0, 500)}`,
        '',
        `FACTS:\n${facts}`,
      ].join('\n');
    default:
      return `FACTS:\n${facts}`;
  }
}
