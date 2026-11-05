import { toastError } from './toast';

/**
 * Lỗi khi thao tác ghi (xác nhận, lưu, phân công…) thất bại – hôm nay mock không lỗi, khi nối API thì `ApiError`
 * (có `message` tiếng Việt từ client / backend) hoặc lỗi bất kỳ.
 */
export function actionErrorText(e: unknown): string {
  const detail = (e instanceof Error ? e.message : typeof e === 'string' ? e : '').trim();
  return detail ? `Không thực hiện được thao tác: ${detail}` : 'Không thực hiện được thao tác. Vui lòng thử lại.';
}

/**
 * Chạy thao tác async từ handler không chờ kết quả (onClick, callback): lỗi KHÔNG lọt thành unhandled rejection mà
 * đi vào `onError` (mặc định: toast lỗi – nhìn thấy + đọc qua `announce`). `task` chạy NGAY (đồng bộ, như gọi trực tiếp); trả về promise
 * luôn resolve (true = thành công) để test / nơi gọi có thể chờ nếu cần.
 */
export function runAction(task: () => Promise<unknown> | unknown, onError: (text: string, error: unknown) => void = toastError): Promise<boolean> {
  const fail = (e: unknown) => {
    if (import.meta.env.DEV) console.error(e);
    onError(actionErrorText(e), e);
    return false;
  };
  try {
    return Promise.resolve(task()).then(() => true, fail);
  } catch (e) {
    return Promise.resolve(fail(e));
  }
}
