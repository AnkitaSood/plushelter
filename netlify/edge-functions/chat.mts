import { isDemoMode, simulateTokenDelay, DEMO_RESPONSES } from '../shared/demo-mode.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'POST required' }
    }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json() as { message?: string; previousInteractionId?: string };

    if (!body.message) {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_REQUEST', message: 'message required' }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Return SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (isDemoMode()) {
            // Send canned tokens one by one with simulated delay
            for (const token of DEMO_RESPONSES.conciergeChat.tokens) {
              controller.enqueue(
                `event: token\ndata: ${JSON.stringify({ token })}\n\n`
              );
              await simulateTokenDelay(50);
            }

            // Send tool result with matched animals
            controller.enqueue(
              `event: tool_result\ndata: ${JSON.stringify({
                toolName: 'searchAvailableAnimals',
                animals: DEMO_RESPONSES.conciergeChat.animals
              })}\n\n`
            );

            // Send completion event
            controller.enqueue('event: done\ndata: {}\n\n');
          } else {
            // TODO: Implement real Gemini Interactions API call with tool-calling loop
            // For now, send canned response
            for (const token of DEMO_RESPONSES.conciergeChat.tokens) {
              controller.enqueue(
                `event: token\ndata: ${JSON.stringify({ token })}\n\n`
              );
              await simulateTokenDelay(50);
            }
            controller.enqueue(
              `event: tool_result\ndata: ${JSON.stringify({
                toolName: 'searchAvailableAnimals',
                animals: DEMO_RESPONSES.conciergeChat.animals
              })}\n\n`
            );
            controller.enqueue('event: done\ndata: {}\n\n');
          }

          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            `event: error\ndata: ${JSON.stringify({
              code: 'UPSTREAM_ERROR',
              message: errorMessage
            })}\n\n`
          );
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: { code: 'UPSTREAM_ERROR', message: 'Failed to process request' }
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = {
  path: '/api/chat'
};
