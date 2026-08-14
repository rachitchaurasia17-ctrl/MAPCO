// MAPCO AI · Structured-output schema DSL
// ---------------------------------------------------------------
// One schema definition serves two jobs:
//
//   1. toJsonSchema()  — the strict JSON Schema handed to the provider so
//                        it is constrained at generation time.
//   2. validate()      — MAPCO's OWN re-validation of whatever came back.
//
// Step 2 is not redundant. A provider can be swapped, degrade, or return
// a schema-shaped-but-wrong payload; MAPCO never persists model output it
// has not itself verified. Unvalidated AI JSON never reaches a database
// row or a dealer screen.
//
// Zero dependencies by design: this runs in Deno Edge with a strict CSP
// and must not pull a validation library over the network.

export type Schema =
  | { readonly kind: 'string'; readonly maxLength?: number; readonly minLength?: number; readonly description?: string }
  | { readonly kind: 'enum'; readonly values: readonly string[]; readonly description?: string }
  | { readonly kind: 'number'; readonly min?: number; readonly max?: number; readonly integer?: boolean; readonly description?: string }
  | { readonly kind: 'boolean'; readonly description?: string }
  | { readonly kind: 'array'; readonly items: Schema; readonly maxItems: number; readonly minItems?: number; readonly description?: string }
  | {
      readonly kind: 'object';
      readonly fields: Readonly<Record<string, Schema>>;
      readonly optional?: readonly string[];
      readonly description?: string;
    };

export const S = {
  string: (opts: { maxLength?: number; minLength?: number; description?: string } = {}): Schema =>
    ({ kind: 'string', ...opts }),
  enum: (values: readonly string[], description?: string): Schema =>
    ({ kind: 'enum', values, description }),
  number: (opts: { min?: number; max?: number; integer?: boolean; description?: string } = {}): Schema =>
    ({ kind: 'number', ...opts }),
  boolean: (description?: string): Schema => ({ kind: 'boolean', description }),
  array: (items: Schema, maxItems: number, opts: { minItems?: number; description?: string } = {}): Schema =>
    ({ kind: 'array', items, maxItems, ...opts }),
  object: (
    fields: Readonly<Record<string, Schema>>,
    opts: { optional?: readonly string[]; description?: string } = {},
  ): Schema => ({ kind: 'object', fields, ...opts }),
};

/* ── JSON Schema projection ─────────────────────────────────────── */

/**
 * Providers that support strict structured output require every property
 * to appear in `required` and forbid extra keys. Optional fields are
 * therefore emitted as `["<type>", "null"]` and treated as absent when
 * null comes back.
 */
export function toJsonSchema(schema: Schema): Record<string, unknown> {
  switch (schema.kind) {
    case 'string':
      return {
        type: 'string',
        ...(schema.maxLength ? { maxLength: schema.maxLength } : {}),
        ...(schema.minLength ? { minLength: schema.minLength } : {}),
        ...(schema.description ? { description: schema.description } : {}),
      };
    case 'enum':
      return {
        type: 'string',
        enum: [...schema.values],
        ...(schema.description ? { description: schema.description } : {}),
      };
    case 'number':
      return {
        type: schema.integer ? 'integer' : 'number',
        ...(schema.min !== undefined ? { minimum: schema.min } : {}),
        ...(schema.max !== undefined ? { maximum: schema.max } : {}),
        ...(schema.description ? { description: schema.description } : {}),
      };
    case 'boolean':
      return { type: 'boolean', ...(schema.description ? { description: schema.description } : {}) };
    case 'array':
      return {
        type: 'array',
        items: toJsonSchema(schema.items),
        maxItems: schema.maxItems,
        ...(schema.minItems !== undefined ? { minItems: schema.minItems } : {}),
        ...(schema.description ? { description: schema.description } : {}),
      };
    case 'object': {
      const optional = new Set(schema.optional ?? []);
      const properties: Record<string, unknown> = {};
      for (const [name, field] of Object.entries(schema.fields)) {
        const projected = toJsonSchema(field) as Record<string, unknown>;
        if (optional.has(name)) {
          const type = projected.type;
          projected.type = Array.isArray(type) ? [...type, 'null'] : [type, 'null'];
        }
        properties[name] = projected;
      }
      return {
        type: 'object',
        properties,
        required: Object.keys(schema.fields),
        additionalProperties: false,
        ...(schema.description ? { description: schema.description } : {}),
      };
    }
  }
}

/* ── Validation ─────────────────────────────────────────────────── */

export interface ValidationSuccess<T> {
  readonly ok: true;
  /** The value with unknown keys stripped and nulls normalised away. */
  readonly value: T;
}
export interface ValidationFailure {
  readonly ok: false;
  readonly errors: readonly string[];
}
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate AND normalise. The returned value contains only declared keys,
 * so a provider cannot smuggle extra content into a stored artifact.
 */
export function validate<T = unknown>(schema: Schema, input: unknown): ValidationResult<T> {
  const errors: string[] = [];
  const value = walk(schema, input, '$', errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: value as T };
}

function walk(schema: Schema, input: unknown, path: string, errors: string[]): unknown {
  switch (schema.kind) {
    case 'string': {
      if (typeof input !== 'string') {
        errors.push(`${path}: expected string`);
        return '';
      }
      if (schema.minLength !== undefined && input.length < schema.minLength) {
        errors.push(`${path}: shorter than ${schema.minLength}`);
      }
      // Over-length copy is trimmed rather than rejected: a slightly long
      // caption is a formatting slip, not a correctness failure.
      return schema.maxLength !== undefined && input.length > schema.maxLength
        ? input.slice(0, schema.maxLength)
        : input;
    }
    case 'enum': {
      if (typeof input !== 'string' || !schema.values.includes(input)) {
        errors.push(`${path}: expected one of ${schema.values.join(' | ')}`);
        return schema.values[0] ?? '';
      }
      return input;
    }
    case 'number': {
      if (typeof input !== 'number' || !Number.isFinite(input)) {
        errors.push(`${path}: expected number`);
        return 0;
      }
      if (schema.integer && !Number.isInteger(input)) {
        errors.push(`${path}: expected integer`);
        return Math.round(input);
      }
      if (schema.min !== undefined && input < schema.min) errors.push(`${path}: below ${schema.min}`);
      if (schema.max !== undefined && input > schema.max) errors.push(`${path}: above ${schema.max}`);
      return input;
    }
    case 'boolean': {
      if (typeof input !== 'boolean') {
        errors.push(`${path}: expected boolean`);
        return false;
      }
      return input;
    }
    case 'array': {
      if (!Array.isArray(input)) {
        errors.push(`${path}: expected array`);
        return [];
      }
      if (schema.minItems !== undefined && input.length < schema.minItems) {
        errors.push(`${path}: fewer than ${schema.minItems} items`);
      }
      // Hard cap: an over-long list is truncated so one response can never
      // blow past the artifact size limit.
      return input
        .slice(0, schema.maxItems)
        .map((item, index) => walk(schema.items, item, `${path}[${index}]`, errors));
    }
    case 'object': {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        errors.push(`${path}: expected object`);
        return {};
      }
      const source = input as Record<string, unknown>;
      const optional = new Set(schema.optional ?? []);
      const out: Record<string, unknown> = {};
      for (const [name, field] of Object.entries(schema.fields)) {
        const raw = source[name];
        if (raw === undefined || raw === null) {
          if (!optional.has(name)) errors.push(`${path}.${name}: required`);
          continue;
        }
        out[name] = walk(field, raw, `${path}.${name}`, errors);
      }
      return out;
    }
  }
}
