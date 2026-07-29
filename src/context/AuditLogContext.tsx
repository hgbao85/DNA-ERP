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
  'proposal.created':         { label: 'Tạo đề xuất mua hàng',        color: '#2563eb' },
  'proposal.acknowledged':    { label: 'Tiếp nhận đề xuất',           color: '#2563eb' },
  'proposal.quote_submitted': { label: 'Gửi báo giá cho Giám đốc',    color: '#7c3aed' },
  'proposal.requoted':        { label: 'Báo giá lại sau từ chối',     color: '#d97706' },
  'proposal.approved':        { label: 'Giám đốc duyệt',              color: '#2e7d32' },
  'proposal.rejected':        { label: 'Giám đốc từ chối',            color: '#c62828' },
  'proposal.purchased':       { label: 'Đã nhận đủ hàng',             color: '#166534' },
  'request.production_started': { label: 'Bắt đầu sản xuất',          color: '#2563eb' },

  // ─── PlanForm (SKU) — tạo mới, nhập định mức (4 account chuyên trách) + duyệt (KHSX/Sếp) ─────────
  'planform.created':                { label: 'Tạo SKU',                                         color: '#2563eb' },
  'planform.detail_submitted':        { label: 'Nhập định mức chi tiết',                          color: '#2563eb' },
  'planform.manh_submitted':          { label: 'Nhập định mức mảnh',                               color: '#2563eb' },
  'planform.detail_section_approved': { label: 'Duyệt 1 nhóm định mức chi tiết',                  color: '#2e7d32' },
  'planform.detail_section_rejected': { label: 'Từ chối 1 nhóm định mức chi tiết',                color: '#c62828' },
  'planform.detail_approved':         { label: 'Duyệt định mức chi tiết — chuyển QLSX duyệt',       color: '#2e7d32' },
  'planform.parts_section_approved':  { label: 'Duyệt 1 nhóm định mức mảnh',                       color: '#2e7d32' },
  'planform.parts_section_rejected':  { label: 'Từ chối 1 nhóm định mức mảnh',                     color: '#c62828' },
  'planform.parts_approved':          { label: 'Duyệt định mức mảnh — chuyển bộ phận nhập chi tiết', color: '#2e7d32' },
  'planform.qlsx_approved':           { label: 'Quản lý sản xuất duyệt',                            color: '#2e7d32' },
  'planform.sent_for_boss_approval':  { label: 'Gửi sếp duyệt',                                    color: '#7c3aed' },
  'planform.qlsx_rejected':           { label: 'QLSX từ chối — trả về cho KHSX duyệt lại',         color: '#c62828' },
  'planform.boss_approved':           { label: 'Giám đốc duyệt — bắt đầu sản xuất',                 color: '#2e7d32' },
  'planform.boss_rejected':           { label: 'Giám đốc từ chối — trả về cho KHSX duyệt lại',      color: '#c62828' },

  // ─── KCS (Phôi/Hàn/Sơn) — lịch sử một lô: xuất → báo sản lượng → KCS duyệt ─────
  'kcs.issued':   { label: 'Kho xuất',                color: '#2563eb' },
  'kcs.reported': { label: 'Báo sản lượng — chờ KCS', color: '#7c3aed' },
  'kcs.approved': { label: 'KCS duyệt',               color: '#2e7d32' },

  // ─── Admin — Người dùng ─────────────────────────────────────────────────────
  'user.created':      { label: 'Tạo tài khoản',       color: '#2563eb' },
  'user.updated':      { label: 'Cập nhật tài khoản',  color: '#d97706' },
  'user.role_changed': { label: 'Đổi vai trò/quyền',   color: '#7c3aed' },
  'user.password_reset': { label: 'Đặt lại mật khẩu',  color: '#7c3aed' },
  'user.locked':       { label: 'Khóa tài khoản',      color: '#c62828' },
  'user.unlocked':     { label: 'Mở khóa tài khoản',   color: '#059669' },
  'user.deleted':      { label: 'Xóa tài khoản',       color: '#c62828' },

  // ─── Admin — Danh mục hệ thống (dùng chung cho mọi entity danh mục) ──────────
  'masterdata.created': { label: 'Tạo bản ghi danh mục',      color: '#2563eb' },
  'masterdata.updated': { label: 'Cập nhật danh mục',         color: '#d97706' },
  'masterdata.deleted': { label: 'Xóa danh mục',              color: '#c62828' },

  // ─── Admin — Thông báo & Cấu hình hệ thống ───────────────────────────────────
  'notification.created': { label: 'Tạo thông báo',        color: '#2563eb' },
  'notification.updated': { label: 'Cập nhật thông báo',   color: '#d97706' },
  'notification.deleted': { label: 'Xóa thông báo',        color: '#c62828' },
  'system_config.updated': { label: 'Cập nhật cấu hình hệ thống', color: '#d97706' },
  'system.data_reset':    { label: 'Reset dữ liệu demo',    color: '#c62828' },
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
    void logAuditAction(entityType, entityId, action, actorId, actorName, note).then(saved => {
      setLogs(prev => prev.map(l => (l.id === optimistic.id ? (saved as AuditLogEntry) : l)))
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
