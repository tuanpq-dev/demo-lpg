/** Ngày tương đối cho dữ liệu mẫu bảo trì (theo giờ nhà máy, mốc `appNow`). */
import { appNow } from '@/lib/demoNow';
import { pad2 } from '@/lib/number';
import { plantDayKey } from '@/lib/plantTime';

/** Ngày (local) cách hôm nay `offset` ngày → "yyyy-mm-dd". */
/** "yyyy-mm-dd" cách hôm nay (giờ nhà máy – khớp cách tính quá hạn) `offset` ngày. */
export function isoDay(offset = 0, base = appNow()) {
  const [y, m, d] = plantDayKey(base).split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + offset));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}
/** Không có `dueTime` → hạn chỉ có ngày (`dueHasTime: false`, lưu "T23:59", quá hạn sau 23:59:59). */
export const at = (offset: number, time = '23:59') => `${isoDay(offset)}T${time}`;
