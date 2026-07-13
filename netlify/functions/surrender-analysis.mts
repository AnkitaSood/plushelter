import type { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

/** Demo model is gemini-3.5-flash (specs.md §5). Override via GEMINI_TEST_MODEL in .env.local
 * to point real-API test calls at a cheaper model without touching this file. */
function resolveModel(): string {
  return process.env.GEMINI_TEST_MODEL || Netlify.env?.get('GEMINI_TEST_MODEL') || 'gemini-3.1-flash-lite';
}

const GUILT_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    guiltScore: { type: 'number' },
    message: { type: 'string' }
  },
  required: ['guiltScore', 'message']
};

interface GuiltAnalysis {
  guiltScore: number;
  message: string;
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

/**
 * The Interactions API docs don't yet document a stable field for safety refusals
 * (no finish_reason/block_reason at time of writing), so this is a best-effort
 * keyword check on the upstream error body until that surface stabilizes.
 */
function isSafetyBlock(errorText: string): boolean {
  return /safety|blocked|prohibited/i.test(errorText);
}

function assertPlausible(analysis: GuiltAnalysis): void {
  if (
    typeof analysis.guiltScore !== 'number' ||
    analysis.guiltScore < 0 ||
    analysis.guiltScore > 100 ||
    !analysis.message?.trim()
  ) {
    throw new InvalidStructuredOutputError(`Implausible guilt analysis: ${JSON.stringify(analysis)}`);
  }
}

async function analyzeSurrenderText(apiKey: string, submittedText: string): Promise<GuiltAnalysis> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION
    },
    body: JSON.stringify({
      model: resolveModel(),
      input: submittedText,
      system_instruction:
        "You are S.A.R.F.'s intake counselor, reviewing a shelter surrender explanation in complete bureaucratic " +
        'sincerity. Return a guiltScore from 0-100 reflecting how avoidable the surrender sounds, and a short ' +
        "message in the shelter's formal municipal voice acknowledging the submission.",
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: GUILT_ANALYSIS_SCHEMA
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[surrender-analysis] Gemini API error', response.status, errText);
    if (response.status === 429) throw new RateLimitedError(errText);
    if (isSafetyBlock(errText)) throw new ContentSafetyBlockedError(errText);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const interaction = await response.json();
  const outputText = extractOutputText(interaction);

  let analysis: GuiltAnalysis;
  try {
    analysis = JSON.parse(outputText);
  } catch {
    throw new InvalidStructuredOutputError(`Non-JSON structured output: ${outputText}`);
  }

  assertPlausible(analysis);
  return analysis;
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as { submittedText?: string };

    if (!body.submittedText) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_REQUEST', message: 'submittedText required' }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (isDemoMode()) {
      return new Response(JSON.stringify(DEMO_RESPONSES.surrenderAnalysis), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const analysis = await analyzeSurrenderText(apiKey, body.submittedText);
    return new Response(JSON.stringify(analysis), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ContentSafetyBlockedError) {
      return new Response(JSON.stringify({
        error: { code: 'CONTENT_SAFETY_BLOCKED', message: "That submission couldn't be processed. Try rephrasing it." }
      }), { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof InvalidStructuredOutputError) {
      console.error('[surrender-analysis] invalid structured output', error.message);
      return new Response(JSON.stringify({
        error: { code: 'INVALID_STRUCTURED_OUTPUT', message: "The assessment didn't come back in a usable shape. Try again." }
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof RateLimitedError) {
      return new Response(JSON.stringify({
        error: { code: 'RATE_LIMITED', message: "We've hit the shelter's request limit for now. Please try again in a minute." }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    console.error('[surrender-analysis] unexpected error', error);
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
