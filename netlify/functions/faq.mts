import { Config } from '@netlify/functions';
import { DEMO_RESPONSES } from '../shared/demo-mode.mjs';

export default async function req(req: Request) {
  // Always return the canned data for demo purposes.
  // In a real app, you might fetch from a database here if DEMO_MODE was false.
  return new Response(JSON.stringify(DEMO_RESPONSES.faq), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export const config: Config = {
  path: '/api/faq',
};
