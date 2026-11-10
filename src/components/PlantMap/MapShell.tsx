/** Khung chung của bản đồ: tiêu đề, chọn renderer 2.5D/3D, toàn màn hình, thông báo. */
import type { ReactNode, RefObject } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { SegmentedControl } from '../SegmentedControl';
import { type CommonProps, type PlantMapRenderer } from './types';

const RENDERER_OPTIONS = [
  { id: 'image', label: '2.5D' },
  { id: 'three', label: '3D' },
] as const;

type MapShellProps = Pick<CommonProps, 'onRendererChange' | 'height' | 'notice' | 'className'> & {
  views: readonly { id: string; label: string }[];
  view: string;
  onViewChange: (id: string) => void;
  renderer: PlantMapRenderer;
  rootRef: RefObject<HTMLDivElement>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  children: ReactNode;
};

export function MapShell({
  rootRef,
  isFullscreen,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  views,
  view,
  onViewChange,
  renderer,
  onRendererChange,
  height = 589,
  notice,
  className,
  children,
}: MapShellProps) {
  return (
    <div
      ref={rootRef}
      className={cn('relative overflow-clip rounded-xl border border-line/30 bg-surface p-px shadow-card', isFullscreen && 'rounded-none', className)}
      style={{ height: isFullscreen ? '100vh' : height + 2 }}
    >
      {children}

      {/* Controls – Figma 53:301 (cách mép 16px). z-30: nằm trên nhãn 3D (zIndexRange 0–21). */}
      <div className="pointer-events-none absolute inset-x-[17px] top-[17px] z-30 flex items-start justify-between gap-3">
        <SegmentedControl label="Chế độ xem bản đồ" options={views} value={view} onChange={onViewChange} className="pointer-events-auto" />
        <div className="pointer-events-auto flex gap-2">
          <Button variant="overlay" aria-label="Phóng to" disabled={!canZoomIn} onClick={onZoomIn} icon={<Icon name="mapZoomIn" box={16} />} />
          <Button variant="overlay" aria-label="Thu nhỏ" disabled={!canZoomOut} onClick={onZoomOut} icon={<Icon name="mapZoomOut" box={16} />} />
          <Button
            variant="overlay"
            aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            pressed={isFullscreen}
            onClick={onToggleFullscreen}
            icon={<Icon name="mapFullscreen" box={16} />}
          />
        </div>
      </div>

      {(onRendererChange || notice) && (
        <div className="absolute bottom-[17px] left-[17px] z-30 flex items-center gap-2">
          {onRendererChange && (
            <SegmentedControl
              label="Kiểu bản đồ"
              size="sm"
              options={RENDERER_OPTIONS}
              value={renderer}
              onChange={(id) => onRendererChange(id as PlantMapRenderer)}
            />
          )}
          {notice && (
            <p role="status" className="rounded-sm bg-surface-raised/85 px-2 py-1 text-xs text-fg-muted backdrop-blur-xs">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
