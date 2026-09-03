import type { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';
import { MOCK_ANIMALS } from '../../src/app/data/roster.ts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_API_REVISION = '2026-05-20';

function resolveModel(): string {
  return process.env.GEMINI_TEST_MODEL || Netlify.env?.get('GEMINI_TEST_MODEL') || 'gemini-3.1-flash-lite';
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const STEP_OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    promptTitle: { type: 'string' },
    promptBody: { type: 'string' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['id', 'label', 'value'],
      },
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ['promptTitle', 'promptBody', 'options'],
};

const STEP3_SCHEMA = {
  type: 'object',
  properties: {
    matchedAnimalId: { type: 'string' },
    compatibilityScore: { type: 'number' },
    compatibilityRationale: { type: 'string' },
    checklistItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          checked: { type: 'boolean' },
        },
        required: ['label', 'checked'],
      },
      minItems: 3,
      maxItems: 5,
    },
  },
  required: ['matchedAnimalId', 'compatibilityScore', 'compatibilityRationale', 'checklistItems'],
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WizardOption {
  id: string;
  label: string;
  value: string;
}

export interface StepOptionsResponse {
  promptTitle: string;
  promptBody: string;
  options: WizardOption[];
}

export interface Step3Response {
  matchedAnimalId: string;
  compatibilityScore: number;
  compatibilityRationale: string;
  checklistItems: Array<{ label: string; checked: boolean }>;
}

export type WizardStepResponse = StepOptionsResponse | Step3Response;

// ─── Error types ─────────────────────────────────────────────────────────────

class ContentSafetyBlockedError extends Error {}
class InvalidStructuredOutputError extends Error {}
class RateLimitedError extends Error {}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractOutputText(interaction: unknown): string {
  const steps: unknown[] = (interaction as any)?.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i] as any;
    if (step?.type === 'model_output') {
      const textPart = (step.content ?? []).find((part: any) => part.type === 'text');
      if (textPart?.text) return textPart.text;
    }
  }
  throw new ContentSafetyBlockedError('No text output — likely a content-safety refusal');
}

function isSafetyBlock(errorText: string): boolean {
  return /safety|blocked|prohibited/i.test(errorText);
}

/** Full roster context sent in the system prompt so Gemini can make an informed match. */
function buildRosterContext(): string {
  return MOCK_ANIMALS.filter((a) => a.available)
    .map((a) => `- id: "${a.id}", name: "${a.name}", species: "${a.species}", backstory: "${a.backstory}"`)
    .join('\n');
}

// ─── Gemini calls ─────────────────────────────────────────────────────────────

async function fetchStep1(apiKey: string): Promise<StepOptionsResponse> {
  const systemInstruction =
    "You are the placement assessment intake system for S.A.R.F. (Stuffed Animal Rescue Foundation). " +
    "Your responses are formal, bureaucratic, and completely sincere — as if this were real municipal shelter software. " +
    "Never wink at the joke. Produce exactly 3 habitat options (apartment/studio, house, workstation/desk) as an " +
    "assessment question. Use the shelter's official voice for all copy.";

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION,
    },
    body: JSON.stringify({
      model: resolveModel(),
      input: 'Generate the Step 1 habitat assessment question for the Adaptive Companion Match Wizard. Offer exactly 3 options covering: compact apartment/studio, suburban house, and workstation/tech desk environments.',
      system_instruction: systemInstruction,
      response_format: { type: 'text', mime_type: 'application/json', schema: STEP_OPTIONS_SCHEMA },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) throw new RateLimitedError(errText);
    if (isSafetyBlock(errText)) throw new ContentSafetyBlockedError(errText);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const interaction = await response.json();
  const outputText = extractOutputText(interaction);
  try {
    return JSON.parse(outputText) as StepOptionsResponse;
  } catch {
    throw new InvalidStructuredOutputError(`Non-JSON step-1 output: ${outputText}`);
  }
}

async function fetchStep2(apiKey: string, livingValue: string): Promise<StepOptionsResponse> {
  const systemInstruction =
    "You are the placement assessment intake system for S.A.R.F. (Stuffed Animal Rescue Foundation). " +
    "Your responses are formal, bureaucratic, and completely sincere — as if this were real municipal shelter software. " +
    "Never wink at the joke. The applicant has selected their habitat. Now generate 2–3 behavioral specialization " +
    "options that are clinically appropriate for that habitat type. Use the shelter's official voice.";

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION,
    },
    body: JSON.stringify({
      model: resolveModel(),
      input: `The applicant selected habitat type: "${livingValue}". Generate Step 2 of the assessment: a behavioral specialization question with 2–3 role options that are well-suited to that environment.`,
      system_instruction: systemInstruction,
      response_format: { type: 'text', mime_type: 'application/json', schema: STEP_OPTIONS_SCHEMA },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) throw new RateLimitedError(errText);
    if (isSafetyBlock(errText)) throw new ContentSafetyBlockedError(errText);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const interaction = await response.json();
  const outputText = extractOutputText(interaction);
  try {
    return JSON.parse(outputText) as StepOptionsResponse;
  } catch {
    throw new InvalidStructuredOutputError(`Non-JSON step-2 output: ${outputText}`);
  }
}

async function fetchStep3(apiKey: string, livingValue: string, roleValue: string): Promise<Step3Response> {
  const rosterContext = buildRosterContext();
  const systemInstruction =
    "You are the placement assessment system for S.A.R.F. (Stuffed Animal Rescue Foundation). " +
    "You have access to the available shelter roster below. Select the single best match from the roster " +
    "for the applicant's habitat and behavioral role, return its exact id string, and produce a compatibility score (0–100), " +
    "a rationale paragraph, and 3–5 arrival protocol checklist items. Be formal and bureaucratic; never break the sincerity.\n\n" +
    "Available roster:\n" + rosterContext;

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
      'Api-Revision': GEMINI_API_REVISION,
    },
    body: JSON.stringify({
      model: resolveModel(),
      input: `Habitat: "${livingValue}". Behavioral specialization: "${roleValue}". Identify the best match from the roster and produce the Step 3 final assessment.`,
      system_instruction: systemInstruction,
      response_format: { type: 'text', mime_type: 'application/json', schema: STEP3_SCHEMA },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    if (response.status === 429) throw new RateLimitedError(errText);
    if (isSafetyBlock(errText)) throw new ContentSafetyBlockedError(errText);
    throw new Error(`Gemini API request failed with status ${response.status}`);
  }

  const interaction = await response.json();
  const outputText = extractOutputText(interaction);
  let result: Step3Response;
  try {
    result = JSON.parse(outputText) as Step3Response;
  } catch {
    throw new InvalidStructuredOutputError(`Non-JSON step-3 output: ${outputText}`);
  }

  // Validate the returned animal id exists in our roster
  const validIds = new Set(MOCK_ANIMALS.map((a) => a.id));
  if (!validIds.has(result.matchedAnimalId)) {
    // Fall back to first available animal rather than crashing
    const fallback = MOCK_ANIMALS.find((a) => a.available);
    if (fallback) result.matchedAnimalId = fallback.id;
  }

  return result;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { step?: number; livingValue?: string; roleValue?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'JSON body required' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const step = body.step ?? 1;

  try {
    // Demo mode short-circuit
    if (isDemoMode()) {
      const demoStep = step === 1
        ? DEMO_RESPONSES.matchWizard.step1
        : step === 2
        ? DEMO_RESPONSES.matchWizard.step2(body.livingValue ?? 'apartment')
        : DEMO_RESPONSES.matchWizard.step3;
      return new Response(JSON.stringify(demoStep), { headers: { 'Content-Type': 'application/json' } });
    }

    const apiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    let result: WizardStepResponse;
    if (step === 1) {
      result = await fetchStep1(apiKey);
    } else if (step === 2) {
      if (!body.livingValue) {
        return new Response(
          JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'livingValue required for step 2' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      result = await fetchStep2(apiKey, body.livingValue);
    } else if (step === 3) {
      if (!body.livingValue || !body.roleValue) {
        return new Response(
          JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'livingValue and roleValue required for step 3' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      result = await fetchStep3(apiKey, body.livingValue, body.roleValue);
    } else {
      return new Response(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'step must be 1, 2, or 3' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    if (error instanceof ContentSafetyBlockedError) {
      return new Response(
        JSON.stringify({ error: { code: 'CONTENT_SAFETY_BLOCKED', message: "The assessment system encountered a processing impediment. Please retry." } }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (error instanceof InvalidStructuredOutputError) {
      console.error('[match-wizard] invalid structured output', (error as Error).message);
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_STRUCTURED_OUTPUT', message: "The placement assessment did not return a usable result. Please retry." } }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (error instanceof RateLimitedError) {
      return new Response(
        JSON.stringify({ error: { code: 'RATE_LIMITED', message: "The shelter's assessment system is momentarily overloaded. Please try again shortly." } }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }
    console.error('[match-wizard] unexpected error', error);
    return new Response(
      JSON.stringify({ error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
