import type { User } from '../context/AuthContext';

/**
 * Bản ghi tài khoản quản trị được — mở rộng `User` (giữ nguyên role/mfgRole/
 * warehouseScope/isPurchaser/isProductPlanner/isSale, không phát sinh mô hình
 * phân quyền mới) và thêm các field chỉ Admin cần (không đưa vào session `User`).
 */
export interface SystemUser extends User {
  username?: string; // dùng để đăng nhập (BE thật)
  password: string; // write-only cho form tạo/sửa — BE không trả password nên list/get luôn để rỗng
  isActive: boolean;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
}

/**
 * Bản ghi audit log đã persist vào mockStore — cùng shape với `AuditLogEntry`
 * trong AuditLogContext.tsx, tách riêng ở đây để tầng data (src/lib/mock, src/types)
 * không phụ thuộc ngược vào src/context/*. `action` được nới thành `string` vì
 * danh sách nhãn/màu (AUDIT_ACTIONS) là mối quan tâm UI, thuộc AuditLogContext.
 */
export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: number;
  actorName: string;
  at: string; // ISO
  note?: string;
  /** Ảnh minh hoạ lỗi (2026-09-11, QA audit B4) - KCS chụp/tải ảnh khi chấm "Không đạt" nhưng ảnh
   *  chưa từng hiển thị lại ở bất kỳ đâu (chỉ lưu lên server, không đọc vào entry nào). Optional -
   *  hầu hết entry khác (proposal/sku/user/masterdata...) không có ảnh. */
  photoUrl?: string;
  /** BE QcReview.id thật (2026-09-11 lần 2, theo Sếp: "cho người nhập được sửa luôn") - CHỈ set
   *  cho entry action='kcs.approved' có photoUrl, để AuditLogTimeline hiện nút Đổi/Xóa ảnh gọi
   *  đúng PATCH /qc-reviews/:id/photo. Optional - mọi entry khác không có. */
  qcReviewId?: string;
}

/** Máy cắt của bộ giải "Đề xuất thanh sắt": 'laser' = MC Laser (cắt từng cây), 'tu_dong' = MC Tự động
 *  (cắt theo bó nhiều cây một lần, phần lẻ cắt tay). Nhãn hiển thị: xem utils/cutMachine.ts. */
export type SolverMachine = 'laser' | 'tu_dong';

/** Cấu hình chung của công ty — hiện chỉ để Admin xem/sửa, chưa có nghiệp vụ nào đọc động. */
export interface SystemConfig {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  taxCode?: string;
  defaultCurrency: string;
  /** Địa chỉ ERP in lên tem QR máy xưởng (vd https://erpdna.vercel.app); null/trống = dùng địa chỉ trình duyệt đang mở.
   *  Theo từng môi trường - máy local để trống, điền khi đưa lên hệ thống thật. */
  floorPublicUrl?: string | null;
  /** Mạng công ty được phép đăng nhập (IP / dải IPv4 CIDR). Rỗng = không giới hạn. Áp cho công nhân + tài khoản tổ Phôi/Hàn/Sơn. */
  floorAllowedIps?: string[];
  /** Mặc định toàn hệ thống: có cho solver đặt cây sắt ngoài các chiều dài chuẩn không. Từng đợt
   *  cắt đè lại được — KHSX đề nghị ở "Tối ưu cắt sắt", Sếp duyệt cùng lệnh sản xuất. */
  solverAllowCustomLength: boolean;
  /** Mặc định toàn hệ thống: số giây solver được giải CHO MỖI LOẠI SẮT. Từng đợt cắt đề nghị riêng
   *  được ở "Tối ưu cắt sắt" (ô "Thời gian chạy tối đa") — không cần Sếp duyệt. */
  solverTimeLimitSeconds: number;
  /** Máy cắt mặc định cho đợt cắt KHSX không chọn riêng ở "Tối ưu cắt sắt". Mặc định 'laser'. */
  solverMachine: SolverMachine;
  /** MC Tự động: bề dày lưỡi cắt (mm) mất đi sau mỗi nhát cắt. Mặc định 2,5. */
  solverMctdBladeWidthMm: number;
  /** MC Tự động: phần đầu cây cắt bỏ (tề đầu, mm) trước khi cắt đoạn đầu tiên. Mặc định 0. */
  solverMctdTrimStartMm: number;
  /** MC Tự động: các hệ số bó (số cây cắt một lần). Mặc định [14, 16, 18, 20]. */
  solverBundleFactors: number[];
  /** MC Tự động: tổng số cây được cắt tay (cắt từng cây, phần lẻ không đủ bó) cho mỗi loại sắt. Mặc định 5. */
  solverMaxManualCuts: number;
  /** MC Tự động: mỗi kiểu cắt có tối đa bao nhiêu cỡ đoạn. Mặc định 5. */
  solverMaxSizesPerPattern: number;
  /** KHUNG gộp (ngày) của lệnh gộp, số nguyên 1-365 (2026-10-24, Sếp chốt): LUẬT CỨNG - mốc cần sắt của các SKU gộp chung
   *  phải nằm trong khung này TÍNH CẢ HAI ĐẦU, tức chênh nhau tối đa N-1 ngày (N=3: ngày 1 gộp được ngày 3, không gộp ngày 4;
   *  N=1: chỉ cùng ngày). Xa hơn thì KHSX không gộp/tính/lưu mốc thời gian được; màn Tối ưu cắt sắt cũng gợi ý gộp theo khung này.
   *  Mặc định 3 (trước là 7, và cho phép 0). */
  solverMergeWindowDays: number;
  /** Lệnh gộp (và một đợt tính phương án cắt) có tối đa chừng này SKU, số nguyên 1-50 (2026-10-24). Mặc định 2. */
  solverMergeMaxSkus: number;
}

export type NotificationCategory = 'ANNOUNCEMENT' | 'ACTION_REQUIRED' | 'RESULT' | 'ALERT' | 'INFO';
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

/** BE dựng URL từ đây (BE không biết cấu trúc route FE - xem changelog notification 2026-09-25 mục
 *  6.2). `module`/`page` khớp đúng chuỗi FE dùng làm khoá điều hướng (app/page.tsx `activeModule`,
 *  `type Page` của từng *App.tsx) - hợp đồng bằng convention, không có type dùng chung giữa 2 repo. */
export interface NotificationLinkTarget {
  module: string;
  page?: string;
  params?: Record<string, string | number | null>;
}

export interface NotificationLink extends NotificationLinkTarget {
  /** Đích thay thế khi người nhận không mở được phân hệ chính (BE: NotificationLink.alternatives). */
  alternatives?: NotificationLinkTarget[];
}

/**
 * 1 dòng thông báo CỦA NGƯỜI GỌI (BE fan-out theo NotificationRecipient từ 2026-09-25, thay mô
 * hình broadcast-4-audience cũ) — id là UUID string thật từ BE (module `notifications`), không
 * phải id số như phần lớn domain khác. `audience` giờ chỉ có giá trị khi `category=ANNOUNCEMENT`.
 */
export interface Notification {
  id: string;
  type: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  link: NotificationLink | null;
  data: unknown;
  audience?: 'all' | 'boss' | 'warehouse_staff' | 'production_manager' | null;
  createdAt: string;
  createdBy?: string | null;
  isRead: boolean;
  isResolved: boolean;
}

/** 1 dòng "Thông báo chung đã gửi" (Admin) - góc nhìn CỦA NGƯỜI PHÁT (tỉ lệ đọc trên mọi người
 *  nhận), khác `Notification` (trạng thái của 1 người cụ thể). Xem AnnouncementResponseDto (BE). */
export interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: 'all' | 'boss' | 'warehouse_staff' | 'production_manager' | null;
  createdBy: string | null;
  createdAt: string;
  recipientCount: number;
  readCount: number;
}
