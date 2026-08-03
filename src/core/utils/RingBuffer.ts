/**
 * 고정 길이 순환 버퍼.
 * 실시간 차트의 "최근 N개 윈도우"를 배열 shift 없이 O(1) 로 유지하기 위해 사용한다.
 * (Array.shift 는 O(n) 이라 초당 수천 건 유입 시 GC/CPU 부담이 커진다.)
 */
export class RingBuffer<T> {
  private items: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error("RingBuffer capacity must be > 0");
    this.items = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    const index = (this.head + this.count) % this.capacity;
    this.items[index] = item;
    if (this.count < this.capacity) this.count += 1;
    else this.head = (this.head + 1) % this.capacity;
  }

  pushMany(items: readonly T[]): void {
    for (const item of items) this.push(item);
  }

  get length(): number {
    return this.count;
  }

  get isFull(): boolean {
    return this.count === this.capacity;
  }

  at(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined;
    return this.items[(this.head + index) % this.capacity];
  }

  get last(): T | undefined {
    return this.at(this.count - 1);
  }

  /** 오래된 것 → 최신 순서의 일반 배열로 복사한다(차트 주입용). */
  toArray(): T[] {
    const out: T[] = new Array(this.count);
    for (let i = 0; i < this.count; i += 1) {
      out[i] = this.items[(this.head + i) % this.capacity] as T;
    }
    return out;
  }

  clear(): void {
    this.items = new Array<T | undefined>(this.capacity);
    this.head = 0;
    this.count = 0;
  }
}
