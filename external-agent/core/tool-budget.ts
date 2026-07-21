const DEFAULT_MAX_INVOKES = 3;
const DEFAULT_MAX_LIST = 1;
const MAX_TRACKED_INVOCATIONS = 200;
const DEFAULT_RATE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_INVOKES_PER_WINDOW = 20;

interface InvocationBudget {
  invokeCount: number;
  listCount: number;
  invokedTools: Set<string>;
}

const budgets = new Map<string, InvocationBudget>();

/** Timestamps (ms) of every invoke_webmcp_tool call, oldest first — spans all messages/invocations
 * in this agent process, unlike InvocationBudget which resets per user message. */
const invokeTimestamps: number[] = [];

function parseLimit(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pruneInvokeTimestamps(windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  while (invokeTimestamps.length > 0 && invokeTimestamps[0] < cutoff) {
    invokeTimestamps.shift();
  }
}

/**
 * Global sliding-window rate check for invoke_webmcp_tool, independent of the per-message
 * budget below — catches a runaway agent spread across many short messages, not just one.
 */
function checkInvokeRateWindow(): Record<string, unknown> | undefined {
  const windowMs = parseLimit(process.env['WEBMCP_RATE_WINDOW_MS'], DEFAULT_RATE_WINDOW_MS);
  const maxPerWindow = parseLimit(
    process.env['WEBMCP_MAX_INVOKES_PER_WINDOW'],
    DEFAULT_MAX_INVOKES_PER_WINDOW,
  );

  pruneInvokeTimestamps(windowMs);

  if (invokeTimestamps.length >= maxPerWindow) {
    return budgetError(
      'rate_window_exceeded',
      `invoke_webmcp_tool rate limit (${maxPerWindow} per ${Math.round(windowMs / 1000)}s) reached. Wait before calling more tools.`,
      { windowMs, maxPerWindow, callsInWindow: invokeTimestamps.length },
    );
  }

  invokeTimestamps.push(Date.now());
  return undefined;
}

function getBudget(invocationId: string): InvocationBudget {
  let budget = budgets.get(invocationId);
  if (!budget) {
    if (budgets.size >= MAX_TRACKED_INVOCATIONS) {
      const oldest = budgets.keys().next().value;
      if (oldest) {
        budgets.delete(oldest);
      }
    }

    budget = { invokeCount: 0, listCount: 0, invokedTools: new Set() };
    budgets.set(invocationId, budget);
  }

  return budget;
}

function budgetError(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): Record<string, unknown> {
  return { status: 'blocked', error: code, message, ...details };
}

/**
 * Blocks runaway tool loops (e.g. dozens of search calls with tweaked args).
 * Returns a synthetic tool result when the budget is exceeded; otherwise undefined.
 */
export function enforceToolBudget({
  tool,
  args,
  context,
}: {
  tool: { name: string };
  args: Record<string, unknown>;
  context: { invocationId: string };
}): Record<string, unknown> | undefined {
  const maxInvokes = parseLimit(process.env['WEBMCP_MAX_INVOKES'], DEFAULT_MAX_INVOKES);
  const maxList = parseLimit(process.env['WEBMCP_MAX_LIST_TOOLS'], DEFAULT_MAX_LIST);
  const budget = getBudget(context.invocationId);

  if (tool.name === 'list_webmcp_tools') {
    if (budget.listCount >= maxList) {
      return budgetError(
        'list_budget_exceeded',
        `list_webmcp_tools limit (${maxList}) reached for this user message. Reuse the tool list you already have.`,
        { listCount: budget.listCount },
      );
    }

    budget.listCount += 1;
    return undefined;
  }

  if (tool.name !== 'invoke_webmcp_tool') {
    return undefined;
  }

  if (budget.invokeCount >= maxInvokes) {
    return budgetError(
      'invoke_budget_exceeded',
      `invoke_webmcp_tool limit (${maxInvokes}) reached for this user message. Answer from previous tool results.`,
      { invokeCount: budget.invokeCount },
    );
  }

  const toolName = String(args['tool_name'] ?? '').trim();
  if (toolName && budget.invokedTools.has(toolName)) {
    return budgetError(
      'duplicate_tool',
      `Tool "${toolName}" was already called this turn. Do not retry with different parameters. Answer from that result.`,
      { tool_name: toolName },
    );
  }

  // Checked last, and only recorded once every per-message gate above has already passed —
  // this window spans the whole agent process, not just the current message.
  const rateLimited = checkInvokeRateWindow();
  if (rateLimited) {
    return rateLimited;
  }

  budget.invokeCount += 1;
  if (toolName) {
    budget.invokedTools.add(toolName);
  }

  return undefined;
}

export function toolBudgetLimits(): { maxInvokes: number; maxList: number } {
  return {
    maxInvokes: parseLimit(process.env['WEBMCP_MAX_INVOKES'], DEFAULT_MAX_INVOKES),
    maxList: parseLimit(process.env['WEBMCP_MAX_LIST_TOOLS'], DEFAULT_MAX_LIST),
  };
}
