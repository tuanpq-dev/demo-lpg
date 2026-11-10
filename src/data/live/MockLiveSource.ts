import type { LiveData, LiveDataSource, LiveSourceStatus, LiveValue } from '@/features/live/types';

type Listener = { tags: Set<string> | null; cb: (data: LiveData) => void };

export type MockLiveSourceOptions = {
  base: Record<string, LiveValue>;
  /** Biên độ dao động ± theo tag (số); tag không có → giữ nguyên giá trị (vẫn cập nhật ts). */
  jitter?: Record<string, number>;
  unit?: (tag: string) => string | undefined;
  /** Chu kỳ cập nhật (ms). */
  intervalMs?: number;
  /** Thời gian kết nối lần đầu (ms). */
  connectMs?: number;
  now?: () => number;
};

/**
 * Nguồn giả lập (thay bằng WebSocket/SCADA cùng interface LiveDataSource):
 * - kết nối khi có người nghe đầu tiên (subscribe hoặc onStatusChange), ngắt khi hết người nghe;
 * - mỗi `intervalMs`: số dao động quanh giá trị nền (mean-reverting), ts = now, quality = good.
 */
export class MockLiveSource implements LiveDataSource {
  status: LiveSourceStatus = 'disconnected';
  private values: LiveData = {};
  private readonly listeners = new Set<Listener>();
  private readonly statusListeners = new Set<(s: LiveSourceStatus) => void>();
  private tick: number | undefined;
  private pending: number | undefined;
  private readonly o: Required<MockLiveSourceOptions>;

  constructor(options: MockLiveSourceOptions) {
    this.o = {
      jitter: {},
      unit: () => undefined,
      intervalMs: 2000,
      connectMs: 300,
      now: () => Date.now(),
      ...options,
    };
    const ts = this.o.now();
    for (const [tag, value] of Object.entries(this.o.base)) this.values[tag] = { value, unit: this.o.unit(tag), ts, quality: 'good' };
  }

  // ----- LiveDataSource -----

  subscribe(tags: readonly string[] | null, cb: (data: LiveData) => void) {
    const l: Listener = { tags: tags ? new Set(tags) : null, cb };
    this.listeners.add(l);
    this.ensureConnection();
    if (this.status === 'connected') cb(this.pick(l.tags));
    return () => {
      this.listeners.delete(l);
      this.maybeIdle();
    };
  }

  getSnapshot(tags: readonly string[] | null) {
    return Promise.resolve(this.pick(tags ? new Set(tags) : null));
  }

  onStatusChange(cb: (s: LiveSourceStatus) => void) {
    this.statusListeners.add(cb);
    this.ensureConnection();
    return () => {
      this.statusListeners.delete(cb);
      this.maybeIdle();
    };
  }

  // ----- Nội bộ -----

  private ensureConnection() {
    if (this.status !== 'disconnected' || this.pending !== undefined) return;
    this.setStatus('connecting');
    this.pending = window.setTimeout(() => this.connect(), this.o.connectMs);
  }

  private connect() {
    this.pending = undefined;
    this.step(true);
    this.setStatus('connected');
    this.emit();
    this.stopTicks();
    this.tick = window.setInterval(() => this.step(false), this.o.intervalMs);
  }

  private maybeIdle() {
    if (this.listeners.size || this.statusListeners.size) return;
    this.stopTicks();
    window.clearTimeout(this.pending);
    this.pending = undefined;
    this.status = 'disconnected';
  }

  private stopTicks() {
    window.clearInterval(this.tick);
    this.tick = undefined;
  }

  private setStatus(s: LiveSourceStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const cb of this.statusListeners) cb(s);
  }

  /** Một bước mô phỏng: dao động quanh giá trị nền, làm tròn 2 chữ số; `fresh` = chỉ làm mới ts. */
  private step(fresh: boolean) {
    const ts = this.o.now();
    const next: LiveData = { ...this.values };
    for (const [tag, cur] of Object.entries(this.values)) {
      let value = cur.value;
      const amp = this.o.jitter[tag];
      const base = this.o.base[tag];
      if (!fresh && amp && typeof base === 'number' && typeof value === 'number') {
        const v = value + (base - value) * 0.3 + (Math.random() * 2 - 1) * amp * 0.6;
        value = Math.round(Math.min(base + amp, Math.max(base - amp, v)) * 100) / 100;
      }
      next[tag] = { value, unit: cur.unit, ts, quality: 'good' };
    }
    this.values = next;
    if (!fresh) this.emit();
  }

  private emit() {
    if (this.status !== 'connected') return;
    for (const l of this.listeners) l.cb(this.pick(l.tags));
  }

  private pick(tags: Set<string> | null): LiveData {
    if (!tags) return { ...this.values };
    const out: LiveData = {};
    for (const t of tags) {
      const v = this.values[t];
      if (v) out[t] = v;
    }
    return out;
  }
}
