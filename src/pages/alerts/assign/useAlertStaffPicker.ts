import { useMemo, useState } from 'react';
import type { StaffPickerItem } from '@/components';
import { ALERT_STAFF, alertKind } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { useAlertLoads } from '@/data/alertApi';
import { ALERT_LOAD_HINT, MATCH_LABEL, alertLoadLabel, rankAlertStaff } from '@/features/alerts/assignStaff';
import type { ShiftId } from '@/features/maintenance/types';
import { shiftShortLabel } from '@/features/staff/availability';
import type { StaffSkill } from '@/features/staff/skills';

/**
 * Danh sách nhân sự của modal phân công cảnh báo: xếp hạng theo khu vực / chuyên môn / tải việc (`rankAlertStaff`) + bộ lọc
 * (tên, phòng ban, ca, chỉ người đang trong ca).
 */
export function useAlertStaffPicker(alerts: readonly AlertRecord[], now: Date) {
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<string | null>(null);
  const [shift, setShift] = useState<ShiftId | null>(null);
  const [onShiftOnly, setOnShiftOnly] = useState(false);

  // Tải việc từng người: máy chủ đếm (GET /staff/alert-loads) – không duyệt toàn bộ cảnh báo ở client.
  const loads = useAlertLoads();
  const context = useMemo(
    () => ({
      areas: [...new Set(alerts.map((a) => a.area))],
      skills: [...new Set(alerts.flatMap((a) => alertKind(a).skills ?? []))] as StaffSkill[],
    }),
    [alerts],
  );
  const ranked = useMemo(() => rankAlertStaff(ALERT_STAFF, context, loads, now), [context, loads, now]);

  const q = query.trim().toLowerCase();
  const items: StaffPickerItem[] = ranked
    .filter(
      ({ staff: p, onShift }) =>
        (!dept || p.department === dept) &&
        (!shift || p.defaultShift === shift) &&
        (!onShiftOnly || onShift) &&
        (!q || [p.name, p.title, p.specialty, p.department].some((t) => t.toLowerCase().includes(q))),
    )
    .map(({ staff: p, load, onShift, availability, match }) => ({
      id: p.name,
      name: p.name,
      subtitle: `${p.title} • ${p.specialty}`,
      shiftLabel: shiftShortLabel(p.defaultShift),
      shiftMatch: onShift,
      busy: load.busy,
      active: load.active,
      overdue: load.critical,
      loadLabel: alertLoadLabel(load),
      workloadHint: ALERT_LOAD_HINT,
      availability,
      suggestion: match.length ? match.map((m) => MATCH_LABEL[m]).join(' · ') : undefined,
    }));

  const clearFilters = () => {
    setQuery('');
    setDept(null);
    setShift(null);
    setOnShiftOnly(false);
  };

  return { items, loads, query, setQuery, dept, setDept, shift, setShift, onShiftOnly, setOnShiftOnly, clearFilters };
}

export type AlertStaffPicker = ReturnType<typeof useAlertStaffPicker>;
