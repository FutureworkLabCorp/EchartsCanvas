import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { mapKnowledgeGraph, coerceNodeType } from "./knowledgeGraph";
import { unwrapMcp } from "./mcp";

// A capture of one live response, kept out of the repo. Present only on a machine that
// has pulled one; elsewhere these checks skip rather than fail.
const CAPTURE = "/tmp/kg4.json";

describe("coerceNodeType", () => {
  it("folds the Korean entity types onto the six the legend shows", () => {
    expect(coerceNodeType("문서")).toBe("DOCUMENT");
    expect(coerceNodeType("역할")).toBe("WORKER");
    expect(coerceNodeType("절차단계")).toBe("PROCESS");
    expect(coerceNodeType("장비")).toBe("EQUIPMENT");
    expect(coerceNodeType("소모품")).toBe("MATERIAL");
    expect(coerceNodeType("장애")).toBe("ISSUE");
  });

  it("passes the English enum through and falls back for anything else", () => {
    expect(coerceNodeType("DOCUMENT")).toBe("DOCUMENT");
    expect(coerceNodeType("STANDARD")).toBe("DOCUMENT");
    expect(coerceNodeType("장학금")).toBe("PROCESS");
    expect(coerceNodeType("")).toBe("PROCESS");
  });
});

describe.skipIf(!existsSync(CAPTURE))(
  "mapKnowledgeGraph against a live capture",
  () => {
    const graph = mapKnowledgeGraph(
      unwrapMcp(JSON.parse(readFileSync(CAPTURE, "utf8"))),
    );

    it("keeps every node and edge the payload carried", () => {
      expect(graph.nodes.length).toBe(439);
      expect(graph.edges.length).toBe(352);
    });

    it("strips the entity: prefix from every id", () => {
      expect(graph.nodes.some((node) => node.id.startsWith("entity:"))).toBe(
        false,
      );
    });

    it("gives every node a non-empty label", () => {
      expect(graph.nodes.every((node) => node.label.length > 0)).toBe(true);
    });

    it("emits only the six legend types", () => {
      const types = new Set(graph.nodes.map((node) => node.type));
      expect([...types].sort()).toEqual(
        [
          "DOCUMENT",
          "EQUIPMENT",
          "ISSUE",
          "MATERIAL",
          "PROCESS",
          "WORKER",
        ].filter((type) => types.has(type)),
      );
    });

    it("reads confidence as a 0..1 weight on every edge", () => {
      const weights = graph.edges.map((edge) => edge.weight);
      expect(
        weights.every((w) => typeof w === "number" && w >= 0 && w <= 1),
      ).toBe(true);
    });

    it("leaves no edge pointing at a node the payload did not carry", () => {
      const ids = new Set(graph.nodes.map((node) => node.id));
      expect(
        graph.edges.every(
          (edge) => ids.has(edge.source) && ids.has(edge.target),
        ),
      ).toBe(true);
    });
  },
);
