/**
 * LTTB(Largest-Triangle-Three-Buckets) 다운샘플링.
 *
 * 수십만 포인트의 이력 데이터를 화면 픽셀 수 수준으로 줄이면서
 * 피크/밸리 같은 시각적 특징을 보존한다. DataStreamBuffer 의 `transform` 이나
 * 이력 조회 결과 전처리에 사용한다.
 */
export function lttb<T>(
  data: readonly T[],
  threshold: number,
  getX: (item: T) => number,
  getY: (item: T) => number,
): T[] {
  const length = data.length;
  if (threshold >= length || threshold <= 2) return [...data];

  const sampled: T[] = [];
  const bucketSize = (length - 2) / (threshold - 2);

  let a = 0;
  const first = data[0];
  const last = data[length - 1];
  if (first === undefined || last === undefined) return [...data];
  sampled.push(first);

  for (let i = 0; i < threshold - 2; i += 1) {
    // 다음 버킷의 평균점 계산
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, length);
    const avgRangeLength = Math.max(1, avgRangeEnd - avgRangeStart);

    let avgX = 0;
    let avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j += 1) {
      const item = data[j];
      if (item === undefined) continue;
      avgX += getX(item);
      avgY += getY(item);
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    // 현재 버킷에서 삼각형 넓이가 최대인 점 선택
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;
    const pointA = data[a];
    if (pointA === undefined) continue;
    const ax = getX(pointA);
    const ay = getY(pointA);

    let maxArea = -1;
    let maxIndex = rangeStart;
    for (let j = rangeStart; j < Math.min(rangeEnd, length); j += 1) {
      const item = data[j];
      if (item === undefined) continue;
      const area =
        Math.abs(
          (ax - avgX) * (getY(item) - ay) - (ax - getX(item)) * (avgY - ay),
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    const picked = data[maxIndex];
    if (picked !== undefined) sampled.push(picked);
    a = maxIndex;
  }

  sampled.push(last);
  return sampled;
}

/** 단순 최대/최소 보존 다운샘플(min-max). LTTB 보다 빠르며 스파이크 검출에 유리하다. */
export function minMaxDownsample<T>(
  data: readonly T[],
  targetPoints: number,
  getY: (item: T) => number,
): T[] {
  if (data.length <= targetPoints || targetPoints <= 0) return [...data];

  const bucketSize = Math.ceil(data.length / (targetPoints / 2));
  const out: T[] = [];

  for (let start = 0; start < data.length; start += bucketSize) {
    const end = Math.min(start + bucketSize, data.length);
    let minItem: T | undefined;
    let maxItem: T | undefined;
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

    for (let i = start; i < end; i += 1) {
      const item = data[i];
      if (item === undefined) continue;
      const y = getY(item);
      if (y < minValue) {
        minValue = y;
        minItem = item;
      }
      if (y > maxValue) {
        maxValue = y;
        maxItem = item;
      }
    }
    if (minItem !== undefined) out.push(minItem);
    if (maxItem !== undefined && maxItem !== minItem) out.push(maxItem);
  }

  return out;
}
