import { describe, expect, test } from 'vitest';
import { GAS_BANDS } from '@/mocks/alertKinds';
import {
  canCloseFire,
  crossConfirm,
  crossConfirmText,
  detectorStatus,
  equipmentStateView,
  fireSignalView,
  type FireSignalKind,
  type TagReading,
} from './fire';

const ok = (value: number | string): TagReading => ({ state: 'ok', value });
const LOST: TagReading = { state: 'lost' };
const PENDING: TagReading = { state: 'pending' };
const gas = { bands: GAS_BANDS, unit: '% LEL' };
const view = (
  kind: FireSignalKind,
  r: TagReading,
  label = kind === 'gas' ? 'GS-05' : kind === 'smoke' ? 'Đầu báo khói SD-02' : 'Nút nhấn khẩn cấp',
) => ({
  kind,
  ...fireSignalView(kind, label, r, gas),
});

describe('trạng thái đầu báo – tách thiết bị và báo động', () => {
  test('báo động + trực tuyến / phục hồi / lỗi', () => {
    expect(detectorStatus(ok('alarm'), ok('online'))).toEqual({ device: 'online', alarm: 'active' });
    expect(detectorStatus(ok('normal'), ok('online'))).toEqual({ device: 'online', alarm: 'cleared' });
    expect(detectorStatus(ok('alarm'), ok('fault'))).toEqual({ device: 'fault', alarm: 'active' });
  });
  test('mất tín hiệu → mất kết nối + báo động không rõ (không giữ giá trị cũ); chưa có số → pending', () => {
    expect(detectorStatus(LOST, ok('online'))).toEqual({ device: 'lost', alarm: 'unknown' });
    expect(detectorStatus(PENDING, PENDING)).toEqual({ device: 'pending', alarm: 'unknown' });
    // Giá trị lạ → không rõ (không tự coi là phục hồi)
    expect(detectorStatus(ok('???'), ok('online')).alarm).toBe('unknown');
  });
});

describe('tín hiệu liên quan', () => {
  test('gas: mức theo bands, bất thường từ cấp 1 (biên 10)', () => {
    expect(view('gas', ok(6))).toMatchObject({ text: '6% LEL - Bình thường', tone: 'success', abnormal: false });
    expect(view('gas', ok(9.9)).abnormal).toBe(false);
    expect(view('gas', ok(10))).toMatchObject({ abnormal: true, tone: 'warning', reason: 'GS-05 10% LEL (cảnh báo cấp 1)' });
    expect(view('gas', ok(45)).tone).toBe('danger');
  });
  test('khói / nút nhấn; mất tín hiệu không bất thường, chữ "Mất tín hiệu"', () => {
    expect(view('smoke', ok('normal'))).toMatchObject({ text: 'Bình thường', abnormal: false });
    expect(view('smoke', ok('alarm'))).toMatchObject({ text: 'Đang báo động', tone: 'danger', abnormal: true });
    expect(view('call-point', ok('idle'))).toMatchObject({ text: 'Chưa kích hoạt', tone: 'neutral', abnormal: false });
    expect(view('call-point', ok('activated'))).toMatchObject({ text: 'Đã kích hoạt', abnormal: true });
    expect(view('smoke', LOST)).toMatchObject({ text: 'Mất tín hiệu', lost: true, abnormal: false });
    expect(view('gas', ok('x'))).toMatchObject({ lost: true, abnormal: false });
    expect(view('gas', PENDING)).toMatchObject({ text: '—', lost: false });
  });
});

describe('xác nhận chéo', () => {
  test('không tín hiệu nào bất thường (kể cả rỗng, mất tín hiệu) → không banner', () => {
    expect(crossConfirm([])).toEqual({ active: false });
    expect(crossConfirm([view('gas', ok(6)), view('smoke', LOST), view('call-point', ok('idle'))])).toEqual({ active: false });
  });
  test('khói hoặc gas ≥ cấp 1 → banner; stage = tập nguồn (sắp xếp)', () => {
    const c = crossConfirm([view('gas', ok(12)), view('smoke', ok('alarm')), view('call-point', ok('idle'))]);
    expect(c).toMatchObject({ active: true, callPoint: false, stage: 'gas+smoke' });
    if (!c.active) throw new Error();
    expect(crossConfirmText(c)).toMatch(/^GS-05 12% LEL \(cảnh báo cấp 1\) · Đầu báo khói SD-02 đang báo động\./);
  });
  test('nút nhấn kích hoạt → banner ghi rõ, đứng đầu', () => {
    const c = crossConfirm([view('smoke', ok('alarm')), view('call-point', ok('activated'))]);
    if (!c.active) throw new Error();
    expect(c.callPoint).toBe(true);
    expect(crossConfirmText(c)).toMatch(/^Nút nhấn khẩn cấp đã được kích hoạt · Đầu báo khói SD-02 đang báo động\./);
  });
});

describe('điều kiện đóng', () => {
  const base = { detector: 'HD-02' };
  test('đã phục hồi → đóng theo live; còn báo động → chặn kể cả đã kiểm tra tại chỗ', () => {
    expect(canCloseFire({ ...base, alarm: 'cleared', device: 'online' })).toEqual({ ok: true, source: 'live' });
    expect(canCloseFire({ ...base, alarm: 'active', device: 'online', fieldChecked: true })).toMatchObject({ ok: false, reason: 'still-alarm' });
  });
  test('mất tín hiệu → bắt buộc kiểm tra tại chỗ; chưa đọc được → chặn', () => {
    expect(canCloseFire({ ...base, alarm: 'unknown', device: 'lost' })).toMatchObject({ ok: false, reason: 'need-field-check' });
    expect(canCloseFire({ ...base, alarm: 'unknown', device: 'lost', fieldChecked: true })).toEqual({ ok: true, source: 'field' });
    expect(canCloseFire({ ...base, alarm: 'unknown', device: 'pending', fieldChecked: true })).toMatchObject({ ok: false, reason: 'pending' });
  });
});

test('trạng thái máy trong khu', () => {
  expect(equipmentStateView(ok('running'))).toMatchObject({ text: 'Đang hoạt động', tone: 'success' });
  expect(equipmentStateView(ok('standby'))).toMatchObject({ text: 'Sẵn sàng', role: 'Dự phòng' });
  expect(equipmentStateView(ok('fault')).tone).toBe('danger');
  expect(equipmentStateView(LOST)).toMatchObject({ lost: true });
});
