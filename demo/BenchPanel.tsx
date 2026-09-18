import { useCallback, useRef, useState } from "react";
import {
  RelationGraphCanvas,
  ThemeProvider,
  axflowGraphTypeStyles,
  axflowLight,
  createMockKnowledgeGraph,
} from "../src";
import type { GraphData } from "../src";

// Measures the two things a Node benchmark cannot: what a frame costs once the layout is
// at rest, and what the page holds while it stays mounted. Both are read from the same
// browser APIs Lighthouse reports from, so the numbers are comparable to a Lighthouse run
// on this page.

interface Sample {
  label: string;
  nodes: number;
  edges: number;
  layoutMs: number;
  frameP50: number;
  frameP95: number;
  heapMb: number | null;
}

const SIZES: Array<[number, number]> = [
  [439, 352],
  [1000, 800],
  [2000, 1600],
];

// Non-standard and Chromium-only, and it reports the whole JS heap rather than this
// component's share, so it is a trend line across sizes and not an attribution.
const heapMb = (): number | null => {
  const memory = (
    performance as Performance & { memory?: { usedJSHeapSize: number } }
  ).memory;
  return memory ? memory.usedJSHeapSize / 1024 / 1024 : null;
};

const percentile = (sorted: number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

export const BenchPanel = () => {
  const [graph, setGraph] = useState<GraphData>(() =>
    createMockKnowledgeGraph({ nodeCount: 439, edgeCount: 352 }),
  );
  const [samples, setSamples] = useState<Sample[]>([]);
  const [running, setRunning] = useState(false);
  const frameTimes = useRef<number[]>([]);
  const recording = useRef(false);

  // Frames are timed from rAF to rAF while the canvas is being panned, which is when the
  // draw pass actually runs: the component is on-demand, so an idle graph draws nothing.
  const recordFrames = useCallback(
    (durationMs: number): Promise<number[]> =>
      new Promise((resolve) => {
        frameTimes.current = [];
        recording.current = true;
        let previous = performance.now();
        const started = previous;

        const step = (now: number): void => {
          frameTimes.current.push(now - previous);
          previous = now;
          if (now - started < durationMs) {
            requestAnimationFrame(step);
          } else {
            recording.current = false;
            resolve(frameTimes.current.slice(1));
          }
        };
        requestAnimationFrame(step);
      }),
    [],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setSamples([]);
    const collected: Sample[] = [];

    for (const [nodeCount, edgeCount] of SIZES) {
      const data = createMockKnowledgeGraph({ nodeCount, edgeCount });

      // Mounting the component runs the layout synchronously, so the wall time around
      // the state change is the layout cost as a viewer experiences it.
      const started = performance.now();
      setGraph(data);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const layoutMs = performance.now() - started;

      const frames = (await recordFrames(2000)).sort((a, b) => a - b);
      collected.push({
        label: `${nodeCount}`,
        nodes: data.nodes.length,
        edges: data.edges.length,
        layoutMs,
        frameP50: percentile(frames, 0.5),
        frameP95: percentile(frames, 0.95),
        heapMb: heapMb(),
      });
      setSamples([...collected]);
    }

    setRunning(false);
  }, [recordFrames]);

  return (
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
        <button type="button" onClick={() => void run()} disabled={running}>
          {running ? "측정 중…" : "측정 시작"}
        </button>
        <span style={{ opacity: 0.75 }}>
          레이아웃 시간 · 프레임 타임(p50/p95) · JS 힙
        </span>
      </div>

      {samples.length > 0 && (
        <table
          style={{
            fontSize: 12,
            borderCollapse: "collapse",
            margin: "0 4px 10px",
          }}
        >
          <thead>
            <tr>
              {["노드", "엣지", "레이아웃", "프레임 p50", "p95", "힙"].map(
                (head) => (
                  <th
                    key={head}
                    style={{
                      textAlign: "right",
                      padding: "4px 12px",
                      borderBottom: `1px solid ${axflowLight.palette.border}`,
                    }}
                  >
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {samples.map((sample) => (
              <tr key={sample.label}>
                <td style={{ textAlign: "right", padding: "4px 12px" }}>
                  {sample.nodes}
                </td>
                <td style={{ textAlign: "right", padding: "4px 12px" }}>
                  {sample.edges}
                </td>
                <td style={{ textAlign: "right", padding: "4px 12px" }}>
                  {sample.layoutMs.toFixed(0)}ms
                </td>
                <td style={{ textAlign: "right", padding: "4px 12px" }}>
                  {sample.frameP50.toFixed(1)}ms
                </td>
                <td style={{ textAlign: "right", padding: "4px 12px" }}>
                  {sample.frameP95.toFixed(1)}ms
                </td>
                <td style={{ textAlign: "right", padding: "4px 12px" }}>
                  {sample.heapMb === null
                    ? "—"
                    : `${sample.heapMb.toFixed(0)}MB`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <RelationGraphCanvas
          data={graph}
          typeStyles={axflowGraphTypeStyles}
          ariaLabel="성능 측정용 관계 그래프"
        />
      </div>
    </ThemeProvider>
  );
};
