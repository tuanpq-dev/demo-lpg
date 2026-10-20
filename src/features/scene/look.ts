/**
 * Thông số "look" của cảnh 3D (ánh sáng, tone mapping, bloom, nét viền) – gom một chỗ để chỉnh khi so với ảnh Figma 53:244.
 * Màu không nằm ở đây: lấy từ token qua `readScenePalette()`.
 */

/** Dev: `?exposure=1.2` để thử nhanh mà không sửa code. */
function devNumber(name: string): number | undefined {
  if (!import.meta.env.DEV || typeof location === 'undefined') return undefined;
  const raw = new URLSearchParams(location.search).get(name);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** Độ phơi sáng của tone mapping ACESFilmic (renderer khi không có postprocessing, ToneMapping effect khi có). */
export const SCENE_EXPOSURE = devNumber('exposure') ?? 0.78;

export const LOOK = {
  /**
   * Key light: trên cao, lệch về phía camera (+X, +Z) → mặt trên sáng nhất, mặt đứng hướng camera sáng vừa,
   * bóng đổ rơi ra sau vật (−X, −Z) như Figma (gần như không thấy bóng phía trước).
   */
  key: { direction: [0.42, 0.82, 0.38] as const, distance: 70, intensity: 2.1, shadowRadius: 4, shadowBias: -0.0005 },
  /** Hemisphere: trời trắng lạnh (text-primary) + đất xanh đậm (bg-header) → vùng khuất ngả xanh, không đen. */
  hemi: { intensity: 1.3 },
  /** Độ đậm bóng đổ trên sàn (shadowMaterial). */
  shadowOpacity: 0.5,
  /** Vùng chiếu bóng (m, quanh gốc toạ độ). */
  shadowExtent: 55,
  /** Nét viền mực ở mép khối (EdgesGeometry, góc ≥ edgeAngle độ). */
  edges: { angle: 32, opacity: 0.55 },
  /** Bloom (chỉ phần emissive vượt ngưỡng: lõi ống, vệt dòng chảy, vòng sáng khớp nối). */
  bloom: { threshold: 0.55, smoothing: 0.1, intensity: 1.1, radius: 0.8 },
} as const;
