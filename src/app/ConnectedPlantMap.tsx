import { Button, PlantMap, type PlantMapThreeProps } from '@/components';
import { useSceneConfig } from '@/data/scene';
import { PageError, Placeholder } from './Placeholder';

export type ConnectedPlantMapProps = Omit<PlantMapThreeProps, 'renderer' | 'scene'> & { sceneId: string };

/**
 * PlantMap 3D nối dữ liệu: nạp + validate cảnh theo `sceneId` (useSceneConfig) rồi truyền `scene` vào PlantMap thuần.
 * 3 trạng thái: loading (Placeholder) · error (Card danger + "Thử lại", kèm "Về bản đồ 2.5D" nếu có onRendererChange) · success.
 */
export function ConnectedPlantMap({ sceneId, height = 589, ...props }: ConnectedPlantMapProps) {
  const { status, data, error, refetch } = useSceneConfig(sceneId);

  if (status === 'loading') return <Placeholder label="Đang tải cảnh 3D…" height={height + 2} />;
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
