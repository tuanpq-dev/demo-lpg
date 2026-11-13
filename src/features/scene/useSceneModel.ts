/** State dẫn xuất của SceneViewer: cảnh đã áp bản xem trước khi kéo, ẩn/khoá/chọn, trạng thái + nhãn theo dữ liệu trực tiếp. */
import { useMemo, useRef, useState } from 'react';
import { freshNumber } from '@/features/live/signal';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ASSETS } from './assets/registry';
import type { SceneEditState } from './EditTools';
import { objectStatus } from './fields';
import { applyPreview, resolveScene, type CurveCache, type ResolvedObject, type ScenePreview } from './geometry';
import { objectMarker } from './markers';
import type { LiveData, ObjectStatus, SceneConfig } from './types';
import type { ActivePoint } from './useEditPointer';

const EMPTY: readonly string[] = [];

/**
 * Cảnh hiệu lực + lựa chọn. Chế độ sửa: bản xem trước khi đang kéo (object/điểm ống/t) – ống nối đi theo ngay; cache
 * đường cong theo ống → chỉ ống có đường đi đổi mới dựng lại TubeGeometry.
 */
export function useSceneSelection(config: SceneConfig, edit?: SceneEditState) {
  const [preview, setPreview] = useState<ScenePreview | null>(null);
  const curveCache = useRef<CurveCache>(new Map());
  const effective = useMemo(() => applyPreview(config, preview), [config, preview]);
  const scene = useMemo(() => resolveScene(effective, curveCache.current), [effective]);
  const editSelected = edit?.selected ?? EMPTY;
  const selectedPipe = edit ? effective.pipes.find((p) => editSelected.includes(p.id)) : undefined;
  const [activePoint, setActivePoint] = useState<ActivePoint | null>(null);
  const activeIndex = activePoint?.pipe === selectedPipe?.id ? (activePoint?.index ?? null) : null;
  const hiddenIds = edit?.hidden;
  const lockedIds = edit?.locked;
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);
  const selected = useMemo(() => new Set(editSelected), [editSelected]);
  const skipPick = useMemo(() => new Set([...hidden, ...locked]), [hidden, locked]);
  const visible = hidden.size ? scene.objects.filter((o) => !hidden.has(o.id)) : scene.objects;
  return { effective, scene, setPreview, selectedPipe, setActivePoint, activeIndex, locked, selected, skipPick, visible };
}

/** Trạng thái, nhãn, lưu lượng theo dữ liệu trực tiếp; `animated` = cần vẽ liên tục (ống đang chảy / object danger). */
export function useSceneLive(config: SceneConfig, visible: readonly ResolvedObject[], liveData?: LiveData) {
  const thresholds = config.thresholds;
  // Nhãn tự sinh từ object.marker + label + bindings + liveData.
  const labels = visible.flatMap((o) => {
    const m = objectMarker(o, liveData, thresholds);
    return m ? [{ obj: o, marker: m }] : [];
  });
  const statuses = new Map<string, ObjectStatus>(
    visible.map((o) => [o.id, ASSETS[o.asset].category === 'equipment' ? objectStatus(o, liveData, thresholds) : 'normal']),
  );
  // Lưu lượng tươi (mất tín hiệu → không chạy vệt sáng, không giữ số cũ).
  const flowOf = (tag?: string) => (tag ? freshNumber(liveData?.[tag]) : undefined);
  // prefers-reduced-motion: không vệt chảy/không pulse → không cần vẽ liên tục.
  const reducedMotion = useReducedMotion();
  const flowing = config.pipes.some((p) => (flowOf(p.flowTag) ?? 0) > 0);
  const animated = !reducedMotion && (flowing || [...statuses.values()].includes('danger'));
  return { labels, markedIds: new Set(labels.map((l) => l.obj.id)), statuses, flowOf, reducedMotion, animated };
}
