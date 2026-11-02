/** Bỏ dấu tiếng Việt + chữ thường (tìm không dấu): "Bơm Đầu" → "bom dau". */
export const foldSearch = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
