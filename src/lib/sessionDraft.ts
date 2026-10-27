/**
 * Nháp form theo mã bản ghi trong sessionStorage – mọi truy cập bọc try/catch (chế độ riêng tư / bộ nhớ đầy / bị chặn).
 * `parse` nhận giá trị đã `JSON.parse` và trả nháp hợp lệ hoặc null (sai dạng → coi như không có nháp).
 * Dùng chung cho nháp phân công bảo trì (`demo-lpg:mt-assign-draft:`) và phân công cảnh báo (`demo-lpg:alert-assign-draft:`).
 */
export type SessionDraft<T> = {
  key: (id: string) => string;
  /** false = không lưu được (UI báo lỗi). */
  save: (id: string, draft: T) => boolean;
  load: (id: string) => T | null;
  clear: (id: string) => void;
};

export function createSessionDraft<T>(prefix: string, parse: (raw: unknown) => T | null): SessionDraft<T> {
  const key = (id: string) => `${prefix}${id}`;
  return {
    key,
    save(id, draft) {
      try {
        sessionStorage.setItem(key(id), JSON.stringify(draft));
        return true;
      } catch {
        return false;
      }
    },
    load(id) {
      try {
        const raw = sessionStorage.getItem(key(id));
        return raw ? parse(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    clear(id) {
      try {
        sessionStorage.removeItem(key(id));
      } catch {
        /* ignore */
      }
    },
  };
}
