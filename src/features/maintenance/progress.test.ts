import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord, MaintenanceStatus } from '@/features/maintenance/types';
import {
  NEAR_DUE_MS,
  UPLOAD_RULES,
  applyProgressUpdate,
  canUpdateProgress,
  checkUploads,
  clampProgress,
  defaultReportedProgress,
  isNearOrPastDue,
  reportedProgressOf,
  canContinueToSubmit,
  requiresText,
  uploadKind,
  validateProgressUpdate,
  workStateDisabled,
  workStateOf,
  type ProgressUpdateInput,
} from './progress';

const rec = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'MT-1',
  code: 'MT-1',
  title: 'Kiểm tra van',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  createdAt: '2026-10-26',
  dueAt: '2026-10-26T16:00',
  completedAt: null,
  progress: 30,
  ...patch,
});

// 11:45 ngày 26/10 giờ nhà máy (UTC+7).
const NOW = new Date('2026-10-26T04:45:00Z');
const ctx = { actor: 'Nguyễn Văn A', now: NOW };
const upd = (patch: Partial<ProgressUpdateInput> = {}): ProgressUpdateInput => ({ state: 'working', progress: 30, text: '', ...patch });
const ALL: MaintenanceStatus[] = ['pending', 'assigned', 'in-progress', 'review', 'done', 'cancelled'];

describe('ánh xạ trạng thái công việc → bản ghi', () => {
  test('Đang thực hiện → in-progress, không cờ', () => {
    const r = applyProgressUpdate(rec({ hold: { kind: 'paused', reason: 'x', at: '2026-10-26T09:00' } }), upd({ progress: 40 }), ctx);
    expect(r.status).toBe('in-progress');
    expect(r.hold).toBeUndefined();
    expect('hold' in r).toBe(false);
  });

  test('Tạm dừng → in-progress + hold.paused (lý do = nội dung, giờ nhà máy)', () => {
    const r = applyProgressUpdate(rec(), upd({ state: 'paused', text: '  Chờ vật tư  ' }), ctx);
    expect(r.status).toBe('in-progress');
    expect(r.hold).toEqual({ kind: 'paused', reason: 'Chờ vật tư', at: '2026-10-26T11:45' });
    expect(workStateOf(r)).toBe('paused');
  });

  test('Gặp sự cố → in-progress + hold.blocked', () => {
    const r = applyProgressUpdate(rec(), upd({ state: 'blocked', text: 'Kẹt bu-lông' }), ctx);
    expect(r.status).toBe('in-progress');
    expect(r.hold?.kind).toBe('blocked');
  });

  test('Hoàn thành: modal tiến độ KHÔNG ghi gì (chuyển sang modal Gửi nghiệm thu – review.ts)', () => {
    const r = rec({ hold: { kind: 'blocked', reason: 'x', at: 'y' } });
    expect(validateProgressUpdate(r, upd({ state: 'completed', progress: 100, text: 'Xong' })).state).toBe(
      'Báo hoàn thành qua "Tiếp tục gửi nghiệm thu".',
    );
    expect(applyProgressUpdate(r, upd({ state: 'completed', progress: 100, text: 'Xong' }), ctx)).toBe(r);
    expect(canContinueToSubmit('in-progress', 'completed')).toBe(true);
    expect(canContinueToSubmit('assigned', 'completed')).toBe(false);
    expect(canContinueToSubmit('in-progress', 'working')).toBe(false);
    expect(requiresText('completed')).toBe(false);
  });

  test('từ Đã phân công: cập nhật đầu = Bắt đầu thực hiện (một bước); chưa được báo Hoàn thành', () => {
    const assigned = rec({ status: 'assigned', progress: 0 });
    expect(workStateDisabled('assigned', 'completed')).toBe(true);
    expect(workStateDisabled('in-progress', 'completed')).toBe(false);
    expect(validateProgressUpdate(assigned, upd({ state: 'completed', text: 'Xong' })).state).toBeTruthy();
    expect(applyProgressUpdate(assigned, upd({ state: 'completed', text: 'Xong' }), ctx)).toBe(assigned);
    const started = applyProgressUpdate(assigned, upd({ progress: 0 }), ctx);
    expect(started.status).toBe('in-progress');
    expect(started.history?.at(-1)).toMatchObject({ kind: 'start', text: 'Bắt đầu thực hiện · tiến độ 0%' });
  });

  test('chỉ mở được khi Đã phân công / Đang thực hiện; trạng thái khác → không đổi', () => {
    expect(ALL.filter(canUpdateProgress)).toEqual(['assigned', 'in-progress']);
    for (const s of ['pending', 'review', 'done', 'cancelled'] as const) {
      const r = rec({ status: s });
      expect(validateProgressUpdate(r, upd({ progress: 80 })).form).toBeTruthy();
      expect(applyProgressUpdate(r, upd({ progress: 80 }), ctx)).toBe(r);
    }
  });
});

describe('bắt buộc nội dung', () => {
  test.each([
    ['paused', 'Nhập lý do tạm dừng.'],
    ['blocked', 'Mô tả sự cố đang gặp.'],
  ] as const)('%s: trống / chỉ khoảng trắng → lỗi, bản ghi không đổi', (state, msg) => {
    const r = rec();
    for (const text of ['', '   \n ']) {
      expect(validateProgressUpdate(r, upd({ state, text })).text).toBe(msg);
      expect(applyProgressUpdate(r, upd({ state, text }), ctx)).toBe(r);
    }
  });

  test('Đang thực hiện: nội dung không bắt buộc', () => {
    expect(validateProgressUpdate(rec(), upd({ progress: 50 }))).toEqual({});
  });

  test('không thay đổi gì → lỗi "Chưa có thay đổi"', () => {
    expect(validateProgressUpdate(rec(), upd())).toEqual({ form: 'Chưa có thay đổi nào để cập nhật.' });
  });
});

describe('tiến độ báo cáo', () => {
  test('tách khỏi tiến độ checklist; được phép giảm; lịch sử "cũ% → mới%"', () => {
    const r0 = rec({ reportedProgress: 50, progress: 33 });
    const r1 = applyProgressUpdate(r0, upd({ progress: 30 }), ctx);
    expect(r1.reportedProgress).toBe(30);
    expect(r1.progress).toBe(33);
    expect(r1.history?.at(-1)).toMatchObject({
      kind: 'progress',
      text: 'Cập nhật tiến độ · 50% → 30%',
      actor: 'Nguyễn Văn A',
      at: '2026-10-26T11:45',
    });
  });

  test('reportedProgressOf: thiếu → checklist (có checklist) hoặc progress', () => {
    expect(reportedProgressOf(rec({ reportedProgress: 0, progress: 60 }))).toBe(0);
    expect(reportedProgressOf(rec({ progress: 60 }))).toBe(60);
    const checklist = [
      { id: 'a', text: 'a', done: true },
      { id: 'b', text: 'b', done: false },
      { id: 'c', text: 'c', done: false },
      { id: 'd', text: 'd', done: false, na: true },
    ];
    expect(reportedProgressOf(rec({ progress: 99, checklist }))).toBe(33);
    expect(defaultReportedProgress(rec({ progress: 99, checklist }))).toBe(35);
  });

  test('clampProgress: kẹp 0..100, bội số 5, NaN → 0', () => {
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(52)).toBe(50);
    expect(clampProgress(53)).toBe(55);
    expect(clampProgress(100)).toBe(100);
    expect(clampProgress(103)).toBe(100);
    expect(clampProgress(Number.NaN)).toBe(0);
  });
});

describe('lịch sử + ghi chú + tệp tạm', () => {
  test('MỘT dòng lịch sử mỗi lần cập nhật, nội dung thành một ghi chú', () => {
    const r0 = rec({ history: [{ id: 'h1', at: '2026-10-26T08:30', kind: 'create', text: 'Tạo' }] });
    const r1 = applyProgressUpdate(r0, upd({ state: 'paused', progress: 45, text: 'Chờ dừng tuyến' }), ctx);
    expect(r1.history).toHaveLength(2);
    expect(r1.history?.[1]).toEqual({
      id: 'h2',
      at: '2026-10-26T11:45',
      kind: 'pause',
      text: 'Tạm dừng – lý do: Chờ dừng tuyến · 30% → 45%',
      actor: 'Nguyễn Văn A',
    });
    expect(r1.notes).toEqual([{ id: 'n1', author: 'Nguyễn Văn A', at: '2026-10-26T11:45', text: 'Chờ dừng tuyến' }]);
  });

  test('tạm dừng → Đang thực hiện = "Tiếp tục thực hiện"; sự cố = "Gặp sự cố: …"', () => {
    const paused = applyProgressUpdate(rec(), upd({ state: 'paused', text: 'A' }), ctx);
    const resumed = applyProgressUpdate(paused, upd(), ctx);
    expect(resumed.history?.at(-1)).toMatchObject({ kind: 'resume', text: 'Tiếp tục thực hiện · tiến độ 30%' });
    const blocked = applyProgressUpdate(resumed, upd({ state: 'blocked', text: 'Rò rỉ' }), ctx);
    expect(blocked.history?.at(-1)).toMatchObject({ kind: 'block', text: 'Gặp sự cố: Rò rỉ · tiến độ 30%' });
    expect(blocked.history?.map((h) => h.id)).toEqual(['h1', 'h2', 'h3']);
  });

  test('checklist 33 % → mặc định 35 %: chỉ làm tròn không tính là thay đổi; lịch sử không ghi "33% → 35%"', () => {
    const checklist = [
      { id: 'a', text: 'a', done: true },
      { id: 'b', text: 'b', done: false },
      { id: 'c', text: 'c', done: false },
    ];
    const r = rec({ progress: 33, checklist });
    expect(validateProgressUpdate(r, upd({ progress: 35 })).form).toBeTruthy();
    expect(applyProgressUpdate(r, upd({ state: 'paused', progress: 35, text: 'x' }), ctx).history?.at(-1)?.text).toBe(
      'Tạm dừng – lý do: x · tiến độ 35%',
    );
    expect(applyProgressUpdate(r, upd({ progress: 40 }), ctx).history?.at(-1)?.text).toBe('Cập nhật tiến độ · 33% → 40%');
  });

  test('chạy lại hai lần cùng thay đổi: lần 2 không còn gì đổi (không thêm lịch sử)', () => {
    const r1 = applyProgressUpdate(rec(), upd({ progress: 60 }), ctx);
    const r2 = applyProgressUpdate(r1, upd({ progress: 60 }), ctx);
    expect(r2).toBe(r1);
    expect(r1.history).toHaveLength(1);
  });

  test('tệp: chỉ lưu tên/kích thước/loại + isTemp (không object URL), lịch sử ghi số tệp', () => {
    const r0 = rec({ attachments: [{ id: 'f1', name: 'a.pdf', size: 1 }] });
    const r1 = applyProgressUpdate(r0, upd({ files: [{ name: 'anh.jpg', size: 2048, kind: 'image' }] }), ctx);
    expect(r1.attachments).toEqual([
      { id: 'f1', name: 'a.pdf', size: 1 },
      { id: 't2', name: 'anh.jpg', size: 2048, kind: 'image', isTemp: true },
    ]);
    expect(JSON.stringify(r1.attachments)).not.toContain('blob:');
    expect(r1.history?.at(-1)?.text).toBe('Cập nhật tiến độ · tiến độ 30% · đính kèm 1 tệp');
  });
});

describe('hạn chót gần hạn (≤ 2 giờ) / quá hạn', () => {
  test('ranh giới 2 giờ', () => {
    const due = new Date('2026-10-26T09:00:00Z'); // 16:00 giờ nhà máy
    expect(NEAR_DUE_MS).toBe(2 * 3600_000);
    expect(isNearOrPastDue('2026-10-26T16:00', new Date(due.getTime() - NEAR_DUE_MS - 60_000))).toBe(false);
    expect(isNearOrPastDue('2026-10-26T16:00', new Date(due.getTime() - NEAR_DUE_MS))).toBe(true);
    expect(isNearOrPastDue('2026-10-26T16:00', due)).toBe(true);
    expect(isNearOrPastDue('2026-10-26T16:00', new Date(due.getTime() + 86_400_000))).toBe(true);
  });

  test('hạn chỉ có ngày = 23:59:59; sai định dạng → false', () => {
    expect(isNearOrPastDue('2026-10-26T23:59', NOW, false)).toBe(false);
    expect(isNearOrPastDue('2026-10-26T23:59', new Date('2026-10-26T15:00:00Z'), false)).toBe(true); // 22:00
    expect(isNearOrPastDue('abc', NOW)).toBe(false);
  });
});

describe('tệp tải lên', () => {
  test('loại / dung lượng / số tệp', () => {
    const { accepted, rejected } = checkUploads(
      [
        { name: 'a.JPG', size: UPLOAD_RULES.maxBytes },
        { name: 'b.exe', size: 10 },
        { name: 'c.pdf', size: UPLOAD_RULES.maxBytes + 1 },
        { name: 'khong-duoi', size: 10 },
        { name: 'd.txt', size: 0 },
      ],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.JPG', 'd.txt']);
    expect(rejected).toEqual([
      { name: 'b.exe', reason: 'không đúng loại tệp cho phép' },
      { name: 'c.pdf', reason: 'vượt quá 10 MB' },
      { name: 'khong-duoi', reason: 'không đúng loại tệp cho phép' },
    ]);
  });

  test('vượt số tệp còn lại trong lần cập nhật', () => {
    const files = [1, 2, 3].map((i) => ({ name: `${i}.png`, size: 1 }));
    expect(checkUploads(files, 3).accepted).toHaveLength(2);
    expect(checkUploads(files, 5).accepted).toHaveLength(0);
    expect(checkUploads([], 0)).toEqual({ accepted: [], rejected: [] });
  });

  test('uploadKind', () => {
    expect(uploadKind('x.webp')).toBe('image');
    expect(uploadKind('x.pdf')).toBe('document');
  });
});
