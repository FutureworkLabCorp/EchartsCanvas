// The demo owns every network call. The library never fetches — it takes GraphData as a
// prop — so this layer, the transport and the mapping below it, is deliberately outside
// src/ and ships with nothing.

// Same-origin. The Vite dev proxy forwards /mcpapi/* to the MCP host, which is what keeps
// the browser off a cross-origin request and out of CORS.
const MCP_PREFIX = "/mcpapi";

export interface McpAuth {
  // A linkbrain access token. Read from VITE_MCP_TOKEN or pasted into the demo; never
  // committed, and never sent anywhere but the proxy target.
  token: string;
  orgId?: string;
  teamId?: string;
  workspaceId?: string;
  contextToken?: string;
}

export class McpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "McpError";
  }
}

// The MCP host answers tools in an envelope: the payload sits under content[0].text as a
// JSON string, or directly under `result`/`data` depending on the tool. Anything that is
// already the payload passes through.
export const unwrapMcp = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const record = raw as Record<string, unknown>;

  if (record.isError === true) {
    throw new McpError(readToolErrorMessage(record));
  }

  const content = record.content;
  if (Array.isArray(content)) {
    const first = content.find(
      (entry): entry is { text: string } =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as { text?: unknown }).text === "string",
    );
    if (first) {
      try {
        return JSON.parse(first.text);
      } catch {
        return first.text;
      }
    }
  }

  if ("result" in record) return unwrapMcp(record.result);
  if ("data" in record) return unwrapMcp(record.data);
  return record;
};

const readToolErrorMessage = (record: Record<string, unknown>): string => {
  const content = record.content;
  if (Array.isArray(content)) {
    const texts = content
      .map((entry) =>
        entry && typeof entry === "object"
          ? (entry as { text?: unknown }).text
          : undefined,
      )
      .filter((text): text is string => typeof text === "string");
    if (texts.length > 0) return texts.join("\n");
  }
  return "MCP tool reported an error";
};

export const callMcpTool = async (
  tool: string,
  body: Record<string, unknown>,
  auth: McpAuth,
  signal?: AbortSignal,
): Promise<unknown> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
  };
  // Workspace context. The host binds the token to a tenant through these, so a missing
  // one comes back as an empty graph rather than an error.
  if (auth.orgId) headers["X-Org-ID"] = auth.orgId;
  if (auth.teamId) headers["X-Team-Id"] = auth.teamId;
  if (auth.workspaceId) headers["X-Workspace-Id"] = auth.workspaceId;
  if (auth.contextToken) headers["X-Context-Token"] = auth.contextToken;

  const response = await fetch(`${MCP_PREFIX}/${tool}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new McpError(
      `${tool} failed: ${response.status} ${response.statusText}`,
      response.status,
    );
  }
  return unwrapMcp(await response.json());
};
