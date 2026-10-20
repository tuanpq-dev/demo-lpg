import { EyeIcon, EyeOffIcon, LockIcon, TreeView, UnlockIcon, type TreeItem } from '@/components';
import { ASSET_SPECS } from '@/features/scene/assets/specs';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import { cn } from '@/lib/cn';
import { AssetGlyph } from './AssetGlyph';

const GROUPS = [
  { id: '__equipment', label: 'Thiết bị', category: 'equipment' },
  { id: '__environment', label: 'Bối cảnh', category: 'environment' },
] as const;

/**
 * Cây object (nhóm Thiết bị / Bối cảnh): chọn (Ctrl/⌘ đảo, Shift chọn dải), ẩn/hiện, khoá,
 * đổi id tại chỗ (F2 / double-click – cập nhật tham chiếu trong views và ống).
 */
export function Outliner({ onRename }: { onRename: (id: string, next: string) => string | undefined }) {
  const objects = useSceneDoc((s) => s.scene.objects);
  const { selection, hidden, locked, setSelection, toggleHidden, toggleLocked } = useEditorUi();

  const items: TreeItem[] = GROUPS.map((g) => ({
    id: g.id,
    label: `${g.label} (${objects.filter((o) => ASSET_SPECS[o.asset]?.category === g.category).length})`,
    selectable: false,
    renamable: false,
    children: objects
      .filter((o) => ASSET_SPECS[o.asset]?.category === g.category)
      .map((o) => ({
        id: o.id,
        label: o.id,
        meta: o.label && o.label !== o.id ? o.label : ASSET_SPECS[o.asset].label,
        icon: <AssetGlyph asset={o.asset} size={14} />,
        dimmed: hidden.includes(o.id),
        selectable: true,
      })),
  })).filter((g) => g.children.length);

  const action = (pressed: boolean, label: string, onClick: () => void, on: JSX.Element, off: JSX.Element) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-sm hover:bg-surface-muted',
        pressed ? 'text-warning' : 'text-fg-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      )}
    >
      {pressed ? on : off}
    </button>
  );

  return (
    <TreeView
      label="Cây object"
      items={items}
      selected={selection}
      onSelectionChange={setSelection}
      onRename={onRename}
      emptyText="Cảnh trống – thêm asset từ thư viện"
      renderActions={(item) =>
        item.id.startsWith('__') ? null : (
        <>
          {action(hidden.includes(item.id), `Ẩn ${item.id}`, () => toggleHidden(item.id), <EyeOffIcon />, <EyeIcon />)}
          {action(locked.includes(item.id), `Khoá ${item.id}`, () => toggleLocked(item.id), <LockIcon />, <UnlockIcon />)}
        </>
        )
      }
    />
  );
}
