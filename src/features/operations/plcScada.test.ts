import { describe, expect, it } from 'vitest';
import type { TagValue } from '@/features/live/types';
import { parsePlantDateTime } from '@/lib/plantTime';
import {
  HEARTBEAT_VIEW,
  MODE_VIEW,
  plcScadaRows,
  plcStatus,
  readStateTag,
  scadaStatus,
  sourceState,
  stateView,
  tagAvailability,
  uptimeText,
  type PlcRowInput,
} from './plcScada';

const NOW = parsePlantDateTime('2026-06-24T18:03')!.getTime();
const tv = (value: TagValue['value'], patch: Partial<TagValue> = {}): TagValue => ({ value, ts: NOW - 1000, quality: 'good', ...patch });
const stale = (value: TagValue['value']) => tv(value, { ts: NOW - 15_000 });

const TAGS: PlcRowInput['tags'] = { heartbeat: 'HB', plcLink: 'PL', scadaLink: 'SL', latency: 'LAT', packetLoss: 'PKT', mode: 'MODE', historian: 'HIST' };
const LIMITS: PlcRowInput['limits'] = { latency: { warn: 3 }, packetLoss: { warn: 5 }, minAvailableTags: 18 };
const okLive: Record<string, TagValue> = {
  HB: tv('ok'),
  PL: tv('active'),
  SL: tv('active'),
  LAT: tv(1.2),
  PKT: tv(0.2),
  MODE: tv('scada-remote'),
  HIST: tv('ok'),
  A: tv(1),
  B: tv(2),
};

describe('tag trạng thái (chuỗi)', () => {
  it('chưa có số liệu → pending; quá 10 s / bad / không phải chuỗi → mất tín hiệu', () => {
    expect(readStateTag(undefined, false, NOW)).toEqual({ state: 'pending' });
    expect(readStateTag(stale('ok'), true, NOW).state).toBe('lost');
    expect(readStateTag(tv('ok', { quality: 'bad' }), true, NOW).state).toBe('lost');
    expect(readStateTag(tv(1), true, NOW).state).toBe('lost');
    expect(readStateTag(tv('ok'), true, NOW)).toMatchObject({ state: 'ok', raw: 'ok' });
  });

  it('ánh xạ giá trị; giá trị lạ → "Không xác định"; mất tín hiệu → không hiện giá trị cũ', () => {
    expect(stateView({ state: 'ok', raw: 'ok' }, HEARTBEAT_VIEW)).toEqual({ value: 'OK', status: 'Ổn định', tone: 'success' });
    expect(stateView({ state: 'ok', raw: 'local' }, MODE_VIEW).tone).toBe('primary');
    expect(stateView({ state: 'ok', raw: 'weird' }, MODE_VIEW)).toEqual({ value: 'weird', status: 'Không xác định', tone: 'warning' });
    expect(stateView({ state: 'lost' }, HEARTBEAT_VIEW)).toEqual({ value: 'Mất tín hiệu', status: 'Mất tín hiệu', tone: 'neutral' });
  });
});

describe('PLC / SCADA', () => {
  const ok = (raw: string) => ({ state: 'ok' as const, raw });
  it('heartbeat ok + liên kết active → Trực tuyến (header "Đang hoạt động")', () => {
    expect(plcStatus(ok('ok'), ok('active'))).toEqual({ label: 'Trực tuyến', tone: 'success', headerLabel: 'Đang hoạt động' });
  });
  it('mất tín hiệu một tag → xám; báo hỏng → Mất kết nối đỏ; chưa có số → "—"', () => {
    expect(plcStatus(ok('ok'), { state: 'lost' }).tone).toBe('neutral');
    expect(plcStatus(ok('lost'), ok('active'))).toMatchObject({ label: 'Mất kết nối', tone: 'danger' });
    expect(plcStatus({ state: 'pending' }, ok('active')).label).toBe('—');
  });
  it('SCADA: active → Đã kết nối; down → Mất kết nối', () => {
    expect(scadaStatus(ok('active')).label).toBe('Đã kết nối');
    expect(scadaStatus(ok('down'))).toMatchObject({ label: 'Mất kết nối', tone: 'danger' });
  });
});

describe('tag khả dụng + nút nguồn', () => {
  it('đếm tag còn tín hiệu (không trùng); chưa có số liệu → undefined', () => {
    expect(tagAvailability(['A', 'B', 'A', 'C'], okLive, NOW)).toEqual({ ok: 2, total: 3, lost: 1, percent: 66.7 });
    expect(tagAvailability(['A'], undefined, NOW)).toBeUndefined();
  });
  it('nút nguồn: một tag mất → lost', () => {
    expect(sourceState(['A', 'B'], okLive, NOW)).toBe('ok');
    expect(sourceState(['A', 'X'], okLive, NOW)).toBe('lost');
    expect(sourceState(['A'], undefined, NOW)).toBe('pending');
  });
});

describe('plcScadaRows', () => {
  const rows = (live: Record<string, TagValue> | undefined, availability = tagAvailability(['A', 'B'], live, NOW)) =>
    Object.fromEntries(plcScadaRows({ tags: TAGS, limits: LIMITS, availability }, live, NOW).map((r) => [r.id, r]));

  it('9 dòng như ảnh khi mọi thứ bình thường', () => {
    const list = plcScadaRows({ tags: TAGS, limits: LIMITS, availability: { ok: 21, total: 21, lost: 0, percent: 100 } }, okLive, NOW);
    expect(list.map((r) => [r.label, r.value, r.unit, r.alarm, r.status])).toEqual([
      ['PLC Heartbeat', 'OK', '-', 'Không nhận heartbeat', 'Ổn định'],
      ['Kết nối PLC', 'Đang hoạt động', '-', 'Mất kết nối PLC', 'Bình thường'],
      ['Kết nối SCADA', 'Đang hoạt động', '-', 'Mất kết nối SCADA', 'Bình thường'],
      ['Độ trễ dữ liệu', '1.2', 's', '> 3.0 giây', 'Tốt'],
      ['Tag khả dụng', '21/21', 'tag', '< 18/21 tag', 'Tốt'],
      ['Tag lỗi', '0', 'tag', '> 0 tag', 'Bình thường'],
      ['Mất gói tin', '0.2', '%', '> 5.0%', 'Tốt'],
      ['Chế độ vận hành', 'SCADA Từ xa', '-', 'Chuyển sang Local', 'Thông tin'],
      ['Đồng bộ lịch sử', 'Thành công', '-', 'Đồng bộ thất bại', 'Bình thường'],
    ]);
    expect(list[0]!.updated).toBe('18:02:59');
  });

  it('độ trễ ≥ ngưỡng → "Cao"; mất tín hiệu → không số cũ', () => {
    expect(rows({ ...okLive, LAT: tv(3.4) }).latency).toMatchObject({ value: '3.4', status: 'Cao', tone: 'warning' });
    expect(rows({ ...okLive, LAT: stale(1.2) }).latency).toMatchObject({ value: 'Mất tín hiệu', valueOk: false, tone: 'neutral' });
  });

  it('tag khả dụng dưới mức tối thiểu → "Thấp"; có tag lỗi → "Cảnh báo"', () => {
    const r = rows(okLive, { ok: 17, total: 21, lost: 4, percent: 81 });
    expect(r.tags).toMatchObject({ value: '17/21', status: 'Thấp', tone: 'warning' });
    expect(r.faults).toMatchObject({ value: '4', status: 'Cảnh báo', tone: 'warning' });
  });

  it('chưa có số liệu → "—" mọi dòng, không giờ cập nhật', () => {
    const r = rows(undefined);
    expect(r.heartbeat).toMatchObject({ value: '—', updated: undefined });
    expect(r.tags).toMatchObject({ value: '—', status: '—', updated: undefined });
  });
});

describe('uptimeText', () => {
  it('ngày + giờ · giờ + phút · phút', () => {
    expect(uptimeText(45 * 1440 + 12 * 60)).toBe('45 ngày 12 giờ');
    expect(uptimeText(200)).toBe('3 giờ 20 phút');
    expect(uptimeText(15)).toBe('15 phút');
    expect(uptimeText(-5)).toBe('0 phút');
  });
});
