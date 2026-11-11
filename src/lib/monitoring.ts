/**
 * Giám sát lỗi runtime (Sentry). TẮT hoàn toàn khi không có `VITE_SENTRY_DSN` (dev, bản demo) – không tải SDK, không gửi gì.
 * Có DSN: SDK tải LƯỜI lúc trình duyệt rảnh (chunk riêng, không nằm trong bundle tải đầu); lỗi xảy ra trước khi SDK sẵn
 * sàng được giữ trong hàng đợi rồi gửi bù. Không gửi thông tin người dùng (`sendDefaultPii: false`, không `setUser`).
 * Nơi báo: lỗi JS toàn cục + promise không bắt (SDK tự nghe), lỗi render / loader (`RouteError`), response sai hợp đồng
 * API (`src/api/client.ts`).
 */
const DSN = import.meta.env.VITE_SENTRY_DSN;

type Context = Record<string, string | number | boolean | undefined>;
type Capture = (error: unknown, context?: Context) => void;

/** Hàng đợi lỗi sớm (giới hạn để vòng lặp lỗi không ngốn bộ nhớ). */
const MAX_QUEUE = 20;
const queue: { error: unknown; context?: Context }[] = [];
let capture: Capture | null = null;

/** Lỗi không đáng báo: người dùng / app chủ động huỷ, tab mở lâu gặp chunk cũ sau deploy (app tự tải lại). */
const IGNORED = [/AbortError/, /Failed to fetch dynamically imported module/i, /Importing a module script failed/i, /Unable to preload CSS/i];

/** Báo một lỗi đã bắt được (không ném lại). Không có DSN → bỏ qua. */
export function reportError(error: unknown, context?: Context): void {
  if (!DSN) return;
  if (capture) capture(error, context);
  else if (queue.length < MAX_QUEUE) queue.push({ error, context });
}

/** Gọi MỘT lần lúc khởi động app (trước khi render). */
export function initMonitoring(): void {
  if (!DSN || typeof window === 'undefined') return;
  // Trước khi SDK tải xong: tự nghe lỗi toàn cục để không sót lỗi lúc khởi động.
  const onError = (e: ErrorEvent) => reportError(e.error ?? e.message, { source: 'window.onerror' });
  const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, { source: 'unhandledrejection' });
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  const load = () => {
    import('./sentryClient')
      .then((Sentry) => {
        Sentry.init({
          dsn: DSN,
          environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
          release: import.meta.env.VITE_APP_VERSION,
          sendDefaultPii: false,
          // Chỉ báo lỗi – không đo hiệu năng / ghi lại phiên (thêm sau nếu cần, có chi phí).
          tracesSampleRate: 0,
          ignoreErrors: IGNORED,
        });
        // Từ đây SDK tự nghe lỗi toàn cục.
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
        capture = (error, context) => {
          Sentry.captureException(error, context ? { extra: context } : undefined);
        };
        for (const q of queue.splice(0)) capture(q.error, q.context);
      })
      .catch(() => {
        // Không tải được SDK (chặn quảng cáo, mất mạng): app vẫn chạy bình thường, bỏ giám sát cho phiên này.
        queue.length = 0;
      });
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 2000);
}
