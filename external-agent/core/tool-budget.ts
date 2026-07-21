const DEFAULT_MAX_INVOKES = 3;
const DEFAULT_MAX_LIST = 1;
const MAX_TRACKED_INVOCATIONS = 200;

interface InvocationBudget {
  invokeCount: number;
  listCount: number;
  invokedTools: Set<string>;
}

const budgets = new Map<string, InvocationBudget>();

function parseLimit(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
