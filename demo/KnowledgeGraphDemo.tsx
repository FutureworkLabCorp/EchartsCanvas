import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  RelationGraphCanvas,
  createMockKnowledgeGraph,
  koGraphTypeStyles,
} from "../src";
import type { GraphData, GraphNode } from "../src";
import { fetchKnowledgeGraph } from "./api/knowledgeGraph";
import type { McpAuth } from "./api/mcp";

type Source = "mock" | "live";

const env = import.meta.env;

const envAuth = (): McpAuth => ({
  token: env["VITE_MCP_TOKEN"] ?? "",
  orgId: env["VITE_MCP_ORG_ID"],
  teamId: env["VITE_MCP_TEAM_ID"],
  workspaceId: env["VITE_MCP_WORKSPACE_ID"],
  contextToken: env["VITE_MCP_CONTEXT_TOKEN"],
});

const mockGraph = createMockKnowledgeGraph();

export const KnowledgeGraphDemo = () => {
  const [source, setSource] = useState<Source>("mock");
  const [graph, setGraph] = useState<GraphData>(mockGraph);
  const [token, setToken] = useState(() => envAuth().token);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // A pending request is abandoned when another starts or the view goes away, so a slow
  // graph pull cannot land on top of a newer one.
  useEffect(() => () => abortRef.current?.abort(), []);

  const loadLive = useCallback(async () => {
    if (!token) {
      setStatus("토큰을 입력하세요.");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setStatus(null);
    try {
      const data = await fetchKnowledgeGraph(
        { ...envAuth(), token },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setGraph(data);
      setSource("live");
      setSelected(null);
      setStatus(
        data.nodes.length === 0
          ? "응답은 왔지만 노드가 비어 있습니다. 워크스페이스 컨텍스트를 확인하세요."
          : null,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token]);

  const useMock = useCallback(() => {
    abortRef.current?.abort();
    setGraph(mockGraph);
    setSource("mock");
    setSelected(null);
    setStatus(null);
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 4px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="linkbrain 액세스 토큰"
          style={{ flex: "1 1 260px", padding: "6px 10px", fontSize: 13 }}
        />
        <button type="button" onClick={loadLive} disabled={loading}>
          {loading ? "불러오는 중…" : "실데이터 불러오기"}
        </button>
        <button type="button" onClick={useMock} disabled={loading}>
          목 데이터
        </button>
        <span style={{ fontSize: 12, opacity: 0.75 }}>
          {source === "live" ? "실데이터" : "목 데이터"} · 노드{" "}
          {graph.nodes.length} · 엣지 {graph.edges.length}
        </span>
      </div>

      {status && (
        <div style={{ fontSize: 12, padding: "0 4px 8px", color: "#f87171" }}>
          {status}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <Panel
          title="지식그래프"
          height="100%"
          extra={
            selected ? (
              <span style={{ fontSize: 12 }}>
                {koGraphTypeStyles[selected.type]?.label ?? selected.type} ·{" "}
                {selected.label}
              </span>
            ) : undefined
          }
        >
          <RelationGraphCanvas
            data={graph}
            typeStyles={koGraphTypeStyles}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            ariaLabel="지식그래프 관계도"
          />
        </Panel>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          fontSize: 12,
          padding: "10px 4px 0",
        }}
      >
        {Object.entries(koGraphTypeStyles).map(([key, style]) => (
          <span
            key={key}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: style.color,
              }}
            />
            {style.label}
          </span>
        ))}
      </div>
    </div>
  );
};
