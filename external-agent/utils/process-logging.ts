const LOG_PREFIX = '[external-agent]';

const loggedBenignErrors = new Set<string>();

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isBenignAdkGraphError(error: unknown): boolean {
  return errorMessage(error).includes('Unsupported tool type');
}

function hintForError(error: unknown): string | undefined {
  const message = errorMessage(error);

  if (message.includes('Unsupported tool type')) {
    return (
      'ADK dev-ui failed to render the agent graph after esbuild bundling ' +
      '(FunctionTool no longer passes instanceof BaseTool). The chat flow may still work.'
    );
  }

  if (message.includes('Unknown name "def"')) {
    return 'Gemini rejected tool schemas. Ensure FunctionTool uses @google/genai Schema, not Zod v4.';
  }

  if (message.includes('Chrome') || message.includes('browser')) {
    return (
      'Puppeteer could not launch stable Chrome with WebMCP. Confirm chrome://flags has ' +
      '"WebMCP support in DevTools" and "WebMCP for testing" enabled, and that the launch args ' +
      'include --enable-webmcp-testing and --devtools-webmcp-support.'
    );
  }

  return undefined;
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    if (error.stack) {
      return error.stack;
    }

    const lines = [`${error.name}: ${error.message}`];
    if (error.cause !== undefined) {
      lines.push(`cause: ${formatUnknownError(error.cause)}`);
    }

    return lines.join('\n');
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function logBenignOnce(key: string, message: string): void {
  if (loggedBenignErrors.has(key)) {
    return;
  }

  loggedBenignErrors.add(key);
  console.warn(`${LOG_PREFIX} ${message}`);
}

function logProcessFailure(label: string, error: unknown): void {
  if (isBenignAdkGraphError(error)) {
    logBenignOnce(
      'adk-graph-unsupported-tool',
      'ADK dev-ui graph rendering is unavailable after esbuild bundling. Chat still works.',
    );
    return;
  }

  const hint = hintForError(error);

  console.error(`${LOG_PREFIX} ${label}`);
  console.error(formatUnknownError(error));

  if (hint) {
    console.error(`${LOG_PREFIX} hint: ${hint}`);
  }
}

/** Logs fatal process errors with stack traces and actionable hints. */
export function registerProcessErrorLogging(): void {
  process.on('uncaughtException', (error) => {
    logProcessFailure('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason) => {
    logProcessFailure('unhandledRejection', reason);
  });
}
