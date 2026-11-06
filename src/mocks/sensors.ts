/**
 * Cảm biến theo khu vực ("Cảm biến trong khu vực" ở drawer cảnh báo gas). Khu lấy từ `AREAS` (một danh sách chung);
 * thứ tự = thứ tự hiển thị và vị trí lắp (cảm biến kề = mục liền trước, hoặc liền sau nếu là mục đầu).
 * Báo cháy (drawer FIR): đầu báo nhiệt (`HEAT_DETECTORS`), tín hiệu liên quan theo khu (`AREA_FIRE_SIGNALS`), thiết bị
 * trong khu (`AREA_EQUIPMENT`).
 * TODO(backend): danh mục thiết bị đo theo khu (GET /areas/:id/sensors).
 */
import { GAS_TAGS, VAPORIZER_AREA_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { Area } from '@/features/plant/areas';

export type AreaSensor = { tag: string; area: Area; kind: 'gas' };

export const AREA_SENSORS: readonly AreaSensor[] = [
  ...GAS_TAGS.map((tag): AreaSensor => ({ tag, area: 'Khu nạp xuất', kind: 'gas' })),
  { tag: VAPORIZER_AREA_TAGS.gas, area: 'Trạm hóa hơi', kind: 'gas' },
];

/** Cảm biến cùng loại trong khu. */
export const sensorsInArea = (area: string, kind: AreaSensor['kind'] = 'gas') => AREA_SENSORS.filter((s) => s.area === area && s.kind === kind);

/** Cảm biến kề (cho chữ hướng dẫn "Đối chiếu với {nearbySensor}…"): mục liền trước trong khu, mục đầu → mục liền sau. */
export function nearbySensor(tag: string): string | undefined {
  const s = AREA_SENSORS.find((x) => x.tag === tag);
  if (!s) return undefined;
  const list = sensorsInArea(s.area, s.kind);
  const i = list.findIndex((x) => x.tag === tag);
  return (list[i - 1] ?? list[i + 1])?.tag;
}

// ---- Báo cháy ----

/**
 * Đầu báo nhiệt – CẤU HÌNH TAG (không viết cứng trong UI). `alarmAt` = nhiệt độ báo động của đầu báo: 57 °C là mức đầu báo
 * nhiệt cố định phổ biến – GIẢ ĐỊNH, chờ khách xác nhận loại đầu báo (docs/questions.md).
 */
export type HeatDetector = {
  id: string;
  /** "Loại tín hiệu" ở drawer. */
  signalType: string;
  area: Area;
  tempTag: string;
  alarmTag: string;
  stateTag: string;
  alarmAt: number;
  unit: string;
};

export const HEAT_DETECTORS: Readonly<Record<string, HeatDetector>> = {
  'HD-02': {
    id: 'HD-02',
    signalType: 'Đầu báo nhiệt',
    area: 'Trạm hóa hơi',
    tempTag: VAPORIZER_AREA_TAGS.heatTemp,
    alarmTag: VAPORIZER_AREA_TAGS.heatAlarm,
    stateTag: VAPORIZER_AREA_TAGS.heatState,
    alarmAt: 57,
    unit: '°C',
  },
};

/** Tín hiệu liên quan của khu (xác nhận chéo): gas (% LEL, mức theo `GAS_BANDS`), đầu báo khói, nút nhấn khẩn cấp. */
export type FireSignal = { id: string; label: string; kind: 'gas' | 'smoke' | 'call-point'; tag: string };

export const AREA_FIRE_SIGNALS: Partial<Readonly<Record<Area, readonly FireSignal[]>>> = {
  'Trạm hóa hơi': [
    { id: 'GS-05', label: 'GS-05 (Gas Sensor)', kind: 'gas', tag: VAPORIZER_AREA_TAGS.gas },
    { id: 'SD-02', label: 'Đầu báo khói SD-02', kind: 'smoke', tag: VAPORIZER_AREA_TAGS.smokeAlarm },
    { id: 'MCP-02', label: 'Nút nhấn khẩn cấp', kind: 'call-point', tag: VAPORIZER_AREA_TAGS.callPoint },
  ],
};

/** Thiết bị trong khu ("Thiết bị liên quan"): trạng thái chạy + nhiệt độ MÁY (tag riêng, khác nhiệt độ đầu báo). */
export type AreaEquipment = { id: string; name: string; stateTag: string; tempTag?: string };

export const AREA_EQUIPMENT: Partial<Readonly<Record<Area, readonly AreaEquipment[]>>> = {
  'Trạm hóa hơi': [
    { id: 'E-101A', name: 'Máy hóa hơi E-101A', stateTag: VAPORIZER_AREA_TAGS.runA, tempTag: VAPORIZER_TAGS.temperature },
    { id: 'E-101B', name: 'Máy hóa hơi E-101B', stateTag: VAPORIZER_AREA_TAGS.runB },
  ],
};
