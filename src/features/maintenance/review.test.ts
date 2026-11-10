import { describe, expect, test } from 'vitest';
import type { MaintenanceRecord, MaintenanceStatus } from '@/features/maintenance/types';
import {
  canSubmitForReview,
  defaultProposedAt,
  followUpUntil,
  resolveReviewer,
  reviewRecord,
  snapshotReading,
  submitForReview,
  submitMissing,
  validateReview,
  type SubmitForm,
  type SubmitInput,
} from './review';

const done = (id: string) => ({ id, text: id, done: true });
const rec = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'MT-1',
  code: 'MT-1',
  title: 'Kiểm tra van an toàn',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  createdAt: '2026-10-26',
  dueAt: '2026-10-26T16:00',
  completedAt: null,
  progress: 100,
  reportedProgress: 80,
  checklist: [done('a'), done('b'), { id: 'c', text: 'c', done: false, na: true }],
  ...patch,
});

// 11:45 ngày 26/10 giờ nhà máy (UTC+7).
const NOW = new Date('2026-10-26T04:45:00Z');
const tech = { actor: 'Nguyễn Văn A', now: NOW };
const form = (patch: Partial<SubmitForm> = {}): SubmitForm => ({
  summary: 'Đã kiểm tra PSV-101',
  cause: 'Bụi bẩn cảm biến',
  remedy: 'Vệ sinh tiếp điểm',
  deviceCondition: 'normal',
  sensorStatus: 'normal',
  valveStatus: 'stable',
  reviewer: 'Trần Hoàng Nam',
  ...patch,
});
const input = (patch: Partial<SubmitInput> = {}): SubmitInput => ({
  ...form(),
  readings: { pressure: { tag: 'PT-101', value: 9.8, warn: 10.5 }, temperature: { tag: 'TT-101', value: 29.4, warn: 40 }, at: '2026-10-26T11:45' },
  ...patch,
});
const ALL: MaintenanceStatus[] = ['pending', 'assigned', 'in-progress', 'review', 'done', 'cancelled'];

describe('điều kiện gửi nghiệm thu', () => {
  test('đủ: checklist xong (bỏ N/A) + tóm tắt + nguyên nhân + biện pháp + người nghiệm thu', () => {
    expect(submitMissing(rec(), form())).toEqual([]);
    expect(canSubmitForReview(rec(), form())).toBe(true);
  });

  test('liệt kê từng mục thiếu (khoảng trắng = trống)', () => {
    const r = rec({ checklist: [done('a'), { id: 'b', text: 'b', done: false }] });
    const ids = submitMissing(r, form({ summary: ' ', cause: '', remedy: '\n', reviewer: null })).map((m) => m.id);
    expect(ids).toEqual(['checklist', 'summary', 'cause', 'remedy', 'reviewer']);
    expect(submitMissing(r, form())[0]!.label).toBe('Checklist chưa hoàn thành (1/2)');
  });

  test('người nghiệm thu trùng người thực hiện → không gửi được', () => {
    expect(submitMissing(rec(), form({ reviewer: 'Nguyễn Văn A' })).map((m) => m.id)).toEqual(['reviewer-self']);
  });

  test('không có checklist → bỏ điều kiện checklist; checklist toàn N/A = xong', () => {
    expect(canSubmitForReview(rec({ checklist: undefined }), form())).toBe(true);
    expect(canSubmitForReview(rec({ checklist: [{ id: 'x', text: 'x', done: false, na: true }] }), form())).toBe(true);
  });

  test('"Chưa khắc phục" không chặn gửi', () => {
    expect(canSubmitForReview(rec(), form({ deviceCondition: 'unresolved' }))).toBe(true);
  });

  test('chỉ từ Đang thực hiện', () => {
    for (const s of ALL.filter((x) => x !== 'in-progress')) {
      expect(submitMissing(rec({ status: s }), form()).map((m) => m.id)).toContain('status');
    }
  });
});

describe('thời gian đề nghị mặc định (+30 phút, làm tròn lên mốc 15 phút, giờ nhà máy)', () => {
  test.each([
    ['2026-10-26T04:45:00Z', '2026-10-26T12:15'], // 11:45 → 12:15 (đúng mốc)
    ['2026-10-26T04:45:30Z', '2026-10-26T12:30'], // giây lẻ → mốc kế
    ['2026-10-26T04:46:00Z', '2026-10-26T12:30'], // 11:46 → 12:16 → 12:30
    ['2026-10-26T04:59:59Z', '2026-10-26T12:30'],
    ['2026-10-26T16:40:00Z', '2026-10-27T00:15'], // 23:40 → qua nửa đêm giờ nhà máy
  ])('%s → %s', (iso, expected) => {
    expect(defaultProposedAt(new Date(iso))).toBe(expected);
  });
});

describe('submitForReview', () => {
  test('→ review, tiến độ 100, bỏ cờ, lưu hồ sơ, MỘT dòng lịch sử + ghi chú tóm tắt', () => {
    const r0 = rec({
      hold: { kind: 'paused', reason: 'x', at: 'y' },
      reviewFailed: true,
      history: [{ id: 'h1', at: 'a', kind: 'create', text: 'Tạo' }],
    });
    const r = submitForReview(r0, input({ proposedAt: '2026-10-26T15:30' }), tech);
    expect(r.status).toBe('review');
    expect(r.reportedProgress).toBe(100);
    expect('hold' in r).toBe(false);
    expect('reviewFailed' in r).toBe(false);
    expect(r.submission).toMatchObject({
      reviewer: 'Trần Hoàng Nam',
      submittedBy: 'Nguyễn Văn A',
      submittedAt: '2026-10-26T11:45',
      proposedAt: '2026-10-26T15:30',
      remedy: 'Vệ sinh tiếp điểm',
    });
    expect(r.history).toHaveLength(2);
    expect(r.history?.[1]).toEqual({
      id: 'h2',
      at: '2026-10-26T11:45',
      kind: 'submit',
      text: 'Gửi nghiệm thu – người nghiệm thu: Trần Hoàng Nam · 80% → 100%',
      actor: 'Nguyễn Văn A',
    });
    expect(r.notes?.at(-1)?.text).toBe('Tóm tắt gửi nghiệm thu: Đã kiểm tra PSV-101');
  });

  test('tiến độ đã 100 → lịch sử không ghi "→"; Chưa khắc phục + tệp ghi kèm', () => {
    const r = submitForReview(
      rec({ reportedProgress: 100 }),
      input({ deviceCondition: 'unresolved', files: [{ name: 'a.jpg', size: 1, kind: 'image' }] }),
      tech,
    );
    expect(r.history?.at(-1)?.text).toBe('Gửi nghiệm thu – người nghiệm thu: Trần Hoàng Nam · thiết bị: Chưa khắc phục · đính kèm 1 tệp');
    expect(r.attachments?.at(-1)).toEqual({ id: 't1', name: 'a.jpg', size: 1, kind: 'image', isTemp: true });
  });

  test('thiếu điều kiện → trả nguyên bản ghi (cùng tham chiếu)', () => {
    const r = rec();
    expect(submitForReview(r, input({ remedy: '' }), tech)).toBe(r);
    expect(submitForReview(r, input({ reviewer: 'Nguyễn Văn A' }), tech)).toBe(r);
  });

  test('ảnh chụp số liệu không đổi khi live đổi sau đó', () => {
    const live = { state: 'ok' as const, value: 9.8 };
    const snap = snapshotReading(live, { tag: 'PT-101', warn: 10.5 })!;
    const readings = { pressure: snap, at: '2026-10-26T11:45' };
    const r = submitForReview(rec(), input({ readings }), tech);
    live.value = 12.4; // live nhảy
    snap.value = 12.4; // kể cả đối tượng truyền vào bị sửa
    expect(r.submission?.readings.pressure).toEqual({ tag: 'PT-101', value: 9.8, warn: 10.5 });
  });

  test('snapshotReading: mất tín hiệu / chưa có số → null (không giữ số cũ); không có live → undefined', () => {
    expect(snapshotReading({ state: 'lost', value: 9.1 })).toEqual({ value: null });
    expect(snapshotReading({ state: 'pending' })).toEqual({ value: null });
    expect(snapshotReading({ state: 'ok', value: Number.NaN })).toEqual({ value: null });
    expect(snapshotReading(undefined)).toBeUndefined();
  });
});

describe('nghiệm thu', () => {
  const inReview = () => submitForReview(rec(), input(), tech);
  const reviewer = { now: new Date('2026-10-26T07:00:00Z') }; // 14:00

  test('chặn tự nghiệm thu (người thực hiện) và người nghiệm thu trống', () => {
    const r = inReview();
    expect(validateReview(r, { result: 'pass', reviewer: 'Nguyễn Văn A', comment: '' }).reviewer).toBe(
      'Người thực hiện không được tự nghiệm thu yêu cầu của mình.',
    );
    expect(validateReview(r, { result: 'pass', reviewer: ' ', comment: '' }).reviewer).toBeTruthy();
    expect(reviewRecord(r, { result: 'pass', reviewer: 'Nguyễn Văn A', comment: '' }, reviewer)).toBe(r);
  });

  test('Đạt yêu cầu → done, theo dõi thêm, lịch sử review-pass; hồ sơ gửi giữ nguyên', () => {
    const r0 = inReview();
    const r = reviewRecord(r0, { result: 'pass', reviewer: 'Trần Hoàng Nam', comment: 'Ổn định', followUpHours: 2 }, reviewer);
    expect(r.status).toBe('done');
    expect(r.completedAt).toBe('2026-10-26');
    expect(r.review).toEqual({
      result: 'pass',
      reviewer: 'Trần Hoàng Nam',
      comment: 'Ổn định',
      followUpHours: 2,
      followUpUntil: '2026-10-26T16:00',
      at: '2026-10-26T14:00',
    });
    expect(r.history?.at(-1)).toMatchObject({
      kind: 'review-pass',
      text: 'Nghiệm thu đạt – hoàn thành · theo dõi thêm 2 giờ (đến 16:00)',
      actor: 'Trần Hoàng Nam',
    });
    expect(r.submission).toBe(r0.submission);
    expect(r.notes).toEqual(r0.notes); // Đạt: không thêm ghi chú
  });

  test('Đạt không theo dõi → không có followUpUntil', () => {
    const r = reviewRecord(inReview(), { result: 'pass', reviewer: 'Trần Hoàng Nam', comment: '', followUpHours: 0 }, reviewer);
    expect(r.review?.followUpUntil).toBeUndefined();
    expect(r.history?.at(-1)?.text).toBe('Nghiệm thu đạt – hoàn thành');
  });

  test('Cần bổ sung → in-progress, giữ tiến độ 100, ý kiến bắt buộc → ghi chú của người nghiệm thu; lịch sử chỉ trỏ tới ghi chú', () => {
    const r0 = inReview();
    expect(reviewRecord(r0, { result: 'needs-info', reviewer: 'Trần Hoàng Nam', comment: '  ' }, reviewer)).toBe(r0);
    expect(validateReview(r0, { result: 'needs-info', reviewer: 'Trần Hoàng Nam', comment: '' }).comment).toBe('Nhập nội dung cần bổ sung.');
    const r = reviewRecord(r0, { result: 'needs-info', reviewer: 'Trần Hoàng Nam', comment: 'Thiếu ảnh mặt bích' }, reviewer);
    expect(r.status).toBe('in-progress');
    expect(r.reportedProgress).toBe(100);
    expect(r.reviewFailed).toBeUndefined();
    expect(r.notes?.at(-1)).toEqual({
      id: `n${r.notes!.length}`,
      author: 'Trần Hoàng Nam',
      at: '2026-10-26T14:00',
      text: 'Nghiệm thu: Cần bổ sung – Thiếu ảnh mặt bích',
    });
    expect(r.history?.at(-1)).toMatchObject({ kind: 'review-needs-info', text: 'Nghiệm thu: Cần bổ sung – xem ghi chú kỹ thuật' });
    expect(r.history?.at(-1)?.text).not.toContain('mặt bích');
  });

  test('Không đạt → in-progress + cờ, tiến độ = tiến độ checklist, lý do bắt buộc → ghi chú', () => {
    const r0 = submitForReview(rec({ checklist: [done('a'), done('b')] }), input(), tech);
    // checklist bị bỏ tick sau khi gửi (tình huống biên) → tiến độ checklist 50 %
    const r1 = { ...r0, checklist: [done('a'), { id: 'b', text: 'b', done: false }] };
    expect(validateReview(r1, { result: 'fail', reviewer: 'Trần Hoàng Nam', comment: '' }).comment).toBe('Nhập lý do không đạt.');
    const r = reviewRecord(r1, { result: 'fail', reviewer: 'Trần Hoàng Nam', comment: 'Còn rò rỉ' }, reviewer);
    expect(r.status).toBe('in-progress');
    expect(r.reviewFailed).toBe(true);
    expect(r.reportedProgress).toBe(50);
    expect(r.history?.at(-1)).toMatchObject({ kind: 'review-fail', text: 'Nghiệm thu: Không đạt – xem ghi chú kỹ thuật · tiến độ 100% → 50%' });
    expect(r.notes?.at(-1)?.text).toBe('Nghiệm thu: Không đạt – Còn rò rỉ');
    // checklist chưa xong → chưa gửi lại được; làm xong rồi gửi lại → bỏ cờ
    expect(submitForReview(r, input(), tech)).toBe(r);
    const resent = submitForReview({ ...r, checklist: [done('a'), done('b')] }, input(), tech);
    expect(resent.status).toBe('review');
    expect('reviewFailed' in resent).toBe(false);
  });

  test('chỉ từ Chờ nghiệm thu; chạy lại hai lần → lần 2 không đổi', () => {
    for (const s of ALL.filter((x) => x !== 'review')) {
      const r = rec({ status: s });
      expect(reviewRecord(r, { result: 'pass', reviewer: 'Trần Hoàng Nam', comment: '' }, reviewer)).toBe(r);
    }
    const once = reviewRecord(inReview(), { result: 'pass', reviewer: 'Trần Hoàng Nam', comment: '' }, reviewer);
    expect(reviewRecord(once, { result: 'pass', reviewer: 'Trần Hoàng Nam', comment: '' }, reviewer)).toBe(once);
  });

  test('followUpUntil qua nửa đêm giờ nhà máy; 0/âm → undefined', () => {
    expect(followUpUntil(new Date('2026-10-26T16:00:00Z'), 2)).toBe('2026-10-27T01:00');
    expect(followUpUntil(NOW, 0)).toBeUndefined();
    expect(followUpUntil(NOW, -2)).toBeUndefined();
  });

  test('resolveReviewer: đăng nhập → người đang đăng nhập; không đăng nhập → người được chọn khi gửi', () => {
    const submission = { reviewer: 'Trần Hoàng Nam' };
    expect(resolveReviewer({ authOff: false, userName: 'Kỹ sư B', submission })).toBe('Kỹ sư B');
    expect(resolveReviewer({ authOff: true, userName: 'Admin', submission })).toBe('Trần Hoàng Nam');
    expect(resolveReviewer({ authOff: true, userName: 'Admin' })).toBe('Admin');
    expect(resolveReviewer({ authOff: false })).toBe('');
  });
});
