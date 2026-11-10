import { Link } from 'react-router-dom';
import { AlertTriangleIcon, ArrowRightIcon, Badge, Button } from '@/components';
import type { AlertRecord } from '@/data/alerts';

/** Dải "Liên kết với cảnh báo …" (mở từ /alerts) – mức độ + link về cảnh báo. */
export function AlertLinkBanner({ alert }: { alert: AlertRecord }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-danger-strong/30 bg-danger-strong/10 px-4 py-3">
      {/* eslint-disable-next-line no-restricted-syntax -- icon, không phải chữ */}
      <AlertTriangleIcon className="shrink-0 text-danger-strong" />
      <p className="min-w-0 flex-1 text-sm text-fg">
        Liên kết với cảnh báo <span className="font-semibold text-danger-text">{alert.code}</span> ({alert.message} tại {alert.area} {alert.device})
      </p>
      <Badge variant="severity" value={alert.severity} size="md" />
      <Link to={`/alerts?alert=${encodeURIComponent(alert.id)}`} className="inline-flex items-center gap-1 rounded-sm text-sm text-accent underline">
        Xem cảnh báo
        <ArrowRightIcon />
      </Link>
    </div>
  );
}

/** Dải "Đã khôi phục bản nháp lưu lúc …" + "Bỏ nháp". */
export function DraftBanner({ savedAt, onDiscard }: { savedAt: string; onDiscard: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-info/20 bg-info/10 px-4 py-2.5 text-sm text-info">
      Đã khôi phục bản nháp lưu lúc {savedAt}.
      <Button variant="link" onClick={onDiscard} className="ml-auto">
        Bỏ nháp
      </Button>
    </div>
  );
}
