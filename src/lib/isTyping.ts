/** Đích sự kiện phím là ô nhập (input/textarea/select/contenteditable) → không bắt phím tắt. */
export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
