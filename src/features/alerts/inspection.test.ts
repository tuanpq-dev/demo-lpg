import { describe, expect, test } from 'vitest';
import {
  inspectedCount,
  inspectionEntry,
  inspectionErrors,
  inspectionItems,
  setInspectionStatus,
  toggledInspection,
  writeInspection,
} from './inspection';

const at = new Date('2026-10-28T03:50:00Z');
const ctx = { by: 'Nguyễn Văn A', at };
const steps = [
  { id: 'a', text: 'Đối chiếu PT-101 với đồng hồ cơ' },
  { id: 'b', text: 'Kiểm tra bộ điều áp PR-101' },
  { id: 'c', text: 'Kiểm tra van an toàn PSV-101' },
];

describe('chuẩn hoá guide (một hàm cho dạng cũ + mới)', () => {
  test('thiếu → Chưa kiểm tra; dạng cũ {at, by} → Đạt; dạng mới giữ status + ghi chú', () => {
    expect(inspectionEntry(undefined, 'a')).toEqual({ status: 'pending', note: '' });
    expect(inspectionEntry({ a: { at: 'T', by: 'X' } }, 'a')).toEqual({ status: 'pass', by: 'X', at: 'T', note: '' });
    expect(inspectionEntry({ a: { at: 'T', by: 'X', status: 'issue', note: 'Kẹt cơ cấu' } }, 'a')).toEqual({
      status: 'issue',
      by: 'X',
      at: 'T',
      note: 'Kẹt cơ cấu',
    });
    // pending có ghi chú: không có người/giờ kiểm tra
    expect(inspectionEntry({ a: { at: 'T', by: 'X', status: 'pending', note: 'Chờ' } }, 'a')).toEqual({ status: 'pending', note: 'Chờ' });
  });
  test('drawer và modal đọc CÙNG danh sách theo thứ tự cấu hình', () => {
    const guide = { b: { at: 'T', by: 'X' }, c: { at: 'T', by: 'Y', status: 'na' as const } };
    const items = inspectionItems(steps, guide);
    expect(items.map((i) => [i.id, i.status])).toEqual([
      ['a', 'pending'],
      ['b', 'pass'],
      ['c', 'na'],
    ]);
    expect(inspectedCount(items)).toBe(2);
  });
});

describe('ghi + đổi trạng thái', () => {
  test('đổi trạng thái tự điền người + giờ; về Chưa kiểm tra bỏ người/giờ, giữ ghi chú; đổi lại cùng trạng thái = không đổi', () => {
    const cur = inspectionEntry(undefined, 'a');
    const pass = setInspectionStatus(cur, 'pass', ctx);
    expect(pass).toEqual({ status: 'pass', by: 'Nguyễn Văn A', at: at.toISOString(), note: '' });
    expect(setInspectionStatus(pass, 'pass', ctx)).toBe(pass);
    expect(setInspectionStatus({ ...pass, note: 'ok' }, 'pending', ctx)).toEqual({ status: 'pending', note: 'ok' });
  });
  test('writeInspection: pending không ghi chú → xoá; còn lại ghi dạng mới (cắt khoảng trắng ghi chú)', () => {
    const g = writeInspection({ a: { at: 'T', by: 'X' } }, 'a', { status: 'pending', note: '  ' }, ctx);
    expect(g).toEqual({});
    const g2 = writeInspection(undefined, 'b', { status: 'issue', note: ' Kẹt ' }, ctx);
    expect(g2).toEqual({ b: { status: 'issue', by: 'Nguyễn Văn A', at: at.toISOString(), note: 'Kẹt' } });
  });
  test('tick nhanh ở drawer: pending ↔ pass; issue/na khoá (null)', () => {
    expect(toggledInspection({ status: 'pending', note: '' })?.status).toBe('pass');
    expect(toggledInspection({ status: 'pass', note: 'x' })).toEqual({ status: 'pending', note: 'x' });
    expect(toggledInspection({ status: 'issue', note: 'x' })).toBeNull();
    expect(toggledInspection({ status: 'na', note: '' })).toBeNull();
  });
  test('"Có vấn đề" bắt buộc ghi chú', () => {
    expect(inspectionErrors({ a: { status: 'issue', note: ' ' }, b: { status: 'issue', note: 'Kẹt' }, c: { status: 'pass', note: '' } })).toEqual({
      a: 'Nhập ghi chú cho hạng mục có vấn đề.',
    });
  });
});
