import { describe, expect, test } from 'vitest';
import { validateSceneConfig } from '@/features/scene/parse';
import { needsMigration } from '@/features/scene/migrate';
import type { SceneConfig, SceneObject } from '@/features/scene/types';
import khuBon from '@/mocks/scenes/khu-bon-lpg.json';
import { checkScene } from './validate';

const TAGS = ['LT-101', 'PT-101', 'P-101A.STATE'];

/** Cảnh nhỏ hợp lệ: bồn + bơm nối ống, mọi thứ trên sàn, tag có trong danh sách. */
const scene = (patch: Partial<SceneConfig> = {}): SceneConfig => ({
  id: 'test',
  name: 'Test',
  version: 1,
  schemaVersion: 2,
  objects: [
    { id: 'V-101', asset: 'tank-horizontal', position: [-10, 0, 0], bindings: { level: 'LT-101' } },
    { id: 'P-101', asset: 'pump', position: [6, 0, 0], bindings: { state: 'P-101A.STATE' } },
  ],
  pipes: [
    {
      id: 'PL-01',
      from: 'V-101.out',
      to: 'P-101.suction',
      points: [
        [0, 3, 0],
        [0, 0.8, 0],
      ],
    },
  ],
  ...patch,
});
const withObject = (o: SceneObject) => scene({ objects: [...scene().objects, o] });
const messages = (s: unknown) => checkScene(s as SceneConfig, TAGS).map((i) => `${i.severity}: ${i.message}`);

describe('checkScene / validateSceneConfig', () => {
  test('cảnh hợp lệ: không lỗi, không cảnh báo', () => {
    expect(validateSceneConfig(scene())).toEqual([]);
    expect(messages(scene())).toEqual([]);
  });

  test('cảnh mẫu khu-bon-lpg: không có lỗi', () => {
    expect(validateSceneConfig(khuBon)).toEqual([]);
  });

  test('id trùng → lỗi', () => {
    const s = withObject({ id: 'V-101', asset: 'pump', position: [20, 0, 0] });
    expect(messages(s)).toContainEqual(expect.stringMatching(/^error: id "V-101" bị trùng/));
  });

  test('asset không tồn tại → lỗi liệt kê loại có', () => {
    const s = withObject({ id: 'X-1', asset: 'robot' as never, position: [20, 0, 0] });
    expect(messages(s)).toContainEqual(expect.stringMatching(/^error: asset "robot" không tồn tại \(có: tank-horizontal/));
  });

  test('binding trỏ tag không có → cảnh báo', () => {
    const s = withObject({ id: 'P-102', asset: 'pump', position: [20, 0, 0], bindings: { state: 'P-999.STATE' } });
    expect(messages(s)).toContainEqual('warning: "P-102": tag "P-999.STATE" không có trong danh sách tag cảm biến');
  });

  test('ống < 2 điểm → lỗi', () => {
    const s = scene({ pipes: [{ id: 'PL-01', points: [[0, 1, 0]] }] });
    expect(messages(s)).toContainEqual('error: ống "PL-01" cần ≥ 2 điểm');
  });

  test('cổng không tồn tại → lỗi liệt kê cổng có', () => {
    const s = scene({ pipes: [{ id: 'PL-01', from: 'V-101.nope', points: [[0, 1, 0]] }] });
    expect(messages(s)).toContainEqual(
      expect.stringMatching(/^error: ống "PL-01": "V-101" \(tank-horizontal\) không có cổng "nope" \(có: in, out, drain\)/),
    );
  });

  test('object lún dưới sàn → cảnh báo', () => {
    const s = withObject({ id: 'F-1', asset: 'filter', position: [20, -0.5, 0], elevation: -0.5 });
    expect(messages(s)).toContainEqual('warning: "F-1" lún dưới sàn 0.5 m (đáy y = -0.5 m)');
  });

  test('elevation sai: position[1] ≠ elevation → lỗi; bơm nâng không lý do → cảnh báo lơ lửng', () => {
    expect(messages(withObject({ id: 'F-1', asset: 'filter', position: [20, 1, 0], elevation: 0.5 }))).toContainEqual(
      expect.stringMatching(/^error: "F-1": position\[1\] \(1\) phải bằng elevation \(0.5\)/),
    );
    expect(messages(withObject({ id: 'P-2', asset: 'pump', position: [20, 1, 0], elevation: 1 }))).toContainEqual(
      expect.stringMatching(/^warning: "P-2" lơ lửng 1 m trên sàn/),
    );
    expect(messages(withObject({ id: 'XV-9', asset: 'valve', position: [20, 1, 0], elevation: 1 }))).toEqual([]);
  });

  test('cảnh version cũ (không schemaVersion) → cần migrate, validate tự migrate rồi hợp lệ', () => {
    const old = { id: 'cu', name: 'Cũ', version: 1, objects: [{ id: 'P-1', asset: 'pump', position: [0, 0.3, 0] }], pipes: [] };
    expect(needsMigration(old)).toBe(true);
    expect(validateSceneConfig(old)).toEqual([]);
    // schemaVersion khác 2 sau migrate (vd số lạ) → lỗi cấu trúc.
    expect(validateSceneConfig({ ...old, schemaVersion: 3 }).map((i) => i.where)).toContain('schemaVersion');
  });

  test('hai đầu ống cùng một cổng → lỗi', () => {
    const s = scene({ pipes: [{ id: 'PL-01', from: 'V-101.drain', to: 'V-101.drain', points: [] }] });
    expect(messages(s)).toContainEqual('error: ống "PL-01": hai đầu cùng nối "V-101.drain"');
  });
});
