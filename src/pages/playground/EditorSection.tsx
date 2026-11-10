import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CameraIcon,
  CaretIcon,
  Checkbox,
  CursorIcon,
  OrthoIcon,
  PipeIcon,
  DuplicateIcon,
  ExportIcon,
  EyeIcon,
  EyeOffIcon,
  FilePlusIcon,
  FitIcon,
  FolderIcon,
  GridIcon,
  ImportIcon,
  LockIcon,
  MagnetIcon,
  MoveIcon,
  NumberField,
  RedoIcon,
  RotateIcon,
  SaveIcon,
  ScaleIcon,
  TrashIcon,
  TreeView,
  UndoIcon,
  UnlockIcon,
  Vec3Field,
  type TreeItem,
  type Vec3Value,
} from '@/components';
import { Demo } from './Demo';

const ICONS = {
  CursorIcon,
  PipeIcon,
  OrthoIcon,
  MoveIcon,
  RotateIcon,
  ScaleIcon,
  MagnetIcon,
  GridIcon,
  FitIcon,
  UndoIcon,
  RedoIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  UnlockIcon,
  CaretIcon,
  FilePlusIcon,
  FolderIcon,
  SaveIcon,
  ImportIcon,
  ExportIcon,
  TrashIcon,
  DuplicateIcon,
  CameraIcon,
};

/** Mục 9 – component mới cho Scene Editor (3D-3): NumberField, Vec3Field, TreeView, Checkbox có nhãn, icon editor. */
export function EditorSection() {
  const [len, setLen] = useState<number | null>(null);
  const [floors, setFloors] = useState(2);
  const [pos, setPos] = useState<Vec3Value>([8.3, 0, 15.4]);
  const [closed, setClosed] = useState(true);
  const [sel, setSel] = useState<string[]>(['V-101']);
  const [hidden, setHidden] = useState<string[]>(['FN-02']);
  const [names, setNames] = useState<Record<string, string>>({});
  const name = (id: string) => names[id] ?? id;
  const items: TreeItem[] = [
    {
      id: 'eq',
      label: 'Thiết bị (3)',
      children: ['V-101', 'P-101A', 'F-101'].map((id) => ({ id, label: name(id), meta: 'equipment' })),
    },
    {
      id: 'env',
      label: 'Bối cảnh (2)',
      children: ['FN-02', 'B-01'].map((id) => ({ id, label: name(id), meta: 'environment', dimmed: hidden.includes(id) })),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-fg-secondary">
        Dùng trong{' '}
        <Link className="text-accent underline" to="/editor?edit=1">
          Scene Editor (/editor?edit=1)
        </Link>
        . ⚠ Figma chưa có thiết kế – style theo token, cùng ngôn ngữ với TextField / Select.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Demo title="NumberField">
          <NumberField
            label="Chiều dài thân"
            unit="m"
            value={len}
            placeholder="11 (mặc định)"
            min={4}
            max={30}
            step={0.5}
            hint="4 – 30 · Enter/rời ô để chốt · ↑/↓ (Shift ×10) · trống = mặc định"
            onChange={setLen}
            onClear={() => setLen(null)}
          />
          <NumberField label="Số tầng" integer min={1} max={8} value={floors} onChange={setFloors} />
          <NumberField label="Lỗi" value={3} onChange={() => undefined} error="Ngoài khoảng cho phép" />
          <p className="text-sm text-fg-muted">
            Giá trị đã chốt: {len ?? 'mặc định'} · {floors} tầng
          </p>
        </Demo>
        <Demo title="Vec3Field + Checkbox có nhãn">
          <Vec3Field label="Vị trí" unit="m" value={pos} onChange={setPos} />
          <Vec3Field label="Scale" value={[1, 1, 1]} onChange={() => undefined} disabled />
          <Checkbox showLabel label="Khép kín (nối điểm cuối về điểm đầu)" checked={closed} onChange={setClosed} />
          <Checkbox showLabel label="Không dùng được" checked={false} onChange={() => undefined} disabled />
          <p className="text-sm text-fg-muted">[{pos.join(', ')}]</p>
        </Demo>
        <Demo title="TreeView (Outliner)">
          <div className="rounded-md border border-line/30 bg-surface-raised p-1">
            <TreeView
              label="Cây demo"
              items={items}
              selected={sel}
              onSelectionChange={setSel}
              onRename={(id, next) => {
                if (!next) return 'Không để trống';
                setNames((n) => ({ ...n, [id]: next }));
                return undefined;
              }}
              renderActions={(item) =>
                item.children ? null : (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Ẩn ${item.id}`}
                    aria-pressed={hidden.includes(item.id)}
                    onClick={() => setHidden((h) => (h.includes(item.id) ? h.filter((x) => x !== item.id) : [...h, item.id]))}
                    className="inline-flex size-6 items-center justify-center rounded-sm text-fg-muted hover:bg-surface-muted"
                  >
                    {hidden.includes(item.id) ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                )
              }
            />
          </div>
          <p className="text-sm text-fg-muted">Đang chọn: {sel.join(', ') || '—'} · Ctrl/⌘+click đảo · Shift+click dải · F2 đổi tên · ←/→ đóng/mở</p>
        </Demo>
      </div>
      <Demo title="Icon editor (tạm – currentColor)">
        <ul className="flex flex-wrap gap-3">
          {Object.entries(ICONS).map(([n, I]) => (
            <li key={n} className="flex w-24 flex-col items-center gap-1 text-xs text-fg-muted">
              <span className="inline-flex size-9 items-center justify-center rounded-md border border-line/30 text-fg">
                <I size={18} />
              </span>
              {n.replace('Icon', '')}
            </li>
          ))}
        </ul>
      </Demo>
    </div>
  );
}
