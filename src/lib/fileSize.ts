import { formatNumber } from './number';

/** 2_480_000 → "2.4 MB"; 860_000 → "840 KB" (quy ước số chung – ./number). */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${formatNumber(bytes / 1024 / 1024, 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
