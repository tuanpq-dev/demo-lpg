/**
 * Hợp đồng dữ liệu trực tiếp (live) – dùng chung FE/BE. Độc lập nguồn: mock hôm nay, WebSocket/SCADA (OPC UA, MQTT…) sau này.
 * FE chỉ `import type` từ file này (schema zod không được kéo vào bundle chính).
 */
import { z } from 'zod';

/** Chất lượng tín hiệu theo chuẩn OPC (Good / Uncertain / Bad). */
export type TagQuality = 'good' | 'uncertain' | 'bad';

/** Giá trị đo hoặc trạng thái (chuỗi: "running", "fault"…). */
export type LiveValue = number | string;

export type TagValue = {
  value: LiveValue;
  unit?: string;
  /** Thời điểm đo (ms epoch) – dùng để phát hiện tín hiệu "đứng" (quá STALE_MS không cập nhật). */
  ts: number;
  quality: TagQuality;
};

/** Số liệu theo tag cảm biến. Tag không có trong map = chưa/không có dữ liệu. */
export type LiveData = Record<string, TagValue>;

export const TAG_QUALITIES = ['good', 'uncertain', 'bad'] as const satisfies readonly TagQuality[];

export const TagValueSchema: z.ZodType<TagValue> = z
  .object({
    value: z.union([z.number().finite(), z.string()]),
    unit: z.string().optional(),
    ts: z.number().int().nonnegative(),
    quality: z.enum(TAG_QUALITIES),
  })
  .strict();

export const LiveDataSchema: z.ZodType<LiveData> = z.record(z.string().min(1), TagValueSchema);
