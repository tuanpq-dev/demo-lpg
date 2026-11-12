import { useCallback, useMemo, useState } from 'react';

const NONE: ReadonlyMap<string, never> = new Map<string, never>();

/**
 * Lựa chọn dòng của bảng PHÂN TRANG PHÍA MÁY CHỦ: giữ cả bản ghi (không chỉ id) để thao tác hàng loạt biết trạng thái của
 * dòng ở trang khác (bảng chỉ có dòng của trang đang xem). Bản ghi được làm mới khi trang hiện tại trả bản mới hơn
 * (sau thao tác ghi); đổi bộ lọc (`resetKey`) → bỏ chọn hết (kết quả đã khác).
 */
export function useRecordSelection<T>(rows: readonly T[], getId: (row: T) => string, resetKey: string) {
  const [state, setState] = useState<{ key: string; picked: ReadonlyMap<string, T> }>({ key: resetKey, picked: NONE });
  // Đổi bộ lọc → bỏ chọn ngay trong lần render này (không lộ lựa chọn cũ một khung hình).
  const stale = state.key !== resetKey;
  if (stale) setState({ key: resetKey, picked: NONE });
  const picked: ReadonlyMap<string, T> = stale ? NONE : state.picked;

  const byId = useMemo(() => new Map(rows.map((r) => [getId(r), r])), [rows, getId]);
  const fresh = useMemo(() => new Map([...picked].map(([id, r]) => [id, byId.get(id) ?? r])), [picked, byId]);

  const setSelected = useCallback(
    (ids: readonly string[]) =>
      setState((s) => {
        const next = new Map<string, T>();
        for (const id of ids) {
          const r = byId.get(id) ?? s.picked.get(id);
          if (r) next.set(id, r);
        }
        return { key: s.key, picked: next };
      }),
    [byId],
  );
  const clear = useCallback(() => setState((s) => ({ key: s.key, picked: NONE })), []);

  return { selected: useMemo(() => [...fresh.keys()], [fresh]), records: useMemo(() => [...fresh.values()], [fresh]), setSelected, clear };
}
