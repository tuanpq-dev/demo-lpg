/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Chỉ khi VITE_AUTH=off: "true" → bật /editor không cần ?edit=1. Có đăng nhập thì quyền theo vai trò (engineer/admin). */
  readonly VITE_SCENE_EDITOR?: string;
  /** "off" → không đăng nhập (phiên giả admin, demo tĩnh); mặc định "api" (đăng nhập qua backend). */
  readonly VITE_AUTH?: string;
  /** Gốc URL backend, vd "http://localhost:3000" (.env.development); production đặt trong Netlify. */
  readonly VITE_API_URL?: string;
}
