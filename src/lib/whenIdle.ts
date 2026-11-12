/**
 * Chạy `fn` khi trình duyệt rảnh (`requestIdleCallback`, chậm nhất `timeoutMs`); trình duyệt không hỗ trợ (Safari) → sau
 * `fallbackMs`. Trả về hàm huỷ (dùng làm cleanup của effect).
 */
export function whenIdle(fn: () => void, { timeoutMs = 4000, fallbackMs = 2000 } = {}): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const t = window.setTimeout(fn, fallbackMs);
  return () => window.clearTimeout(t);
}

/**
 * Nạp trước chunk lười (drawer, modal…) lúc rảnh để lần mở đầu không phải chờ mạng. Lỗi nạp bị bỏ qua – lúc mở thật
 * `lazy()` gọi lại loader và lỗi (nếu còn) đi qua errorElement như mọi chunk khác.
 */
export function preloadWhenIdle(...loaders: (() => Promise<unknown>)[]): () => void {
  return whenIdle(() => loaders.forEach((load) => void load().catch(() => undefined)));
}
