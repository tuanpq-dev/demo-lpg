import { describe, expect, test } from 'vitest';
import { STALE_MS } from '@/features/live/signal';
import type { LiveData, TagValue } from '@/features/live/types';
import { applyLive, fetchOverview } from './overview';

const T0 = 5_000_000;
const tv = (value: number | string, quality: TagValue['quality'] = 'good', ts = T0): TagValue => ({ value, ts, quality });

describe('applyLive – ghép số liệu trực tiếp vào Tổng quan', async () => {
  const data = await fetchOverview();
  const kpi = (live: LiveData | undefined, now = T0 + 1) => Object.fromEntries(applyLive(data, live, now).kpis.map((k) => [k.id, k]));
  const live: LiveData = { 'INV-TOTAL': tv(152340.4), 'LT-101': tv(50), 'PT-100': tv(1.8234), 'FQ-100': tv(203.4), 'P-101A.STATE': tv('fault') };

  test('chưa có ảnh chụp đầu → ô gắn tag "—" (không dùng số tĩnh của mock)', () => {
    expect(kpi(undefined)['pressure']!.value).toBe('—');
    expect(kpi(undefined)['alerts']!.value).toBe('2'); // KPI không gắn tag giữ nguyên
  });

  test('định dạng en-US theo digits; mức bồn = % thể tích quy đổi từ chiều cao', () => {
    const k = kpi(live);
    expect(k['inventory']!.value).toBe('152,340');
    expect(k['pressure']!.value).toBe('1.82');
    expect(k['tank-level']!.value).toBe('50.00'); // nửa chiều cao = nửa thể tích
  });

  test('tag bad / quá 10 s / thiếu → signalLost, không giữ số cũ', () => {
    expect(kpi({ ...live, 'PT-100': tv(1.8, 'bad') })['pressure']!.signalLost).toBe(true);
    expect(kpi(live, T0 + STALE_MS)['inventory']!.signalLost).toBe(true);
    const { 'FQ-100': _gone, ...rest } = live;
    void _gone;
    expect(kpi(rest)['consumption']!.signalLost).toBe(true);
  });

  test('danh sách theo dõi: trạng thái sự cố → nhãn + tone danger; mất tín hiệu → "Mất tín hiệu"', () => {
    const rows = Object.fromEntries(applyLive(data, live, T0 + 1).watchlist.map((r) => [r.id, r]));
    expect(rows['p-101a']).toMatchObject({ statusLabel: 'Sự cố', tone: 'danger' });
    expect(rows['v-101']).toMatchObject({ statusLabel: 'Ổn định', tone: 'success' });
    expect(rows['pr-101']).toMatchObject({ statusLabel: 'Mất tín hiệu', tone: 'offline', signalLost: true });
  });

  test('marker 2.5D: giá trị theo trường, mất tín hiệu → xám + icon', () => {
    const m = Object.fromEntries(
      applyLive(data, { ...live, 'FT-101': tv(198.6), 'TT-201': tv(45.6, 'bad') }, T0 + 1).map.markers.map((x) => [x.id, x]),
    );
    expect(m['ft-101']!.value).toBe('199 m³/h');
    expect(m['vaporizer']).toMatchObject({ tone: 'neutral', value: 'Mất tín hiệu', showSignalLostIcon: true });
  });
});
