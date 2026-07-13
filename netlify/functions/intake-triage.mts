import type { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

/** Demo model is gemini-3.5-flash (specs.md §5). Override via GEMINI_TEST_MODEL in .env.local
 * to point real-API test calls at a cheaper model without touching this file. */
function resolveModel(): string {
  return process.env.GEMINI_TEST_MODEL || Netlify.env?.get('GEMINI_TEST_MODEL') || 'gemini-3.1-flash-lite';
}

const CASE_FILE_SCHEMA = {
  type: 'object',
  properties: {
    species: { type: 'string' },
    condition: { type: 'string' },
    suggestedCaseName: { type: 'string' },
    huggabilityScore: { type: 'number' },
    recommendedTreatmentPlan: { type: 'array', items: { type: 'string' } }
  },
  required: ['species', 'condition', 'suggestedCaseName', 'huggabilityScore', 'recommendedTreatmentPlan']
};

interface CaseFile {
  species: string;
  condition: string;
  suggestedCaseName: string;
  huggabilityScore: number;
  recommendedTreatmentPlan: string[];
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

function assertPlausible(caseFile: CaseFile): void {
  if (
    typeof caseFile.huggabilityScore !== 'number' ||
    caseFile.huggabilityScore < 1 ||
    caseFile.huggabilityScore > 10 ||
    !caseFile.species?.trim() ||
    !caseFile.condition?.trim() ||
    !caseFile.suggestedCaseName?.trim() ||
    !Array.isArray(caseFile.recommendedTreatmentPlan) ||
    caseFile.recommendedTreatmentPlan.length === 0
  ) {
    throw new InvalidStructuredOutputError(`Implausible case file: ${JSON.stringify(caseFile)}`);
  }
}

async function triagePhoto(apiKey: string, photoBase64: string, mimeType: string, instructionText: string | undefined): Promise<CaseFile> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION
    },
    body: JSON.stringify({
      model: resolveModel(),
      input: [
        {
          type: 'text',
          text: instructionText || 'Assess this stuffed animal for intake at a shelter and produce its case file.'
        },
        { type: 'image', data: photoBase64, mime_type: mimeType }
      ],
      system_instruction:
        'You are a shelter intake clerk for stuffed animals. Examine the photo and return a case file: ' +
        'species, condition, a suggested case name, a huggabilityScore from 1-10, and a recommended treatment plan ' +
        '(a list of concrete inspection/cleaning steps).',
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: CASE_FILE_SCHEMA
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[intake-triage] Gemini API error', response.status, errText);
    if (response.status === 429) throw new RateLimitedError(errText);
    if (isSafetyBlock(errText)) throw new ContentSafetyBlockedError(errText);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const interaction = await response.json();
  const outputText = extractOutputText(interaction);

  let caseFile: CaseFile;
  try {
    caseFile = JSON.parse(outputText);
  } catch {
    throw new InvalidStructuredOutputError(`Non-JSON structured output: ${outputText}`);
  }

  assertPlausible(caseFile);
  return caseFile;
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as { photoBase64?: string; mimeType?: string; instructionText?: string };

    if (!body.photoBase64) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_REQUEST', message: 'photoBase64 required' }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (isDemoMode()) {
      return new Response(JSON.stringify(DEMO_RESPONSES.intakeTriage), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const caseFile = await triagePhoto(apiKey, body.photoBase64, body.mimeType || 'image/jpeg', body.instructionText);
    return new Response(JSON.stringify(caseFile), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ContentSafetyBlockedError) {
      return new Response(JSON.stringify({
        error: { code: 'CONTENT_SAFETY_BLOCKED', message: "That photo couldn't be processed. Try a different one." }
      }), { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof InvalidStructuredOutputError) {
      console.error('[intake-triage] invalid structured output', error.message);
      return new Response(JSON.stringify({
        error: { code: 'INVALID_STRUCTURED_OUTPUT', message: "The assessment didn't come back in a usable shape. Try again." }
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof RateLimitedError) {
      return new Response(JSON.stringify({
        error: { code: 'RATE_LIMITED', message: "We've hit the shelter's request limit for now. Please try again in a minute." }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    console.error('[intake-triage] unexpected error', error);
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
