import { Context } from '@netlify/functions';
import { isDemoMode, DEMO_RESPONSES } from '../shared/demo-mode.mts';

export default async (req: Request, context: Context) => {
  if (isDemoMode()) {
    return new Response(JSON.stringify(DEMO_RESPONSES.animals), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // TODO: In real mode, fetch from actual data source
  return new Response(JSON.stringify(DEMO_RESPONSES.animals), {
    headers: { 'Content-Type': 'application/json' }
  });
};
