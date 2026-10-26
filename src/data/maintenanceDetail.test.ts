import { describe, expect, test } from 'vitest';
import type { Reading } from './assetDetail';
import {
  formatFileSize,
  formatPlantDateTime,
  historyEvents,
  listSearchOnly,
  maintenanceListUrl,
  mockAttachmentFile,
  relativeDayTime,
  resolveMaintenanceId,
  worstReading,
} from './maintenanceDetail';

// 11:45 ngày 26/10/2026 giờ nhà máy.
const NOW = new Date('2026-10-26T04:45:00Z');

describe('resolveMaintenanceId', () => {
  const rows = [{ id: 'MT-00128' }, { id: 'MT-00127' }];
  test('đúng / khác kiểu chữ / khoảng trắng → mã chuẩn', () => {
    expect(resolveMaintenanceId('MT-00128', rows)).toBe('MT-00128');
    expect(resolveMaintenanceId('mt-00128', rows)).toBe('MT-00128');
    expect(resolveMaintenanceId(' Mt-00127 ', rows)).toBe('MT-00127');
  });
  test('không có / rỗng → null', () => {
    expect(resolveMaintenanceId('MT-99999', rows)).toBeNull();
    expect(resolveMaintenanceId('', rows)).toBeNull();
    expect(resolveMaintenanceId(undefined, [])).toBeNull();
  });
});

describe('định dạng ngày giờ (giờ nhà máy)', () => {
  test('formatPlantDateTime', () => {
    expect(formatPlantDateTime('2026-10-26T08:30')).toBe('26/10/2026 08:30');
    expect(formatPlantDateTime('2026-10-26')).toBe('26/10/2026');
  });
  test('relativeDayTime: hôm nay / hôm qua / ngày khác / năm khác', () => {
    expect(relativeDayTime('2026-10-26T10:50', NOW)).toBe('Hôm nay 10:50');
    expect(relativeDayTime('2026-10-25T09:00', NOW)).toBe('Hôm qua 09:00');
    expect(relativeDayTime('2026-10-20T09:00', NOW)).toBe('20/10 09:00');
    expect(relativeDayTime('2025-12-31T09:00', NOW)).toBe('31/12/2025 09:00');
  });
  test('qua nửa đêm Bangkok: 00:10 ngày 27 ICT → ghi chú 23:50 ngày 26 là "Hôm qua"', () => {
    expect(relativeDayTime('2026-10-26T23:50', new Date('2026-10-26T17:10:00Z'))).toBe('Hôm qua 23:50');
  });
});

describe('historyEvents', () => {
  test('giờ ngắn cho hôm nay, kèm ngày cho hôm trước; màu theo loại', () => {
    const ev = historyEvents(
      {
        history: [
          { id: 'h1', at: '2026-10-25T08:30', kind: 'create', text: 'Tạo' },
          { id: 'h2', at: '2026-10-26T08:35', kind: 'priority', text: 'Ưu tiên' },
          { id: 'h3', at: '2026-10-26T09:00', kind: 'cancel', text: 'Hủy' },
        ],
      },
      NOW,
    );
    expect(ev.map((e) => [e.time, e.tone])).toEqual([
      ['Hôm qua 08:30', 'success'],
      ['08:35', 'danger'],
      ['09:00', 'danger'],
    ]);
    expect(historyEvents({}, NOW)).toEqual([]);
  });
});

describe('tệp mẫu (Tải xuống khi chưa có backend)', () => {
  test('<tên>-mau.txt, nội dung ghi rõ dữ liệu mẫu', () => {
    const f = mockAttachmentFile({ name: 'bao-cao-kiem-dinh.pdf', size: 860_000 }, 'MT-00128');
    expect(f.fileName).toBe('bao-cao-kiem-dinh-mau.txt');
    expect(f.content).toMatch(/^DỮ LIỆU MẪU/);
    expect(f.content).toContain('MT-00128');
    expect(mockAttachmentFile({ name: 'a.b.c.jpg', size: 0 }, 'X').fileName).toBe('a.b.c-mau.txt');
    expect(mockAttachmentFile({ name: '.pdf', size: 0 }, 'X').fileName).toBe('tep-mau.txt');
  });
  test('formatFileSize', () => {
    expect(formatFileSize(2_480_000)).toBe('2,4 MB');
    expect(formatFileSize(860_000)).toBe('840 KB');
    expect(formatFileSize(0)).toBe('0 B');
  });
});

describe('maintenanceListUrl – quay lại đúng bộ lọc', () => {
  test('ưu tiên state.from là URL danh sách; bỏ qua URL chi tiết / lạ', () => {
    expect(maintenanceListUrl('/maintenance?tab=overdue&q=V-101')).toBe('/maintenance?tab=overdue&q=V-101');
    expect(maintenanceListUrl('/maintenance/MT-00127')).toBe('/maintenance');
    expect(maintenanceListUrl('https://evil.example')).toBe('/maintenance');
    expect(maintenanceListUrl(undefined)).toBe('/maintenance');
  });
});

describe('listSearchOnly – bỏ tham số một lần trước khi lưu URL quay lại', () => {
  test('bỏ open/create/device/from, giữ bộ lọc', () => {
    expect(listSearchOnly('?tab=overdue&open=MT-00128&q=V-101')).toBe('?tab=overdue&q=V-101');
    expect(listSearchOnly('?create=1&device=V-101&from=ALT-00128')).toBe('');
    expect(listSearchOnly('')).toBe('');
  });
});

describe('worstReading – chấm trạng thái thiết bị', () => {
  const r = (status: Reading['status']): Reading => ({ state: 'ok', value: 1, status });
  test('danger > warning > offline > normal; rỗng → normal', () => {
    expect(worstReading([r('normal'), r('warning'), r('danger')])).toBe('danger');
    expect(worstReading([r('normal'), r('offline')])).toBe('offline');
    expect(worstReading([r('offline'), r('warning')])).toBe('warning');
    expect(worstReading([])).toBe('normal');
  });
});
