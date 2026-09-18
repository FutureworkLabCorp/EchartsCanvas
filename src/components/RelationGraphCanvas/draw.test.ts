import { describe, expect, it } from "vitest";
import {
  collisionRadius,
  drawEdge,
  drawNode,
  edgeControlPoint,
  hitNode,
  measureLabel,
  nodeSize,
  pickLabelMode,
} from "./draw";
import type { RenderNode } from "./draw";
import { industrialLight } from "../../theme/presets";
import type { GraphTypeStyle } from "../../types/domain";

// jsdom has no canvas implementation, so the drawing is checked against a recorder: it
// proves the code paths run and what they asked the context to do, not how it looks.
interface Call {
  op: string;
  args: unknown[];
}

const recordingContext = (): {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
} => {
  const calls: Call[] = [];
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args });
    };

  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 7 }),
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arcTo: record("arcTo"),
    arc: record("arc"),
    quadraticCurveTo: record("quadraticCurveTo"),
    fill: record("fill"),
    stroke: record("stroke"),
    fillRect: record("fillRect"),
    fillText: record("fillText"),
    strokeText: record("strokeText"),
  };

  const ctx = new Proxy(target, {
    get: (obj, key) => obj[key as string],
    set: (obj, key, value) => {
      obj[key as string] = value;
      calls.push({ op: `set:${String(key)}`, args: [value] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, calls };
};

const style: GraphTypeStyle = {
  label: "문서",
  color: "#14b8a6",
  icon: "doc",
};

const makeRenderNode = (label = "화재안전기준"): RenderNode => {
  const node = { id: "n1", label, type: "DOCUMENT" };
  const size = nodeSize(node, style.label);
  return {
    id: node.id,
    node,
    x: 100,
    y: 50,
    vx: 0,
    vy: 0,
    width: size.width,
    height: size.height,
  };
};

describe("measureLabel", () => {
  it("counts a CJK glyph as wider than a latin one", () => {
    expect(measureLabel("가나다", 13)).toBeGreaterThan(measureLabel("abc", 13));
  });

  it("scales with the font size", () => {
    expect(measureLabel("abc", 26)).toBeCloseTo(measureLabel("abc", 13) * 2, 6);
  });
});

describe("nodeSize", () => {
  it("grows with the label but stops at the cap", () => {
    const short = nodeSize(
      { id: "a", label: "짧음", type: "DOCUMENT" },
      "문서",
    );
    const long = nodeSize(
      { id: "b", label: "아주 긴 라벨을 가진 노드", type: "DOCUMENT" },
      "문서",
    );
    const absurd = nodeSize(
      { id: "c", label: "가".repeat(400), type: "DOCUMENT" },
      "문서",
    );
    expect(long.width).toBeGreaterThan(short.width);
    expect(absurd.width).toBeLessThan(300);
  });

  it("keeps every card the same height", () => {
    const a = nodeSize({ id: "a", label: "x", type: "DOCUMENT" }, "문서");
    const b = nodeSize(
      { id: "b", label: "가".repeat(50), type: "ISSUE" },
      "이슈",
    );
    expect(a.height).toBe(b.height);
  });
});

describe("collisionRadius", () => {
  it("covers the card corner, not just its half-width", () => {
    const node = makeRenderNode();
    expect(collisionRadius(node)).toBeGreaterThan(node.width / 2);
  });
});

describe("pickLabelMode", () => {
  it("degrades from card to pill to dot as the view zooms out", () => {
    expect(pickLabelMode(1)).toBe("card");
    expect(pickLabelMode(0.5)).toBe("pill");
    expect(pickLabelMode(0.2)).toBe("dot");
  });
});

describe("drawNode", () => {
  it("draws the type label and the node label on a card", () => {
    const { ctx, calls } = recordingContext();
    drawNode(ctx, makeRenderNode(), {
      theme: industrialLight,
      style,
      mode: "card",
      selected: false,
      hovered: false,
      dimmed: false,
    });
    const texts = calls
      .filter((call) => call.op === "fillText")
      .map((call) => call.args[0]);
    expect(texts).toContain("문서");
    expect(texts).toContain("화재안전기준");
  });

  it("writes no text at all in dot mode", () => {
    const { ctx, calls } = recordingContext();
    drawNode(ctx, makeRenderNode(), {
      theme: industrialLight,
      style,
      mode: "dot",
      selected: false,
      hovered: false,
      dimmed: false,
    });
    expect(calls.some((call) => call.op === "fillText")).toBe(false);
    expect(calls.some((call) => call.op === "arc")).toBe(true);
  });

  it("restores the context exactly as often as it saves it", () => {
    for (const mode of ["dot", "pill", "card"] as const) {
      const { ctx, calls } = recordingContext();
      drawNode(ctx, makeRenderNode(), {
        theme: industrialLight,
        style,
        mode,
        selected: true,
        hovered: true,
        dimmed: true,
      });
      const saves = calls.filter((call) => call.op === "save").length;
      const restores = calls.filter((call) => call.op === "restore").length;
      expect(`${mode}:${saves}`).toBe(`${mode}:${restores}`);
    }
  });

  it("clears the shadow before drawing text, so glyphs stay crisp", () => {
    const { ctx, calls } = recordingContext();
    drawNode(ctx, makeRenderNode(), {
      theme: industrialLight,
      style,
      mode: "card",
      selected: false,
      hovered: false,
      dimmed: false,
    });
    const clearedAt = calls.findIndex(
      (call) => call.op === "set:shadowColor" && call.args[0] === "transparent",
    );
    const firstText = calls.findIndex((call) => call.op === "fillText");
    expect(clearedAt).toBeGreaterThanOrEqual(0);
    expect(clearedAt).toBeLessThan(firstText);
  });
});

describe("drawEdge", () => {
  it("bows the curve off the straight line between the two nodes", () => {
    const a = { ...makeRenderNode(), x: 0, y: 0 };
    const b = { ...makeRenderNode(), x: 100, y: 0 };
    const { cx, cy } = edgeControlPoint(a, b, 0.12);
    expect(cx).toBeCloseTo(50, 6);
    expect(cy).not.toBeCloseTo(0, 3);

    const { ctx, calls } = recordingContext();
    drawEdge(ctx, a, b, "#ccc", 1, 0.12);
    expect(calls.some((call) => call.op === "quadraticCurveTo")).toBe(true);
  });

  it("puts a reciprocal pair on opposite sides of the straight line", () => {
    const a = { ...makeRenderNode(), x: 0, y: 0 };
    const b = { ...makeRenderNode(), x: 100, y: 0 };
    const forward = edgeControlPoint(a, b, 0.12);
    const backward = edgeControlPoint(b, a, 0.12);
    expect(Math.sign(forward.cy)).toBe(-Math.sign(backward.cy));
  });
});

describe("hitNode", () => {
  it("accepts a point inside the card and rejects one outside", () => {
    const node = makeRenderNode();
    expect(hitNode(node, node.x, node.y, "card")).toBe(true);
    expect(hitNode(node, node.x + node.width, node.y, "card")).toBe(false);
  });

  it("uses a small circle in dot mode rather than the card bounds", () => {
    const node = makeRenderNode();
    expect(hitNode(node, node.x + 4, node.y, "dot")).toBe(true);
    expect(hitNode(node, node.x + 40, node.y, "dot")).toBe(false);
  });
});
