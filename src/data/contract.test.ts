import { describe, expect, test } from 'vitest';
import { ApiError } from '@/api/client';
import {
  fetchAlert,
  fetchAlertCounts,
  fetchAlertList,
  fetchAlertLoads,
  fetchAlertsByDevices,
  fetchAlertsByIds,
  fetchAlertSummary,
  fetchRecentAlerts,
  fetchRelatedOpen,
} from './alertApi';
import { fromMock } from './contract';
import {
  fetchDeviceDirectory,
  fetchLinkedMaintenance,
  fetchMaintenanceByDevice,
  fetchMaintenanceById,
  fetchMaintenanceList,
  fetchMaintenanceLoads,
  fetchMaintenanceSummary,
  createMaintenanceRequest,
} from './maintenanceApi';

/** Mọi endpoint cảnh báo / bảo trì trên TOÀN BỘ dữ liệu mẫu phải khớp schema API – thay mock bằng backend không vỡ UI. */
describe('response mock khớp schema API (src/api/*Schemas.ts)', () => {
  test('cảnh báo: danh sách đủ mọi bản ghi, tóm tắt, theo id, liên quan, tải việc, số đếm', async () => {
    const all = await fetchAlertList({
      tab: 'all',
      q: '',
      severity: null,
      area: null,
      device: null,
      shift: null,
      range: '30d',
      page: 1,
      pageSize: 100_000,
    });
    expect(all.rows.length).toBe(all.total);
    const ids = all.rows.map((a) => a.id);
    await Promise.all([
      fetchAlertSummary('30d'),
      fetchAlert(ids[0]!),
      fetchAlert('KHONG-CO'),
      fetchAlertsByIds(ids),
      fetchAlertsByDevices(['V-101'], ['fire']),
      fetchRelatedOpen(ids),
      fetchAlertLoads(),
      fetchAlertCounts(),
      fetchRecentAlerts(29),
    ]);
  });

  test('bảo trì: danh sách đủ mọi bản ghi, tóm tắt, theo id / thiết bị, liên kết cảnh báo, danh bạ, tải việc', async () => {
    const all = await fetchMaintenanceList({
      tab: 'all',
      q: '',
      area: null,
      priority: null,
      type: null,
      range: 'all',
      sort: 'created',
      page: 1,
      pageSize: 100_000,
    });
    expect(all.rows.length).toBe(all.total);
    const first = all.rows[0]!;
    await Promise.all([
      fetchMaintenanceSummary(),
      fetchMaintenanceById(first.id),
      fetchMaintenanceById('KHONG-CO'),
      fetchMaintenanceByDevice(first.device),
      fetchLinkedMaintenance(first.sourceAlertId ?? 'KHONG-CO'),
      fetchDeviceDirectory(),
      fetchMaintenanceLoads(),
    ]);
  });

  test('bản ghi do thao tác ghi tạo ra (tạo yêu cầu, hạn chỉ có ngày) vẫn khớp schema', async () => {
    const created = await createMaintenanceRequest({
      title: 'Kiểm tra van an toàn',
      device: 'V-101',
      area: 'Khu bồn LPG',
      type: 'inspection',
      priority: 'high',
      dueAt: '2026-11-20',
      assignee: 'Nguyễn Văn A',
      checklist: [{ id: 'c1', text: 'Đo áp suất', done: false }],
      notes: 'Mang đồng hồ cơ',
    });
    expect(await fetchMaintenanceById(created.id)).toMatchObject({ dueAt: '2026-11-20T23:59', dueHasTime: false });
  });

  test('lệch hợp đồng → ApiError CONTRACT_ERROR nêu đúng trường sai', async () => {
    const bad = fromMock('GET /alerts/counts', (s) => s.AlertUnackCountSchema, Promise.resolve({ unacknowledged: -1 }));
    await expect(bad).rejects.toBeInstanceOf(ApiError);
    await expect(bad).rejects.toMatchObject({ code: 'CONTRACT_ERROR', message: expect.stringContaining('unacknowledged') });
  });
});
