/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" → bật /editor không cần ?edit=1 (chưa có phân quyền thật). */
  readonly VITE_SCENE_EDITOR?: string;
}
