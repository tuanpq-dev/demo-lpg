// Barrel nhẹ (không kéo three/drei/zod). Phần vẽ R3F ở `src/scene3d` (luôn import động:
//   import('@/scene3d/SceneViewer')); parse (zod) – import('@/features/scene/parse') (data/scene làm sẵn).
export * from './types';
export type { EditTool, ObjectTransform, SceneEditState, SelectHow } from './edit';
export { type AssetSpec, type ParamDef } from './assets/specs';
export { parseQuality, type QualityPreset, type SceneQuality } from './quality';
