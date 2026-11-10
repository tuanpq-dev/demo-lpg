import { Color, SRGBColorSpace } from 'three';
import type { ColorToken } from '@/lib/tokens';

/**
 * Token màu → THREE.Color (đọc CSS var dạng kênh "R G B").
 * Không dùng chuỗi rgb() vì parser của three chưa hiểu cú pháp cách khoảng trắng.
 */
export function sceneColor(name: ColorToken): Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  const [r = 0, g = 0, b = 0] = raw.split(/\s+/).map(Number);
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}

export type ScenePalette = ReturnType<typeof readScenePalette>;

/** Toàn bộ màu cảnh dùng – đọc một lần khi mount Viewer (app hiện chỉ có theme tối). */
export function readScenePalette() {
  return {
    ground: sceneColor('scene-ground'),
    grid: sceneColor('scene-grid'),
    asset: sceneColor('scene-asset'),
    muted: sceneColor('surface-muted'),
    line: sceneColor('line'),
    neutral: sceneColor('neutral'),
    flow: sceneColor('scene-flow'),
    primary: sceneColor('primary'),
    accent: sceneColor('accent'),
    warning: sceneColor('warning'),
    danger: sceneColor('danger-strong'),
    /** Hemisphere: trời trắng lạnh + đất xanh đậm cho vùng khuất (tông lạnh ở mặt hướng xuống/khuất). */
    sky: sceneColor('text-primary'),
    shade: sceneColor('bg-header'),
  };
}

// ---------------------------------------------------------------------------
// Bù tone mapping: khi có EffectComposer, ToneMapping effect áp ACES lên cả màu nền (clear color) → nền tối hơn token.
// Tìm màu tuyến tính x sao cho ACES(x) = màu token để nền vẫn đúng token.

type V3 = [number, number, number];

/** ACESFilmic của three (tonemapping_pars_fragment), không gồm bước saturate. */
function acesFilmic([r, g, b]: V3, exposure: number): V3 {
  const k = exposure / 0.6;
  const [x, y, z] = [r * k, g * k, b * k];
  // ACESInputMat (cột) × màu
  const i: V3 = [0.59719 * x + 0.35458 * y + 0.04823 * z, 0.076 * x + 0.90834 * y + 0.01566 * z, 0.0284 * x + 0.13383 * y + 0.83777 * z];
  const f = i.map((v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)) as V3;
  return [
    1.60475 * f[0] - 0.53108 * f[1] - 0.07367 * f[2],
    -0.10208 * f[0] + 1.10813 * f[1] - 0.00605 * f[2],
    -0.00327 * f[0] - 0.07276 * f[1] + 1.07602 * f[2],
  ];
}

/** Màu tuyến tính trước tone mapping cho ra `target` (tuyến tính) sau ACES – lặp điểm bất động theo từng kênh. */
export function inverseToneMap(target: Color, exposure: number): Color {
  const want: V3 = [target.r, target.g, target.b];
  let x: V3 = [...want];
  for (let n = 0; n < 40; n++) {
    const y = acesFilmic(x, exposure);
    x = x.map((v, c) => Math.max(0, v + (want[c]! - y[c]!) * 1.6)) as V3;
  }
  return new Color(x[0], x[1], x[2]);
}
