import type { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';
import { MOCK_ANIMALS } from '../../src/app/data/roster.ts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

/** Demo model is gemini-3.5-flash (specs.md §5). Override via GEMINI_TEST_MODEL in .env.local
 * to point real-API test calls at a cheaper model without touching this file. */
function resolveModel(): string {
  return process.env.GEMINI_TEST_MODEL || Netlify.env?.get('GEMINI_TEST_MODEL') || 'gemini-3.1-flash-lite';
}

/** The model may only reference animals it was shown, so the schema is just ids + reasons;
 * the frontend rehydrates full Animal records from the roster by id. */
const ROSTER_SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['id', 'reason'],
      },
    },
  },
  required: ['matches'],
};

interface RosterMatch {
  id: string;
  reason: string;
}
interface RosterSearchResult {
  matches: RosterMatch[];
}

class ContentSafetyBlockedError extends Error {}
class InvalidStructuredOutputError extends Error {}
class RateLimitedError extends Error {}

/** Extracts the JSON text from an Interactions API response's final model_output step. */
function extractOutputText(interaction: any): string {
  const steps: any[] = interaction?.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]?.type === 'model_output') {
      const textPart = (steps[i].content ?? []).find((part: any) => part.type === 'text');
      if (textPart?.text) return textPart.text;
    }
  }
  throw new ContentSafetyBlockedError('No text output — likely a content-safety refusal');
}

function isSafetyBlock(errorText: string): boolean {
  return /safety|blocked|prohibited/i.test(errorText);
}

/** Keeps only matches that name a real, adoptable animal — the model occasionally invents ids
 * or points at animals that aren't cleared for placement. */
function sanitizeMatches(result: RosterSearchResult): RosterSearchResult {
  const availableById = new Map(MOCK_ANIMALS.filter((a) => a.available).map((a) => [a.id, a]));
  const matches = (result.matches ?? [])
    .filter((m) => m && typeof m.id === 'string' && availableById.has(m.id) && !!m.reason?.trim())
    .map((m) => ({ id: m.id, reason: m.reason.trim() }));
  return { matches };
}

/** A compact roster snapshot for the prompt — only cleared-for-placement animals are searchable. */
function buildRosterContext(): string {
  return JSON.stringify(
    MOCK_ANIMALS.filter((a) => a.available).map((a) => ({
      id: a.id,
      name: a.name,
      species: a.species,
      condition: a.condition,
      backstory: a.backstory,
    })),
  );
}

async function searchRoster(apiKey: string, query: string): Promise<RosterSearchResult> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION,
    },
    body: JSON.stringify({
      model: resolveModel(),
      input:
        `Adopter is looking for: "${query}".\n\n` +
        `Here is the shelter's cleared-for-placement roster as JSON:\n${buildRosterContext()}\n\n` +
        `Return the animals that best fit the request, most relevant first, each with a short reason.`,
      system_instruction:
        "You are S.A.R.F.'s adoption concierge, matching adopters to cleared stuffed animals in " +
        'complete bureaucratic sincerity. Only return animals from the provided roster, referenced ' +
        'by their exact id. The reason must be one concise sentence in the shelter\'s formal municipal ' +
        'voice. If nothing fits, return an empty matches array.',
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: ROSTER_SEARCH_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[roster-search] Gemini API error', response.status, errText);
    if (response.status === 429) throw new RateLimitedError(errText);
    if (isSafetyBlock(errText)) throw new ContentSafetyBlockedError(errText);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const interaction = await response.json();
  const outputText = extractOutputText(interaction);

  let result: RosterSearchResult;
  try {
    result = JSON.parse(outputText);
  } catch {
    throw new InvalidStructuredOutputError(`Non-JSON structured output: ${outputText}`);
  }
  if (!Array.isArray(result?.matches)) {
    throw new InvalidStructuredOutputError(`Missing matches array: ${outputText}`);
  }

  return sanitizeMatches(result);
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as { query?: string };

    if (!body.query?.trim()) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_REQUEST', message: 'query required' }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (isDemoMode()) {
      return new Response(JSON.stringify(DEMO_RESPONSES.rosterSearch), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const result = await searchRoster(apiKey, body.query.trim());
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ContentSafetyBlockedError) {
      return new Response(JSON.stringify({
        error: { code: 'CONTENT_SAFETY_BLOCKED', message: "That search couldn't be processed. Try rephrasing it." }
      }), { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof InvalidStructuredOutputError) {
      console.error('[roster-search] invalid structured output', error.message);
      return new Response(JSON.stringify({
        error: { code: 'INVALID_STRUCTURED_OUTPUT', message: "The search didn't come back in a usable shape. Try again." }
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof RateLimitedError) {
      return new Response(JSON.stringify({
        error: { code: 'RATE_LIMITED', message: "We've hit the shelter's request limit for now. Please try again in a minute." }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    console.error('[roster-search] unexpected error', error);
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
