import type { User } from '../context/AuthContext';

/**
 * Bản ghi tài khoản quản trị được — mở rộng `User` (giữ nguyên role/mfgRole/
 * warehouseScope/isPurchaser/isProductPlanner/isSale, không phát sinh mô hình
 * phân quyền mới) và thêm các field chỉ Admin cần (không đưa vào session `User`).
 */
export interface SystemUser extends User {
  password: string; // mock-only, plaintext — cùng convention với MOCK_ACCOUNTS cũ
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
}

/** Cấu hình chung của công ty — hiện chỉ để Admin xem/sửa, chưa có nghiệp vụ nào đọc động. */
export interface SystemConfig {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  taxCode?: string;
  defaultCurrency: string;
}

/** Thông báo do Admin tạo/quản lý — broadcast đơn giản, chưa gắn trạng thái đã đọc theo user. */
export interface Notification {
  id: number;
  title: string;
  message: string;
  audience: 'all' | 'boss' | 'warehouse_staff';
  createdAt: string;
  createdBy?: string;
}
