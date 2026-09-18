import type { EquipmentStatus, FactoryLayout } from "../types/domain";
import { createRandom } from "./random";

export function createMockFactoryLayout(): FactoryLayout {
  const equipments = [
    { id: "PRESS-01", name: "프레스 #1", x: 80, y: 90, type: "press" },
    { id: "PRESS-02", name: "프레스 #2", x: 240, y: 90, type: "press" },
    { id: "WELD-01", name: "용접 #1", x: 400, y: 90, type: "welder" },
    { id: "WELD-02", name: "용접 #2", x: 560, y: 90, type: "welder" },
    { id: "CNC-01", name: "CNC #1", x: 80, y: 300, type: "cnc" },
    { id: "CNC-02", name: "CNC #2", x: 240, y: 300, type: "cnc" },
    { id: "ROBOT-01", name: "로봇암 #1", x: 400, y: 300, type: "robot" },
    { id: "ROBOT-02", name: "로봇암 #2", x: 560, y: 300, type: "robot" },
    { id: "AOI-01", name: "AOI 검사기", x: 780, y: 150, type: "inspection" },
    { id: "PACK-01", name: "포장 #1", x: 780, y: 320, type: "packing" },
  ] as const;

  const statuses: EquipmentStatus[] = [
    "normal",
    "normal",
    "warning",
    "normal",
    "normal",
    "critical",
    "normal",
    "idle",
    "normal",
    "maintenance",
  ];

  const random = createRandom(7);

  return {
    width: 960,
    height: 480,
    gridSize: 40,
    zones: [
      {
        id: "zone-a",
        name: "A 라인 · 성형/용접",
        x: 50,
        y: 60,
        width: 680,
        height: 140,
      },
      {
        id: "zone-b",
        name: "B 라인 · 가공/조립",
        x: 50,
        y: 270,
        width: 680,
        height: 140,
      },
      {
        id: "zone-c",
        name: "검사 · 포장",
        x: 750,
        y: 60,
        width: 170,
        height: 350,
      },
    ],
    conveyors: [
      {
        id: "conv-a",
        direction: 1,
        points: [
          { x: 60, y: 230 },
          { x: 700, y: 230 },
          { x: 700, y: 200 },
          { x: 830, y: 200 },
        ],
      },
      {
        id: "conv-b",
        direction: 1,
        points: [
          { x: 60, y: 440 },
          { x: 700, y: 440 },
          { x: 700, y: 380 },
          { x: 830, y: 380 },
        ],
      },
    ],
    equipments: equipments.map((item, index) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      x: item.x,
      y: item.y,
      width: 120,
      height: 70,
      status: statuses[index] ?? "normal",
      metrics: {
        온도: `${(60 + random() * 25).toFixed(1)}℃`,
        진동: `${(0.4 + random() * 1.6).toFixed(2)}mm/s`,
        가동률: `${(70 + random() * 28).toFixed(1)}%`,
      },
    })),
  };
}

// Flips equipment status on a timer. The returned function clears it.
export function simulateStatusChanges(
  equipmentIds: string[],
  onChange: (statuses: Record<string, EquipmentStatus>) => void,
  intervalMs = 4000,
  seed = 42,
): () => void {
  const random = createRandom(seed);
  const pool: EquipmentStatus[] = [
    "normal",
    "normal",
    "normal",
    "warning",
    "critical",
    "idle",
  ];
  const statuses: Record<string, EquipmentStatus> = {};

  const timer = setInterval(() => {
    const target = equipmentIds[Math.floor(random() * equipmentIds.length)];
    if (!target) return;
    statuses[target] = pool[Math.floor(random() * pool.length)] ?? "normal";
    onChange({ ...statuses });
  }, intervalMs);

  return () => clearInterval(timer);
}
