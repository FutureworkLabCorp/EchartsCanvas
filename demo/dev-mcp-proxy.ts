import type { IncomingMessage, ServerResponse } from "node:http";

// Dev-server-only. The demo page calls same-origin /mcpapi/* with no credential of its
// own; this middleware signs in against the linkbrain API and forwards the call with the
// headers the MCP host wants.
//
// It lives here, not in the proxy `configure` hook, because signing in is asynchronous
// and that hook is not. It also keeps the credentials out of the browser: the variables
// below carry no VITE_ prefix, so Vite never puts them in the client bundle.
//
// Chain, mirroring what the Axflow app does:
//   POST /api/v1/user/auth/password      { email, password }       -> accessToken
//   GET  /api/v1/organizations/                                    -> orgUuid
//   POST /api/v1/organizations/context-token?organization_uuid=…   -> contextToken
//   POST /mcpapi/*   with Bearer accessToken + X-Org-ID + X-Context-Token

export interface McpProxyEnv {
  apiTarget: string;
  mcpTarget: string;
  email: string;
  password: string;
  orgUuid: string;
}

interface Session {
  accessToken: string;
  orgUuid: string;
  contextToken: string;
}

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const readToken = (payload: unknown): string => {
  const record = asRecord(payload);
  const direct = record.accessToken ?? record.access_token;
  if (typeof direct === "string" && direct) return direct;
  // Some responses nest the session one level down under `data`.
  const nested = asRecord(record.data);
  const inner = nested.accessToken ?? nested.access_token;
  return typeof inner === "string" ? inner : "";
};

const login = async (env: McpProxyEnv): Promise<Session> => {
  const loginResponse = await fetch(
    `${env.apiTarget}/api/v1/user/auth/password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.email, password: env.password }),
    },
  );
  if (!loginResponse.ok) {
    throw new Error(
      `login failed: ${loginResponse.status} ${await loginResponse.text()}`,
    );
  }
  const accessToken = readToken(await loginResponse.json());
  if (!accessToken) throw new Error("login returned no access token");

  const auth = { Authorization: `Bearer ${accessToken}` };

  let orgUuid = env.orgUuid;
  if (!orgUuid) {
    const orgResponse = await fetch(`${env.apiTarget}/api/v1/organizations/`, {
      headers: auth,
    });
    if (!orgResponse.ok) {
      throw new Error(`organizations failed: ${orgResponse.status}`);
    }
    const list = asRecord(await orgResponse.json()).data;
    // `{ data: [{ uuid, name }] }`, per the schema the Axflow client parses this with.
    // The first organization is the demo's, unless MCP_DEMO_ORG_UUID names another.
    const first = Array.isArray(list) ? asRecord(list[0]) : {};
    orgUuid = typeof first.uuid === "string" ? first.uuid : "";
    if (!orgUuid) throw new Error("no organization available for this account");
  }

  const contextResponse = await fetch(
    `${env.apiTarget}/api/v1/organizations/context-token?organization_uuid=${encodeURIComponent(orgUuid)}`,
    { method: "POST", headers: auth },
  );
  if (!contextResponse.ok) {
    throw new Error(`context-token failed: ${contextResponse.status}`);
  }
  const contextPayload = asRecord(await contextResponse.json()).data;
  const contextToken = typeof contextPayload === "string" ? contextPayload : "";
  if (!contextToken) throw new Error("context-token returned no token");

  return { accessToken, orgUuid, contextToken };
};

export const createMcpMiddleware = (env: McpProxyEnv) => {
  let session: Session | null = null;
  let pending: Promise<Session> | null = null;

  // Single-flight: several panels mounting at once must not each start a login.
  const ensureSession = async (force: boolean): Promise<Session> => {
    if (force) session = null;
    if (session) return session;
    pending ??= login(env).finally(() => {
      pending = null;
    });
    session = await pending;
    return session;
  };

  const forward = async (
    path: string,
    body: string,
    current: Session,
  ): Promise<Response> =>
    fetch(`${env.mcpTarget}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.accessToken}`,
        "X-Org-ID": current.orgUuid,
        "X-Context-Token": current.contextToken,
      },
      body,
    });

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> => {
    const path = req.url ?? "";
    if (!path.startsWith("/mcpapi/")) {
      next();
      return;
    }

    if (!env.email || !env.password) {
      res.statusCode = 501;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          detail:
            "MCP_DEMO_EMAIL / MCP_DEMO_PASSWORD are not set; add them to .env.local",
        }),
      );
      return;
    }

    try {
      const body = await readBody(req);
      let current = await ensureSession(false);
      let upstream = await forward(path, body, current);

      // A cached session outlives its token, and the only way to find out is to be
      // refused, so one refusal buys exactly one fresh login and retry.
      if (upstream.status === 401 || upstream.status === 403) {
        current = await ensureSession(true);
        upstream = await forward(path, body, current);
      }

      res.statusCode = upstream.status;
      res.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/json",
      );
      res.end(await upstream.text());
    } catch (error) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };
};
