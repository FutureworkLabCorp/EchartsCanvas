# 공통 시각화 컴포넌트 프레임워크 구축

## 1. 프로젝트 개요

제조 AX 산단 온프레미스 솔루션 전반에 범용으로 쓰일 **실시간 대용량 시각화 공통 컴포넌트 라이브러리(Core Engine & UI Kit)**를 구축합니다.
다양한 제조 현장의 설비 데이터와 2D 레이아웃을 최소한의 설정(Configuration)만으로 빠르게 구성할 수 있는 확장 가능한 시스템을 목표로 합니다.

---

## 2. 공통 시각화 프레임워크 핵심 설계 요구사항

### A. 성능 & 렌더링 엔진 표준화 (Core Engine)

1. **ECharts (Canvas) + Pure HTML5 Canvas 기반의 하이브리드 코어**
   - 모든 차트 컴포넌트는 기본적으로 Canvas 렌더러 기반으로 동작하도록 래핑(Wrapping)합니다.
   - 고주파 센서 데이터 처리를 위해 **공통 데이터 버퍼링 엔진(Throttling/Debouncing)**을 내장하여 프레임 드랍을 방지합니다.

2. **자동 라이프사이클 & 메모리 관리 (Memory Management)**
   - 대시보드가 24시간 연속 작동하는 온프레미스 환경 특성을 반영하여, 컴포넌트 Mount/Unmount 시 **ECharts 인스턴스 해제(`dispose()`), Canvas Animation Loop 중단, Event Listener 및 WebSocket Clean-up**을 공통 래퍼(Wrapper) 레벨에서 자동 수행하도록 설계하세요.

3. **반응형 & 주제별 테마 시스템 (Theming & Responsive)**
   - Resize Observer 기반으로 container 크기 변경 시 차트 레이아웃이 자동 재계산(`resize()`)되는 공통 Hook/HOC를 제공하세요.
   - 관제센터/현장 키오스크용 **Industrial Dark Theme**를 기본 탑재하고, 커스텀 테마 주입이 가능한 Theme Provider 구조로 구현하세요.

---

## 3. 공통 모듈 및 예시 컴포넌트 구성 명세

공통 모듈 구조는 다음과 같아야 하며, 이를 검증하기 위한 3가지 대표 예시 컴포넌트를 함께 구축합니다.

### [공통 아키텍처 모듈]

- `BaseChart`: ECharts 라이프사이클, Resize, Theme, Clean-up을 총괄하는 추상화 컴포넌트
- `Canvas2DBase`: HTML5 Canvas 2D 렌더링, Loop 관리, Hit Detection(클릭 감지)을 담당하는 추상화 컴포넌트
- `DataStreamBuffer`: WebSocket/SSE 고주파 데이터를 가공하여 일정한 주기로 차트에 주입해주는 데이터 파이프라인 모듈

---

### [공통 모듈 기반의 대표 구현 예시 3종]

#### 1. 실시간 스트리밍 모니터링 컴포넌트 (`RealtimeStreamChart`)

- **목적**: 고주파 센서 데이터를 `DataStreamBuffer`를 통해 전달받아 시각화하는 예시
- **기능**: 끊김 없는 Line Chart, Threshold 경고 표시(Visual Map), OEE Gauge/LiquidFill 위젯 연동

#### 2. AI 이상 탐지 시계열 컴포넌트 (`AnomalyAnalysisChart`)

- **목적**: AI 예측 데이터 및 패턴 분석 결과 시각화 예시
- **기능**: 정상 예측 범위(MarkArea), 이상 발생 지점(MarkPoint), 대용량 이력 정밀 탐색(DataZoom) 및 Heatmap 전환

#### 3. 2D 공장 레이아웃/스마트 맵 컴포넌트 (`FactoryLayoutCanvas`)

- **목적**: `Canvas2DBase`를 확장하여 공장 도면 위 설비 배치 및 상태 시각화 예시
- **기능**: 평면도 배경 렌더링, 상태별 Pulse 애니메이션, 설비 객체 클릭/호버 감지(Hit Detection)

---

## 4. 컴포넌트 간 이벤트 & 상태 연동 (Event-Driven Architecture)

- 대시보드 내 컴포넌트 간 결합도를 낮추기 위해 **이벤트 버스(Event Bus) 또는 중앙 State 레퍼런스**를 활용합니다.
- 예: `FactoryLayoutCanvas`에서 특정 설비 클릭 시 발생한 `ON_EQUIPMENT_SELECT` 이벤트를 공통 스토어에서 수신하여 타 차트 컴포넌트의 데이터 세트를 선언적으로 Swapping할 수 있어야 합니다.

---

## 5. 최종 제출 형태 및 코드 스타일

1. **TypeScript** 기반으로 엄격한 타입 정의(Prop, Chart Config, Event Types) 포함.
2. 재사용 가능한 **공통 모듈/Hook**과 이를 구현한 **3가지 샘플 컴포넌트**의 깔끔한 폴더 구조 제시.
3. 실시간 스트리밍 테스트를 위한 **Mock Data Generator (WebSocket/SSE Simulation)** 작성.
4. 패키지 모듈은 기본적으로 **pnpm**을 사용할 것.
5. 시각화 모듈에 대한 테스트로 **Storybook**을 차용할것.
