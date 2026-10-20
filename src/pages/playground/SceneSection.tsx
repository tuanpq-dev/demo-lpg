import { useMemo, useState } from 'react';
import { Button, SegmentedControl } from '@/components';
import { ConnectedPlantMap } from '@/app/ConnectedPlantMap';
import { useLiveData, useLiveStatus, liveSimulator } from '@/data/live';
import { SCENE_IDS } from '@/data/scene';
import type { LiveData, TagValue } from '@/features/scene';
import { FigmaRef } from './FigmaRef';

/** Ghi đè số liệu để xem đủ trạng thái: V-101 warning (mức cao), E-101A danger, C-101 mất tín hiệu (mất tag PT-202). */
function withIncidents(live: LiveData): LiveData {
  const { 'PT-202': _lost, ...rest } = live;
  void _lost;
  const set = (tag: string, value: number): TagValue => ({ ...(live[tag] ?? { ts: Date.now(), quality: 'good' }), value });
  return { ...rest, 'LT-101': set('LT-101', 88.5), 'TT-201': set('TT-201', 47.2), 'FT-102': set('FT-102', 0) };
}

/** Giả lập sự cố nguồn dữ liệu (MockLiveSource) – kiểm tra "Mất tín hiệu" / "Mất kết nối" trên mọi màn. */
function LiveSimulatorBar() {
  const status = useLiveStatus();
  const [, force] = useState(0);
  const sim = liveSimulator.state;
  const act = (fn: () => void) => () => {
    fn();
    force((n) => n + 1);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-base" aria-label="Giả lập nguồn dữ liệu">
      <span className="text-fg-muted">
        Nguồn: <output className="font-mono text-fg">{status}</output>
      </span>
      <Button variant="ghost" size="sm" aria-pressed={sim.disconnected} onClick={act(() => liveSimulator.disconnect(!sim.disconnected))}>
        {sim.disconnected ? 'Kết nối lại' : 'Mất kết nối'}
      </Button>
      <Button variant="ghost" size="sm" aria-pressed={sim.bad.includes('LT-101')} onClick={act(() => liveSimulator.setBad(['LT-101', 'FT-101'], !sim.bad.includes('LT-101')))}>
        Tag lỗi (LT-101, FT-101 = bad)
      </Button>
      <Button variant="ghost" size="sm" aria-pressed={sim.frozen.includes('TT-201')} onClick={act(() => liveSimulator.freeze(['TT-201'], !sim.frozen.includes('TT-201')))}>
        Ngừng cập nhật TT-201 (mất tín hiệu sau 10 s)
      </Button>
      <Button variant="ghost" size="sm" onClick={act(() => liveSimulator.restore())}>
        Khôi phục
      </Button>
    </div>
  );
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
      <LiveSimulatorBar />
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
