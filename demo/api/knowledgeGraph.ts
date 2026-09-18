import { callMcpTool } from "./mcp";
import type { McpAuth } from "./mcp";
import type { GraphData, GraphEdge, GraphNode } from "../../src";

// This file is the normalizer the architecture doc calls for: everything the backend
// shape implies stops here, and the component below it only ever sees GraphData.
//
// Shapes checked against AxFlow's own mapping in
// packages/core/src/domains/knowledge-graph/lib/mcp.ts.

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
  // Upper-cased so the typeStyles lookup does not depend on the casing the host used.
  const type =
    readString(props, "entity_type", "entityType").toUpperCase() || "DOCUMENT";
  return { id, label, type };
};

const mapEdge = (raw: Record<string, unknown>): GraphEdge | null => {
  const source = normalizeEntityId(raw.source);
  const target = normalizeEntityId(raw.target);
  if (!source || !target) return null;
  const props = propsOf(raw);
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

export const fetchKnowledgeGraph = async (
  auth: McpAuth,
  { label = "*", docIds, signal }: FetchKnowledgeGraphOptions = {},
): Promise<GraphData> => {
  const raw = await callMcpTool(
    "rag/get_knowledge_graph",
    {
      label: label === "*" ? "*" : [...label],
      ...(docIds && docIds.length > 0 ? { docIds: [...docIds] } : {}),
    },
    auth,
    signal,
  );
  return mapKnowledgeGraph(raw);
};
