/** JSON Schema fragment exposed by WebMCP tools via `inputSchema`. */
export interface JsonSchemaObject {
  readonly type?: string;
  readonly properties?: Readonly<Record<string, JsonSchemaObject>>;
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly description?: string;
  readonly additionalProperties?: boolean;
  readonly items?: JsonSchemaObject;
}

/** Serializable WebMCP tool metadata returned by `list_webmcp_tools`. */
export interface WebMcpToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject | null;
}
