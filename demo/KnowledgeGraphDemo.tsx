import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  RelationGraphCanvas,
  ThemeProvider,
  axflowGraphTypeStyles,
  axflowLight,
  createMockKnowledgeGraph,
} from "../src";
import type { GraphData, GraphNode } from "../src";
import { fetchKnowledgeGraph } from "./api/knowledgeGraph";

type Source = "loading" | "live" | "mock";

const mockGraph = createMockKnowledgeGraph();

export const KnowledgeGraphDemo = () => {
  const [source, setSource] = useState<Source>("loading");
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSource("loading");
    setStatus(null);
    try {
      const data = await fetchKnowledgeGraph({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setGraph(data);
      setSelected(null);
      if (data.nodes.length === 0) {
        // The host answers an unknown tenant with an empty graph rather than an error,
        // so this is the only signal that the key reached the wrong workspace.
        setSource("mock");
        setGraph(mockGraph);
        setStatus("응답은 왔지만 노드가 비어 있어 목 데이터로 대체했습니다.");
        return;
      }
      setSource("live");
    } catch (error) {
      if (controller.signal.aborted) return;
      setGraph(mockGraph);
      setSource("mock");
      setStatus(
        `${error instanceof Error ? error.message : String(error)} — 목 데이터로 대체했습니다.`,
      );
    }
  }, []);

  // Connects on mount: the dev proxy attaches the credential, so there is nothing for the
  // page to collect first.
  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return (
    // Scoped to this view: the dashboard beside it keeps its own theme, and nesting the
    // provider is what a host swapping one panel's palette would do.
    <ThemeProvider
      theme={axflowLight}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: axflowLight.palette.background,
        color: axflowLight.palette.textPrimary,
        fontFamily: axflowLight.font.family,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          padding: "8px 4px",
          fontSize: 12,
        }}
      >
        <button
          type="button"
          onClick={() => void load()}
          disabled={source === "loading"}
        >
          {source === "loading" ? "불러오는 중…" : "다시 불러오기"}
        </button>
        <span style={{ opacity: 0.75 }}>
          {source === "live"
            ? "ncpapidev 실데이터"
            : source === "mock"
              ? "목 데이터"
              : "연결 중"}{" "}
          · 노드 {graph.nodes.length} · 엣지 {graph.edges.length}
        </span>
      </div>

      {status && (
        <div style={{ fontSize: 12, padding: "0 4px 8px", color: "#f59e0b" }}>
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
                {axflowGraphTypeStyles[selected.type]?.label ?? selected.type} ·{" "}
                {selected.label}
              </span>
            ) : undefined
          }
        >
          <RelationGraphCanvas
            data={graph}
            typeStyles={axflowGraphTypeStyles}
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
        {Object.entries(axflowGraphTypeStyles).map(([key, style]) => (
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
    </ThemeProvider>
  );
};
