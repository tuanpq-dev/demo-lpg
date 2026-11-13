import { describe, expect, test } from 'vitest';
import { durationHours } from '@/data/maintenanceForm';
import { blankForm, validateCreate, type CreateFormValues } from './createForm';

/** 23:30 ngày 27/10 giờ nhà máy – ngày UTC (16:30Z) vẫn là 27, ngày nhà máy là 27; 17:30Z = 00:30 ngày 28 ở nhà máy. */
const LATE = new Date('2026-10-27T16:30:00Z');
const AFTER_MIDNIGHT = new Date('2026-10-27T17:30:00Z');

const form = (patch: Partial<CreateFormValues>): CreateFormValues => ({ ...blankForm('V-101', LATE), title: 'Kiểm tra van an toàn', ...patch });

describe('Tạo yêu cầu bảo trì – mặc định + kiểm tra hạn theo giờ nhà máy', () => {
  test('form trống: bắt đầu = giờ chẵn tới, hạn = +24 giờ (giờ nhà máy)', () => {
    const f = blankForm(null, LATE);
    expect(f.startAt).toBe('2026-10-28T00:00');
    expect(f.dueAt).toBe('2026-10-29T00:00');
  });

  test('hạn "hôm nay" theo nhà máy hợp lệ dù ngày UTC còn là hôm trước', () => {
    const f = form({ startAt: '', dueAt: '2026-10-28T08:00' });
    expect(validateCreate(f, AFTER_MIDNIGHT).dueAt).toBeUndefined();
  });

  test('hạn "hôm qua" theo nhà máy bị chặn dù trùng ngày UTC hiện tại', () => {
    const f = form({ startAt: '', dueAt: '2026-10-27T20:00' });
    expect(validateCreate(f, AFTER_MIDNIGHT).dueAt).toBe('Hạn hoàn thành không được trong quá khứ.');
  });

  test('hạn phải sau giờ bắt đầu', () => {
    const f = form({ startAt: '2026-10-28T10:00', dueAt: '2026-10-28T09:00' });
    expect(validateCreate(f, LATE).dueAt).toBe('Hạn hoàn thành phải sau thời gian bắt đầu.');
  });

  test('số giờ giữa hai mốc giờ nhà máy; thiếu / sai định dạng → null', () => {
    expect(durationHours('2026-10-27T22:00', '2026-10-28T08:30')).toBe(10.5);
    expect(durationHours('2026-10-27T22:00', '')).toBeNull();
    expect(durationHours('2026-10-27', '2026-10-28T08:00')).toBeNull();
  });
});
