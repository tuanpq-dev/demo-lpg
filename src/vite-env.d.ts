/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chỉ khi VITE_AUTH=off: "true" → bật /editor không cần ?edit=1. Có đăng nhập thì quyền theo vai trò (engineer/admin). */
  readonly VITE_SCENE_EDITOR?: string;
  /** "off" → không đăng nhập (phiên giả admin, demo tĩnh); mặc định "api" (đăng nhập qua backend). */
  readonly VITE_AUTH?: string;
  /** Gốc URL backend, vd "http://localhost:3000" (.env.development); production đặt trong Netlify. */
  readonly VITE_API_URL?: string;
  /** "true" → bản build cũng nhận `?now=` (dời giờ app để demo hạn chót/quá hạn – src/lib/demoNow.ts). Dev luôn nhận. */
  readonly VITE_DEMO?: string;
  /** Ghim mốc giờ app LÚC BUILD (giờ nhà máy "yyyy-mm-ddTHH:mm" hoặc ISO có Z) – demo nội bộ. Mặc định tắt; KHÔNG đặt trên bản công khai. */
  readonly VITE_FIXED_NOW?: string;
}
