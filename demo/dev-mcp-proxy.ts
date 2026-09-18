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
  // Used when no accessToken is supplied. An account created through Google has no
  // password set, and the backend answers that with the same "Invalid email or password"
  // as a wrong one, so pasting a token is the way in for such an account.
  email: string;
  password: string;
  // Skips the password step. Read from a signed-in browser session; it expires, and the
  // middleware reports that rather than silently falling back.
  accessToken: string;
  // All optional. The MCP host answered a live request on the bearer alone, so these only
  // narrow the read when the account's token spans more than one workspace.
  orgUuid: string;
  teamUuid: string;
  workspaceUuid: string;
}

interface Session {
  accessToken: string;
  orgUuid: string;
  contextToken: string;
}

// The organization bootstrap is best-effort: an account can have no organization at all
// (checked on 2026-09-18, where /organizations/ answered `[]` while the graph still
// loaded), so a failure here must not sink the request.
const tryOrgContext = async (
  env: McpProxyEnv,
  accessToken: string,
): Promise<{ orgUuid: string; contextToken: string }> => {
  const none = { orgUuid: "", contextToken: "" };
  const auth = { Authorization: `Bearer ${accessToken}` };
  try {
    let orgUuid = env.orgUuid;
    if (!orgUuid) {
      const orgResponse = await fetch(
        `${env.apiTarget}/api/v1/organizations/`,
        {
          headers: auth,
        },
      );
      if (!orgResponse.ok) return none;
      // `{ data: [{ uuid, name }] }`, per the schema the Axflow client parses this with.
      const list = asRecord(await orgResponse.json()).data;
      const first = Array.isArray(list) ? asRecord(list[0]) : {};
      orgUuid = typeof first.uuid === "string" ? first.uuid : "";
      if (!orgUuid) return none;
    }

    const contextResponse = await fetch(
      `${env.apiTarget}/api/v1/organizations/context-token?organization_uuid=${encodeURIComponent(orgUuid)}`,
      { method: "POST", headers: auth },
    );
    if (!contextResponse.ok) return { orgUuid, contextToken: "" };
    const payload = asRecord(await contextResponse.json()).data;
    return {
      orgUuid,
      contextToken: typeof payload === "string" ? payload : "",
    };
  } catch {
    return none;
  }
};

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

const acquireAccessToken = async (env: McpProxyEnv): Promise<string> => {
  if (env.accessToken) return env.accessToken;

  const loginResponse = await fetch(
    `${env.apiTarget}/api/v1/user/auth/password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.email, password: env.password }),
    },
  );
  if (!loginResponse.ok) {
    const detail = await loginResponse.text();
    const hint =
      loginResponse.status === 401
        ? " (an account created through Google has no password; set MCP_DEMO_ACCESS_TOKEN instead)"
        : "";
    throw new Error(`login failed: ${loginResponse.status} ${detail}${hint}`);
  }
  const token = readToken(await loginResponse.json());
  if (!token) throw new Error("login returned no access token");
  return token;
};

const login = async (env: McpProxyEnv): Promise<Session> => {
  const accessToken = await acquireAccessToken(env);
  const { orgUuid, contextToken } = await tryOrgContext(env, accessToken);
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
      // Only the headers that have a value: the host reads an empty X-Org-ID as a
      // request to scope to nothing rather than as an absent one.
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.accessToken}`,
        ...(current.orgUuid ? { "X-Org-ID": current.orgUuid } : {}),
        ...(current.contextToken
          ? { "X-Context-Token": current.contextToken }
          : {}),
        ...(env.teamUuid ? { "X-Team-Id": env.teamUuid } : {}),
        ...(env.workspaceUuid ? { "X-Workspace-Id": env.workspaceUuid } : {}),
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

    if (!env.accessToken && !(env.email && env.password)) {
      res.statusCode = 501;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          detail:
            "Set MCP_DEMO_ACCESS_TOKEN, or MCP_DEMO_EMAIL and MCP_DEMO_PASSWORD, in .env.local",
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
        if (env.accessToken) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              detail:
                "MCP_DEMO_ACCESS_TOKEN was rejected; it has most likely expired, so copy a fresh one",
            }),
          );
          return;
        }
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
