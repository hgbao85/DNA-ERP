'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

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
  'planform.detail_approved':         { label: 'Duyệt định mức chi tiết — chuyển bộ phận nhập mảnh', color: '#2e7d32' },
  'planform.detail_sent_back':        { label: 'Gửi lại bộ phận Định mức chi tiết',                color: '#d97706' },
  'planform.parts_approved':          { label: 'Duyệt định mức mảnh',                              color: '#2e7d32' },
  'planform.parts_rejected':          { label: 'Từ chối định mức mảnh',                            color: '#c62828' },
  'planform.parts_sent_back':         { label: 'Gửi lại bộ phận Định mức mảnh',                    color: '#d97706' },
  'planform.sent_for_boss_approval':  { label: 'Gửi sếp duyệt',                                    color: '#7c3aed' },
  'planform.boss_approved':           { label: 'Giám đốc duyệt — bắt đầu sản xuất',                 color: '#2e7d32' },
} as const

export type AuditAction = keyof typeof AUDIT_ACTIONS

export interface AuditLogEntry {
  id: string
  entityType: string
  entityId: string
  action: AuditAction
  actorId?: number
  actorName: string
  at: string // ISO timestamp
  note?: string
}

interface AuditLogCtxType {
  logs: AuditLogEntry[]
  logAction: (entityType: string, entityId: string, action: AuditAction, note?: string) => void
  getLogsFor: (entityType: string, entityId: string) => AuditLogEntry[]
}

const AuditLogCtx = createContext<AuditLogCtxType | undefined>(undefined)

export function AuditLogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])

  const logAction = useCallback((entityType: string, entityId: string, action: AuditAction, note?: string) => {
    setLogs(prev => [...prev, {
      id: `log-${prev.length + 1}-${Date.now()}`,
      entityType,
      entityId,
      action,
      actorId: user?.id,
      actorName: user?.name ?? 'Hệ thống',
      at: new Date().toISOString(),
      note,
    }])
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
