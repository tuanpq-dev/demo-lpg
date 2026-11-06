/*
 * Nhân sự trong modal "Phân công xử lý cảnh báo" – thuần, `now` truyền vào:
 * tải việc TÍNH TỪ danh sách cảnh báo, Sẵn sàng / Bận / Ngoài ca (Ngoài ca thắng Bận), sắp xếp gợi ý, cảnh báo không chặn.
 * Import danh mục ca (mocks) → chỉ dùng trong chunk modal, không import từ `data/alerts` (bundle chính).
 */
import { AVAILABILITY_ORDER, BUSY_THRESHOLD, isOnShift, shiftLabel, staffAvailability, type Availability } from '@/features/staff/availability';
import type { AlertRecord } from '@/features/alerts/types';
import type { StaffMember } from '@/features/staff/org';
import type { StaffSkill } from '@/features/staff/skills';
import type { AlertAssignForm } from './assign';

/** Giải thích cách đếm – tooltip + đọc kèm chip tải việc. */
export const ALERT_LOAD_HINT = `Số cảnh báo người này là người phụ trách chính: đã giao nhưng chưa xác nhận + đang xử lý (không tính người phối hợp, không tính đã hoàn thành). Bận khi từ ${BUSY_THRESHOLD} cảnh báo.`;

export type AlertLoad = {
  /** Chưa xác nhận (đã giao) + Đang xử lý. */
  active: number;
  /** Trong số đó, mức Nghiêm trọng. */
  critical: number;
  busy: boolean;
  /** Mã các cảnh báo nghiêm trọng đang phụ trách (cảnh báo "đang có cảnh báo nghiêm trọng khác"). */
  criticalAlerts: readonly { id: string; code: string }[];
};

const EMPTY: AlertLoad = { active: 0, critical: 0, busy: false, criticalAlerts: [] };

/** Tải việc theo người phụ trách chính (Map theo tên). */
export function computeAlertLoads(alerts: readonly AlertRecord[]): Map<string, AlertLoad> {
  const map = new Map<string, { active: number; critical: number; busy: boolean; criticalAlerts: { id: string; code: string }[] }>();
  for (const a of alerts) {
    if (!a.assignee || a.status === 'done') continue;
    const cur = map.get(a.assignee) ?? { active: 0, critical: 0, busy: false, criticalAlerts: [] };
    cur.active += 1;
    if (a.severity === 'critical') {
      cur.critical += 1;
      cur.criticalAlerts.push({ id: a.id, code: a.code });
    }
    cur.busy = cur.active >= BUSY_THRESHOLD;
    map.set(a.assignee, cur);
  }
  return map;
}

export const alertLoadOf = (map: ReadonlyMap<string, AlertLoad>, name: string | null | undefined): AlertLoad => (name && map.get(name)) || EMPTY;

/** "1 cảnh báo đang xử lý" · "3 cảnh báo đang xử lý (1 nghiêm trọng)". */
export const alertLoadLabel = (l: AlertLoad) => `${l.active} cảnh báo đang xử lý${l.critical ? ` (${l.critical} nghiêm trọng)` : ''}`;

/** Khu + chuyên môn của các cảnh báo đang phân công – tiêu chí gợi ý. */
export type AssignContext = { areas: readonly string[]; skills: readonly StaffSkill[] };

export type AlertStaffOption = {
  staff: StaffMember;
  load: AlertLoad;
  onShift: boolean;
  availability: Availability;
  /** Lý do gợi ý ("cùng khu", "đúng chuyên môn") – rỗng = không gợi ý. */
  match: readonly ('area' | 'skill')[];
};

/**
 * Danh sách nhân sự đã sắp xếp: người cùng khu hoặc đúng chuyên môn trước, rồi Sẵn sàng → Bận → Ngoài ca, rồi theo tên.
 * Ngoài ca thắng Bận (`staffAvailability`).
 */
export function rankAlertStaff(staff: readonly StaffMember[], ctx: AssignContext, loads: ReadonlyMap<string, AlertLoad>, now: Date): AlertStaffOption[] {
  return staff
    .map((s) => {
      const load = alertLoadOf(loads, s.name);
      const onShift = isOnShift(s.defaultShift, now);
      const match: ('area' | 'skill')[] = [];
      if (s.areas.some((a) => ctx.areas.includes(a))) match.push('area');
      if (s.skills.some((k) => ctx.skills.includes(k))) match.push('skill');
      return { staff: s, load, onShift, availability: staffAvailability({ busy: load.busy, onShift }), match };
    })
    .sort(
      (a, b) =>
        Number(b.match.length > 0) - Number(a.match.length > 0) ||
        AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability] ||
        a.staff.name.localeCompare(b.staff.name, 'vi'),
    );
}

export const MATCH_LABEL = { area: 'Cùng khu', skill: 'Đúng chuyên môn' } as const;

export type AlertAssignWarning = { id: 'off-shift' | 'busy' | 'critical-other'; label: string };

/**
 * Cảnh báo KHÔNG chặn cho người được chọn: Ngoài ca · Bận · đang phụ trách cảnh báo Nghiêm trọng KHÁC (bỏ các cảnh báo
 * đang phân công – `alertIds`). `staff` thiếu (tên không có trong danh mục) → không xét ca.
 */
export function alertAssignWarnings(
  f: Pick<AlertAssignForm, 'assignee'>,
  opts: { staff: StaffMember | undefined; loads: ReadonlyMap<string, AlertLoad>; now: Date; alertIds: readonly string[] },
): AlertAssignWarning[] {
  const name = f.assignee?.trim();
  if (!name) return [];
  const out: AlertAssignWarning[] = [];
  const load = alertLoadOf(opts.loads, name);
  if (opts.staff && !isOnShift(opts.staff.defaultShift, opts.now)) {
    out.push({ id: 'off-shift', label: `${name} đang Ngoài ca (${shiftLabel(opts.staff.defaultShift).replace(' (', ', ').replace(/\)$/, '')}) – có thể chưa xử lý ngay được` });
  }
  if (load.busy) out.push({ id: 'busy', label: `${name} đang Bận (${alertLoadLabel(load)})` });
  const others = load.criticalAlerts.filter((c) => !opts.alertIds.includes(c.id));
  if (others.length) out.push({ id: 'critical-other', label: `${name} đang phụ trách cảnh báo nghiêm trọng khác: ${others.map((c) => c.code).join(', ')}` });
  return out;
}
