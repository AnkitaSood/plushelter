import type { BaseLlm } from '@google/adk';

import { OllamaLlm } from './ollama-llm.js';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_OLLAMA_MODEL = 'llama3.1';
const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

/** Resolves the agent's model backend. AGENT_LLM_PROVIDER=ollama switches to a local
 * Ollama model; anything else (including unset) uses Gemini, as before. */
export function resolveAgentModel(): string | BaseLlm {
  const provider = process.env['AGENT_LLM_PROVIDER']?.trim().toLowerCase();

  if (provider === 'ollama') {
    const model = process.env['OLLAMA_MODEL']?.trim() || DEFAULT_OLLAMA_MODEL;
    const host = process.env['OLLAMA_BASE_URL']?.trim() || DEFAULT_OLLAMA_HOST;
    return new OllamaLlm(model, host);
  }

  return process.env['GEMINI_MODEL']?.trim() || DEFAULT_GEMINI_MODEL;
}
