/** Chi tiết bổ sung theo mã yêu cầu (checklist, ghi chú, lịch sử…). Tách từ mocks/maintenance.ts. */
import type { MaintenanceRecord } from '@/features/maintenance/types';
import { isoDay } from './maintenanceDates';

const at2 = (time: string, offset = 0) => `${isoDay(offset)}T${time}`;

/** Nội dung trang chi tiết (ảnh MT-00128). Giờ trong ngày theo ảnh; ngày = hôm nay (ảnh ghi 15/10/2023 – dữ liệu mẫu cũ). */
export const DETAILS: Record<string, () => Partial<MaintenanceRecord>> = {
  'MT-00128': () => ({
    createdBy: 'Nguyen Abc',
    description:
      'Cảnh báo ALT-00128 cho thấy áp suất tại bồn V-101 đang dao động bất thường quanh mức 11.8 bar (vượt ngưỡng cảnh báo 1). Yêu cầu khẩn cấp kiểm tra hoạt động của van an toàn PSV-101.',
    objectives: [
      'Đảm bảo van xả áp hoạt động đúng thiết kế, không bị kẹt cơ học.',
      'Kiểm tra áp suất thực tế tại bồn V-101.',
      'Kiểm tra cảm biến hành trình báo tín hiệu chính xác về DCS.',
      'Kiểm tra hệ thống đường ống kết nối.',
      'Kiểm tra hệ thống làm mát.',
      'Xác định nguyên nhân dao động áp suất.',
    ],
    requiresPermit: true,
    checklist: [
      { id: 'c1', text: 'Chuẩn bị dụng cụ và giấy phép làm việc (PTW)', done: true, doneAt: at2('10:15') },
      { id: 'c2', text: 'Kiểm tra trực quan tình trạng bên ngoài PSV-101', done: true, doneAt: at2('10:45') },
      { id: 'c3', text: 'Sử dụng thiết bị dò siêu âm kiểm tra rò rỉ khí qua seat', done: false, active: true },
      { id: 'c4', text: 'Kiểm tra cáp tín hiệu cảm biến hành trình ZSO/ZSC', done: false },
      { id: 'c5', text: 'Vệ sinh bề mặt tiếp xúc và bu-lông mặt bích', done: false },
      { id: 'c6', text: 'Ghi nhận thông số áp suất hiện tại lúc kiểm tra', done: false },
      { id: 'c7', text: 'Trả lại mặt bằng, dọn dẹp và ký đóng PTW', done: false, na: true },
    ],
    notes: [{ id: 'n1', author: 'Nguyễn Văn A', at: at2('10:50'), text: 'Kiểm tra trực quan không thấy rò rỉ bên ngoài. Bắt đầu siêu âm.' }],
    attachments: [
      { id: 'f1', name: 'hien-truong-psv101.jpg', size: 2_480_000, kind: 'image' },
      { id: 'f2', name: 'bao-cao-kiem-dinh.pdf', size: 860_000, kind: 'document' },
      { id: 'f3', name: 'manual-psv101.pdf', size: 4_150_000, kind: 'manual' },
    ],
    history: [
      { id: 'h1', at: at2('08:30'), kind: 'create', text: 'Tạo yêu cầu (Auto-Trigger)', actor: 'Hệ thống' },
      { id: 'h2', at: at2('08:31'), kind: 'notify', text: 'Gửi thông báo đến bộ phận Bảo trì', actor: 'Hệ thống' },
      { id: 'h3', at: at2('08:35'), kind: 'priority', text: 'Cập nhật mức ưu tiên: Nghiêm trọng', actor: 'Hệ thống' },
    ],
  }),
  // ---- Nghiệm thu (ảnh "Gửi yêu cầu nghiệm thu" / "Nghiệm thu yêu cầu bảo trì") ----
  // MT-00109 (V-101): checklist 7/7 với tên mục theo ảnh modal Gửi → đủ điều kiện gửi khi điền tóm tắt/nguyên nhân/biện pháp/người
  // nghiệm thu; tiến độ báo cáo 80 % → gửi đặt 100 %.
  'MT-00109': () => ({
    reportedProgress: 80,
    checklist: [
      { id: 'c1', text: 'Kiểm tra trực quan', done: true, doneAt: at2('08:40', -1) },
      { id: 'c2', text: 'Kiểm tra rò rỉ siêu âm', done: true, doneAt: at2('09:05', -1) },
      { id: 'c3', text: 'Ghi nhận áp suất', done: true, doneAt: at2('09:20', -1) },
      { id: 'c4', text: 'Tín hiệu cảm biến ZSO/ZSC', done: true, doneAt: at2('09:50', -1) },
      { id: 'c5', text: 'Vệ sinh hệ thống làm mát', done: true, doneAt: at2('10:30', -1) },
      { id: 'c6', text: 'Chụp ảnh nhật ký', done: true, doneAt: at2('10:40', -1) },
      { id: 'c7', text: 'Đề xuất xử lý', done: true, doneAt: at2('11:00', -1) },
    ],
  }),
  // MT-00117: checklist chưa xong → modal Gửi "Chưa đủ điều kiện".
  'MT-00117': () => ({
    reportedProgress: 70,
    checklist: [
      { id: 'c1', text: 'Đối chiếu mức tại hiện trường', done: true, doneAt: at2('09:00', -1) },
      { id: 'c2', text: 'Kiểm tra tín hiệu LT-102', done: true, doneAt: at2('09:30', -1) },
      { id: 'c3', text: 'Hiệu chỉnh điểm 0 cảm biến', done: false, active: true },
      { id: 'c4', text: 'Ghi nhận kết quả', done: false },
      { id: 'c5', text: 'Kiểm tra van cách ly', done: false, na: true },
    ],
  }),
  // MT-00115: đã gửi nghiệm thu (có hồ sơ) – mở được modal Nghiệm thu. E-101B không có số liệu trực tiếp → không có thông số.
  'MT-00115': () => ({
    submission: {
      summary: 'Đã vệ sinh bộ trao đổi nhiệt, thay gioăng nắp và chạy thử 30 phút ở tải định mức.',
      cause: 'Cặn bám bộ trao đổi nhiệt làm giảm hiệu suất hóa hơi.',
      remedy: 'Súc rửa hóa chất bộ trao đổi nhiệt, thay gioăng nắp, hiệu chỉnh van điều nhiệt.',
      deviceCondition: 'normal',
      readings: { at: at2('15:10', -1) },
      sensorStatus: 'normal',
      valveStatus: 'stable',
      reviewer: 'Trần Hoàng Nam',
      submittedBy: 'Lê Thị C',
      submittedAt: at2('15:10', -1),
    },
    history: [{ id: 'h1', at: at2('15:10', -1), kind: 'submit', text: 'Gửi nghiệm thu – người nghiệm thu: Trần Hoàng Nam', actor: 'Lê Thị C' }],
  }),
};
