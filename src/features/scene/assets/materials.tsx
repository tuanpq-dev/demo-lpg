import { useFrame } from '@react-three/fiber';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { LineBasicMaterial, MeshStandardMaterial } from 'three';
import type { ScenePalette } from '../colors';
import { LOOK } from '../look';
import { prefersReducedMotion } from '@/lib/reducedMotion';
import { pulse } from '../pulse';
import type { ObjectStatus } from '../types';

/**
 * - body: thân thiết bị/nhà (xám nhạt "đất sét", nhám) · concrete: bệ/sàn (tối hơn, rất nhám)
 * - metal: ống phụ, bích, lan can, thang (kim loại nhạt, hơi bóng) · shiny: thân bồn xe (kim loại sáng, bóng hơn)
 * - cab: cabin/tủ (sơn tối hơn thân) · dark: chi tiết tối (cửa cuốn, tay quay) · rubber: lốp
 * - glass: kính/màn hình · glow: vòng sáng khớp nối/van (emissive màu dòng chảy – bloom)
 */
export type MaterialKind = 'body' | 'concrete' | 'metal' | 'shiny' | 'cab' | 'dark' | 'rubber' | 'glass' | 'glow';
export type AssetMaterials = Record<MaterialKind, MeshStandardMaterial>;

/** Nét viền mực theo trạng thái object (hover/selected tô primary, warning/danger tô màu trạng thái). */
export type EdgeTone = 'normal' | 'hover' | 'selected' | 'warning' | 'danger' | 'offline';

type ObjectState = { status: ObjectStatus; hovered: boolean };

const ObjectStateContext = createContext<ObjectState>({ status: 'normal', hovered: false });
type Cache = { get: (s: ObjectState) => AssetMaterials; edges: Record<EdgeTone, LineBasicMaterial> };
const MaterialCacheContext = createContext<Cache | null>(null);

export const ObjectStateProvider = ObjectStateContext.Provider;

/**
 * Bộ vật liệu dùng chung theo (offline × hover): tối đa 4 bộ cho toàn cảnh thay vì mỗi object một bộ.
 * Trạng thái warning/danger KHÔNG tô cả khối – chỉ nét viền (edges) + outline + vòng sáng sàn.
 * Hover → emissive primary nhẹ; offline → tối màu. Dispose toàn bộ khi Viewer unmount.
 */
export function MaterialsProvider({ palette, children }: { palette: ScenePalette; children: ReactNode }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Cố ý phụ thuộc `palette`: đổi bảng màu → bỏ cache vật liệu cũ.
  const cache = useMemo(() => new Map<string, AssetMaterials>(), [palette]);

  const edges = useMemo(() => {
    const line = (color: ScenePalette['asset'], opacity: number, boost = 1) =>
      new LineBasicMaterial({ color: color.clone().multiplyScalar(boost), transparent: true, opacity, depthWrite: false });
    return {
      normal: line(palette.shade, LOOK.edges.opacity),
      offline: line(palette.shade, LOOK.edges.opacity * 0.7),
      // Primary/danger nhân > 1 (HDR) để bloom bắt được nét viền khi có postprocessing.
      hover: line(palette.primary, 0.9, 1.6),
      selected: line(palette.primary, 1, 2.4),
      warning: line(palette.warning, 0.9, 1.2),
      danger: line(palette.danger, 1, 2.2),
    } satisfies Record<EdgeTone, LineBasicMaterial>;
  }, [palette]);

  // Danger: nét viền đỏ pulse chậm (đồng pha với outline/vòng sáng sàn qua pulse()).
  useFrame(({ clock }) => {
    edges.danger.opacity = 0.3 + 0.7 * pulse(clock.elapsedTime, prefersReducedMotion());
  });

  useEffect(
    () => () => {
      cache.forEach((set) => Object.values(set).forEach((m) => m.dispose()));
      cache.clear();
      Object.values(edges).forEach((m) => m.dispose());
    },
    [cache, edges],
  );

  const get = useMemo(
    () =>
      ({ status, hovered }: ObjectState): AssetMaterials => {
        const offline = status === 'offline';
        const key = `${offline ? 1 : 0}|${hovered ? 1 : 0}`;
        let set = cache.get(key);
        if (set) return set;

        const dim = offline ? 0.55 : 1;
        const make = (base: ScenePalette['asset'], lightness: number, roughness: number, metalness = 0.04) => {
          const m = new MeshStandardMaterial({
            color: base.clone().multiplyScalar(lightness * dim),
            roughness,
            metalness,
            // Đẩy mặt khối lùi nhẹ → nét viền mực nằm trên mép không bị z-fighting.
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          });
          if (hovered) {
            m.emissive.copy(palette.primary);
            m.emissiveIntensity = 0.14;
          }
          return m;
        };

        const glow = make(palette.flow, 1, 0.4);
        glow.emissive.copy(palette.flow);
        glow.emissiveIntensity = offline ? 0.3 : 1.6;

        set = {
          body: make(palette.asset, 1, 0.86),
          concrete: make(palette.asset, 0.7, 0.96),
          metal: make(palette.neutral, 0.86, 0.5, 0.22),
          shiny: make(palette.asset, 1.04, 0.32, 0.28),
          cab: make(palette.asset, 0.76, 0.6, 0.1),
          dark: make(palette.muted, 1, 0.75),
          rubber: make(palette.line, 0.9, 0.92),
          glass: make(palette.line, 1, 0.22, 0.3),
          glow,
        };
        cache.set(key, set);
        return set;
      },
    [cache, palette],
  );

  const value = useMemo(() => ({ get, edges }), [get, edges]);
  return <MaterialCacheContext.Provider value={value}>{children}</MaterialCacheContext.Provider>;
}

function useCache(): Cache {
  const c = useContext(MaterialCacheContext);
  if (!c) throw new Error('useAssetMaterials phải nằm trong <MaterialsProvider>');
  return c;
}

/** Vật liệu cho asset hiện tại (theo trạng thái/hover của object chứa nó). */
export function useAssetMaterials(): AssetMaterials {
  const { get } = useCache();
  return get(useContext(ObjectStateContext));
}

/** Vật liệu nét viền dùng chung theo tone. */
export function useEdgeMaterials(): Record<EdgeTone, LineBasicMaterial> {
  return useCache().edges;
}
