import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Outline, SMAA, ToneMapping } from '@react-three/postprocessing';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { HalfFloatType, UnsignedByteType, type Mesh } from 'three';
import type { ScenePalette } from './colors';
import { LOOK } from './look';
import type { QualityPreset } from './quality';

/** ToneMappingMode.ACES_FILMIC của `postprocessing` (mặc định của effect là AgX). */
const TONE_MAPPING_ACES = 6;

/** Mỗi Outline cần lớp (layer) chọn riêng – dùng chung sẽ lẫn selection của nhau. */
const OUTLINE_LAYERS = { hover: 11, selected: 12 } as const;

/**
 * Hậu kỳ (preset high/medium):
 * - Bloom chỉ bắt phần emissive vượt ngưỡng (lõi ống, vệt chảy, vòng khớp, nét viền HDR);
 * - Outline: hover (primary) · đang chọn (primary đậm hơn, thấy cả phần bị che). Chỉ tốn pass khi selection khác rỗng –
 *   danger KHÔNG dùng Outline (luôn có selection → thêm depth pass mỗi frame); danger = nét viền đỏ pulse + vòng sáng sàn;
 * - ToneMapping ACES (cùng exposure với renderer) → SMAA hoặc MSAA của render target (theo preset).
 * Chunk lazy riêng (postprocessing ~85KB gzip): preset low không tải; báo `onActive` để nền dùng màu đã bù tone mapping.
 */
export default function PostEffects({
  preset,
  palette,
  hovered,
  selected,
  shapeKey,
  onActive,
}: {
  preset: QualityPreset;
  palette: ScenePalette;
  hovered: string | null;
  selected: readonly string[];
  /** Đổi cảnh/nháp → mesh có thể đổi → tính lại selection. */
  shapeKey: unknown;
  onActive: (active: boolean) => void;
}) {
  useLayoutEffect(() => {
    onActive(true);
    return () => onActive(false);
  }, [onActive]);
  const { threshold, smoothing, intensity, radius } = LOOK.bloom;
  const scene = useThree((s) => s.scene);
  const meshesOf = useCallback(
    (ids: (string | null)[]) => {
      const out: Mesh[] = [];
      for (const id of ids) {
        scene.getObjectByName(id ?? '')?.traverse((o) => {
          if ((o as Mesh).isMesh && !o.userData.noShadow) out.push(o as Mesh);
        });
      }
      return out;
    },
    [scene],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedKey = selected.join();
  const hoverSel = useMemo(
    () => meshesOf(hovered && !selected.includes(hovered) ? [hovered] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meshesOf, hovered, selectedKey, shapeKey],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedSel = useMemo(() => meshesOf([...selected]), [meshesOf, selectedKey, shapeKey]);

  return (
    <EffectComposer
      multisampling={preset.multisampling}
      frameBufferType={preset.hdr ? HalfFloatType : UnsignedByteType}
      enableNormalPass={false}
    >
      <Bloom
        mipmapBlur
        levels={preset.bloomLevels}
        luminanceThreshold={threshold}
        luminanceSmoothing={smoothing}
        intensity={intensity}
        radius={radius}
      />
      <Outline
        selection={hoverSel}
        selectionLayer={OUTLINE_LAYERS.hover}
        visibleEdgeColor={palette.primary.getHex()}
        hiddenEdgeColor={palette.primary.getHex()}
        edgeStrength={4}
        blur
        xRay={false}
      />
      <Outline
        selection={selectedSel}
        selectionLayer={OUTLINE_LAYERS.selected}
        visibleEdgeColor={palette.primary.getHex()}
        hiddenEdgeColor={palette.primary.getHex()}
        edgeStrength={9}
        xRay
      />
      <ToneMapping mode={TONE_MAPPING_ACES} />
      {preset.smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
