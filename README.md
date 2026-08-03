# @ax/viz-kit — 공통 시각화 컴포넌트 프레임워크

제조 AX 산단 **온프레미스 솔루션** 전반에 범용으로 사용하는 실시간 대용량 시각화 공통 컴포넌트 라이브러리입니다.
**ECharts(Canvas) + Pure HTML5 Canvas 하이브리드 코어** 위에, 설정(Configuration)만으로 설비 데이터와 2D 레이아웃 화면을 구성할 수 있도록 설계했습니다.

- 24시간 연속 구동을 전제로 한 **자동 라이프사이클 / 메모리 관리**
- 고주파 센서 데이터를 위한 **공통 데이터 버퍼링 파이프라인**
- 관제센터·현장 키오스크용 **Industrial Dark 테마** 기본 탑재 + 커스텀 테마 주입
- 컴포넌트 간 결합도를 낮추는 **Event Bus + 중앙 Store** 구조

---

## 1. 빠른 시작

```bash
pnpm install

pnpm dev              # 통합 대시보드 데모 (http://localhost:5173)
pnpm storybook        # 컴포넌트 카탈로그 (http://localhost:6006)
pnpm test             # 코어 모듈 단위 테스트 (Vitest)
pnpm typecheck        # 타입 검사
pnpm build            # 라이브러리 번들(ESM/CJS + d.ts) 생성
pnpm build-storybook  # 정적 Storybook 산출물
```

> 패키지 매니저는 **pnpm** 을 사용합니다. (`packageManager: pnpm@9.15.0`)

### 최소 사용 예시

```tsx
import {
  ThemeProvider,
  industrialDark,
  RealtimeStreamChart,
  createMockSensorStream,
} from "@ax/viz-kit";
import "@ax/viz-kit/styles.css";

const stream = createMockSensorStream({
  hz: 60,
  sensors: [{ sensorId: "temp", base: 74, amplitude: 7 }],
});

export function App() {
  return (
    <ThemeProvider theme={industrialDark}>
      <div style={{ height: 320 }}>
        <RealtimeStreamChart
          series={[{ key: "temp", name: "주축 온도", unit: "℃" }]}
          source={stream}
          thresholds={{ warning: 82, critical: 92 }}
        />
      </div>
    </ThemeProvider>
  );
}
```

---

## 2. 폴더 구조

```
src/
├── core/                       # 프레임워크 코어 엔진
│   ├── BaseChart/              # ECharts 추상화 래퍼 (라이프사이클/Resize/Theme/Event)
│   │   ├── BaseChart.tsx
│   │   └── types.ts
│   ├── Canvas2DBase/           # HTML5 Canvas 2D 추상화 래퍼
│   │   ├── Canvas2DBase.tsx    # rAF 루프, DPR, Pan/Zoom, Hit Detection
│   │   ├── hit.ts              # hitRect / hitCircle / hitPolygon / fitToViewport
│   │   └── types.ts
│   ├── DataStreamBuffer/       # 고주파 스트림 완충 파이프라인
│   │   ├── DataStreamBuffer.ts # throttle / debounce / batch 방출, 링버퍼 상한
│   │   ├── sources.ts          # WebSocket / SSE / Emitter 소스
│   │   └── types.ts
│   ├── EventBus/               # 타입 안전 이벤트 버스 + 이벤트 계약(events.ts)
│   ├── echarts/                # ECharts 코어 등록(트리셰이킹) + 엄격 옵션 타입
│   └── utils/                  # RingBuffer, LTTB 다운샘플, 포맷터
│
├── theme/                      # 테마 시스템
│   ├── ThemeProvider.tsx       # Context + CSS 변수 주입
│   ├── presets.ts              # industrialDark / industrialLight / createTheme
│   ├── echartsTheme.ts         # VizTheme → ECharts 테마 변환 및 등록
│   └── types.ts
│
├── hooks/                      # 공통 Hook
│   ├── useResizeObserver.ts    # 컨테이너 리사이즈 감지(rAF/디바운스)
│   ├── useAnimationLoop.ts     # rAF 루프 (백그라운드 탭 자동 정지)
│   ├── useDataStream.ts        # DataStreamBuffer ↔ React 라이프사이클 결합
│   └── useEventCallback.ts     # 참조 고정 + 최신 클로저 콜백
│
├── store/                      # 대시보드 공통 상태(zustand) + useVizEvent
├── types/domain.ts             # 도메인 타입(센서/이상탐지/레이아웃)
├── mock/                       # Mock Data Generator (WebSocket/SSE 시뮬레이션)
│
├── components/                 # 공통 모듈 기반 대표 구현 예시
│   ├── RealtimeStreamChart/    # ① 실시간 스트리밍 모니터링 (+ OeeGauge, LiquidFillWidget)
│   ├── AnomalyAnalysisChart/   # ② AI 이상 탐지 시계열
│   ├── FactoryLayoutCanvas/    # ③ 2D 공장 레이아웃 / 스마트 맵
│   └── Panel/                  # 카드 레이아웃 · 상태 뱃지
│
├── stories/                    # 코어 모듈 · 통합 대시보드 스토리
└── index.ts                    # 공개 API 진입점

demo/                           # pnpm dev 로 실행되는 통합 대시보드 데모 앱
.storybook/                     # Storybook 설정(테마 토글 툴바 포함)
```

---

## 3. 코어 엔진 설계

### 3.1 `BaseChart` — ECharts 라이프사이클 총괄

모든 ECharts 기반 컴포넌트는 이 래퍼를 통해서만 생성합니다. `echarts.init` 을 직접 호출하는 코드는 만들지 않습니다.

| 책임          | 처리 방식                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------- |
| 인스턴스 관리 | 언마운트 시 `dispose()` 보장 → 내부 rAF·이벤트·Canvas 컨텍스트 일괄 해제                       |
| 테마          | ThemeProvider 테마 자동 적용, 테마 변경 시 인스턴스 재생성(ECharts 는 런타임 테마 교체 미지원) |
| 반응형        | `ResizeObserver` → `resize()` 자동 호출, 0 크기(숨김 상태) resize 는 무시                      |
| 이벤트        | `events` / `zrEvents` props 로 등록하고 해제 시 전부 `off()`                                   |
| 렌더러        | Canvas 고정 + `useDirtyRect` 부분 갱신 최적화                                                  |

```tsx
const ref = useRef<BaseChartHandle>(null);

<BaseChart
  ref={ref}
  option={option}
  events={{
    click: (params, chart) => {
      /* ... */
    },
  }}
  group="line-a" // 여러 차트 축·툴팁 연동
  resizeDebounceMs={80}
/>;

ref.current?.getInstance(); // ECharts 인스턴스 직접 접근
ref.current?.toDataURL(); // 리포트 캡처
```

옵션 타입은 등록된 series/component 만 허용하는 `VizEChartsOption`(ComposeOption) 을 사용해,
등록하지 않은 차트 타입을 쓰면 **컴파일 타임에 차단**됩니다.

### 3.2 `Canvas2DBase` — Canvas 2D 추상화

| 책임          | 처리 방식                                                                            |
| ------------- | ------------------------------------------------------------------------------------ |
| 해상도        | `devicePixelRatio`(최대 3배) 기준 backing store 동기화 → 대형 관제 모니터에서도 선명 |
| 루프          | rAF 루프 관리, 언마운트·백그라운드 탭 전환 시 자동 중단, `maxFps` 상한               |
| 렌더 모드     | `loop`(애니메이션) / `on-demand`(정적 도면 — 필요할 때만 렌더)                       |
| Hit Detection | 포인터 좌표를 뷰포트 역변환 후 `hitTest(worldPoint)` 로 위임                         |
| 인터랙션      | 드래그 팬 / 커서 기준 휠 줌 / 드래그·클릭 구분(4px 임계)                             |
| 정리          | 모든 포인터·휠 리스너 해제 + 캔버스 backing store 축소                               |

```tsx
<Canvas2DBase<Equipment>
  onDraw={({ ctx, width, height, frame, theme }) => {
    /* 월드 좌표로 그리기 */
  }}
  hitTest={(point) => pickTopMost(items, (item) => hitRect(point, item))}
  onItemClick={(item) => select(item)}
  interaction={{ pan: true, zoom: true }}
  renderMode="loop"
/>
```

### 3.3 `DataStreamBuffer` — 데이터 파이프라인

**문제**: 센서가 초당 수백~수천 건을 보내는데 수신할 때마다 `setOption` 을 호출하면 메인 스레드가 렌더에 묶여 프레임이 무너집니다.
**해결**: 수신은 O(1) 적재만 하고, 방출은 일정 주기(또는 배치 단위)로 묶어 **한 번만** 수행합니다.

```ts
const buffer = new DataStreamBuffer<SensorSample>({
  interval: 200, // flush 주기(ms)
  mode: "throttle", // 'throttle' | 'debounce' | 'batch'
  capacity: 10_000, // 버퍼 상한 (초과 시 drop-oldest)
  maxFlushSize: 5_000, // 1회 방출 상한 → 렌더 폭주 방지
  transform: (items) =>
    lttb(
      items,
      500,
      (p) => p.time,
      (p) => p.value,
    ),
  alignToFrame: true, // flush 를 rAF 에 정렬
  pauseWhenHidden: true, // 백그라운드 탭에서는 버퍼링만 수행
});

const off = buffer.subscribe((items, stats) => appendToChart(items));
const disconnect = buffer.connect(createWebSocketSource("wss://.../sensors"));

// 정리
off();
disconnect();
buffer.dispose();
```

- 소스 어댑터: `createWebSocketSource`(지수 백오프 재연결 포함), `createSSESource`, `createEmitterSource`
- 계측: `stats.inboundRate`(초당 유입), `received / flushed / dropped / bufferSize`
- React 결합: `useDataStream()` 훅이 구독 해제와 `dispose()` 를 자동 처리

### 3.4 테마 시스템

```tsx
import { ThemeProvider, createTheme, industrialDark } from "@ax/viz-kit";

const plantTheme = createTheme(industrialDark, {
  name: "plant-a",
  palette: {
    accent: "#ff922b",
    series: ["#ff922b", "#4dabf7", "#38d9a9"],
    status: { critical: "#f03e3e" },
  },
});

<ThemeProvider theme={plantTheme}>{children}</ThemeProvider>;
```

- 팔레트 하나가 **ECharts 테마와 Canvas 렌더링 양쪽**에 동일하게 적용됩니다.
- ThemeProvider 는 `--viz-*` CSS 변수도 주입하므로 차트 외 UI(카드·범례·뱃지)까지 토큰을 공유합니다.
- 상태 색상(`normal / warning / critical / idle / offline / maintenance`)은 도메인 타입 `EquipmentStatus` 와 1:1 대응합니다.

### 3.5 메모리 관리 체크리스트

24시간 무중단 구동에서 누수가 쌓이지 않도록 래퍼 레벨에서 다음을 자동 수행합니다.

- [x] ECharts `dispose()` — `BaseChart` 언마운트 시
- [x] rAF 루프 `cancelAnimationFrame` — `useAnimationLoop` / `Canvas2DBase`
- [x] `ResizeObserver.disconnect()` + 대기 중 타이머 취소 — `useResizeObserver`
- [x] 차트 / zrender 이벤트 `off()` — `BaseChart`
- [x] 포인터·휠·`visibilitychange` 리스너 해제 — `Canvas2DBase`, `DataStreamBuffer`
- [x] WebSocket / SSE 구독 해제 및 `close()` — `DataStreamBuffer.dispose()`
- [x] 버퍼 상한(`capacity`)으로 데이터 무한 증가 차단 — `DataStreamBuffer`, `RingBuffer`

---

## 4. 대표 구현 예시 3종

### ① `RealtimeStreamChart` — 실시간 스트리밍 모니터링

```tsx
<RealtimeStreamChart
  series={[
    { key: "temp", name: "온도", unit: "℃" },
    { key: "vib", name: "진동", unit: "mm/s" },
  ]}
  source={stream} // StreamSource<SensorSample>
  windowSize={800} // 시리즈별 유지 포인트 수
  flushInterval={200}
  thresholds={{ warning: 82, critical: 92 }} // 임계 구간 색상 + MarkLine
  equipmentId={selectedId} // 설비 선택 연동 필터
  paused={!live}
/>
```

- 데이터는 React state 가 아닌 **`RingBuffer`(ref)** 에 적재 → 초당 수백 건 유입에도 **리렌더 0회**
- flush 주기마다 `setOption` 1회, series `id` 매칭으로 축·툴팁 재계산 최소화
- `sampling: 'lttb'` 로 포인트 수가 픽셀 수를 넘어도 렌더 비용이 선형으로 증가하지 않음
- 임계치 **상태가 바뀌는 순간에만** `ON_THRESHOLD_BREACH` 이벤트 발행(이벤트 폭주 방지)
- 함께 제공되는 위젯: `OeeGauge`(ECharts Gauge), `LiquidFillWidget`(Canvas2DBase 기반 수위 위젯)

> `LiquidFillWidget` 은 `echarts-liquidfill` 플러그인 대신 `Canvas2DBase` 위에 직접 구현했습니다.
> 해당 플러그인이 전체 echarts 번들에 의존해 코어 트리셰이킹을 깨뜨리기 때문입니다.

### ② `AnomalyAnalysisChart` — AI 이상 탐지 시계열

```tsx
<AnomalyAnalysisChart
  data={data} // TimeValuePoint[]
  predictionBand={predictionBand} // 예측 정상범위(상·하한)
  anomalies={anomalies} // 이상 지점 → MarkPoint
  markRanges={markRanges} // 구간 강조 → MarkArea
  mode="timeline" // 'timeline' | 'heatmap'
  downsampleTo={2000}
  onAnomalyClick={(anomaly) => openDetail(anomaly)}
/>
```

- **예측 정상범위**: 하한 라인 + `(상한-하한)` 스택 영역으로 밴드 표현
- **이상 지점**: `MarkPoint` 표시, 클릭 시 `ON_ANOMALY_SELECT` 발행
- **대용량 이력**: 12만 포인트도 LTTB 다운샘플 + `DataZoom(inside/slider)` 조합으로 정밀 탐색
- **Heatmap 전환**: 동일 데이터를 (일 × 시간) 밀도로 집계(`aggregateToHeatmap`)
- DataZoom 조작 시 표시 구간을 `ON_TIME_RANGE_CHANGE` 로 발행 → 타 차트와 구간 동기화

### ③ `FactoryLayoutCanvas` — 2D 공장 레이아웃 / 스마트 맵

```tsx
<FactoryLayoutCanvas
  layout={layout} // 존/컨베이어/설비 + 배경 평면도
  statusOverrides={realtimeStatuses} // 실시간 상태 오버레이
  selectedId={selected?.id ?? null}
  onSelect={(equipment) => selectEquipment(equipment)}
  animate // false 면 on-demand 렌더
/>
```

- 평면도 이미지 · 격자 · 존 · 컨베이어 흐름 애니메이션(대시 오프셋) · 설비 박스를 Canvas 한 장에 렌더 → 설비 수백 대에서도 **DOM 노드 증가 없음**
- `warning / critical` 설비만 Pulse 링 애니메이션(정상 설비는 정적 → GPU 부담 최소화)
- 클릭·호버는 좌표 기반 **Hit Detection**(`pickTopMost` 로 겹친 객체 중 최상단 우선)
- 휠 확대/축소(커서 기준), 드래그 이동, 컨테이너 크기에 맞춘 자동 Fit

---

## 5. 컴포넌트 간 이벤트 & 상태 연동

컴포넌트끼리 서로를 직접 참조하지 않고, **Event Bus + 중앙 Store** 를 통해 연동합니다.

```
FactoryLayoutCanvas ──(설비 클릭)──▶ vizEventBus.emit(ON_EQUIPMENT_SELECT)
                                              │
                                    useVizStore.selectedEquipment
                                              │
        ┌─────────────────────────────────────┼─────────────────────────────────┐
        ▼                                     ▼                                 ▼
RealtimeStreamChart                 AnomalyAnalysisChart                  상세 정보 패널
 (equipmentId 필터 전환)              (데이터셋 Swapping)                     (KPI 표시)
```

```tsx
// 발행 — 스토어 액션이 상태 갱신과 이벤트 발행을 함께 처리
const selectEquipment = useVizStore((s) => s.selectEquipment);
selectEquipment(equipment, "FactoryLayoutCanvas");

// 구독 A — 스토어 셀렉터(리렌더 최소화)
const selected = useVizStore((s) => s.selectedEquipment);

// 구독 B — 이벤트(언마운트 시 자동 해제)
useVizEvent(VizEvent.THRESHOLD_BREACH, (payload) => pushAlert(payload));
```

공통 이벤트 계약은 `src/core/EventBus/events.ts` 의 `VizEventMap` 한 곳에서 관리합니다.

| 이벤트                 | 페이로드                                      | 발행 주체                    |
| ---------------------- | --------------------------------------------- | ---------------------------- |
| `ON_EQUIPMENT_SELECT`  | `{ equipment, source }`                       | FactoryLayoutCanvas / Store  |
| `ON_EQUIPMENT_HOVER`   | `{ equipment, source }`                       | FactoryLayoutCanvas          |
| `ON_TIME_RANGE_CHANGE` | `{ range, source }`                           | AnomalyAnalysisChart / Store |
| `ON_ANOMALY_SELECT`    | `{ anomaly, source }`                         | AnomalyAnalysisChart         |
| `ON_THRESHOLD_BREACH`  | `{ sensorId, value, threshold, level, time }` | RealtimeStreamChart          |
| `ON_STREAM_STATUS`     | `{ channel, status }`                         | Store / 소스 어댑터          |

> 상태로 **보관**해야 하는 값은 Store 에, 발생한 **사건**은 Event Bus 에 둡니다.

---

## 6. Mock Data Generator

실시간 스트리밍 테스트를 위해 서버 없이 동작하는 시뮬레이터를 제공합니다.

```ts
// 고주파 센서 스트림 (사인파 + 가우시안 노이즈 + 스파이크 + 드리프트)
const stream = createMockSensorStream({
  hz: 1000, // 센서당 초당 샘플 수
  burst: 25, // 1 tick 당 묶음 전송(WebSocket 배치 수신 모사)
  sensors: [
    {
      sensorId: "temp",
      base: 74,
      amplitude: 7,
      noise: 0.8,
      spikeChance: 0.003,
    },
    { sensorId: "vib", base: 48, amplitude: 15, drift: 0.05 },
  ],
});
stream.injectAnomaly("temp", 40); // 임의 시점 이상값 주입

// WebSocket API 를 흉내 내는 Mock 소켓 — 재연결 로직까지 검증 가능
createWebSocketSource("wss://mock", {
  factory: () => new MockWebSocket(() => generateBatch(), 100),
});

// 이상 탐지 데이터셋 (정상 구간 → 밴드 이탈 구간 포함)
const { data, predictionBand, anomalies, markRanges } =
  createMockAnomalyDataset({
    count: 120_000,
    anomalyCount: 12,
  });

// 공장 도면 + 상태 변화 시뮬레이터
const layout = createMockFactoryLayout();
const stop = simulateStatusChanges(ids, setStatuses, 3000);
```

난수는 **시드 기반(mulberry32)** 이므로 Storybook·테스트에서 동일한 데이터가 재현됩니다.

---

## 7. Storybook

```bash
pnpm storybook
```

| 카테고리          | 스토리                  | 확인 항목                                                    |
| ----------------- | ----------------------- | ------------------------------------------------------------ |
| 01. 공통 모듈     | BaseChart 반응형        | 컨테이너 너비 변경 → `resize()` 자동 호출                    |
|                   | Canvas2DBase 히트감지   | rAF 루프 + 원형 객체 클릭 판정                               |
|                   | DataStreamBuffer 처리량 | 500Hz 유입 대비 flush(=setOption) 횟수 계측                  |
|                   | 커스텀 테마 주입        | Dark / Light / 커스텀 테마 동시 비교                         |
| 02. 예시 컴포넌트 | RealtimeStreamChart     | 기본 / 1000Hz 스트레스 / 임계치 이벤트 / OEE·LiquidFill 연동 |
|                   | AnomalyAnalysisChart    | 기본 / 12만 포인트 탐색 / Heatmap 전환 / 이상지점 클릭       |
|                   | FactoryLayoutCanvas     | 기본 / 실시간 상태 변화 / 설비 선택 연동 / 정적 on-demand    |
| 03. 통합 대시보드 | 이벤트 연동 데모        | 설비 클릭 → 타 차트 데이터셋 Swapping                        |

상단 툴바의 **Theme** 셀렉터로 Industrial Dark ↔ Light 를 즉시 전환할 수 있습니다.

---

## 8. 성능 설계 요약

| 구간   | 기법                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| 수신   | `DataStreamBuffer` throttle/batch 방출 — flush 주기당 `setOption` 1회             |
| 보관   | `RingBuffer` O(1) 갱신(`Array.shift` 의 O(n) 회피), `capacity` 상한               |
| 축약   | LTTB / min-max 다운샘플, ECharts `sampling: 'lttb'`                               |
| 렌더   | Canvas 렌더러 고정, `useDirtyRect`, 실시간 차트 `animation: false`                |
| 리렌더 | 스트림 데이터는 ref 보관 → React 리렌더와 분리, `useEventCallback` 으로 참조 고정 |
| 유휴   | 백그라운드 탭에서 rAF 루프·flush 중단(`visibilitychange`)                         |
| Canvas | 상태 이상 객체만 애니메이션, `on-demand` 렌더 모드 지원                           |

---

## 9. 기술 스택 및 규약

- **TypeScript** `strict` + `noUncheckedIndexedAccess` — Prop / Chart Config / Event 타입 모두 명시
- **React 18**(peerDependency), **ECharts 5**(코어 등록 방식), **zustand 5**
- **Vite**(라이브러리 번들 ESM/CJS + `d.ts`), **Vitest**(jsdom), **Storybook 8**
- 공개 API 는 `src/index.ts` 를 통해서만 노출 — 내부 파일 경로에 직접 의존하지 않습니다.
- 차트는 반드시 `BaseChart` / `Canvas2DBase` 를 거쳐 구현합니다(라이프사이클 보장).

---

## 10. 신규 컴포넌트 추가 가이드

1. `src/components/<Name>/` 디렉터리 생성
2. ECharts 기반이면 `BaseChart`, Canvas 기반이면 `Canvas2DBase` 를 감싸 구현
3. 색상·폰트는 하드코딩하지 말고 `useVizTheme()` 토큰 사용
4. 실시간 데이터가 필요하면 `useDataStream()` 으로 연결(직접 WebSocket 구독 금지)
5. 타 컴포넌트와의 연동은 `vizEventBus` / `useVizStore` 를 통해서만 수행
6. `<Name>.stories.tsx` 작성 후 `src/index.ts` 에 public export 추가
