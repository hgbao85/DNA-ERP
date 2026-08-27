import type { ProcessStep } from '../types/sku'

// Công đoạn phôi chi tiết — chỉ áp dụng cho nhóm Sắt, đa chọn (vd 1 thanh vừa tán vừa dập).
// Khớp enum ProcessStep ở BE (schema.prisma) — dùng chung giữa trang cấu hình (SpecSteelPage) và
// các trang Phôi tác nghiệp/thống kê (XacNhanSanLuongPage, LenhSanXuatPhoi).
export const PROCESS_STEPS: ProcessStep[] = ['CAT', 'UON', 'DAP', 'DUC_LO', 'TAN', 'TOP_DAU', 'XE']
export const PROCESS_STEP_LABELS: Record<ProcessStep, string> = {
  CAT: 'Cắt', UON: 'Uốn', DAP: 'Dập', DUC_LO: 'Đục lỗ', TAN: 'Tán', TOP_DAU: 'Tóp đầu', XE: 'Xẻ',
}
