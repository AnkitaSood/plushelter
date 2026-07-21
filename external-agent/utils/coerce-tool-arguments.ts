import type { JsonSchemaObject } from '../types/webmcp.js';

function coerceValue(value: unknown, schema: JsonSchemaObject | undefined): unknown {
  if (value === undefined || value === null || !schema?.type) {
    return value;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return schema.type === 'integer' ? Math.trunc(value) : value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return schema.type === 'integer' ? Math.trunc(parsed) : parsed;
      }
    }
  }

  if (schema.type === 'boolean' && typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }

  return value;
}

/**
 * Coerces agent-provided arguments to match a page tool's JSON Schema. LLMs
 * often send numbers as strings (e.g. maxPrice: "200").
 */
export function coerceToolArguments(
  args: Record<string, unknown>,
  schema: JsonSchemaObject | null | undefined,
): Record<string, unknown> {
  if (!schema?.properties) {
    return args;
  }

  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    next[key] = coerceValue(value, schema.properties[key]);
  }

  return next;
}

export function normalizeToolArguments(
  args: Record<string, unknown>,
  schema: JsonSchemaObject | null | undefined,
): Record<string, unknown> {
  return coerceToolArguments(args, schema);
}
