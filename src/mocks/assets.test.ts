import { describe, expect, it } from 'vitest';
import { ASSET_TAGS, V101_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import { bindingTag, resolveBindings } from '@/features/scene/fields';
import { parseSceneConfig } from '@/features/scene/parse';
import { alertRecords } from './alerts';
import { assetMocks } from './assets';
import { liveBase } from './scenes/live';
import khuBon from './scenes/khu-bon-lpg.json';
import v101Scene from './scenes/v-101.json';

/*
 * Cảnh 3D là JSON nên không đọc được hằng TS – các test này bảo đảm JSON khớp nguồn duy nhất
 * (`features/live/tags.ts` cho tên tag, `mocks/assets.ts` cho kích thước/ngưỡng). Đổi một bên → test chỉ ra bên kia.
 */

const sceneV101 = parseSceneConfig(v101Scene, 'v-101');
const mapScene = parseSceneConfig(khuBon, 'khu-bon-lpg');
const tankIn = (c: typeof sceneV101) => c.objects.find((o) => o.id === 'V-101')!;
const asset = assetMocks['V-101']!;

describe('tag giả định gom một chỗ', () => {
  it('binding V-101 ở cả hai cảnh dùng đúng tag trong tags.ts', () => {
    for (const scene of [sceneV101, mapScene]) {
      const o = tankIn(scene);
      expect(bindingTag(o, 'level'), scene.id).toBe(V101_TAGS.level);
      expect(bindingTag(o, 'pressure'), scene.id).toBe(V101_TAGS.pressure);
      expect(bindingTag(o, 'temperature'), scene.id).toBe(V101_TAGS.temperature);
    }
    const vap = mapScene.objects.find((o) => o.id === 'E-101A')!;
    expect(bindingTag(vap, 'pressure')).toBe(VAPORIZER_TAGS.inletPressure);
    expect(bindingTag(vap, 'temperature')).toBe(VAPORIZER_TAGS.temperature);
  });
  it('mọi tag của tài sản có trong nguồn mock; cảnh báo hóa hơi dùng PT-201', () => {
    for (const t of Object.values(ASSET_TAGS['V-101'])) expect(liveBase, t).toHaveProperty([t]);
    const vapAlert = alertRecords.find((a) => a.message.startsWith('Áp suất đầu vào hóa hơi'))!;
    expect(vapAlert.device).toBe(VAPORIZER_TAGS.inletPressure);
  });
});

describe('thông số V-101 một nguồn', () => {
  it('kích thước cảnh chi tiết = mocks/assets.ts', () => {
    expect(tankIn(sceneV101).params).toEqual(asset.tank);
  });
  it('ngưỡng cảnh báo trong hai cảnh = mocks/assets.ts', () => {
    for (const scene of [sceneV101, mapScene]) {
      const th = Object.fromEntries(resolveBindings(tankIn(scene), scene.thresholds).map((b) => [b.field, b.thresholds]));
      expect(th.pressure, scene.id).toEqual(asset.alarms.pressure);
      expect(th.temperature, scene.id).toEqual(asset.alarms.temperature);
      expect(th.level, scene.id).toEqual(asset.alarms.level);
    }
  });
  it('ngưỡng nguy hiểm áp suất không vượt áp suất định mức thiết kế', () => {
    expect(asset.alarms.pressure.danger!).toBeLessThanOrEqual(asset.designPressure);
    expect(asset.alarms.pressure.warn!).toBeLessThan(asset.alarms.pressure.danger!);
  });
  it('cảnh Tổng quan: V-101 vẽ theo kích thước mặc định (lệch đã ghi CLAUDE.md mục 8)', () => {
    // Đổi kích thước V-101 ở Tổng quan sẽ dời cổng ống + bố cục ảnh Figma → giữ, test để nhớ chỗ lệch.
    expect(tankIn(mapScene).params).toBeUndefined();
  });
});
