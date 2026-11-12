import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord } from '@/features/maintenance/types';
import { applyProgressUpdate, checkUploads, isNearOrPastDue, validateProgressUpdate } from './progress';
import { reviewRecord, submitForReview, submitMissing, validateReview, type SubmitForm } from './review';

const rec = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'MT-1',
  code: 'MT-1',
  title: 'Kiểm tra van',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'high',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  createdAt: '2026-10-26',
  dueAt: '2026-10-26T16:00',
  completedAt: null,
  progress: 0,
  reportedProgress: 40,
  ...patch,
});

// 11:45 ngày 26/10 giờ nhà máy.
const NOW = new Date('2026-10-26T04:45:00Z');
const ctx = { actor: 'Nguyễn Văn A', now: NOW };

describe('cập nhật tiến độ', () => {
  test('chỉ mở ở Đã phân công / Đang thực hiện', () => {
    expect(validateProgressUpdate(rec({ status: 'review' }), { state: 'working', progress: 50, text: '' }).form).toBeDefined();
  });

  test('Tạm dừng / Gặp sự cố bắt buộc nội dung; không báo Hoàn thành ở modal này', () => {
    expect(validateProgressUpdate(rec(), { state: 'paused', progress: 40, text: ' ' }).text).toBeDefined();
    expect(validateProgressUpdate(rec(), { state: 'blocked', progress: 40, text: '' }).text).toBeDefined();
    expect(validateProgressUpdate(rec(), { state: 'completed', progress: 100, text: '' }).state).toBeDefined();
    expect(validateProgressUpdate(rec({ status: 'assigned' }), { state: 'completed', progress: 100, text: '' }).state).toContain('Bắt đầu');
  });

  test('không có thay đổi → chặn; Đã phân công luôn là thay đổi (bắt đầu)', () => {
    expect(validateProgressUpdate(rec(), { state: 'working', progress: 40, text: '' }).form).toContain('Chưa có thay đổi');
    expect(validateProgressUpdate(rec({ status: 'assigned' }), { state: 'working', progress: 40, text: '' })).toEqual({});
  });

  test('Đã phân công → Đang thực hiện, tiến độ làm tròn bước 5, một dòng lịch sử "Bắt đầu"', () => {
    const r = applyProgressUpdate(rec({ status: 'assigned', reportedProgress: 0 }), { state: 'working', progress: 23, text: '' }, ctx);
    expect(r.status).toBe('in-progress');
    expect(r.reportedProgress).toBe(25);
    expect(r.history).toEqual([expect.objectContaining({ kind: 'start', text: 'Bắt đầu thực hiện · 0% → 25%', actor: 'Nguyễn Văn A' })]);
  });

  test('tạm dừng ghi `hold` + ghi chú; tiếp tục bỏ `hold`', () => {
    const paused = applyProgressUpdate(rec(), { state: 'paused', progress: 40, text: 'Chờ vật tư' }, ctx);
    expect(paused.hold).toEqual({ kind: 'paused', reason: 'Chờ vật tư', at: '2026-10-26T11:45' });
    expect(paused.notes?.at(-1)?.text).toBe('Chờ vật tư');
    const resumed = applyProgressUpdate(paused, { state: 'working', progress: 60, text: '' }, ctx);
    expect(resumed.hold).toBeUndefined();
    expect(resumed.history?.at(-1)).toMatchObject({ kind: 'resume', text: 'Tiếp tục thực hiện · 40% → 60%' });
  });

  test('không hợp lệ → trả nguyên bản ghi', () => {
    const r = rec();
    expect(applyProgressUpdate(r, { state: 'paused', progress: 40, text: '' }, ctx)).toBe(r);
  });

  test('hạn đỏ khi đã quá hoặc còn ≤ 2 giờ', () => {
    expect(isNearOrPastDue('2026-10-26T13:30', NOW)).toBe(true);
    expect(isNearOrPastDue('2026-10-26T16:00', NOW)).toBe(false);
    expect(isNearOrPastDue('2026-10-26T09:00', NOW)).toBe(true);
  });

  test('tệp: đúng loại, ≤ 10 MB, tối đa 5 tệp mỗi lần', () => {
    const { accepted, rejected } = checkUploads(
      [
        { name: 'a.PNG', size: 1 },
        { name: 'b.exe', size: 1 },
        { name: 'c.pdf', size: 11 * 1024 * 1024 },
        { name: 'd.pdf', size: 1 },
        { name: 'e.pdf', size: 1 },
      ],
      3,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.PNG', 'd.pdf']);
    expect(rejected.map((f) => f.name)).toEqual(['b.exe', 'c.pdf', 'e.pdf']);
  });
});

const form = (patch: Partial<SubmitForm> = {}): SubmitForm => ({
  summary: 'Đã thay gioăng',
  cause: 'Gioăng lão hoá',
  remedy: 'Thay mới',
  deviceCondition: 'normal',
  sensorStatus: 'normal',
  valveStatus: 'stable',
  reviewer: 'Trần Thị B',
  ...patch,
});

describe('gửi nghiệm thu', () => {
  test('thiếu nội dung / checklist chưa xong / tự nghiệm thu → liệt kê đủ lý do', () => {
    const r = rec({
      checklist: [
        { id: 'c1', text: 'Tháo van', done: true },
        { id: 'c2', text: 'Thay gioăng', done: false },
        { id: 'c3', text: 'Không áp dụng', done: false, na: true },
      ],
    });
    expect(submitMissing(r, form({ summary: ' ', reviewer: 'Nguyễn Văn A' })).map((m) => m.id)).toEqual(['checklist', 'summary', 'reviewer-self']);
    expect(submitMissing(rec({ status: 'assigned' }), form()).map((m) => m.id)).toEqual(['status']);
  });

  test('đủ điều kiện → Chờ nghiệm thu, 100 %, lưu hồ sơ, bỏ cờ tạm dừng / Không đạt', () => {
    const r = submitForReview(
      rec({ hold: { kind: 'paused', reason: 'x', at: '2026-10-26T10:00' }, reviewFailed: true }),
      { ...form(), readings: { at: '2026-10-26T11:45' } },
      ctx,
    );
    expect(r).toMatchObject({ status: 'review', reportedProgress: 100, submission: { reviewer: 'Trần Thị B', submittedBy: 'Nguyễn Văn A' } });
    expect(r.hold).toBeUndefined();
    expect(r.reviewFailed).toBeUndefined();
    expect(r.history?.at(-1)).toMatchObject({ kind: 'submit', text: 'Gửi nghiệm thu – người nghiệm thu: Trần Thị B · 40% → 100%' });
  });

  test('thiếu điều kiện → trả nguyên bản ghi', () => {
    const r = rec();
    expect(submitForReview(r, { ...form({ cause: '' }), readings: { at: '' } }, ctx)).toBe(r);
  });
});

describe('nghiệm thu', () => {
  const inReview = rec({ status: 'review', reportedProgress: 100, progress: 50 });

  test('không tự nghiệm thu; Cần bổ sung / Không đạt bắt buộc ý kiến', () => {
    expect(validateReview(inReview, { result: 'pass', reviewer: 'Nguyễn Văn A', comment: '' }).reviewer).toBeDefined();
    expect(validateReview(inReview, { result: 'fail', reviewer: 'Trần Thị B', comment: '' }).comment).toBe('Nhập lý do không đạt.');
    expect(validateReview(inReview, { result: 'pass', reviewer: 'Trần Thị B', comment: '' })).toEqual({});
  });

  test('Đạt → Hoàn thành hôm nay (giờ nhà máy), theo dõi thêm có mốc kết thúc', () => {
    const r = reviewRecord(inReview, { result: 'pass', reviewer: 'Trần Thị B', comment: '', followUpHours: 2 }, ctx);
    expect(r).toMatchObject({
      status: 'done',
      completedAt: '2026-10-26',
      review: { result: 'pass', followUpHours: 2, followUpUntil: '2026-10-26T13:45' },
    });
    expect(r.history?.at(-1)).toMatchObject({ kind: 'review-pass', actor: 'Trần Thị B' });
  });

  test('Không đạt → quay lại Đang thực hiện, cờ Không đạt, tiến độ về theo checklist', () => {
    const r = reviewRecord(inReview, { result: 'fail', reviewer: 'Trần Thị B', comment: 'Còn rò' }, ctx);
    expect(r).toMatchObject({ status: 'in-progress', reviewFailed: true, reportedProgress: 50 });
    expect(r.notes?.at(-1)?.text).toBe('Nghiệm thu: Không đạt – Còn rò');
  });

  test('Cần bổ sung → Đang thực hiện, giữ tiến độ, không gắn cờ', () => {
    const r = reviewRecord(inReview, { result: 'needs-info', reviewer: 'Trần Thị B', comment: 'Thiếu ảnh' }, ctx);
    expect(r).toMatchObject({ status: 'in-progress', reportedProgress: 100 });
    expect(r.reviewFailed).toBeUndefined();
  });
});
