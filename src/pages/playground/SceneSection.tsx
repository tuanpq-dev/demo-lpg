import { useMemo, useState } from 'react';
import { Button, SegmentedControl } from '@/components';
import { ConnectedPlantMap } from '@/app/ConnectedPlantMap';
import { SCENE_IDS, useLiveData } from '@/data/scene';
import type { LiveData } from '@/features/scene';
import { FigmaRef } from './FigmaRef';

/** Ghi đè số liệu để xem đủ trạng thái: V-101 warning (mức cao), E-101A danger, C-101 offline (mất tag). */
function withIncidents(live: LiveData): LiveData {
  const { 'PT-202': _offline, ...rest } = live;
  void _offline;
  return { ...rest, 'LT-101': 88.5, 'TT-201': 47.2, 'FT-102': 0 };
}

/**
 * 3D: ConnectedPlantMap theo sceneId (cùng Viewer cho mọi cảnh; views + nhãn nằm trong cảnh) cạnh ảnh Figma 53:242.
 * "Chế độ sửa" = như ?edit=1 bên Tổng quan.
 */
export function SceneSection() {
  const live = useLiveData();
  const [sceneId, setSceneId] = useState(SCENE_IDS.includes('khu-bon-lpg') ? 'khu-bon-lpg' : SCENE_IDS[0]!);
  const [selected, setSelected] = useState<string | null>(null);
  const [incidents, setIncidents] = useState(false);
  const [editing, setEditing] = useState(false);
  const liveData = useMemo(() => (live && incidents ? withIncidents(live) : live), [live, incidents]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-base">
        <SegmentedControl
          label="Cảnh"
          options={SCENE_IDS.map((id) => ({ id, label: id }))}
          value={sceneId}
          onChange={(id) => {
            setSceneId(id);
            setSelected(null);
          }}
        />
        <Button variant="ghost" aria-pressed={incidents} onClick={() => setIncidents((v) => !v)}>
          {incidents ? 'Tắt mô phỏng sự cố' : 'Mô phỏng sự cố'}
        </Button>
        <Button variant="ghost" aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Tắt chế độ sửa' : 'Chế độ sửa'}
        </Button>
        <span className="text-fg-muted">
          Đã chọn: <output className="font-mono text-fg">{selected ?? '—'}</output>
        </span>
      </div>
      <ConnectedPlantMap
        sceneId={sceneId}
        liveData={liveData}
        editable={editing}
        alt="Cảnh 3D khu bồn LPG"
        onSelect={setSelected}
      />
      <FigmaRef src="/figma-ref/53-11-overview.png" x={32} y={318} w={1146} h={591} />
    </div>
  );
}
