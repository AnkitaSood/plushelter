import type { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

/** Demo model is gemini-3.5-flash (specs.md §5). Override via GEMINI_TEST_MODEL in .env.local
 * to point real-API test calls at a cheaper model without touching this file. */
function resolveModel(): string {
  return process.env.GEMINI_TEST_MODEL || Netlify.env?.get('GEMINI_TEST_MODEL') || 'gemini-3.1-flash-lite';
}

const CERTIFICATE_SCHEMA = {
  type: 'object',
  properties: {
    certificateText: { type: 'string' }
  },
  required: ['certificateText']
};

interface AdoptionCertificate {
  certificateText: string;
}

interface AnimalInput {
  name: string;
  species: string;
  backstory: string;
}

interface ApplicationInput {
  adopterName: string;
  householdNote: string;
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

function assertPlausible(certificate: AdoptionCertificate): void {
  if (!certificate.certificateText?.trim()) {
    throw new InvalidStructuredOutputError(`Implausible adoption certificate: ${JSON.stringify(certificate)}`);
  }
}

async function generateCertificate(
  apiKey: string,
  animal: AnimalInput,
  application: ApplicationInput
): Promise<AdoptionCertificate> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION
    },
    body: JSON.stringify({
      model: resolveModel(),
      input: JSON.stringify({
        animalName: animal.name,
        animalSpecies: animal.species,
        animalBackstory: animal.backstory,
        adopterName: application.adopterName,
        householdNote: application.householdNote
      }),
      system_instruction:
        "You are S.A.R.F.'s placement registrar, finalizing a stuffed-animal adoption in complete bureaucratic " +
        'sincerity. Given the animal\'s name, species, and backstory, plus the adopter\'s name and a household note ' +
        'they submitted, write a short, warm certificateText (2-4 sentences) in the shelter\'s formal municipal ' +
        'voice, welcoming the adopter and the animal into their new household together. Reference both names and ' +
        'weave in a specific detail from the backstory and the household note.',
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: CERTIFICATE_SCHEMA
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[adoption-certificate] Gemini API error', response.status, errText);
    if (response.status === 429) throw new RateLimitedError(errText);
    if (isSafetyBlock(errText)) throw new ContentSafetyBlockedError(errText);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const interaction = await response.json();
  const outputText = extractOutputText(interaction);

  let certificate: AdoptionCertificate;
  try {
    certificate = JSON.parse(outputText);
  } catch {
    throw new InvalidStructuredOutputError(`Non-JSON structured output: ${outputText}`);
  }

  assertPlausible(certificate);
  return certificate;
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as { animal?: AnimalInput; application?: ApplicationInput };

    if (!body.animal || !body.application?.adopterName) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_REQUEST', message: 'animal and application.adopterName required' }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (isDemoMode()) {
      return new Response(JSON.stringify(DEMO_RESPONSES.adoptionCertificate), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const certificate = await generateCertificate(apiKey, body.animal, body.application);
    return new Response(JSON.stringify(certificate), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof ContentSafetyBlockedError) {
      return new Response(JSON.stringify({
        error: { code: 'CONTENT_SAFETY_BLOCKED', message: "That submission couldn't be processed. Try rephrasing it." }
      }), { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof InvalidStructuredOutputError) {
      console.error('[adoption-certificate] invalid structured output', error.message);
      return new Response(JSON.stringify({
        error: { code: 'INVALID_STRUCTURED_OUTPUT', message: "The certificate didn't come back in a usable shape. Try again." }
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    if (error instanceof RateLimitedError) {
      return new Response(JSON.stringify({
        error: { code: 'RATE_LIMITED', message: "We've hit the shelter's request limit for now. Please try again in a minute." }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    console.error('[adoption-certificate] unexpected error', error);
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
