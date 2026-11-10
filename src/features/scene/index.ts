// Barrel nhẹ (không kéo three/drei/zod). Luôn import động:
//   SceneViewer – import('@/features/scene/SceneViewer')
//   parse (zod) – import('@/features/scene/parse') (data/scene.ts làm sẵn)
export * from './types';
export type { SceneViewerHandle, SceneViewerProps, SceneEditState, ZoomLimits } from './SceneViewer';
export { type AssetSpec, type ParamDef } from './assets/specs';
export { parseQuality, type QualityPreset, type SceneQuality } from './quality';
