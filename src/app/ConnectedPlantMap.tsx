import { useEffect } from 'react';
import { Button, PlantMap, SceneLoading, preloadSceneViewer, type PlantMapThreeProps } from '@/components';
import { useSceneConfig } from '@/data/scene';
import { PageError } from './Placeholder';

export type ConnectedPlantMapProps = Omit<PlantMapThreeProps, 'renderer' | 'scene'> & { sceneId: string };

/**
 * PlantMap 3D nối dữ liệu: nạp + validate cảnh theo `sceneId` (useSceneConfig) rồi truyền `scene` vào PlantMap thuần.
 * 3 trạng thái: loading (`SceneLoading` trong khung y hệt bản đồ – liền mạch với lớp chờ bên trong SceneViewer) · error (Card danger + "Thử lại", kèm "Về bản đồ 2.5D" nếu có onRendererChange) · success.
 */
export function ConnectedPlantMap({ sceneId, height = 589, ...props }: ConnectedPlantMapProps) {
  const { status, data, error, refetch } = useSceneConfig(sceneId);
  // Tải code 3D song song với dữ liệu cảnh.
  useEffect(preloadSceneViewer, []);

  if (status === 'loading') {
    // Cùng khung (viền, bo góc, chiều cao) với MapShell → không nhảy layout khi cảnh về.
    return (
      <div className="relative overflow-clip rounded-xl border border-line/30 bg-surface p-px shadow-card" style={{ height: height + 2 }}>
        <SceneLoading className="rounded-[11px]" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <PageError
        title="Không tải được cảnh 3D"
        error={error}
        onRetry={refetch}
        preformatted
        actions={props.onRendererChange && <Button onClick={() => props.onRendererChange?.('image')}>Về bản đồ 2.5D</Button>}
      />
    );
  }
  return <PlantMap renderer="three" scene={data} height={height} {...props} />;
}
