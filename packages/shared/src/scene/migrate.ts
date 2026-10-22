import { ASSET_SPECS } from './specs.js';
import { SCENE_SCHEMA_VERSION, type AssetType } from './types.js';

/*
 * Chuyển dữ liệu cảnh cũ lên định dạng hiện tại (SCENE_SCHEMA_VERSION). Thuần (không zod/three) – chạy trước
 * validate ở mọi đường nạp: mock/API (parse), kho localStorage (parse), Import JSON, bản nháp Editor.
 * Giữ nguyên hình ảnh: object nằm đúng chỗ như trước khi migrate.
 */

type RawObject = { asset?: unknown; position?: unknown; attach?: unknown; elevation?: unknown; [k: string]: unknown };
type RawScene = { version?: unknown; schemaVersion?: unknown; objects?: unknown; [k: string]: unknown };

const round = (v: number) => +v.toFixed(3) || 0;
const isVec3 = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number');

/** v1 → v2: position[1] → elevation (độ cao đáy); van/đồng hồ đứng riêng hạ xuống `inline.axisY` vì gốc dời từ tâm ống xuống đáy. */
function v1ToV2(o: RawObject): RawObject {
  if (o.attach || !isVec3(o.position) || o.elevation !== undefined) return o;
  const spec = ASSET_SPECS[o.asset as AssetType] as (typeof ASSET_SPECS)[AssetType] | undefined;
  const elevation = round(o.position[1] - (spec?.inline?.axisY ?? 0));
  const out: RawObject = { ...o, position: [o.position[0], elevation, o.position[2]] };
  if (elevation !== 0) out.elevation = elevation;
  return out;
}

/** Cần migrate? (thiếu schemaVersion hoặc cũ hơn hiện tại). */
export function needsMigration(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const v = (raw as RawScene).schemaVersion;
  return typeof v !== 'number' || v < SCENE_SCHEMA_VERSION;
}

/**
 * Trả về bản đã migrate (đối tượng mới) hoặc chính `raw` nếu không cần/không phải cảnh. Đã migrate → version + 1.
 * Không validate – dữ liệu sai cấu trúc vẫn để zod báo lỗi.
 */
export function migrateScene<T>(raw: T): T {
  if (!needsMigration(raw)) return raw;
  const s = raw as RawScene;
  if (!Array.isArray(s.objects)) return raw;
  return {
    ...s,
    version: typeof s.version === 'number' ? s.version + 1 : s.version,
    schemaVersion: SCENE_SCHEMA_VERSION,
    objects: s.objects.map((o) => (o && typeof o === 'object' ? v1ToV2(o as RawObject) : o)),
  } as T;
}
