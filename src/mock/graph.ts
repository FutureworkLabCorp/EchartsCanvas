import { createRandom } from "./random";
import type { GraphData, GraphTypeStyle } from "../types/domain";

// The six node types the linkbrain knowledge graph returns. Uppercase because that is
// what the payload carries; the component treats the value as an opaque key.
export const GRAPH_NODE_TYPES = [
  "ISSUE",
  "EQUIPMENT",
  "PROCESS",
  "MATERIAL",
  "DOCUMENT",
  "WORKER",
] as const;

export type MockNodeType = (typeof GRAPH_NODE_TYPES)[number];

// Sample copy and colours for the demo and the stories, the same way koStatusLabels is.
// A consuming app supplies its own, resolved from its design tokens.
export const koGraphTypeStyles: Record<string, GraphTypeStyle> = {
  ISSUE: { label: "이슈", color: "#ef4444", icon: "alert" },
  EQUIPMENT: { label: "장비", color: "#7c3aed", icon: "gear" },
  PROCESS: { label: "공정", color: "#eab308", icon: "flow" },
  MATERIAL: { label: "원자재", color: "#2563eb", icon: "layers" },
  DOCUMENT: { label: "문서", color: "#14b8a6", icon: "doc" },
  WORKER: { label: "작업자", color: "#6b7280", icon: "person" },
};

const LABELS: Record<MockNodeType, string[]> = {
  ISSUE: ["미등록", "계산 문제", "화재 관련 재해", "서류 누락", "기한 초과"],
  EQUIPMENT: ["팩스", "소화 설비", "우편", "스프링클러", "감지기", "제연 설비"],
  PROCESS: [
    "건축물",
    "배관 설계",
    "입학시험",
    "화상면접",
    "연소론",
    "용어 숙달",
    "위험물",
    "공식 복습법",
    "방화 안전관리 감독",
    "소방시설 공사 시공 및 관리",
    "투자유치 역량 강화 프로그램",
  ],
  MATERIAL: ["신분증", "본인 식별 사진", "인감", "증빙 서류"],
  DOCUMENT: [
    "소방공무원 가산점 최대 5%",
    "소방설비기사 (기계분야)",
    "학업계획서",
    "7·9급 공무원 가산점",
    "화재안전기준",
    "건축설비공학",
    "사업계획서",
    "졸업 여부",
    "전공 분야",
    "정식 학위",
    "학습전략",
    "기계 설비학",
    "공조 냉동학",
    "가스 냉동학",
    "합격수기",
    "개정 내용 확인",
    "학위수여증명서",
    "자동차운전면허증",
    "졸업증명서",
    "성적증명서",
    "소방전기시설의 구조 및 원리",
    "베르누이 방정식",
    "원본 제시",
    "소방설비기사, 알고가기",
  ],
  WORKER: [
    "유도회 회원",
    "국가전략대학원",
    "정치외교학과",
    "교무처장",
    "첨단국방대학원 지원자",
    "글로벌창업대학원 지원자",
    "한국산업인력공단",
    "정부기관 공무원",
    "수험생",
    "강동구 교수",
    "전기공사",
    "기술자격소지자",
  ],
};

// Mirrors the shape of a real pull: more nodes than edges, so a good share of the graph
// sits unconnected at the rim rather than every node landing in one dense ball.
export interface MockGraphOptions {
  nodeCount?: number;
  edgeCount?: number;
  seed?: number;
}

export const createMockKnowledgeGraph = ({
  nodeCount = 439,
  edgeCount = 352,
  seed = 20260918,
}: MockGraphOptions = {}): GraphData => {
  const random = createRandom(seed);

  // Weighted so documents dominate, which is what a document-derived graph looks like.
  const weights: Array<[MockNodeType, number]> = [
    ["DOCUMENT", 0.42],
    ["PROCESS", 0.2],
    ["WORKER", 0.18],
    ["EQUIPMENT", 0.1],
    ["ISSUE", 0.06],
    ["MATERIAL", 0.04],
  ];
  const pickType = (): MockNodeType => {
    let roll = random();
    for (const [type, weight] of weights) {
      roll -= weight;
      if (roll <= 0) return type;
    }
    return "DOCUMENT";
  };

  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const type = pickType();
    const pool = LABELS[type];
    const base = pool[Math.floor(random() * pool.length)] ?? type;
    // Suffixed past the first use so repeated sample labels stay distinguishable.
    const seen = index % pool.length;
    return {
      id: `n${index}`,
      type,
      label: seen === 0 && index >= pool.length ? `${base} ${index}` : base,
    };
  });

  const edges = [];
  const used = new Set<string>();
  let attempts = 0;
  while (edges.length < edgeCount && attempts < edgeCount * 20) {
    attempts += 1;
    const a = Math.floor(random() * nodeCount);
    // Biased towards a nearby index so the graph forms clusters instead of a uniform mesh.
    const spread = Math.floor((random() - 0.5) * 40);
    const b = Math.min(nodeCount - 1, Math.max(0, a + spread));
    if (a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (used.has(key)) continue;
    used.add(key);
    edges.push({
      id: `e${edges.length}`,
      source: `n${a}`,
      target: `n${b}`,
      weight: Number(random().toFixed(2)),
    });
  }

  return { nodes, edges };
};
