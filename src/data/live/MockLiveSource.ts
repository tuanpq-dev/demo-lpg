import type { LiveData, LiveDataSource, LiveSourceStatus, LiveValue, TagQuality, TagValue } from '@/features/live/types';

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
  /** Sau khi mất kết nối bao lâu thì bắt đầu thử kết nối lại (ms). */
  retryAfterMs?: number;
  now?: () => number;
};

/**
 * Nguồn giả lập (thay bằng WebSocket/SCADA cùng interface LiveDataSource):
 * - kết nối khi có người nghe đầu tiên (subscribe hoặc onStatusChange), ngắt khi hết người nghe;
 * - mỗi `intervalMs`: số dao động quanh giá trị nền (mean-reverting), ts = now, quality theo chế độ giả lập;
 * - giả lập sự cố (test/playground/`?live=`): `simulateDisconnect` (mất kết nối → sau `retryAfterMs` chuyển
 *   "connecting" thử lại liên tục tới khi tắt giả lập), `setQuality(tags, 'bad')`, `freeze(tags)` (ngừng cập nhật
 *   → quá 10 s thành mất tín hiệu), `restore()`.
 */
export class MockLiveSource implements LiveDataSource {
  status: LiveSourceStatus = 'disconnected';
  private values: LiveData = {};
  private readonly listeners = new Set<Listener>();
  private readonly statusListeners = new Set<(s: LiveSourceStatus) => void>();
  private tick: number | undefined;
  private pending: number | undefined;
  private down = false;
  private readonly quality = new Map<string, TagQuality>();
  private readonly frozen = new Set<string>();
  private readonly o: Required<MockLiveSourceOptions>;

  constructor(options: MockLiveSourceOptions) {
    this.o = {
      jitter: {},
      unit: () => undefined,
      intervalMs: 2000,
      connectMs: 300,
      retryAfterMs: 2500,
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

  // ----- Giả lập sự cố -----

  /** Bật: mất kết nối (không còn dữ liệu mới) → sau retryAfterMs "đang kết nối lại". Tắt: kết nối lại. */
  simulateDisconnect(on: boolean) {
    this.down = on;
    window.clearTimeout(this.pending);
    if (on) {
      this.stopTicks();
      this.setStatus('disconnected');
      this.pending = window.setTimeout(() => this.down && this.setStatus('connecting'), this.o.retryAfterMs);
    } else {
      this.setStatus('connecting');
      this.pending = window.setTimeout(() => this.connect(), this.o.connectMs);
    }
  }

  /** Đặt chất lượng cho tag (bad = cảm biến/kênh lỗi; uncertain = không chắc chắn). Có hiệu lực ngay. */
  setQuality(tags: readonly string[], quality: TagQuality) {
    for (const t of tags) {
      if (quality === 'good') this.quality.delete(t);
      else this.quality.set(t, quality);
      const v = this.values[t];
      if (v) this.values[t] = { ...v, quality, ts: this.o.now() };
    }
    this.emit();
  }

  /** Ngừng (true) / tiếp tục cập nhật tag – ts đứng yên → quá 10 s UI báo mất tín hiệu. */
  freeze(tags: readonly string[], frozen = true) {
    for (const t of tags) {
      if (frozen) this.frozen.add(t);
      else this.frozen.delete(t);
    }
  }

  /** Bỏ mọi giả lập sự cố. */
  restore() {
    this.quality.clear();
    this.frozen.clear();
    if (this.down) this.simulateDisconnect(false);
    else this.step(true);
  }

  /** Trạng thái giả lập hiện tại (playground hiển thị). */
  get simulation() {
    return { disconnected: this.down, bad: [...this.quality].filter(([, q]) => q === 'bad').map(([t]) => t), frozen: [...this.frozen] };
  }

  // ----- Nội bộ -----

  private ensureConnection() {
    if (this.status !== 'disconnected' || this.down || this.pending !== undefined) return;
    this.setStatus('connecting');
    this.pending = window.setTimeout(() => this.connect(), this.o.connectMs);
  }

  private connect() {
    this.pending = undefined;
    if (this.down) return;
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
    if (!this.down) this.status = 'disconnected';
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
      if (this.frozen.has(tag)) continue;
      let value = cur.value;
      const amp = this.o.jitter[tag];
      const base = this.o.base[tag];
      if (!fresh && amp && typeof base === 'number' && typeof value === 'number') {
        const v = value + (base - value) * 0.3 + (Math.random() * 2 - 1) * amp * 0.6;
        value = Math.round(Math.min(base + amp, Math.max(base - amp, v)) * 100) / 100;
      }
      next[tag] = { value, unit: cur.unit, ts, quality: this.quality.get(tag) ?? 'good' };
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

/** Tag ở dạng TagValue cố định (test / playground). */
export const tagValue = (value: LiveValue, unit?: string, quality: TagQuality = 'good', ts = Date.now()): TagValue => ({ value, unit, ts, quality });
