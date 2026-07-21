const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

/** Resolves the Gemini model for the WebMCP agent. Override via GEMINI_MODEL. */
export function resolveAgentModel(): string {
  return process.env['GEMINI_MODEL']?.trim() || DEFAULT_GEMINI_MODEL;
}
