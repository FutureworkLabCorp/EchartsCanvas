# @ax/viz-kit — 온프레미스 데이터 시각화 공통 컴포넌트

## 0. 이 문서의 위치

이 저장소는 제품 저장소(`FutureworkLabCorp/AxFlow`)와 **분리된 독립 배포 라이브러리**다.
AxFlow는 이 라이브러리를 **소비만** 하고, 이 저장소는 AxFlow의 어떤 패키지도 import 하지 않는다.

제품 저장소를 읽어야 판단이 서는 항목은 §2 "제품 저장소 계약"에 모아 두었다. 그 절과 충돌하는
구현은 아무리 자체적으로 옳아도 통합 시점에 전부 되돌아온다.

---

## 1. 왜 시각화 컴포넌트를 별도로 구축하는가

범용 차트 라이브러리를 그대로 쓰지 않고 별도 계층을 만드는 이유는 네 가지다. 각 이유는 곧바로
아키텍처 제약이며, 설계 판단이 갈릴 때 되돌아와 근거로 삼는다.

| 이유 | 구체적으로 해결하는 문제 | 이 문서에서의 귀결 |
| --- | --- | --- |
| **폐쇄망에서 독립적으로 동작** | 외부 CDN, SaaS 대시보드, 외부 폰트·지도 API 등에 접근하지 못해도 시각화가 정상 동작하도록 리소스를 내부에 구성 | §3 오프라인 불변식 |
| **데이터 보안 및 권한 적용** | 내부 API로 데이터를 조회하고, 사용자 권한에 맞춰 조회 범위·상세 보기·다운로드 기능을 연결. 실제 접근 통제는 서버에서 수행 | §6 Capability 프로토콜 |
| **업무에 맞는 데이터 표현** | 제조 설비 관계, 공정 흐름, 지식그래프, 에이전트 실행 상태처럼 기본 차트만으로 표현하기 어려운 정보를 구현 | §5 렌더링 계층 · §7 컴포넌트 |
| **서로 다른 데이터 형식 통일** | 백엔드·에이전트마다 다른 응답을 공통 시각화 스키마로 변환해 여러 화면에서 재사용 | §4 VizSchema & Normalizer |

네 번째 항목이 이번 재설계에서 새로 들어온 축이다. 기존 스펙에는 차트 컴포넌트만 있고
**응답 → 공통 스키마 변환 계층이 없었다.** 이 계층 없이는 백엔드가 하나 늘 때마다 차트가 하나씩
분기되고, 라이브러리가 아니라 화면 모음이 된다.

---

## 2. 제품 저장소(AxFlow) 계약

AxFlow `develop` 기준 실측값이다. 추측이 아니라 확인된 사실만 적는다.

### 런타임 / 빌드

| 항목 | AxFlow | 이 저장소가 맞춰야 하는가 |
| --- | --- | --- |
| React | **19.3** | **예** — peerDependency `^19` |
| TanStack Start (SSR) | 사용 | **예** — 모든 컴포넌트 SSR 안전 |
| Tailwind | v4, `@theme {}` | 토큰 이름 계약만 (§5) |
| TanStack Query | v5, 서버 데이터 전담 | 경계 명시 (§4) |
| zod | v4 | 스키마 작성 시 v4 문법 |
| Vite / Vitest | 8 / 3 | **아니오** — 내부 빌드 도구는 자유 |

Vite·Vitest·Storybook 버전은 산출물(`dist`)에 드러나지 않으므로 이 저장소가 독자적으로 고른다.
**런타임 계약은 React 19와 SSR 안전성 두 가지뿐이다.**

### 시각화 현황

- `packages/features/src/shared/chart.tsx` — shadcn chart 래퍼 + **recharts 3.8 (SVG)**
- `packages/features/src/monitoring/ui/TokenUsageChart.tsx` — recharts BarChart, 색은 `var(--color-data-1/2)`
- `packages/features/src/knowledge-graph/ui/GraphCanvas.tsx` — **react-force-graph-2d (Canvas 2D)**
- **ECharts 없음. WebSocket 코드 0건.**
- 스트리밍은 `packages/core/src/lib/sse.ts`의 `readSseEvents()` 하나로 통일 (chat, template run)

### 반드시 지켜야 하는 컨벤션

AxFlow `CLAUDE.md` / `.docs/Code-Conventions_*`에서 가져온, 이 저장소에도 그대로 적용되는 항목:

- `any` 금지, `unknown` 좁히기. 허용되는 단언은 `as const` 뿐
- 컴포넌트는 `const`에 할당한 화살표 함수. `function` 선언 금지. 컴포넌트 안에서 컴포넌트 정의 금지
- 정적 인라인 `style` 금지. `style` prop은 **런타임 계산값 전용** (좌표, `animationDelay`, 해석된 색상)
- 주석은 영어. `/* */` 블록·JSDoc·구분선 주석(`// ===== X =====`) 금지.
  코드가 스스로 말하지 못하는 것만 적는다 (백엔드 계약, 측정된 브라우저 동작, 단순해 보이는 형태를 기각한 이유)
- Conventional Commits + scope 필수 (`feat(core):`, `fix(charts):`)
- 커버리지 90% (statements / branches / functions / lines)

> **기존 소스의 한국어 JSDoc 주석은 전부 정리 대상이다.** (`src/theme/types.ts`, `src/core/echarts/index.ts` 등)

### 지키지 않아도 되는 것

- **i18n** — AxFlow의 `useTranslation('shared')` 규칙은 `@axflow/features`에만 걸린다.
  이 라이브러리는 독립 패키지이므로 **모든 사용자 노출 문자열을 props로 받는다.** 내부에 문자열 상수를 두지 않는다
- **파일 배치 매트릭스** (`.docs/Feature-Placement_*`) — 모노레포 내부 규칙
- **리뷰 게이트 훅** (`.review/<sha>.json`) — AxFlow 로컬 훅

---

## 3. 오프라인 불변식 (폐쇄망)

CI에서 강제한다. 하나라도 어기면 고객사 망에서 컴포넌트가 죽는다.

1. **네트워크 요청 0건.** 라이브러리 코드는 `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`를
   **직접 호출하지 않는다.** 데이터는 전부 props 또는 주입된 소스 객체로 들어온다.
   (`DataStreamBuffer`의 소스는 호출자가 만들어 넘긴다 — §4)
2. **외부 폰트 로드 금지.** `@import`, `<link>`, `@font-face`의 원격 URL 전부 금지.
   폰트는 **호스트 앱에서 상속**하고, 라이브러리는 JS fallback 스택만 지정한다.
   → 현재 `src/theme/presets.ts`의 `font.family` 하드코딩은 제거하고 `inherit` 기반으로 전환
3. **외부 지도·타일 API 금지.** `FactoryLayoutCanvas`의 배경은 호출자가 넘긴 로컬 이미지/SVG/도형
   데이터만 받는다. 베이스맵 개념 자체를 넣지 않는다
4. **CDN 참조 0건.** Storybook 설정, 데모 앱 포함
5. **런타임 원격 의존 0건.** 아이콘·이미지는 인라인 SVG 또는 번들 에셋

검증: `scripts/check-offline.mjs`가 `dist`와 `storybook-static`을 스캔해 `https?://` 리터럴과
원격 `@font-face`를 찾으면 실패. `pnpm build` 이후 CI 필수 단계.

---

## 4. VizSchema & Normalizer

### 문제

백엔드마다, 에이전트마다 응답이 다르다. 그걸 차트가 직접 읽으면 차트가 백엔드 수만큼 분기한다.

### 구조

```
백엔드 응답 ─┐
에이전트 응답 ─┼─→ Normalizer (호출자가 선택) ─→ VizSchema ─→ 컴포넌트
MCP 응답   ─┘
```

`VizSchema`는 컴포넌트가 이해하는 **유일한** 입력 형태다. 다섯 종류로 고정한다:

| 스키마 | 형태 | 소비 컴포넌트 |
| --- | --- | --- |
| `VizSeries` | 시계열 / 카테고리 `{ id, name, points: [t, v][] , unit?, thresholds? }` | 차트류 |
| `VizGraph` | 노드-엣지 `{ nodes, edges }` | 지식그래프, 설비 관계도 |
| `VizFlow` | 유향 단계 `{ steps, transitions, status }` | 공정 흐름, 에이전트 실행 상태 |
| `VizLayout` | 2D 좌표 배치 `{ background, regions, objects }` | 공장 레이아웃 |
| `VizMetric` | 단일 값 + 델타 `{ key, value, unit, delta, state }` | KPI, 게이지 |

각 스키마는 **zod v4 스키마로 정의**하고 타입을 `z.infer`로 뽑는다. 런타임 검증은 Normalizer 진입점에서만 수행한다(차트 렌더 경로에서는 하지 않는다 — 고주파에서 비용).

### Normalizer

`createNormalizer<TRaw, TSchema>(spec)` 형태의 순수 함수 팩토리. 라이브러리는 **제품 백엔드용
Normalizer를 내장하지 않는다.** 대신 작성 도구와, 데모/테스트용 Normalizer만 제공한다.
제품별 Normalizer는 AxFlow 쪽 `packages/core/src/domains/*`에 산다 — 그래야 백엔드 계약이 바뀌었을 때
라이브러리를 재배포하지 않는다.

### 스트림과 TanStack Query의 경계

AxFlow는 "서버 데이터는 TanStack Query, `useEffect + fetch` 금지"가 불변식이다. 충돌을 피하기 위해:

- **스냅샷 / 페이지네이션 / 이력 조회 = TanStack Query.** 라이브러리는 관여하지 않고 결과만 props로 받는다
- **연속 스트림(SSE/WebSocket) = `DataStreamBuffer`.** Query의 캐시 모델에 맞지 않는다
  (키가 없고, 무효화가 없고, 초당 수십 회 갱신된다). 이건 Query 규칙의 **예외가 아니라 범위 밖**이며,
  통합 PR 본문에 이 문장을 그대로 적는다
- `DataStreamBuffer`는 소스를 **직접 열지 않는다.** `{ subscribe(cb): () => void }` 인터페이스만 받는다.
  AxFlow는 이미 있는 `readSseEvents()`를 감싸 넘기면 되고, 라이브러리는 §3-1을 어기지 않는다

---

## 5. 렌더링 계층 & 테마

### 엔진 3종 공존

| 엔진 | 담당 | 이유 |
| --- | --- | --- |
| **recharts (AxFlow 소유)** | 저빈도 정적 차트 | 이미 monitoring에 자리잡음. 건드리지 않음 |
| **ECharts Canvas (viz-kit)** | 고주파 스트리밍, 10만 포인트급 이력 탐색, DataZoom, Heatmap | recharts가 못 버티는 구간 전용 |
| **Pure Canvas 2D (viz-kit)** | 레이아웃/그래프/플로우 — 좌표·히트영역·애니메이션을 직접 통제해야 하는 표현 | §1 세 번째 이유의 직접 귀결 |

**ECharts는 `dependencies`로 번들한다** (peer 아님). AxFlow에 echarts가 전혀 없어 중복 우려가 없고,
폐쇄망에서 버전 협상을 없애는 쪽이 안전하다. `echarts/core` 모듈식 등록은 이미 올바르게 되어 있으므로
(`src/core/echarts/index.ts`) 그대로 유지한다. echarts 6.x로 올린다.

### 테마 — ThemeProvider를 걷어낸다

AxFlow는 명시적으로 금지한다: *"no dark-mode opt-in. Do not add `dark:` variants,
`prefers-color-scheme`, `data-theme`, `ThemeProvider`."* 앱마다 단일 테마이고 값은 `styles.css`의
`@theme {}`에 산다.

**결정: Industrial Dark는 라이브러리 테마가 아니라 키오스크용 신규 고객사 앱의 토큰셋으로 내려간다.**

라이브러리가 남기는 것은 팔레트가 아니라 **토큰 계약 + 해석기**다:

1. **토큰 계약** — 라이브러리가 읽는 CSS 커스텀 프로퍼티 이름 목록을 문서로 고정
   (`--viz-surface`, `--viz-grid`, `--viz-axis`, `--viz-text-*`, `--viz-series-1..8`,
   `--viz-status-{normal,warning,critical,idle,offline,maintenance}`)
2. **해석기** — `resolveVizTokens(element)`가 `getComputedStyle`로 실제 색 문자열을 읽어
   ECharts option과 Canvas 렌더러에 주입. ECharts는 CSS 변수를 못 읽으므로 이 단계가 필수다
3. **재해석 트리거** — 호스트가 토큰을 바꿨을 때를 위해 해석 결과를 컨텍스트에 캐시하고,
   `ResizeObserver`와 같은 훅에서 명시적 `refreshTokens()`를 노출
4. **fallback 프리셋** — 토큰이 하나도 없는 환경(Storybook, 독립 데모)을 위한 JS 기본값.
   **호스트 앱이 토큰을 주면 언제나 토큰이 이긴다**

`ThemeProvider`라는 이름은 쓰지 않는다 (AxFlow 금지어). `VizTokenProvider`로 간다.

산출물: `dist/tokens/industrial-dark.css` — 키오스크 앱이 자기 `@theme {}`에 복사해 넣는 **참조용
토큰셋**. 라이브러리가 런타임에 주입하는 스타일시트가 아니다.

### AxFlow 데이터 색상 토큰 부족 — 팀 결정 항목

AxFlow `apps/spire/src/styles.css`에는 데이터 색상 토큰이 `--color-data-1`, `--color-data-2`
**두 개뿐**이고, 하나는 나머지의 투명도 변형이다. 다계열 차트가 불가능하다.

AxFlow 규칙: *"토큰 추가는 팀 결정이며 에이전트가 단독으로 `@theme`을 편집하지 않는다."*
→ **이 저장소에서 해결하지 않는다.** `--viz-series-1..8`이 필요한 이유·값·호출 지점을 정리한
제안서를 만들어 팀에 올리는 것이 산출물이고, 그때까지 fallback 프리셋으로 동작시킨다.

---

## 6. Capability 프로토콜 (권한)

실제 접근 통제는 서버가 한다. 라이브러리는 **서버가 이미 내린 결정을 화면에 반영**할 뿐이며,
권한을 판단하지도, 판단한 척하지도 않는다.

```ts
interface VizCapabilities {
  canViewDetail: boolean   // 객체 클릭 시 상세 패널 열림 여부
  canDownload: boolean     // CSV/이미지 내보내기 노출 여부
  canDrillDown: boolean    // 시간 축 확대·원본 이력 조회 노출 여부
  redactedFields?: readonly string[]  // 서버가 마스킹한 필드 — 툴팁/레이블에서 제외
}
```

규칙:

- 모든 최상위 컴포넌트가 `capabilities` prop을 받는다. 기본값은 **전부 `false`** (deny by default)
- `canDownload: false`면 내보내기 버튼을 **숨긴다** (비활성화가 아니라 미렌더 — 존재 자체가 정보 누출)
- `redactedFields`에 든 키는 툴팁·레이블·내보내기 결과에서 제외한다
- **클라이언트 게이팅은 UX이지 보안이 아니다.** 서버가 안 준 데이터는 애초에 스키마에 없어야 한다.
  이 문장을 README에 명시해 소비자가 오해하지 않게 한다

---

## 7. 모듈 구성

```
src/
  core/
    echarts/          ECharts 모듈식 등록 (유지)
    BaseChart/        ECharts 라이프사이클·resize·dispose·토큰 주입
    Canvas2DBase/     Canvas 2D 루프·DPR·히트 감지·좌표 변환
    DataStreamBuffer/ 주입된 소스 → 고정 주기 배출 (throttle/debounce/ring buffer)
    utils/            downsample(LTTB), format, RingBuffer
  schema/             VizSeries · VizGraph · VizFlow · VizLayout · VizMetric (zod v4)
  normalize/          createNormalizer + 데모용 어댑터
  tokens/             토큰 계약, resolveVizTokens, fallback 프리셋, VizTokenProvider
  capabilities/       VizCapabilities 타입 + 기본값 + 헬퍼
  hooks/              useResizeObserver · useAnimationLoop · useDataStream · useEventCallback
  components/
    RealtimeStreamChart/    VizSeries  · ECharts
    AnomalyAnalysisChart/   VizSeries  · ECharts (MarkArea/MarkPoint/DataZoom/Heatmap)
    FactoryLayoutCanvas/    VizLayout  · Canvas 2D
    ProcessFlowCanvas/      VizFlow    · Canvas 2D   ← 신규
    RelationGraphCanvas/    VizGraph   · Canvas 2D   ← 신규
  mock/               오프라인 목 생성기 (스트림·이력·그래프·플로우)
```

### 신규 컴포넌트 2종이 들어온 이유

§1의 세 번째 이유가 "제조 설비 관계, 공정 흐름, 지식그래프, 에이전트 실행 상태"를 명시한다.
기존 3종은 이 중 어느 것도 다루지 못했다.

- **`RelationGraphCanvas`** — 설비 관계도 + 지식그래프. AxFlow의 `GraphCanvas`가 이미
  `react-force-graph-2d`로 같은 일을 하고 있어, **`Canvas2DBase`의 실전 검증 대상이 가상의 도면이 아니라
  이미 존재하는 화면**이 된다. 레이아웃 계산(force)은 주입 가능하게 두고 라이브러리는 렌더·히트 감지만 맡는다
- **`ProcessFlowCanvas`** — 공정 흐름 + 에이전트 실행 상태. 둘 다 "유향 단계 + 단계별 상태 + 진행 중 강조"로
  같은 `VizFlow` 스키마에 들어간다

### 컴포넌트 간 연동 — EventBus 제거

기존 `src/core/EventBus`는 **모듈 전역 싱글톤**이다. SSR에서 요청 간 상태가 섞이고, 한 페이지에
대시보드 두 개를 띄우면 서로의 이벤트를 받는다. AxFlow는 "route 레이어에서 조합"이 원칙이다.

→ `EventBus`와 전역 `vizStore`를 제거하고, **스코프된 store 인스턴스 + Provider**로 교체한다
(AxFlow의 `CurrentUserProvider` / `OrgScopeProvider` 패턴). 선택·호버·시간범위는 컨텍스트로 흐르고,
Provider를 쓰지 않는 소비자는 콜백 props(`onEquipmentSelect` 등)로 직접 받는다.

---

## 8. 검증

- **Storybook** — 이 저장소의 개발·리뷰 수단으로 유지. AxFlow에는 Storybook이 없고
  `<Name>.showcase.tsx` + `/dev-only/showcase` 규약을 쓰지만, **독립 배포 라이브러리이므로 맞출 필요가 없다.**
  Storybook 빌드에도 §3 오프라인 검사를 건다
- **Vitest** — 순수 로직(`schema`, `normalize`, `utils`, `DataStreamBuffer`, `tokens`, `capabilities`)은
  단위 테스트로 커버리지 90%. Canvas 렌더 경로는 히트 감지·좌표 변환만 테스트하고 픽셀 비교는 하지 않는다
- **오프라인 검사** — `scripts/check-offline.mjs` (§3)
- **번들 예산** — ECharts 포함 gzip 상한을 CI에 고정. 초과 시 실패

---

## 9. 로드맵

| 단계 | 내용 | 완료 기준 |
| --- | --- | --- |
| **P0** | React 19 마이그레이션, echarts 6, 툴체인 최신화, 한국어 JSDoc 주석 정리 | `pnpm build` + `typecheck` 통과, peer `react@^19` |
| **P1** | `schema/` 5종 (zod v4) + `normalize/` + 기존 3종 컴포넌트를 스키마 입력으로 전환 | 컴포넌트가 원시 응답 타입을 전혀 모름 |
| **P2** | `tokens/` — 토큰 계약·`resolveVizTokens`·`VizTokenProvider`·fallback. `ThemeProvider` 제거 | 호스트 토큰만으로 색이 바뀜. 라이브러리에 hex 하드코딩 0건 (fallback 프리셋 제외) |
| **P3** | `EventBus`/전역 store 제거 → 스코프 Provider. SSR 안전성 확보 | 한 페이지 두 대시보드 독립 동작 |
| **P4** | `capabilities/` + 전 컴포넌트 적용 (deny by default) | 기본값에서 내보내기·상세·드릴다운 전부 미노출 |
| **P5** | `ProcessFlowCanvas` · `RelationGraphCanvas` 신규 | `VizFlow`/`VizGraph` 목 데이터로 Storybook 동작 |
| **P6** | `scripts/check-offline.mjs` + 번들 예산 + CI | 위반 시 빌드 실패 |
| **P7** | `dist/tokens/industrial-dark.css` + 통합 가이드 + 사내 레지스트리 배포 | AxFlow에서 `pnpm add` 한 줄로 소비 가능 |

---

## 10. 미결 항목

플랜을 진행하며 답이 필요한 것들. 임의로 정하지 않는다.

1. **사내 레지스트리** — Verdaccio / Nexus / GitHub Packages 중 어디에 publish 하는가.
   없다면 `git+ssh` 의존으로 갈 것인가 (그 경우 `dist`를 커밋해야 한다)
2. **`--viz-series-1..8` 토큰 제안** — AxFlow 팀에 언제 어떤 형태로 올릴 것인가
3. **`RelationGraphCanvas`가 AxFlow `GraphCanvas`를 대체하는가**, 아니면 신규 화면에만 쓰는가.
   대체라면 `react-force-graph-2d` 제거가 별도 PR로 따라온다
4. **force 레이아웃 계산 주체** — 라이브러리 내장 vs 주입. 폐쇄망이라 외부 워커 CDN은 어차피 불가
5. **키오스크 고객사 앱** — `new-customer-app` 스캐폴딩이 이 프로젝트 범위인가, AxFlow 쪽 작업인가

---

## 11. 명령어

```bash
pnpm install
pnpm dev              # 데모 앱
pnpm storybook        # 컴포넌트 검증
pnpm test             # vitest
pnpm typecheck
pnpm build            # dist (ESM + CJS + d.ts)
```

패키지 매니저는 **pnpm** 고정.
