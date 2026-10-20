import { Button, Card, PlantMap, type PlantMapThreeProps } from '@/components';
import { useSceneConfig } from '@/data/scene';
import { Placeholder } from './Placeholder';

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
      <Card title="Không tải được cảnh 3D" headerVariant="plain" tone="danger">
        <pre className="mb-4 whitespace-pre-wrap font-mono text-sm text-fg-secondary">{error.message}</pre>
        <div className="flex gap-2">
          <Button onClick={refetch}>Thử lại</Button>
          {props.onRendererChange && <Button onClick={() => props.onRendererChange?.('image')}>Về bản đồ 2.5D</Button>}
        </div>
      </Card>
    );
  }
  return <PlantMap renderer="three" scene={data} height={height} {...props} />;
}
