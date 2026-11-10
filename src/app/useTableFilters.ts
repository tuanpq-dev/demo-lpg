import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Khai báo một tham số lọc trên URL. `values` = tập giá trị hợp lệ; `default` = giá trị khi không có trên URL. */
export type ParamDef = { readonly values?: readonly string[]; readonly default?: string };
export type ParamSpec = Readonly<Record<string, ParamDef>>;

type ValueOf<D> = D extends { values: readonly (infer V extends string)[] } ? V : string;
/** Có `default` → luôn có giá trị; không có → có thể null. */
export type ParamValues<S extends ParamSpec> = {
  [K in keyof S]: S[K] extends { default: string } ? ValueOf<S[K]> : ValueOf<S[K]> | null;
};

export type UseTableFiltersOptions<Row, S extends ParamSpec> = {
  /** Toàn bộ dữ liệu (chưa lọc). */
  rows: readonly Row[];
  getId: (row: Row) => string;
  /** Khai báo tham số (nên dùng `as const`). */
  params: S;
  /** Hàm khớp một dòng với bộ lọc hiện tại. */
  match: (row: Row, values: ParamValues<S>) => boolean;
  /** Sắp xếp kết quả (có thể phụ thuộc bộ lọc, ví dụ `sort=due`). */
  sort?: (a: Row, b: Row, values: ParamValues<S>) => number;
  pageSize: number;
  /** Tham số dùng làm Tabs – để tính số đếm từng tab (đếm theo các bộ lọc còn lại). */
  tabKey?: keyof S & string;
  /** Tên tham số URL lưu bản ghi đang mở (drawer). Mặc định "open". */
  openKey?: string;
};

/**
 * Trạng thái bảng có lọc, đồng bộ với URL query (F5/chia sẻ link không mất):
 * bộ lọc theo `params` + `page` + bản ghi đang mở; lựa chọn dòng giữ trong bộ nhớ.
 *
 * - Giá trị mặc định không ghi lên URL; giá trị ngoài `values` bị bỏ qua.
 * - Đổi bộ lọc → về trang 1. Ghi URL bằng `replace` (không làm đầy history).
 * - Lựa chọn tự bỏ các dòng không còn trong kết quả lọc.
 */
export function useTableFilters<Row, S extends ParamSpec>({
  rows,
  getId,
  params: spec,
  match,
  sort,
  pageSize,
  tabKey,
  openKey = 'open',
}: UseTableFiltersOptions<Row, S>) {
  const [search, setSearch] = useSearchParams();

  const values = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const [key, def] of Object.entries(spec)) {
      const raw = search.get(key);
      const valid = raw !== null && (!def.values || def.values.includes(raw));
      out[key] = valid ? raw : (def.default ?? null);
    }
    return out as ParamValues<S>;
  }, [search, spec]);

  const write = useCallback(
    (patch: Record<string, string | number | null | undefined>) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            const def = spec[k]?.default;
            if (v === null || v === undefined || v === '' || v === def || (k === 'page' && v === 1)) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      ),
    [setSearch, spec],
  );

  /** Đổi một/nhiều bộ lọc → về trang 1. */
  const setValues = useCallback((patch: Partial<ParamValues<S>>) => write({ ...(patch as Record<string, string | null>), page: 1 }), [write]);

  /** Về mặc định cho các khoá (mặc định: tất cả trừ `keep`). */
  const reset = useCallback(
    (keep: readonly (keyof S)[] = []) => {
      const patch: Record<string, null> = {};
      Object.keys(spec).forEach((k) => {
        if (!keep.includes(k)) patch[k] = null;
      });
      write({ ...patch, page: 1 });
    },
    [spec, write],
  );

  /** Có bộ lọc nào khác mặc định không (bỏ qua `ignore`). */
  const isFiltered = (ignore: readonly (keyof S)[] = []) =>
    Object.entries(spec).some(([k, def]) => !ignore.includes(k) && (values as Record<string, unknown>)[k] !== (def.default ?? null));

  // ---- Kết quả lọc + phân trang
  const filtered = useMemo(() => {
    const out = rows.filter((r) => match(r, values));
    return sort ? out.sort((a, b) => sort(a, b, values)) : out;
  }, [rows, values, match, sort]);

  const tabCounts = useMemo(() => {
    if (!tabKey) return {} as Record<string, number>;
    const tabs = spec[tabKey]?.values ?? [];
    return Object.fromEntries(tabs.map((t) => [t, rows.filter((r) => match(r, { ...values, [tabKey]: t })).length])) as Record<
      ValueOf<S[typeof tabKey]>,
      number
    >;
  }, [rows, values, match, spec, tabKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Number(search.get('page')) || 1), pageCount);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const setPage = useCallback((p: number) => write({ page: p }), [write]);

  // ---- Bản ghi đang mở
  const openId = search.get(openKey);
  const setOpenId = useCallback((id: string | null) => write({ [openKey]: id }), [write, openKey]);

  /** Ghi tham số URL tuỳ ý (ngoài `params`), ví dụ `create=1&device=V-101`. */
  const setExtra = write;

  // ---- Lựa chọn
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    const visible = new Set(filtered.map(getId));
    setSelected((cur) => (cur.every((id) => visible.has(id)) ? cur : cur.filter((id) => visible.has(id))));
  }, [filtered, getId]);
  const clearSelection = useCallback(() => setSelected([]), []);

  return {
    values,
    setValues,
    reset,
    isFiltered,
    filtered,
    pageRows,
    page,
    pageCount,
    pageSize,
    setPage,
    tabCounts,
    openId,
    setOpenId,
    setExtra,
    search,
    selected,
    setSelected,
    clearSelection,
  };
}
