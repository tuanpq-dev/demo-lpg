import { tempIconBase } from '@/components';
import type { AssetType } from '@/features/scene/types';

/** Hình vẽ nét cho từng loại asset (⚠ icon tạm, theo currentColor) – thư viện asset + Outliner. */
const PATHS: Record<AssetType, string> = {
  'tank-horizontal': 'M6 8h12a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8ZM7 16v3M17 16v3M10 8V6h3v2',
  'tank-vertical': 'M8 6a4 2 0 0 1 8 0v13H8ZM8 6v13M12 2v2M6 19h12M17 7h2v12',
  pump: 'M4 17h16M7 17v-3M9 10a3 3 0 1 0 0 .01M12 10h2M14 8h6v5h-6ZM9 7V4',
  valve: 'M3 12h4M17 12h4M7 8l10 8V8L7 16ZM12 12V6M9 5h6',
  filter: 'M8 6h8v11a4 4 0 0 1-8 0ZM8 6l-1-2h10l-1 2M5 9h3M16 15h3M9 21l-1 1M15 21l1 1',
  vaporizer: 'M3 19h18M5 19V8h8v11M7 8v11M9 8v11M11 8v11M15 19v-9a2 2 0 0 1 4 0v9',
  'tanker-truck': 'M2 15V9h4l2 3v3M8 15h13V9a3 3 0 0 0-3-3H11a3 3 0 0 0-3 3ZM5 18a1.5 1.5 0 1 0 0 .01M17 18a1.5 1.5 0 1 0 0 .01',
  'loading-station': 'M7 21V5h8v16M9 8h4v3H9ZM5 21h12M18 21V9M16 9h4',
  'flow-meter': 'M3 14h5M16 14h5M8 10h8v8H8ZM12 10V7M9 4h6v3H9Z',
  building: 'M3 21V8l6-3v16M9 21V5h12v16M12 9h2M16 9h2M12 13h2M16 13h2M13 21v-4h3v4',
  canopy: 'M2 10l10-5 10 5M5 9v11M19 9v11M3 20h18',
  fence: 'M4 20V6l1-2 1 2v14M11 20V6l1-2 1 2v14M18 20V6l1-2 1 2v14M3 10h18M3 16h18',
};

export function AssetGlyph({ asset, size = 18 }: { asset: AssetType; size?: number }) {
  return (
    <svg {...tempIconBase(size, {})}>
      <path d={PATHS[asset]} />
    </svg>
  );
}
