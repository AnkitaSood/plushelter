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

function toOllamaMessages(contents: LlmRequest['contents']): Message[] {
  return contents.flatMap((content) => {
    const role = content.role === 'model' ? 'assistant' : (content.role ?? 'user');
    const parts = (content.parts ?? []) as ContentPartLike[];
    const toolCallParts = parts.filter((part) => 'functionCall' in part);
    const functionResponseParts = parts.filter((part) => 'functionResponse' in part);
    const textParts = parts
      .filter((part) => 'text' in part)
      .map((part) => part.text)
      .join('\n');

    if (functionResponseParts.length > 0) {
      return functionResponseParts.map((part) => ({
        role: 'tool' as const,
        content: JSON.stringify(part.functionResponse?.response),
      }));
    }

    const message: Message = { role, content: textParts };

    if (toolCallParts.length > 0) {
      message.tool_calls = toolCallParts.flatMap((part) => {
        if (!('functionCall' in part) || !part.functionCall?.name) {
          return [];
        }

        return [
          {
            function: {
              name: part.functionCall.name,
              arguments: part.functionCall.args ?? {},
            },
          },
        ];
      });
    }

    return message.content || message.tool_calls ? [message] : [];
  });
}

/**
 * Ollama-backed LLM for ADK. Uses non-streaming chat so tool calls are returned
 * reliably (streaming + Llama often makes ADK treat prose as the final answer).
 */
export class OllamaLlm extends BaseLlm {
  private readonly client: Ollama;

  constructor(
    model: string,
    host = normalizeOllamaHost(process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434'),
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
    const messages = toOllamaMessages(llmRequest.contents);

    const response = await this.client.chat({
      model: this.model,
      messages,
      tools,
      stream: false,
    });

    const parts: NonNullable<LlmResponse['content']>['parts'] = [];

    if (response.message.tool_calls?.length) {
      for (const toolCall of response.message.tool_calls) {
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: toolCall.function.arguments,
          },
        });
      }
    } else if (response.message.content) {
      parts.push({ text: response.message.content });
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
