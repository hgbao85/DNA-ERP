'use client'
import type { AuditLogEntry as PersistedAuditLogEntry } from '../types/admin'

// 16/11/2026: KHÔNG còn provider/logAction ghi nhật ký vào localStorage. Mọi nhật ký giờ là dữ liệu
// thật của BE: trang Admin "Nhật ký hoạt động" đọc audit_logs (services/audit-log-api.ts), lịch sử
// duyệt SKU đọc GET /skus/:id/history (BE tự ghi ở từng bước - sku-history.ts phía BE). File này chỉ
// còn bảng nhãn/màu cho AuditLogTimeline (lịch sử SKU, lịch sử lô KCS, vết đề xuất mua).
//
// Cấu hình mapping action -> nhãn + màu hiển thị. Đây là điểm mở rộng duy nhất:
// Nghiệp vụ mới (không chỉ PurchaseProposal) chỉ cần thêm 1 dòng ở đây (key phải khớp đúng
// giá trị BE trả về),
// không phải viết lại cơ chế ghi log hay màn hiển thị "Hoạt động". Màu lấy theo đúng bảng màu
// ngữ nghĩa đã dùng sẵn trong app (xanh dương = tạo/tiếp nhận, tím = chờ duyệt, cam = làm lại,
// xanh lá = duyệt, đỏ = từ chối) để nhất quán, không phát sinh màu mới.
export const AUDIT_ACTIONS = {
  'proposal.created':         { label: 'Tạo đề xuất mua hàng',        color: 'var(--fg-2563eb)' },
  'proposal.acknowledged':    { label: 'Tiếp nhận đề xuất',           color: 'var(--fg-2563eb)' },
  'proposal.quote_submitted': { label: 'Gửi báo giá cho Giám đốc',    color: 'var(--fg-7c3aed)' },
  'proposal.requoted':        { label: 'Báo giá lại sau từ chối',     color: 'var(--fg-d97706)' },
  'proposal.approved':        { label: 'Giám đốc duyệt',              color: 'var(--fg-2e7d32)' },
  'proposal.rejected':        { label: 'Giám đốc từ chối',            color: 'var(--fg-c62828)' },
  'proposal.purchased':       { label: 'Đã nhận đủ hàng',             color: 'var(--fg-166534)' },
  'request.production_started': { label: 'Bắt đầu sản xuất',          color: 'var(--fg-2563eb)' },

  // ─── SKU — tạo mới, nhập định mức (4 account chuyên trách) + duyệt (KHSX/Sếp) ─────────
  'sku.created':                { label: 'Tạo SKU',                                         color: 'var(--fg-2563eb)' },
  'sku.updated':                { label: 'Sửa tên/khách hàng SKU',                          color: 'var(--fg-2563eb)' },
  'sku.detail_submitted':        { label: 'Nhập định mức chi tiết',                          color: 'var(--fg-2563eb)' },
  'sku.manh_submitted':          { label: 'Nhập định mức mảnh',                               color: 'var(--fg-2563eb)' },
  'sku.detail_section_approved': { label: 'Duyệt 1 nhóm định mức chi tiết',                  color: 'var(--fg-2e7d32)' },
  'sku.detail_section_rejected': { label: 'Từ chối 1 nhóm định mức chi tiết',                color: 'var(--fg-c62828)' },
  // Mảnh/chi tiết là 2 nhánh độc lập tiến song song (không còn "chuyển QLSX duyệt" hay "chuyển
  // bộ phận nhập chi tiết" - QLSX duyệt cục bộ đã bỏ khỏi pipeline từ trước, và nhánh kia có thể
  // đã tự làm việc song song rồi) - nhãn chỉ còn phản ánh đúng 1 nhánh vừa được KHSX chốt xong.
  'sku.detail_approved':         { label: 'Xác nhận hoàn tất định mức chi tiết',              color: 'var(--fg-2e7d32)' },
  'sku.parts_section_approved':  { label: 'Duyệt 1 nhóm định mức mảnh',                       color: 'var(--fg-2e7d32)' },
  'sku.parts_section_rejected':  { label: 'Từ chối 1 nhóm định mức mảnh',                     color: 'var(--fg-c62828)' },
  'sku.parts_approved':          { label: 'Xác nhận hoàn tất định mức mảnh',                  color: 'var(--fg-2e7d32)' },
  'sku.qlsx_approved':           { label: 'Quản lý sản xuất duyệt',                            color: 'var(--fg-2e7d32)' },
  'sku.sent_for_boss_approval':  { label: 'Gửi sếp duyệt',                                    color: 'var(--fg-7c3aed)' },
  'sku.qlsx_rejected':           { label: 'QLSX từ chối — trả về cho KHSX duyệt lại',         color: 'var(--fg-c62828)' },
  'sku.boss_approved':           { label: 'Giám đốc duyệt — bắt đầu sản xuất',                 color: 'var(--fg-2e7d32)' },
  'sku.boss_rejected':           { label: 'Giám đốc từ chối — trả về cho KHSX duyệt lại',      color: 'var(--fg-c62828)' },
  'sku.admin_override':          { label: 'Admin ghi đè định mức đã duyệt',                    color: 'var(--fg-d97706)' },

  // ─── KCS (Phôi/Hàn/Sơn) — lịch sử một lô: xuất → báo sản lượng → KCS duyệt ─────
  'kcs.issued':   { label: 'Kho xuất',                color: 'var(--fg-2563eb)' },
  'kcs.reported': { label: 'Báo sản lượng — chờ KCS', color: 'var(--fg-7c3aed)' },
  'kcs.approved': { label: 'KCS duyệt',               color: 'var(--fg-2e7d32)' },

} as const

export type AuditAction = keyof typeof AUDIT_ACTIONS

// Shape lưu trữ (persisted) định nghĩa ở tầng data — src/types/admin.ts — để
// src/lib/mock/* không phải import ngược từ src/context/*. Ở đây thu hẹp lại
// `action` về đúng AuditAction cho các consumer trong app (AuditLogTimeline...).
export type AuditLogEntry = Omit<PersistedAuditLogEntry, 'action'> & { action: AuditAction }
