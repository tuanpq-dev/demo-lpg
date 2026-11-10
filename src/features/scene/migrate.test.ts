import { describe, expect, test } from 'vitest';
import { migrateScene, needsMigration } from './migrate';
import { SCENE_SCHEMA_VERSION } from './types';

/** Cảnh định dạng cũ (v1): không schemaVersion, độ cao nằm ở position[1], van đứng riêng có gốc ở tâm ống. */
const legacy = () => ({
  id: 'cu',
  name: 'Cảnh cũ',
  version: 5,
  objects: [
    { id: 'P-1', asset: 'pump', position: [0, 0.3, 0] },
    { id: 'XV-1', asset: 'valve', position: [3, 1.1, 0] },
    { id: 'T-1', asset: 'tank-vertical', position: [8, 0, 0] },
    { id: 'XV-2', asset: 'valve', attach: { pipe: 'PL-1', t: 0.5 } },
  ],
  pipes: [
    {
      id: 'PL-1',
      points: [
        [0, 1, 5],
        [5, 1, 5],
      ],
    },
  ],
});

describe('migrateScene v1 → v2 (pivot tâm đáy + elevation)', () => {
  test('position[1] → elevation; van đứng riêng hạ axisY (0.27); object gắn ống giữ nguyên; version + 1', () => {
    const m = migrateScene(legacy()) as ReturnType<typeof legacy> & { schemaVersion?: number };
    expect(m.schemaVersion).toBe(SCENE_SCHEMA_VERSION);
    expect(m.version).toBe(6);
    const by = Object.fromEntries(m.objects.map((o) => [o.id, o])) as Record<string, Record<string, unknown>>;
    expect(by['P-1']).toMatchObject({ position: [0, 0.3, 0], elevation: 0.3 });
    expect(by['XV-1']).toMatchObject({ position: [3, 0.83, 0], elevation: 0.83 });
    expect(by['T-1']!.elevation).toBeUndefined();
    expect(by['XV-2']).toEqual({ id: 'XV-2', asset: 'valve', attach: { pipe: 'PL-1', t: 0.5 } });
  });

  test('idempotent: chạy lại cho kết quả như nhau (không tăng version lần 2)', () => {
    const once = migrateScene(legacy());
    const twice = migrateScene(once);
    expect(twice).toBe(once);
    expect(migrateScene(structuredClone(once))).toEqual(once);
    expect(needsMigration(once)).toBe(false);
  });

  test('không sửa đối tượng đầu vào', () => {
    const raw = legacy();
    const snapshot = structuredClone(raw);
    migrateScene(raw);
    expect(raw).toEqual(snapshot);
  });

  test('đầu vào không phải cảnh → trả nguyên', () => {
    expect(migrateScene(null)).toBeNull();
    expect(migrateScene('x')).toBe('x');
    const noObjects = { id: 'a' };
    expect(migrateScene(noObjects)).toBe(noObjects);
  });
});
