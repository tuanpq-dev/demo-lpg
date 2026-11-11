/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chỉ khi VITE_AUTH=off: "true" → bật /editor không cần ?edit=1. Có đăng nhập thì quyền theo vai trò (engineer/admin). */
  readonly VITE_SCENE_EDITOR?: string;
  /** "off" → không đăng nhập (phiên giả admin, demo tĩnh); mặc định "api" (đăng nhập qua backend). */
  readonly VITE_AUTH?: string;
  /** Gốc URL backend, vd "http://localhost:3000" (.env.development); production đặt trong Vercel (Project Settings → Environment Variables). */
  readonly VITE_API_URL?: string;
  /** "true" → bản build cũng nhận `?now=` (dời giờ app để demo hạn chót/quá hạn – src/lib/demoNow.ts). Dev luôn nhận. */
  readonly VITE_DEMO?: string;
  /** Ghim mốc giờ app LÚC BUILD (giờ nhà máy "yyyy-mm-ddTHH:mm" hoặc ISO có Z) – demo nội bộ. Mặc định tắt; KHÔNG đặt trên bản công khai. */
  readonly VITE_FIXED_NOW?: string;
  /** DSN của dự án Sentry – có thì bật giám sát lỗi (src/lib/monitoring.ts); bỏ trống = tắt. Không phải bí mật (DSN vốn công khai). */
  readonly VITE_SENTRY_DSN?: string;
  /** Tên môi trường gửi kèm lỗi ("production", "staging"); mặc định theo MODE của Vite. */
  readonly VITE_APP_ENV?: string;
  /** Mã phiên bản gửi kèm lỗi (vd SHA commit – Vercel: đặt = $VERCEL_GIT_COMMIT_SHA lúc build). */
  readonly VITE_APP_VERSION?: string;
}
