import { Badge, Button, Modal } from '@/components';
import type { AlertKindConfig } from '@/mocks/alertKinds';

/**
 * "Xem quy trình khẩn cấp" (chưa có thiết kế; dựng theo token, mở TRÊN drawer – Esc/Đóng trả focus nút đã mở):
 * các bước ứng phó + danh bạ khẩn cấp từ cấu hình loại (`ALERT_KINDS[kind].emergency`). Nội dung chưa duyệt → nhãn `draft`
 * hiển thị ngay đầu modal. Liên hệ không có số → "Chờ khách cung cấp" (không đặt số giả). Chỉ đọc.
 */
export function EmergencyProcedureModal({ procedure, onClose }: { procedure: NonNullable<AlertKindConfig['emergency']>; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={procedure.title}
      footer={
        <Button variant="primary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      {procedure.draft && (
        <div>
          <Badge variant="tag" tone="warning" size="md">
            {procedure.draft}
          </Badge>
        </div>
      )}
      <section aria-labelledby="emergency-steps" className="flex flex-col gap-2">
        <h3 id="emergency-steps" className="text-md font-semibold text-fg-secondary">
          Các bước ứng phó
        </h3>
        <ol className="flex flex-col gap-2">
          {procedure.steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-base text-fg">
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line/30 text-sm text-fg-secondary">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="emergency-contacts" className="flex flex-col gap-2">
        <h3 id="emergency-contacts" className="text-md font-semibold text-fg-secondary">
          Danh bạ khẩn cấp
        </h3>
        <ul className="overflow-hidden rounded-md border border-line/30">
          {procedure.contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line/30 px-4 py-2.5 last:border-b-0">
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-semibold text-fg">{c.name}</span>
                <span className="text-sm text-fg-secondary">{c.role}</span>
              </span>
              {c.phone ? (
                <a href={`tel:${c.phone}`} className="shrink-0 rounded-sm text-lg font-bold tabular-nums text-primary hover:underline" aria-label={`Gọi ${c.name} ${c.phone}`}>
                  {c.phone}
                </a>
              ) : (
                <span className="shrink-0 text-sm text-fg-secondary">Chờ khách cung cấp</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Modal>
  );
}
