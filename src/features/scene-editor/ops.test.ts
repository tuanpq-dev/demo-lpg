import { describe, expect, test } from 'vitest';
import type { SceneConfig } from '@/features/scene/types';
import {
  addPipe,
  alignObjects,
  attachToPipe,
  cleanObject,
  cloneObjects,
  createObject,
  detachFromPipe,
  insertPipePoint,
  nextObjectId,
  normalizeScene,
  removeObjects,
  removePipes,
  renameObject,
  renamePipe,
  reversePipe,
  setElevation,
} from './ops';

const scene = (): SceneConfig => ({
  id: 's',
  name: 'S',
  version: 1,
  schemaVersion: 2,
  views: [{ id: 'v', label: 'V', objectIds: ['P-101', 'V-101'] }],
  objects: [
    { id: 'V-101', asset: 'tank-horizontal', position: [-10, 0, 0] },
    { id: 'P-101', asset: 'pump', position: [6, 0, 0] },
    { id: 'XV-101', asset: 'valve', attach: { pipe: 'PL-01', t: 0.25 } },
  ],
  pipes: [{ id: 'PL-01', from: 'V-101.out', to: 'P-101.suction', points: [[0, 3, 0], [0, 0.8, 0]] }],
});

describe('id + tạo object', () => {
  test('nextObjectId lấy số nhỏ nhất chưa dùng theo idPrefix', () => {
    expect(nextObjectId('pump', new Set(['P-101', 'P-103']))).toBe('P-102');
    expect(nextObjectId('fence', new Set())).toBe('FN-01');
  });
  test('createObject luôn đặt trên sàn (y = 0) dù điểm thả có y', () => {
    expect(createObject('pump', [1, 5, 2], new Set()).position).toEqual([1, 0, 2]);
  });
});

describe('độ cao + căn hàng', () => {
  test('setElevation đồng bộ position[1]; 0 = bỏ elevation; bỏ qua object gắn ống', () => {
    const s = setElevation(scene(), ['P-101', 'XV-101'], 1.25);
    expect(s.objects[1]).toMatchObject({ position: [6, 1.25, 0], elevation: 1.25 });
    expect(s.objects[2]).toEqual(scene().objects[2]);
    expect(setElevation(s, ['P-101'], 0).objects[1]).toEqual({ id: 'P-101', asset: 'pump', position: [6, 0, 0] });
  });
  test('setElevation không đổi gì → giữ tham chiếu (không tạo bước undo thừa)', () => {
    const s = scene();
    expect(setElevation(s, ['P-101'], 0)).toBe(s);
  });
  test('alignObjects theo X: cùng Z + elevation của mốc, cách đều', () => {
    const s = setElevation({ ...scene(), objects: [...scene().objects.slice(0, 2), { id: 'F-1', asset: 'filter', position: [20, 0, 7] }] }, ['P-101'], 1);
    const r = alignObjects(s, ['P-101', 'V-101', 'F-1'], 'x');
    expect(r.objects.map((o) => o.position)).toEqual([
      [-10, 1, 0],
      [5, 1, 0],
      [20, 1, 0],
    ]);
  });
});

describe('xoá / đổi id / nhân bản', () => {
  test('removeObjects keep: đầu ống thành điểm tự do đúng vị trí cổng, dọn view', () => {
    const r = removeObjects(scene(), ['P-101'], 'keep');
    expect(r.views![0]!.objectIds).toEqual(['V-101']);
    expect(r.pipes[0]!.to).toBeUndefined();
    expect(r.pipes[0]!.points.at(-1)).toEqual([4.75, 0.8, 0]);
  });
  test('removeObjects delete: xoá cả ống và object gắn trên ống', () => {
    const r = removeObjects(scene(), ['P-101'], 'delete');
    expect(r.pipes).toEqual([]);
    expect(r.objects.map((o) => o.id)).toEqual(['V-101']);
  });
  test('renameObject cập nhật view + from/to; id trùng/không hợp lệ → null', () => {
    const r = renameObject(scene(), 'P-101', 'P-201')!;
    expect(r.pipes[0]!.to).toBe('P-201.suction');
    expect(r.views![0]!.objectIds).toContain('P-201');
    expect(renameObject(scene(), 'P-101', 'V-101')).toBeNull();
    expect(renameObject(scene(), 'P-101', 'a.b')).toBeNull();
  });
  test('cloneObjects: id mới, dời offset, object gắn ống dời t', () => {
    const [c1, c2] = cloneObjects(scene().objects.slice(1), new Set(scene().objects.map((o) => o.id)), [1, 0, 1]);
    expect(c1).toMatchObject({ id: 'P-102', position: [7, 0, 1] });
    expect(c2).toMatchObject({ id: 'XV-102', attach: { pipe: 'PL-01', t: 0.3 } });
  });
  test('cleanObject bỏ giá trị mặc định', () => {
    expect(cleanObject({ id: 'a', asset: 'pump', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], params: {}, label: '' })).toEqual({ id: 'a', asset: 'pump', position: [0, 0, 0] });
  });
});

describe('ống', () => {
  test('addPipe: id PL-xx kế tiếp, cổng bí danh → tên thật, làm tròn 3 số lẻ', () => {
    const { scene: s, id } = addPipe(scene(), { from: 'P-101.out', points: [[1.23456, 1, 2]] });
    expect(id).toBe('PL-02');
    expect(s.pipes[1]).toEqual({ id: 'PL-02', from: 'P-101.discharge', points: [[1.235, 1, 2]] });
  });
  test('insertPipePoint chèn vào đoạn gần nhất (tính cả cổng đầu)', () => {
    const r = insertPipePoint(scene(), 'PL-01', [0, 2, 0]);
    expect(r.pipes[0]!.points).toEqual([[0, 3, 0], [0, 2, 0], [0, 0.8, 0]]);
    const r2 = insertPipePoint(scene(), 'PL-01', [-1, 3, 0]);
    expect(r2.pipes[0]!.points[0]).toEqual([-1, 3, 0]);
  });
  test('reversePipe đảo from/to, điểm và t của object gắn', () => {
    const r = reversePipe(scene(), 'PL-01');
    expect(r.pipes[0]).toMatchObject({ from: 'P-101.suction', to: 'V-101.out', points: [[0, 0.8, 0], [0, 3, 0]] });
    expect(r.objects[2]!.attach!.t).toBe(0.75);
  });
  test('renamePipe cập nhật attach.pipe; removePipes xoá object gắn', () => {
    expect(renamePipe(scene(), 'PL-01', 'PL-09')!.objects[2]!.attach!.pipe).toBe('PL-09');
    expect(renamePipe(scene(), 'PL-01', 'P-101')).toBeNull();
    expect(removePipes(scene(), ['PL-01']).objects.map((o) => o.id)).toEqual(['V-101', 'P-101']);
  });
  test('attach/detach: tháo rồi gắn lại về đúng t', () => {
    const d = detachFromPipe(scene(), 'XV-101');
    const o = d.objects[2]!;
    expect(o.attach).toBeUndefined();
    expect(o.position).toBeDefined();
    const back = attachToPipe(d, 'XV-101', 'PL-01');
    expect(back.objects[2]!.attach!.t).toBeCloseTo(0.25, 2);
  });
});

test('normalizeScene: thứ tự khoá cố định + schemaVersion', () => {
  const n = normalizeScene(scene());
  expect(Object.keys(n)).toEqual(['id', 'name', 'version', 'schemaVersion', 'views', 'objects', 'pipes']);
});
