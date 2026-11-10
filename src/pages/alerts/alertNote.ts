/** Nháp ghi chú của drawer cảnh báo (dùng chung phần Ghi chú và chân drawer). */

/** Nháp ô "Ghi chú xử lý" – dùng chung giữa thân (ô nhập) và chân (nút "Đánh dấu đã xử lý" lấy luôn nội dung ô). */
export type NoteDraft = { text: string; error?: string; set: (text: string) => void; fail: (error: string) => void; clear: () => void };

export const NOTE_FIELD_ID = (alertId: string) => `alert-note-${alertId}`;
