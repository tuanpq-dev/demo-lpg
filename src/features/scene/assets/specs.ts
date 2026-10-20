import type { AssetType, SceneObject, Vec3 } from '../types';

/**
 * Đặc tả asset THUẦN (không three/React): tham số, category, cổng/hộp bao tính theo tham số.
 * Dùng chung cho validate (parse – chunk lazy), Viewer (registry) và Editor sau này.
 */

/**
 * - equipment:   thiết bị – hover/click, có bindings, có trạng thái.
 * - environment: bối cảnh (nhà, mái che, hàng rào) – không hover/click, không bindings.
 */
export type AssetCategory = 'equipment' | 'environment';

export type ParamDef = {
  label: string;
  default: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Chỉ nhận số nguyên (số tầng, số nhịp…). */
  integer?: boolean;
};

export type AssetParams = Record<string, number>;
export type Box = { min: Vec3; max: Vec3 };

export type AssetLayout = {
  /** Cổng nối ống (toạ độ cục bộ) – `Pipe.from/to` = "objectId.port". */
  ports: Record<string, Vec3>;
  /** Hộp bao cục bộ – viền hover/trạng thái, bay camera. */
  bounds: Box;
  /** Điểm neo nhãn (cục bộ); mặc định giữa đỉnh hộp bao. */
  labelAnchor?: Vec3;
};

export type AssetSpec = {
  /** Tên loại (tiếng Việt) cho tooltip/Editor. */
  label: string;
  category: AssetCategory;
  paramsSchema: Record<string, ParamDef>;
  /** Các trường dữ liệu có thể gắn tag trong `bindings`. */
  dataFields: string[];
  layout: (p: AssetParams, obj: Pick<SceneObject, 'path'>) => AssetLayout;
};

const box = (min: Vec3, max: Vec3): Box => ({ min, max });

// Hằng hình học dùng chung giữa spec và component.
export const TANK_SADDLE_H = 0.8;
export const CANOPY_RISE = 1.3;
export const VAPORIZER_PLATE_SPAN = 2.9;

/** Sàn thao tác trên đỉnh bồn nằm ngang (cạnh cửa người chui) – chung cho component và hộp bao. */
export function tankHorizontalPlatform(L: number, R: number) {
  const top = R + TANK_SADDLE_H + R;
  return { x: -L * 0.27, w: 2.8, z0: -0.9, z1: R + 0.35, y: top + 0.1 };
}

export const ASSET_SPECS: Record<AssetType, AssetSpec> = {
  'tank-horizontal': {
    label: 'Bồn chứa nằm ngang',
    category: 'equipment',
    paramsSchema: {
      length: { label: 'Chiều dài thân', default: 11, min: 4, max: 30, unit: 'm' },
      diameter: { label: 'Đường kính', default: 4.4, min: 1.5, max: 8, unit: 'm' },
    },
    dataFields: ['level', 'pressure', 'temperature'],
    layout: ({ length: L, diameter: D }) => {
      const R = D! / 2;
      const cy = R + TANK_SADDLE_H;
      const tip = L! / 2 + R * 0.5;
      const deck = tankHorizontalPlatform(L!, R);
      return {
        ports: { out: [tip + 0.5, cy, 0] },
        // Gồm sàn thao tác + lan can trên đỉnh và lồng thang phía +Z.
        bounds: box([-tip, 0, -R], [tip + 0.5, deck.y + 1.1, deck.z1 + 0.8]),
        // Chấm nhãn đặt trên cửa người chui (như Figma).
        labelAnchor: [deck.x, deck.y + 0.5, 0],
      };
    },
  },
  'tank-vertical': {
    label: 'Tháp / bồn đứng',
    category: 'equipment',
    paramsSchema: {
      height: { label: 'Chiều cao thân', default: 8, min: 2, max: 30, unit: 'm' },
      diameter: { label: 'Đường kính', default: 2, min: 0.8, max: 8, unit: 'm' },
    },
    dataFields: ['pressure', 'temperature', 'level'],
    layout: ({ height: h, diameter: D }) => {
      const r = D! / 2;
      const top = 1 + h! + r * 0.5;
      // Sàn vành khăn r + 0.6 + lan can 1.05 m trên đỉnh thân; lồng thang phía +X.
      const ext = r + 0.65;
      return {
        ports: { in: [-r - 0.3, 1.2, 0], out: [0, 1.2, -r - 0.3], top: [0, top + 0.45, 0] },
        bounds: box([-ext, 0, -ext], [r + 1.2, Math.max(top + 0.5, 1 + h! + 1.1), ext]),
      };
    },
  },
  pump: {
    label: 'Bơm',
    category: 'equipment',
    paramsSchema: {},
    dataFields: ['state', 'pressure', 'flow'],
    layout: () => ({
      ports: { suction: [-1.25, 0.8, 0], discharge: [-0.55, 1.78, 0] },
      bounds: box([-1.4, 0, -0.65], [1.6, 1.8, 0.65]),
    }),
  },
  valve: {
    label: 'Van',
    category: 'equipment',
    paramsSchema: {},
    dataFields: ['state', 'position'],
    layout: () => ({ ports: { a: [-0.34, 0, 0], b: [0.34, 0, 0] }, bounds: box([-0.35, -0.25, -0.25], [0.35, 0.75, 0.25]) }),
  },
  filter: {
    label: 'Bình lọc',
    category: 'equipment',
    paramsSchema: {},
    dataFields: ['pressure'],
    layout: () => ({
      ports: { in: [-0.875, 1.9, 0], out: [0.875, 0.9, 0] },
      bounds: box([-0.9, 0, -0.65], [0.9, 2.7, 0.65]),
    }),
  },
  'flow-meter': {
    label: 'Đồng hồ lưu lượng',
    category: 'equipment',
    paramsSchema: {},
    dataFields: ['flow'],
    layout: () => ({ ports: { a: [-0.45, 0, 0], b: [0.45, 0, 0] }, bounds: box([-0.45, -0.36, -0.36], [0.45, 0.9, 0.36]) }),
  },
  vaporizer: {
    label: 'Hóa hơi & điều áp',
    category: 'equipment',
    paramsSchema: { plates: { label: 'Số tấm trao đổi nhiệt', default: 18, min: 4, max: 40, integer: true } },
    dataFields: ['temperature', 'pressure', 'flow'],
    layout: () => ({
      ports: { in: [-4.3, 1.2, 1.5], out: [4.5, 1.2, -1.5] },
      bounds: box([-4.5, 0, -2.75], [4.5, 2.9, 2.75]),
    }),
  },
  'tanker-truck': {
    label: 'Xe bồn',
    category: 'equipment',
    paramsSchema: {},
    dataFields: ['state', 'level'],
    layout: () => ({
      ports: { outlet: [7.4, 1.1, 0] },
      bounds: box([-7.5, 0, -1.6], [7.4, 4.8, 1.6]),
      labelAnchor: [5.6, 4.6, 0],
    }),
  },
  'loading-station': {
    label: 'Trạm nạp',
    category: 'equipment',
    paramsSchema: {},
    dataFields: ['state', 'flow'],
    layout: () => ({ ports: {}, bounds: box([-2.6, 0, -0.6], [0.8, 2.9, 0.7]) }),
  },
  building: {
    label: 'Nhà xưởng',
    category: 'environment',
    paramsSchema: {
      width: { label: 'Chiều rộng', default: 18, min: 6, max: 60, unit: 'm' },
      depth: { label: 'Chiều sâu', default: 10, min: 4, max: 40, unit: 'm' },
      height: { label: 'Chiều cao', default: 7, min: 3, max: 30, unit: 'm' },
      floors: { label: 'Số tầng', default: 2, min: 1, max: 8, integer: true },
    },
    dataFields: [],
    layout: ({ width: W, depth: D, height: H }) => ({
      ports: {},
      bounds: box([-W! / 2 - 0.3, 0, -D! / 2 - 0.3], [W! / 2 + 0.3, H! + 5, D! / 2 + 0.3]),
      // Tag "Khu sản xuất" ở mép mái trước bên trái như Figma.
      labelAnchor: [-W! * 0.22, H! + 0.8, D! / 2],
    }),
  },
  canopy: {
    label: 'Mái che',
    category: 'environment',
    paramsSchema: {
      length: { label: 'Chiều dài', default: 16, min: 4, max: 40, unit: 'm' },
      depth: { label: 'Chiều sâu', default: 8, min: 3, max: 20, unit: 'm' },
      height: { label: 'Cao tới mép mái', default: 7, min: 3, max: 15, unit: 'm' },
      bays: { label: 'Số nhịp cột', default: 2, min: 1, max: 8, integer: true },
    },
    dataFields: [],
    layout: ({ length: L, depth: D, height: H }) => ({
      ports: {},
      bounds: box([-L! / 2 - 0.4, 0, -D! / 2 - 0.3], [L! / 2 + 0.4, H! + CANOPY_RISE + 0.1, D! / 2 + 0.3]),
    }),
  },
  fence: {
    label: 'Hàng rào',
    category: 'environment',
    paramsSchema: {
      height: { label: 'Chiều cao', default: 1.3, min: 0.5, max: 4, unit: 'm' },
      postSpacing: { label: 'Khoảng cách cọc', default: 1.6, min: 0.5, max: 5, unit: 'm' },
    },
    dataFields: [],
    layout: ({ height: h }, { path }) => {
      const pts = path?.length ? path : [[0, 0, 0] as Vec3];
      const xs = pts.map((p) => p[0]);
      const zs = pts.map((p) => p[2]);
      return { ports: {}, bounds: box([Math.min(...xs), 0, Math.min(...zs)], [Math.max(...xs), h!, Math.max(...zs)]) };
    },
  },
};

/** Tham số đầy đủ = mặc định của schema ghi đè bởi `obj.params`. */
export function resolveParams(obj: Pick<SceneObject, 'asset' | 'params'>): AssetParams {
  const schema = ASSET_SPECS[obj.asset].paramsSchema;
  const out: AssetParams = {};
  for (const [k, def] of Object.entries(schema)) out[k] = obj.params?.[k] ?? def.default;
  return out;
}

export function assetLayout(obj: Pick<SceneObject, 'asset' | 'params' | 'path'>): AssetLayout {
  return ASSET_SPECS[obj.asset].layout(resolveParams(obj), obj);
}
