'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { logAuditAction, getAllAuditLogs } from '../services/api'
import type { AuditLogEntry as PersistedAuditLogEntry } from '../types/admin'

// Cấu hình mapping action -> nhãn + màu hiển thị. Đây là điểm mở rộng duy nhất:
// nghiệp vụ mới (không chỉ PurchaseProposal) chỉ cần thêm 1 dòng ở đây rồi gọi logAction(),
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

  // ─── KCS (Phôi/Hàn/Sơn) — lịch sử một lô: xuất → báo sản lượng → KCS duyệt ─────
  'kcs.issued':   { label: 'Kho xuất',                color: 'var(--fg-2563eb)' },
  'kcs.reported': { label: 'Báo sản lượng — chờ KCS', color: 'var(--fg-7c3aed)' },
  'kcs.approved': { label: 'KCS duyệt',               color: 'var(--fg-2e7d32)' },

  // ─── Admin — Người dùng ─────────────────────────────────────────────────────
  'user.created':      { label: 'Tạo tài khoản',       color: 'var(--fg-2563eb)' },
  'user.updated':      { label: 'Cập nhật tài khoản',  color: 'var(--fg-d97706)' },
  'user.role_changed': { label: 'Đổi vai trò/quyền',   color: 'var(--fg-7c3aed)' },
  'user.password_reset': { label: 'Đặt lại mật khẩu',  color: 'var(--fg-7c3aed)' },
  'user.locked':       { label: 'Khóa tài khoản',      color: 'var(--fg-c62828)' },
  'user.unlocked':     { label: 'Mở khóa tài khoản',   color: 'var(--fg-059669)' },
  'user.deleted':      { label: 'Xóa tài khoản',       color: 'var(--fg-c62828)' },

  // ─── Admin — Danh mục hệ thống (dùng chung cho mọi entity danh mục) ──────────
  'masterdata.created': { label: 'Tạo bản ghi danh mục',      color: 'var(--fg-2563eb)' },
  'masterdata.updated': { label: 'Cập nhật danh mục',         color: 'var(--fg-d97706)' },
  'masterdata.deleted': { label: 'Xóa danh mục',              color: 'var(--fg-c62828)' },

  // ─── Admin — Thông báo & Cấu hình hệ thống ───────────────────────────────────
  'notification.created': { label: 'Tạo thông báo',        color: 'var(--fg-2563eb)' },
  'notification.updated': { label: 'Cập nhật thông báo',   color: 'var(--fg-d97706)' },
  'notification.deleted': { label: 'Xóa thông báo',        color: 'var(--fg-c62828)' },
  'system_config.updated': { label: 'Cập nhật cấu hình hệ thống', color: 'var(--fg-d97706)' },
  'system.data_reset':    { label: 'Reset dữ liệu demo',    color: 'var(--fg-c62828)' },
} as const

export type AuditAction = keyof typeof AUDIT_ACTIONS

// Shape lưu trữ (persisted) định nghĩa ở tầng data — src/types/admin.ts — để
// src/lib/mock/* không phải import ngược từ src/context/*. Ở đây thu hẹp lại
// `action` về đúng AuditAction cho các consumer trong app (AuditLogTimeline...).
export type AuditLogEntry = Omit<PersistedAuditLogEntry, 'action'> & { action: AuditAction }

interface AuditLogCtxType {
  logs: AuditLogEntry[]
  logAction: (entityType: string, entityId: string, action: AuditAction, note?: string) => void
  getLogsFor: (entityType: string, entityId: string) => AuditLogEntry[]
}

const AuditLogCtx = createContext<AuditLogCtxType | undefined>(undefined)

export function AuditLogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])

  // Nạp lịch sử đã persist trong mockStore khi provider mount — trước đây log
  // chỉ sống trong React state nên mất khi F5, giờ đọc lại từ auditLogs collection.
  useEffect(() => {
    getAllAuditLogs().then(entries => setLogs(entries as AuditLogEntry[])).catch(() => {})
  }, [])

  const logAction = useCallback((entityType: string, entityId: string, action: AuditAction, note?: string) => {
    const actorId = user?.id
    const actorName = user?.name ?? 'Hệ thống'
    // Ghi optimistic vào state trước (không đổi UX/độ trễ cảm nhận so với trước),
    // đồng thời gọi service lưu xuống mockStore ở nền — logAction() vẫn là hàm
    // đồng bộ (void) như cũ nên toàn bộ call site hiện có không cần sửa.
    const optimistic: AuditLogEntry = {
      id: `log-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entityType,
      entityId,
      action,
      actorId,
      actorName,
      at: new Date().toISOString(),
      note,
    }
    setLogs(prev => [...prev, optimistic])
    void logAuditAction(entityType, entityId, action, actorId, actorName, note)
      .then(saved => {
        setLogs(prev => prev.map(l => (l.id === optimistic.id ? (saved as AuditLogEntry) : l)))
      })
      .catch(() => {
        // Lưu thất bại (mạng lỗi...) - gỡ dòng optimistic để không để lại log "ma" chỉ
        // sống trong phiên hiện tại rồi biến mất im lặng khi F5 mà không ai biết đã mất.
        setLogs(prev => prev.filter(l => l.id !== optimistic.id))
      })
  }, [user])

  const getLogsFor = useCallback((entityType: string, entityId: string) =>
    logs
      .filter(l => l.entityType === entityType && l.entityId === entityId)
      .sort((a, b) => a.at.localeCompare(b.at)),
  [logs])

  return (
    <AuditLogCtx.Provider value={{ logs, logAction, getLogsFor }}>
      {children}
    </AuditLogCtx.Provider>
  )
}

export function useAuditLog(): AuditLogCtxType {
  const ctx = useContext(AuditLogCtx)
  if (!ctx) {
    throw new Error('useAuditLog phải được sử dụng bên trong AuditLogProvider')
  }
  return ctx
}
