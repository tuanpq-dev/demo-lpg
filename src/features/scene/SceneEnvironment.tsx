/** Môi trường cảnh 3D: bắt lỗi WebGL, tone mapping, ánh sáng, cập nhật bóng, sàn + lưới. Tách từ SceneViewer.tsx. */
import { Grid } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Component, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { ACESFilmicToneMapping, AdditiveBlending, CanvasTexture, SRGBColorSpace, type Color } from 'three';
import type { ScenePalette } from './colors';
import { LOOK } from './look';
import type { QualityPreset, SceneQuality } from './quality';

const noRaycast = () => null;

/** Bắt lỗi khi dựng Canvas/WebGLRenderer (vd. GPU bị chặn) → báo lên để rơi về ảnh 2.5D. */
export class WebGLErrorBoundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** ACESFilmic + sRGB + exposure (một biến: SCENE_EXPOSURE). EffectComposer tự tắt tone mapping renderer và dùng ToneMapping effect. */
export function RendererLook({ exposure }: { exposure: number }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [gl, exposure, invalidate]);
  return null;
}

/**
 * Hemisphere (trời lạnh / đất xanh đậm) + key light trắng trung tính (không nhuộm màu asset) chéo từ trên cao phía camera, đổ bóng PCF có bán kính blur.
 * Đổi kích thước shadow map → remount đèn (three không tự tạo lại shadow map).
 */
export function SceneLights({ palette, preset }: { palette: ScenePalette; preset: QualityPreset }) {
  const { direction, distance, intensity, shadowRadius, shadowBias } = LOOK.key;
  const e = LOOK.shadowExtent;
  const size = preset.shadowMapSize;
  return (
    <>
      <hemisphereLight args={[palette.sky, palette.shade, LOOK.hemi.intensity]} />
      <directionalLight
        key={size}
        position={[direction[0] * distance, direction[1] * distance, direction[2] * distance]}
        intensity={intensity}
        castShadow={preset.shadows}
        shadow-mapSize={[size, size]}
        shadow-radius={shadowRadius}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={1}
        shadow-camera-far={distance * 2.5}
        shadow-bias={shadowBias}
        shadow-normalBias={0.02}
      />
    </>
  );
}

/**
 * Cảnh tĩnh → không render lại shadow map mỗi frame (frameloop 'always' chỉ vì ống chảy/pulse).
 * Cập nhật một lần khi cảnh/preset đổi; chế độ sửa (`live`) cập nhật liên tục để bóng theo gizmo khi kéo.
 */
export function ShadowUpdates({ live, version, level }: { live: boolean; version: unknown; level: SceneQuality }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    gl.shadowMap.autoUpdate = live;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, live, version, level, invalidate]);
  useEffect(
    () => () => {
      gl.shadowMap.autoUpdate = true;
    },
    [gl],
  );
  return null;
}

/** Mặt nạ độ sáng tròn mờ dần cho "đèn nền" giữa sàn (nhân với màu token, blending cộng). */
function createFalloffTexture(stops: [number, number][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, v] of stops) grad.addColorStop(at, `rgb(${v} ${v} ${v})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

/** Sàn: nhận bóng + vùng sáng nhẹ ở giữa (Figma: giữa #0A1827, rìa #081323) + lưới token. */
/**
 * Sàn CHỈ ĐỂ NHÌN (không nhận tia – kéo/thả tính bằng GROUND_PLANE trong EditTools): mặt sàn lớn màu `scene-ground`
 * (cùng màu nền, đã bù tone mapping khi có composer), lớp nhận bóng, vùng sáng giữa sàn, lưới `scene-grid`.
 */
export function Ground({ palette, grid = true, color }: { palette: ScenePalette; grid?: boolean; color: Color }) {
  const falloff = useMemo(
    () =>
      createFalloffTexture([
        [0, 255],
        [0.45, 150],
        [1, 0],
      ]),
    [],
  );
  useEffect(() => () => falloff.dispose(), [falloff]);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} renderOrder={-3} raycast={noRaycast}>
        <planeGeometry args={[800, 800]} />
        <meshBasicMaterial color={color} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow raycast={noRaycast}>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial transparent opacity={LOOK.shadowOpacity} color={palette.shade} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} renderOrder={-2} raycast={noRaycast}>
        <planeGeometry args={[150, 150]} />
        <meshBasicMaterial color={palette.grid} map={falloff} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {grid && (
        <Grid
          raycast={noRaycast}
          position-y={-0.01}
          infiniteGrid
          cellSize={2}
          cellThickness={0.5}
          cellColor={palette.grid}
          sectionSize={10}
          sectionThickness={1}
          sectionColor={palette.grid}
          fadeDistance={220}
          fadeStrength={2.5}
        />
      )}
    </>
  );
}
