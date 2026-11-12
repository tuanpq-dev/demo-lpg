/*
 * Theo dõi sau xử lý cảnh báo: khoảng theo dõi khi lưu "Đã xử lý", nhãn hiển thị và trạng thái "Đến giờ kiểm tra lại".
 * Thuần; `savedAt` / `now` truyền vào.
 */
import type { AlertRecord } from './types';
import { plantTimeOfDay } from '@/lib/plantTime';
import { formatMeasure } from './gauge';

export type FollowUpChoice = number | 'custom';

/** Thời điểm kiểm tra lại = lúc lưu + số phút. */
export const followUpUntil = (savedAt: Date, minutes: number) => new Date(savedAt.getTime() + minutes * 60_000);

/** Khoảng theo dõi thực tế (0 phút → null). Tùy chỉnh: thời điểm phải sau lúc lưu (không thì null). */
export function followUpWindow(choice: FollowUpChoice, customAt: string | undefined, savedAt: Date): { minutes: number; until: Date } | null {
  if (choice === 'custom') {
    const t = customAt ? new Date(customAt) : null;
    if (!t || Number.isNaN(t.getTime()) || t.getTime() <= savedAt.getTime()) return null;
    return { minutes: Math.round((t.getTime() - savedAt.getTime()) / 60_000), until: t };
  }
  return choice > 0 ? { minutes: choice, until: followUpUntil(savedAt, choice) } : null;
}

export const followUpChoiceLabel = (c: FollowUpChoice) =>
  c === 'custom' ? 'Tùy chỉnh' : c === 0 ? 'Không cần theo dõi thêm' : c < 60 ? `Theo dõi thêm ${c} phút` : `Theo dõi thêm ${c / 60} giờ`;

/** Nhãn ngắn của thời gian theo dõi (select ở modal đóng): "30 phút", "2 Giờ", "Không theo dõi". */
export const followUpDurationLabel = (m: number) =>
  m === 0 ? 'Không theo dõi' : m < 60 ? `${m} phút` : m % 60 === 0 ? `${m / 60} Giờ` : `${Math.floor(m / 60)} Giờ ${m % 60} phút`;

/** "HH:MM" giờ nhà máy của một mốc ISO. */
export const hhmm = (iso: string) => plantTimeOfDay(new Date(iso)).slice(0, 5);

/** "Đang theo dõi đến HH:MM[, mục tiêu < 10 bar]" – Đã xử lý hoặc Hoàn thành có theo dõi và chưa hết giờ. */
export function followUpLabel(a: Pick<AlertRecord, 'status' | 'followUp'>, now: Date): string | null {
  const f = a.followUp;
  if ((a.status !== 'done' && a.status !== 'resolved') || !f || new Date(f.until).getTime() <= now.getTime()) return null;
  return `Đang theo dõi đến ${hhmm(f.until)}${f.target !== undefined ? `, mục tiêu < ${formatMeasure(f.target, f.unit)}` : ''}`;
}

/** Hết giờ theo dõi mà vẫn chờ đóng → chip "Đến giờ kiểm tra lại". */
export function followUpDue(a: Pick<AlertRecord, 'status' | 'followUp'>, now: Date): boolean {
  return a.status === 'resolved' && !!a.followUp && new Date(a.followUp.until).getTime() <= now.getTime();
}
export const FOLLOW_UP_DUE_LABEL = 'Đến giờ kiểm tra lại';
