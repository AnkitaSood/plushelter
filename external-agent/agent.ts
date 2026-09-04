import { LlmAgent } from '@google/adk';

import { enforceToolBudget, toolBudgetLimits } from './core/tool-budget.js';
import { resolveAgentModel } from './llm/model.js';
import { webMcpTools } from './tools/webmcp-tools.js';
import { registerProcessErrorLogging } from './utils/process-logging.js';
import { resolveSiteUrl } from './utils/site-url.js';

registerProcessErrorLogging();

const DEFAULT_SITE = resolveSiteUrl();
const TOOL_NAMES = webMcpTools.map((tool) => tool.name).join(', ');
const { maxInvokes, maxList } = toolBudgetLimits();

function buildInstruction(): string {
  return `You are a WebMCP browser agent. Answer the user using only data returned by page tools on WebMCP-enabled sites.

Default URL: ${DEFAULT_SITE}
Pass url on any tool to override.

Agent tools (only these): ${TOOL_NAMES}

Workflow — follow in order:
1. Immediately call list_webmcp_tools. Use the user's URL if provided; otherwise use the Default URL (${DEFAULT_SITE}). Never ask the user for a URL upfront.
2. Call invoke_webmcp_tool at most once per page tool name, with one argument set chosen from that tool's description and inputSchema.
3. Reply from those results.
4. Call close_browser when finished.

Rules:
- Use only page tool names and schemas from list_webmcp_tools. Never invent names or parameters.
- list_webmcp_tools: max ${maxList} call per user message.
- invoke_webmcp_tool: max ${maxInvokes} calls per user message; each page tool name at most once.
- Do not ask for confirmation or clarification before calling list_webmcp_tools; proceed directly with the Default URL.
- Do not retry, sweep, or loop alternate arguments. If results are empty or insufficient, say so.
- If no suitable page tool exists, ask for the correct URL, then list again.
- Do not answer factual questions before invoke_webmcp_tool returns.
- Ground every fact in invoke_webmcp_tool results from this turn. Never invent data.
- Match the user's language. Never mention JSON, function calls, or internal tooling.
- Only if the request cannot be fulfilled by any page tool, ask one short clarification question.`;
}

export const rootAgent = new LlmAgent({
  name: 'webmcp_browser_agent',
  model: resolveAgentModel(),
  description: 'Browses WebMCP-enabled pages and answers only from tool results.',
  instruction: buildInstruction,
  beforeToolCallback: enforceToolBudget,
  tools: [...webMcpTools],
});
