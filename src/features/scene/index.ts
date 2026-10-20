// Barrel nhẹ (không kéo three/drei/zod). Luôn import động:
//   SceneViewer – import('@/features/scene/SceneViewer')
//   parse (zod) – import('@/features/scene/parse') (data/scene.ts làm sẵn)
export * from './types';
export type { SceneViewerHandle, SceneViewerProps, SceneEditState, ZoomLimits } from './SceneViewer';
export { ASSET_SPECS, assetLayout, resolveParams, type AssetSpec, type ParamDef } from './assets/specs';
export { FIELD_META, formatField, objectStatus } from './fields';
export { parseQuality, QUALITY_PRESETS, SCENE_QUALITIES, type QualityPreset, type SceneQuality } from './quality';
