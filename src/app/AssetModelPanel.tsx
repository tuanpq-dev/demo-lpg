import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { Button, Card, FocusIcon, ResponsiveImage, SceneLoading, SignalLostIcon, preloadSceneViewer } from '@/components';
import { useSceneConfig } from '@/data/scene';
import { sceneSnapshot } from '@/features/scene/sceneSnapshot';
import type { LiveData } from '@/features/live/types';
import { cn } from '@/lib/cn';
import type { ImageAsset } from '@/lib/imageAsset';
import { useFullscreen } from '@/hooks/useFullscreen';

// three + drei chỉ tải khi trang có mô hình 3D (chunk lazy dùng chung với Tổng quan).
const SceneViewer = lazy(() => import('@/features/scene/SceneViewer'));

export type AssetModelPanelProps = {
  /** Cảnh chỉ có tài sản (src/mocks/scenes/<id>.json). */
  sceneId: string;
  /** Tên tài sản – tên vùng 3D cho trình đọc màn hình + alt ảnh tĩnh. */
  assetName: string;
  liveData?: LiveData;
  /** Nhãn góc trên trái: tiêu đề + dòng số liệu (đã định dạng; `signalLost` → "Mất tín hiệu"). */
  tag?: { title: string; line: string; signalLost?: boolean };
  /** Mô tả văn bản thay cho canvas (tóm tắt số liệu chính). */
  description: string;
  /** Ảnh tĩnh khi WebGL lỗi / cảnh không nạp được. */
  fallbackImage: string | ImageAsset;
  className?: string;
};

/**
 * "Mô hình tài sản" (cột trái trang chi tiết): SceneViewer 3D của cảnh riêng tài sản + nhãn số liệu trực tiếp + nút
 * toàn màn hình. WebGL không chạy / cảnh lỗi → ảnh tĩnh chụp từ chính cảnh đó (src/assets/digital-twin).
 * Nối dữ liệu (useSceneConfig) nên nằm ở src/app, không ở components.
 */
export function AssetModelPanel({ sceneId, assetName, liveData, tag, description, fallbackImage, className }: AssetModelPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const descId = useId();
  const { isFullscreen, toggle } = useFullscreen(rootRef);
  const scene = useSceneConfig(sceneId);
  // Tải code 3D song song với dữ liệu cảnh.
  useEffect(preloadSceneViewer, []);
  const [glError, setGlError] = useState<string | null>(null);
  const fallback = glError ?? (scene.status === 'error' ? scene.error.message : null);
  // Mở lại trang: các bước chờ trước khi SceneViewer gắn cũng hiện ảnh cảnh lần trước (liền mạch với lớp chờ bên trong).
  const snapshot = sceneSnapshot(sceneId);

  return (
    <div ref={rootRef} className={cn('flex min-h-0 flex-col bg-bg-app', className)}>
      <Card
        title="Mô hình tài sản"
        className="h-full"
        padding="none"
        headerEnd={
          <Button
            variant="overlay"
            size="sm"
            aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Xem mô hình toàn màn hình'}
            pressed={isFullscreen}
            onClick={toggle}
            icon={<FocusIcon size={16} />}
          />
        }
      >
        <div
          role="region"
          aria-label={`Mô hình 3D ${assetName}`}
          aria-describedby={descId}
          className="relative min-h-[320px] flex-1 overflow-hidden bg-bg-app"
        >
          <p id={descId} className="sr-only">
            {description}
          </p>
          {fallback ? (
            <>
              <ResponsiveImage image={fallbackImage} alt={`Ảnh tĩnh mô hình ${assetName}`} className="absolute inset-0 size-full object-contain" />
              <p
                role="status"
                className="absolute bottom-3 left-3 right-3 rounded-sm bg-surface-raised/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-xs"
              >
                Không chạy được mô hình 3D – đang hiển thị ảnh tĩnh.
              </p>
            </>
          ) : scene.status === 'loading' ? (
            <SceneLoading snapshot={snapshot} />
          ) : (
            scene.status === 'success' && (
              <Suspense fallback={<SceneLoading snapshot={snapshot} />}>
                <div className="absolute inset-0">
                  <SceneViewer config={scene.data} liveData={liveData} onWebGLError={setGlError} />
                </div>
              </Suspense>
            )
          )}
          {tag && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col rounded-md border border-accent/50 bg-surface-raised/85 px-2.5 py-1.5 backdrop-blur-xs">
              <span className="text-xs font-bold text-fg">{tag.title}</span>
              <span className={cn('flex items-center gap-1 text-2xs', tag.signalLost ? 'text-fg-secondary' : 'text-fg-muted')}>
                {tag.signalLost && <SignalLostIcon size={12} />}
                {tag.line}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
