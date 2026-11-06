import { describe, expect, test } from 'vitest';
import { readingText, tankLayerItems, type AssetLive } from './assetView';

const layers = {
  levelPct: 60,
  waterPct: 2,
  lpg: { percent: 57.5, volume: 23.04 },
  vapor: { percent: 40, volume: 16 },
  water: { percent: 2.5, volume: 0.456 },
} as unknown as AssetLive['layers'];

describe('tankLayerItems', () => {
  test('có số lớp: "% | m³" (thể tích < 1 → 2 chữ số), tone theo lớp + trạng thái', () => {
    const items = tankLayerItems({ layers, layersState: 'ok', storageStatus: 'normal', waterStatus: 'warning' });
    expect(items.map((i) => i.id)).toEqual(['lpg', 'vapor', 'water', 'status', 'water-alarm']);
    expect(items[0]).toMatchObject({ value: '57.5% | 23.0 m³', tone: 'info' });
    expect(items[2]).toMatchObject({ value: '2.5% | 0.46 m³', tone: 'warning' });
    expect(items[3]!.tone).toBe('success');
    expect(items[4]!.tone).toBe('warning');
  });
  test('mất tín hiệu → "Mất tín hiệu" ở 3 lớp + cảnh báo nước đáy, tone muted; chưa có số → "—"', () => {
    const lost = tankLayerItems({ layers: null, layersState: 'lost', storageStatus: 'offline', waterStatus: undefined });
    expect(lost.filter((i) => i.value === 'Mất tín hiệu').map((i) => i.id)).toEqual(expect.arrayContaining(['lpg', 'vapor', 'water', 'water-alarm']));
    expect(lost.every((i) => i.tone === 'muted')).toBe(true);
    const pending = tankLayerItems({ layers: null, layersState: 'pending', storageStatus: 'pending', waterStatus: undefined });
    expect(pending[0]!.value).toBe('—');
  });
});

describe('readingText', () => {
  test('ok → số + đơn vị; lost → "Mất tín hiệu"; còn lại → "—"', () => {
    expect(readingText({ state: 'ok', value: 9.25, status: 'normal' } as never, 1, ' bar')).toBe('9.3 bar');
    expect(readingText({ state: 'lost' } as never, 1, ' bar')).toBe('Mất tín hiệu');
    expect(readingText({ state: 'pending' } as never, 1, ' bar')).toBe('—');
  });
});
