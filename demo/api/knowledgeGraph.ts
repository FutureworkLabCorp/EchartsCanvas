import { callMcpTool } from "./mcp";
import type { GraphData, GraphEdge, GraphNode } from "../../src";

// This file is the normalizer the architecture doc calls for: everything the backend
// shape implies stops here, and the component below it only ever sees GraphData.
//
// Shapes checked against AxFlow's own mapping in
// packages/core/src/domains/knowledge-graph/lib/mcp.ts.

// The backend labels entities in Korean and with a wider vocabulary than the six types
// the legend shows, so the adapter folds them down. Copied from the Axflow client's own
// table (knowledge-graph/model/node-mapping.ts), which marks it provisional until the
// finalized i18n table lands. Verified against a live pull on 2026-09-18, which carried
// 16 distinct entity_type values across 439 nodes.
const KOREAN_ENTITY_TYPE: Record<string, string> = {
  역할: "WORKER",
  조직: "WORKER",
  장비: "EQUIPMENT",
  절차단계: "PROCESS",
  조건: "PROCESS",
  장소: "PROCESS",
  소모품: "MATERIAL",
  문서: "DOCUMENT",
  규칙: "DOCUMENT",
  주의사항: "DOCUMENT",
  규격: "DOCUMENT",
  판정기준: "DOCUMENT",
  증상: "ISSUE",
  장애: "ISSUE",
  인과요인: "ISSUE",
};

const KNOWN_TYPES = new Set([
  "ISSUE",
  "EQUIPMENT",
  "PROCESS",
  "MATERIAL",
  "DOCUMENT",
  "WORKER",
]);

// Anything unrecognised becomes PROCESS rather than a seventh legend entry. `장학금`
// reaches this in the live data today.
const FALLBACK_TYPE = "PROCESS";

export const coerceNodeType = (input: string): string => {
  const trimmed = input.trim();
  if (KNOWN_TYPES.has(trimmed.toUpperCase())) return trimmed.toUpperCase();
  if (trimmed === "STANDARD") return "DOCUMENT";
  return KOREAN_ENTITY_TYPE[trimmed] ?? FALLBACK_TYPE;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

// Ids arrive as `entity:<url-encoded name>` on some tools and bare on others.
export const normalizeEntityId = (raw: unknown): string => {
  if (typeof raw !== "string") return "";
  if (!raw.startsWith("entity:")) return raw;
  const rest = raw.slice("entity:".length);
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
};

const readString = (
  record: Record<string, unknown>,
  ...keys: string[]
): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
};

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// The node's own fields may sit at the top level or under `properties`, depending on
// which tool produced them.
const propsOf = (record: Record<string, unknown>): Record<string, unknown> =>
  isRecord(record.properties) ? record.properties : record;

const mapNode = (raw: Record<string, unknown>): GraphNode | null => {
  const props = propsOf(raw);
  const id = normalizeEntityId(
    readString(raw, "id") || readString(props, "entity_name", "entityName"),
  );
  if (!id) return null;
  const label =
    readString(props, "entity_name", "entityName", "label", "name") || id;
  return {
    id,
    label,
    type: coerceNodeType(readString(props, "entity_type", "entityType")),
  };
};

const mapEdge = (raw: Record<string, unknown>): GraphEdge | null => {
  const source = normalizeEntityId(raw.source);
  const target = normalizeEntityId(raw.target);
  if (!source || !target) return null;
  const props = propsOf(raw);
  // The live payload carries `confidence` (0.7 to 0.99 in the pull checked on
  // 2026-09-18) and no `weight`; both are read because AxFlow's client reads both.
  const weight = readNumber(props.weight) ?? readNumber(props.confidence);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `${source}->${target}`,
    source,
    target,
    // Clamped because the renderer maps this straight onto stroke width, and the
    // 0..1 range is this adapter's assumption about the field, not a checked contract.
    ...(weight === null ? {} : { weight: Math.min(1, Math.max(0, weight)) }),
  };
};

export const mapKnowledgeGraph = (raw: unknown): GraphData => {
  if (!isRecord(raw)) return { nodes: [], edges: [] };

  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
    .filter(isRecord)
    .map(mapNode)
    .filter((node): node is GraphNode => node !== null);

  // An edge naming a node outside this payload would render as a line to nowhere.
  const known = new Set(nodes.map((node) => node.id));
  const edges = (Array.isArray(raw.edges) ? raw.edges : [])
    .filter(isRecord)
    .map(mapEdge)
    .filter(
      (edge): edge is GraphEdge =>
        edge !== null && known.has(edge.source) && known.has(edge.target),
    );

  return { nodes, edges };
};

export interface FetchKnowledgeGraphOptions {
  // `'*'` is the whole graph; a list of entity ids returns the sub-graph anchored on them.
  label?: "*" | readonly string[];
  docIds?: readonly string[];
  signal?: AbortSignal;
}

export const fetchKnowledgeGraph = async ({
  label = "*",
  docIds,
  signal,
}: FetchKnowledgeGraphOptions = {}): Promise<GraphData> => {
  const raw = await callMcpTool(
    "rag/get_knowledge_graph",
    {
      label: label === "*" ? "*" : [...label],
      ...(docIds && docIds.length > 0 ? { docIds: [...docIds] } : {}),
    },
    signal,
  );
  return mapKnowledgeGraph(raw);
};
