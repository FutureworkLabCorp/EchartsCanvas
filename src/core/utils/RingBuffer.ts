// Holds a trailing window in O(1). The obvious push/shift pair was rejected because
// Array.shift is O(n), which shows up as GC pressure at thousands of samples a second.
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

  // Oldest to newest, which is the order a chart series expects.
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
