import { BaseLlm, type LlmRequest, type LlmResponse } from '@google/adk';
import { Ollama, type Message, type Tool } from 'ollama';

interface FunctionDeclarationLike {
  name?: string;
  description?: string;
  parameters?: unknown;
}

interface ToolConfigLike {
  functionDeclarations?: FunctionDeclarationLike[];
  function_declarations?: FunctionDeclarationLike[];
}

interface ContentPartLike {
  text?: string;
  functionCall?: {
    name?: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name?: string;
    response?: unknown;
  };
}

function normalizeOllamaHost(raw: string): string {
  return raw.replace(/\/v1\/?$/, '');
}

function sanitizeSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeSchema(item));
  }

  const record = schema as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };

  if (typeof next['type'] === 'string') {
    next['type'] = next['type'].toLowerCase();
  }

  if (next['type'] === 'object' && !next['properties']) {
    next['properties'] = {};
  }

  if (next['properties'] && typeof next['properties'] === 'object') {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next['properties'] as Record<string, unknown>)) {
      properties[key] = sanitizeSchema(value);
    }
    next['properties'] = properties;
  }

  for (const [key, value] of Object.entries(next)) {
    if (key !== 'type' && key !== 'properties' && typeof value === 'object' && value !== null) {
      next[key] = sanitizeSchema(value);
    }
  }

  return next;
}

function toOllamaTools(llmRequest: LlmRequest): Tool[] | undefined {
  const toolConfigs = (llmRequest.config?.tools ?? []) as ToolConfigLike[];
  const declarations = toolConfigs.flatMap((toolConfig): FunctionDeclarationLike[] => {
    if (typeof toolConfig !== 'object' || toolConfig === null) {
      return [];
    }

    if ('functionDeclarations' in toolConfig && Array.isArray(toolConfig.functionDeclarations)) {
      return toolConfig.functionDeclarations;
    }

    if ('function_declarations' in toolConfig && Array.isArray(toolConfig.function_declarations)) {
      return toolConfig.function_declarations;
    }

    return [];
  });

  const tools = declarations
    .filter(
      (decl): decl is FunctionDeclarationLike & { name: string } =>
        typeof decl.name === 'string' && decl.name.length > 0,
    )
    .map((decl) => ({
      type: 'function' as const,
      function: {
        name: decl.name as string,
        description: decl.description ?? '',
        parameters: sanitizeSchema(decl.parameters) as Tool['function']['parameters'],
      },
    }));

  return tools.length > 0 ? tools : undefined;
}

function extractSystemInstruction(llmRequest: LlmRequest): string | undefined {
  const raw = llmRequest.config?.systemInstruction;
  if (!raw) {
    return undefined;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'parts' in raw &&
    Array.isArray((raw as { parts?: Array<{ text?: string }> }).parts)
  ) {
    const text = (raw as { parts: Array<{ text?: string }> }).parts
      .map((p) => p.text ?? '')
      .join('\n')
      .trim();
    return text.length > 0 ? text : undefined;
  }
  return undefined;
}

function extractFallbackToolCalls(
  text: string,
  tools?: Tool[],
): Array<{ name: string; args: Record<string, unknown> }> {
  if (!tools || tools.length === 0 || !text) {
    return [];
  }

  const toolNames = new Set(tools.map((t) => t.function.name));
  const results: Array<{ name: string; args: Record<string, unknown> }> = [];

  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const jsonSlice = text.slice(start, i + 1);
        start = -1;
        try {
          const parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
          if (typeof parsed['name'] === 'string' && toolNames.has(parsed['name'])) {
            const rawArgs = parsed['parameters'] ?? parsed['arguments'] ?? {};
            const args =
              typeof rawArgs === 'object' && rawArgs !== null
                ? (rawArgs as Record<string, unknown>)
                : {};
            results.push({ name: parsed['name'], args });
          }
        } catch {
          // not a valid JSON chunk
        }
      }
    }
  }

  return results;
}

function toOllamaMessages(llmRequest: LlmRequest): Message[] {
  const messages: Message[] = [];
  const systemInstruction = extractSystemInstruction(llmRequest);
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  const contentMessages = (llmRequest.contents ?? []).flatMap((content) => {
    const role = content.role === 'model' ? 'assistant' : (content.role ?? 'user');
    const parts = (content.parts ?? []) as ContentPartLike[];
    const toolCallParts = parts.filter((part) => 'functionCall' in part);
    const functionResponseParts = parts.filter((part) => 'functionResponse' in part);
    const textParts = parts
      .filter((part) => 'text' in part)
      .map((part) => part.text)
      .join('\n');

    if (functionResponseParts.length > 0) {
      return functionResponseParts.map((part) => {
        const msg: Message = {
          role: 'tool' as const,
          content:
            typeof part.functionResponse?.response === 'string'
              ? part.functionResponse.response
              : JSON.stringify(part.functionResponse?.response ?? {}),
        };
        if (part.functionResponse?.name) {
          msg.tool_name = part.functionResponse.name;
        }
        return msg;
      });
    }

    const message: Message = { role, content: textParts };

    if (toolCallParts.length > 0) {
      message.tool_calls = toolCallParts.flatMap((part) => {
        if (!('functionCall' in part) || !part.functionCall?.name) {
          return [];
        }

        let args = part.functionCall.args ?? {};
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args) as Record<string, unknown>;
          } catch {
            args = {};
          }
        }

        return [
          {
            function: {
              name: part.functionCall.name,
              arguments: args,
            },
          },
        ];
      });
    }

    return message.content || message.tool_calls ? [message] : [];
  });

  messages.push(...contentMessages);
  return messages;
}

/**
 * Ollama-backed LLM for ADK. Uses non-streaming chat so tool calls are returned
 * reliably (streaming + Llama often makes ADK treat prose as the final answer).
 */
export class OllamaLlm extends BaseLlm {
  private readonly client: Ollama;

  constructor(
    model: string,
    host = normalizeOllamaHost(
      process.env['OLLAMA_BASE_URL'] ?? process.env['OLLAMA_HOST'] ?? 'http://localhost:11434',
    ),
  ) {
    super({ model });
    this.client = new Ollama({ host });
  }

  connect(): never {
    throw new Error('Live connections are not supported for OllamaLlm');
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    _stream = true,
  ): AsyncGenerator<LlmResponse, void> {
    const tools = toOllamaTools(llmRequest);
    const messages = toOllamaMessages(llmRequest);

    const response = await this.client.chat({
      model: this.model,
      messages,
      tools,
      stream: false,
    });

    const parts: NonNullable<LlmResponse['content']>['parts'] = [];

    if (response.message.tool_calls?.length) {
      for (const toolCall of response.message.tool_calls) {
        let args = toolCall.function.arguments;
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args) as Record<string, unknown>;
          } catch {
            args = {};
          }
        }
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: (args as Record<string, unknown>) ?? {},
          },
        });
      }
    } else if (response.message.content) {
      const fallbackCalls = extractFallbackToolCalls(response.message.content, tools);
      if (fallbackCalls.length > 0) {
        for (const call of fallbackCalls) {
          parts.push({
            functionCall: {
              name: call.name,
              args: call.args,
            },
          });
        }
      } else {
        parts.push({ text: response.message.content });
      }
    }

    if (parts.length === 0) {
      return;
    }

    yield {
      content: {
        role: 'model',
        parts,
      },
    };
  }
}
