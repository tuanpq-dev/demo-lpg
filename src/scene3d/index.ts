/*
 * Lớp vẽ bản đồ 3D (React Three Fiber): `PlantMap` (chuyển 2.5D ảnh / 3D), `SceneViewer` (canvas, camera, đèn, thiết bị, ống,
 * nhãn, công cụ sửa của Editor), asset dựng thủ tục. Dữ liệu + hình học thuần ở `features/scene`, Editor ở `features/scene-editor`.
 *
 * Barrel NHẸ – không kéo three/drei vào chunk của nơi import. `SceneViewer` luôn tải lười:
 *   lazy(() => import('@/scene3d/SceneViewer'))
 */
export { PlantMap, preloadSceneViewer } from './PlantMap';
export { sceneSnapshot } from './sceneSnapshot';
export type { RigApi, SceneViewerHandle, SceneViewerProps, ZoomLimits } from './SceneViewer';
