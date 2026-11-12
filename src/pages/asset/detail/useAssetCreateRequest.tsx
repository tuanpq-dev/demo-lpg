import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, CloseIcon } from '@/components';
import { createMaintenanceRequest, useDeviceDirectory, type NewMaintenanceInput } from '@/data/maintenanceApi';
import { announce } from '@/lib/announce';

/**
 * "Tạo yêu cầu bảo trì" từ trang tài sản: modal mở qua URL (`?create=1`, như /maintenance), thiết bị điền sẵn = tài sản;
 * tạo xong → đóng + thông báo có link "Xem trong Bảo trì" (tự ẩn sau 8 giây). `setExtra` = ghi query của bảng sự kiện.
 */
export function useAssetCreateRequest({ open, setExtra }: { open: boolean; setExtra: (patch: Record<string, string | null>) => void }) {
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  // Danh bạ thiết bị chỉ tải khi mở modal (GET /devices).
  const devices = useDeviceDirectory(open);

  useEffect(() => {
    if (!created) return;
    const t = window.setTimeout(() => setCreated(null), 8000);
    return () => window.clearTimeout(t);
  }, [created]);

  const close = () => setExtra({ create: null });
  return {
    open,
    devices,
    created,
    dismissCreated: () => setCreated(null),
    openCreate: () => setExtra({ create: '1' }),
    close,
    onDraftSaved: () => {
      close();
      announce('Đã lưu nháp yêu cầu bảo trì.');
    },
    onSubmit: async (input: NewMaintenanceInput) => {
      const rec = await createMaintenanceRequest(input);
      close();
      setCreated({ id: rec.id, code: rec.code });
      announce(`Đã tạo yêu cầu ${rec.code}.`);
    },
  };
}

/** Thông báo nổi góc phải sau khi tạo yêu cầu: mã + link "Xem trong Bảo trì" + nút đóng. */
export function CreatedNotice({ created, onDismiss }: { created: { id: string; code: string }; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-lg border border-success/30 bg-surface-raised px-4 py-3 text-sm shadow-card">
      <span className="text-success">Đã tạo yêu cầu {created.code}.</span>
      <Link to={`/maintenance/${encodeURIComponent(created.id)}`} className="text-accent underline hover:text-info">
        Xem trong Bảo trì
      </Link>
      <Button variant="icon" size="sm" aria-label="Đóng thông báo" onClick={onDismiss} icon={<CloseIcon size={12} />} />
    </div>
  );
}
