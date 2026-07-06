import { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as { photoBase64?: string };

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

    // TODO: Implement real Gemini API call with multimodal input and structured output
    // For now, return canned response
    return new Response(JSON.stringify(DEMO_RESPONSES.intakeTriage), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
