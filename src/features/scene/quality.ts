/**
 * Preset chất lượng cho cảnh 3D. 'auto' (mặc định) bắt đầu ở 'high' rồi hạ/nâng theo drei <PerformanceMonitor>;
 * ghi đè cố định bằng prop `quality` (Tổng quan: `?quality=low|medium|high`).
 */
export const SCENE_QUALITIES = ['low', 'medium', 'high'] as const;
export type SceneQuality = (typeof SCENE_QUALITIES)[number];

export type QualityPreset = {
  /** Key light đổ bóng (PCF + bán kính blur). */
  shadows: boolean;
  shadowMapSize: number;
  /** EffectComposer (chunk lazy): Bloom + Outline (hover/chọn) + ToneMapping. Tắt → tone mapping của renderer, quầng ống giả, hover = nét viền. */
  postprocessing: boolean;
  /** Khử răng cưa trong composer: MSAA của render target (số mẫu) hoặc SMAA. */
  multisampling: number;
  smaa: boolean;
  /** Số mức mip của Bloom (mipmapBlur) – ít hơn = nhẹ hơn, quầng ngắn hơn. */
  bloomLevels: number;
  /** Buffer HalfFloat (HDR trước tone mapping) – tắt → 8 bit, rẻ băng thông hơn, đỉnh sáng bị cắt sớm. */
  hdr: boolean;
  dpr: [number, number];
};

export const QUALITY_PRESETS: Record<SceneQuality, QualityPreset> = {
  high: {
    shadows: true,
    shadowMapSize: 2048,
    postprocessing: true,
    multisampling: 4,
    smaa: false,
    bloomLevels: 8,
    hdr: true,
    dpr: [1, 1.5],
  },
  medium: {
    shadows: true,
    // Shadow map tĩnh (chỉ render khi cảnh đổi) → 2048 gần như không tốn thêm mỗi frame; 1024 + blur gây lấm tấm.
    shadowMapSize: 2048,
    postprocessing: true,
    multisampling: 0,
    smaa: false,
    bloomLevels: 5,
    hdr: false,
    dpr: [1, 1.25],
  },
  low: {
    shadows: false,
    shadowMapSize: 512,
    postprocessing: false,
    multisampling: 0,
    smaa: false,
    bloomLevels: 0,
    hdr: false,
    dpr: [1, 1],
  },
};

export function parseQuality(value: string | null | undefined): SceneQuality | undefined {
  return SCENE_QUALITIES.find((q) => q === value);
}

/** WebGL dùng được không (tạo context thử). */
export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
