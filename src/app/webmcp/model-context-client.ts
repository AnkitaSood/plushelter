import { EnvironmentInjector, Service, inject, runInInjectionContext } from '@angular/core';
import { SHELTER_TOOL_REGISTRY } from './shelter-tools';

/**
 * Browser-side bridge between the in-page agent and the page's WebMCP tools.
 *
 * The page registers tools into `document.modelContext` (via Angular's WebMCP providers); this
 * client both LISTS them (so the agent knows the current route's scoped toolset) and CALLS them.
 * Calls are routed through `document.modelContext` on purpose: that is the surface the WebMCP
 * DevTools extension instruments, so every agent call shows up in its "Tool Activity" panel.
 *
 * `document.modelContext` is an experimental API delivered by different providers (the DevTools
 * browser extension, the @mcp-b npm polyfill, or a future native Chrome build), each of which may
 * expose a slightly different invocation method. We feature-detect the call path rather than pin one,
 * and fall back to running the registered descriptor directly (the Agent Console's approach) only
 * when no `document.modelContext`/`navigator.modelContext` exists at all — in which case there's no
 * DevTools panel anyway. `navigator.modelContext` is still probed as a fallback for older provider
 * versions, since it's the surface the spec migrated away from (hence the deprecation warning).
 */

/** A tool as the agent needs to describe it to the model (WebMCP JSON-Schema shape). */
export interface WebMcpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A Gemini function-tool declaration (what /api/agent forwards to the Interactions API). */
export interface GeminiToolDecl {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** The MCP content-block result shape every tool returns. */
interface McpToolResult {
  content?: { type?: string; text?: string }[];
}

/** The subset of the experimental `navigator.modelContext` surface we probe for. */
interface ModelContextLike {
  getTools?: () => WebMcpToolInfo[] | Promise<WebMcpToolInfo[]>;
  tools?: WebMcpToolInfo[];
  callTool?: (name: string, args: unknown) => unknown;
  // Chrome's native ModelContext.executeTool(tool, inputJson) takes the RegisteredTool OBJECT
  // returned by getTools() — not its name — and the args as a JSON *string*, not an object.
  executeTool?: (tool: WebMcpToolInfo, inputJson: string) => unknown;
}
interface ModelContextTestingLike {
  listTools?: () => WebMcpToolInfo[] | Promise<WebMcpToolInfo[]>;
  executeTool?: (name: string, args: unknown) => unknown;
}

function getModelContext(): ModelContextLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  // The WebMCP spec moved this surface from `navigator` to `document`; check `document` first
  // (same precedence Angular core's own `declareExperimentalWebMcpTool` uses) to avoid the
  // "navigator.modelContext is deprecated" warning that fires just from reading the old getter.
  const doc = typeof document === 'undefined' ? undefined : (document as Document & { modelContext?: ModelContextLike });
  return doc?.modelContext ?? (navigator as Navigator & { modelContext?: ModelContextLike }).modelContext;
}
function getModelContextTesting(): ModelContextTestingLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { modelContextTesting?: ModelContextTestingLike }).modelContextTesting;
}

/**
 * Some `document.modelContext`/`navigator.modelContext` providers hand back `inputSchema` as an
 * already-`JSON.stringify`'d string rather than the JSON Schema object the descriptor promises
 * (observed from the WebMCP DevTools extension). Gemini's tool `parameters` field needs an object —
 * a raw string is silently unusable and produces an empty completion with no error — so parse it back.
 */
function normalizeInputSchema(schema: unknown): Record<string, unknown> {
  if (typeof schema === 'string') {
    try {
      return JSON.parse(schema) as Record<string, unknown>;
    } catch {
      return { type: 'object', properties: {} };
    }
  }
  return (schema as Record<string, unknown>) ?? { type: 'object', properties: {} };
}

/**
 * Extract the plain-text payload from a tool result. Chrome's native `executeTool` resolves with
 * a plain `string | null`; the local registry fallback (and some polyfills) resolve with the MCP
 * content-block shape (`{ content: [{ type: 'text', text }] }`). Handle both.
 */
function extractText(out: unknown): string {
  if (out === null || out === undefined) return '';
  if (typeof out === 'string') return out;
  const content = (out as McpToolResult)?.content ?? [];
  const text = content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n');
  return text || JSON.stringify(out);
}

@Service()
export class ModelContextClient {
  private readonly injector = inject(EnvironmentInjector);

  /** True when a real `document.modelContext`/`navigator.modelContext` is present (extension/polyfill/native). */
  isWebMcpAvailable(): boolean {
    return getModelContext() !== undefined;
  }

  /** Map a WebMCP tool descriptor to the Gemini function-declaration the agent endpoint expects. */
  toGeminiTool(t: WebMcpToolInfo): GeminiToolDecl {
    return {
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: normalizeInputSchema(t.inputSchema),
    };
  }

  /** List the tools registered for the CURRENT route (falls back to the static registry off-DOM). */
  async listTools(): Promise<WebMcpToolInfo[]> {
    const mc = getModelContext();
    if (mc?.getTools) return await mc.getTools();
    if (mc?.tools) return mc.tools;

    const testing = getModelContextTesting();
    if (testing?.listTools) return await testing.listTools();

    return this.registryTools();
  }

  /**
   * Execute a tool by name. Prefers `document.modelContext` so the DevTools extension logs the call;
   * falls back to running the registered descriptor in an injection context when no WebMCP surface
   * exists. Returns the tool's text content.
   */
  async callTool(name: string, args: unknown): Promise<string> {
    const mc = getModelContext();
    if (mc?.callTool) return extractText(await mc.callTool(name, args));
    if (mc?.executeTool) {
      // executeTool needs the actual RegisteredTool object from getTools(), not just its name.
      const tools = mc.getTools ? await mc.getTools() : mc.tools ?? [];
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new Error(`Tool "${name}" is not registered on this page.`);
      return extractText(await mc.executeTool(tool, JSON.stringify(args ?? {})));
    }

    const testing = getModelContextTesting();
    if (testing?.executeTool) return extractText(await testing.executeTool(name, args));

    return this.callFromRegistry(name, args);
  }

  private registryTools(): WebMcpToolInfo[] {
    return SHELTER_TOOL_REGISTRY.map((rt) => ({
      name: rt.tool.name,
      description: rt.tool.description,
      inputSchema: rt.tool.inputSchema as Record<string, unknown>,
    }));
  }

  private async callFromRegistry(name: string, args: unknown): Promise<string> {
    const entry = SHELTER_TOOL_REGISTRY.find((rt) => rt.tool.name === name);
    if (!entry) throw new Error(`Tool "${name}" is not registered on this page.`);
    const run = entry.tool.execute as (a: unknown, c: unknown) => unknown;
    const out = await Promise.resolve(runInInjectionContext(this.injector, () => run(args, {})));
    return extractText(out);
  }
}
