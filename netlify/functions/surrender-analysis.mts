import { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';

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

    // TODO: Implement real Gemini API call with structured output schema
    return new Response(JSON.stringify(DEMO_RESPONSES.surrenderAnalysis), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
