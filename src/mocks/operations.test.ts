import { describe, expect, it } from 'vitest';
import { VAPORIZER_TAGS } from '@/features/live/tags';
import { resolveBindings } from '@/features/scene/fields';
import { parseSceneConfig } from '@/features/scene/parse';
import { alertRecords } from './alerts';
import { AREAS } from './areas';
import { operationDevices } from './operations';
import { liveBase } from './scenes/live';
import khuBon from './scenes/khu-bon-lpg.json';

/* Cấu hình màn Vận hành phải khớp nguồn chung: tag (tags.ts + mock live), ngưỡng (cảnh 3D, cảnh báo), khu vực (AREAS). */

const d = operationDevices['E-101A']!;
const scene = parseSceneConfig(khuBon, 'khu-bon-lpg');
const bindingOf = (objId: string, field: string) => resolveBindings(scene.objects.find((o) => o.id === objId)!).find((b) => b.field === field)!;
const param = (id: string) => d.params.find((p) => p.id === id)!;

describe('E-101A – một nguồn', () => {
  it('mọi tag tham số / PLC / trạng thái có trong nguồn số liệu giả lập', () => {
    for (const t of [...d.params.map((p) => p.tag), ...d.plcSignals.map((s) => s.tag), d.stateTag, d.standby.stateTag]) expect(liveBase, t).toHaveProperty([t]);
  });
  it('tag lấy từ VAPORIZER_TAGS', () => {
    expect(param('outletTemperature').tag).toBe(VAPORIZER_TAGS.temperature);
    expect(param('inletPressure').tag).toBe(VAPORIZER_TAGS.inletPressure);
    expect(param('outletPressure').tag).toBe(VAPORIZER_TAGS.outletPressure);
  });
  it('ngưỡng áp suất = binding trong cảnh 3D (PT-201 ở E-101A, PT-202 ở C-101)', () => {
    const inlet = bindingOf('E-101A', 'pressure');
    expect(inlet.tag).toBe(param('inletPressure').tag);
    expect(param('inletPressure').limits).toMatchObject(inlet.thresholds);
    const outlet = bindingOf('C-101', 'pressure');
    expect(outlet.tag).toBe(param('outletPressure').tag);
    expect(param('outletPressure').limits).toMatchObject(outlet.thresholds);
  });
  it('biên dưới nhiệt độ ra = ngưỡng cảnh báo "Nhiệt độ máy hóa hơi thấp" của E-101A', () => {
    const a = alertRecords.find((x) => x.device === 'E-101A' && x.message.includes('Nhiệt độ'))!;
    expect(param('outletTemperature').limits.lowWarn).toBe(Number(a.threshold));
  });
  it('khu vực thuộc danh sách chung; biểu đồ trỏ tham số có thật', () => {
    expect(AREAS).toContain(d.area);
    expect(param(d.trend.temperature.param)).toBeDefined();
    expect(param(d.trend.pressure.param)).toBeDefined();
  });
});
