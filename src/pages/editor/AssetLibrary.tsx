import { useState } from 'react';
import { SearchInput } from '@/components';
import { ASSET_SPECS } from '@/features/scene/assets/specs';
import { SCENE_ASSET_MIME } from '@/features/scene/editConstants';
import { ASSET_TYPES, type AssetType } from '@/features/scene/types';
import { slugify } from '@/features/scene-editor/ops';
import { AssetGlyph } from './AssetGlyph';

const GROUPS = [
  { id: 'equipment', label: 'Thiết bị' },
  { id: 'environment', label: 'Bối cảnh' },
] as const;

/**
 * Thư viện asset (nhóm equipment / environment, tìm theo tên/loại/tiền tố id).
 * Bấm → thêm ở tâm khung; kéo thả vào canvas → đặt tại điểm trên sàn (snap 0.5 m).
 */
export function AssetLibrary({ onAdd }: { onAdd: (asset: AssetType) => void }) {
  const [q, setQ] = useState('');
  const needle = slugify(q);
  const match = (a: AssetType) =>
    !q.trim() || [a, ASSET_SPECS[a].label, ASSET_SPECS[a].idPrefix].some((t) => slugify(t).includes(needle));

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <SearchInput value={q} onChange={setQ} onClear={() => setQ('')} label="Tìm asset" placeholder="Tìm asset…" />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {GROUPS.map((g) => {
          const items = ASSET_TYPES.filter((a) => ASSET_SPECS[a].category === g.id && match(a));
          if (!items.length) return null;
          return (
            <section key={g.id} aria-label={g.label} className="mb-2">
              <h3 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{g.label}</h3>
              <ul className="grid grid-cols-1 gap-1">
                {items.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(SCENE_ASSET_MIME, a);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => onAdd(a)}
                      title={`Bấm để thêm ở giữa khung · kéo vào canvas để đặt (${a})`}
                      className="flex h-9 w-full cursor-grab items-center gap-2 rounded-md border border-line/30 bg-surface-raised px-2 text-left text-sm text-fg hover:border-accent/60 active:cursor-grabbing"
                    >
                      <span className="text-fg-muted">
                        <AssetGlyph asset={a} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{ASSET_SPECS[a].label}</span>
                      <span className="text-xs text-fg-muted">{ASSET_SPECS[a].idPrefix}-</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {!ASSET_TYPES.some(match) && <p className="px-1 text-sm text-fg-muted">Không có asset khớp “{q}”.</p>}
      </div>
    </div>
  );
}
