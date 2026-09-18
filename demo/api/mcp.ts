// The demo owns every network call. The library never fetches — it takes GraphData as a
// prop — so this layer, the transport and the mapping beside it, sits outside src/ and
// ships with nothing.

// Same-origin. The Vite dev proxy forwards /mcpapi/* to the MCP host and attaches the
// API key there, so no credential is ever present in the browser and no CORS grant is
// needed on the host.
const MCP_PREFIX = "/mcpapi";

export class McpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "McpError";
  }
}

// The MCP host answers tools in an envelope: the payload arrives as a JSON string under
// content[0].text, or directly under `result`/`data` depending on the tool. Something
// that is already the payload passes through.
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

const readErrorDetail = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();
    if (!text) return response.statusText;
    try {
      const detail = (JSON.parse(text) as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail) return detail;
    } catch {
      // Not JSON; the raw text is the best description available.
    }
    return text.slice(0, 300);
  } catch {
    return response.statusText;
  }
};

export const callMcpTool = async (
  tool: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch(`${MCP_PREFIX}/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    // Both the dev middleware and the upstream report why in a FastAPI-style `detail`,
    // and the status alone ("501") says nothing a reader can act on.
    throw new McpError(
      `${tool} failed: ${response.status} ${await readErrorDetail(response)}`,
      response.status,
    );
  }
  return unwrapMcp(await response.json());
};
