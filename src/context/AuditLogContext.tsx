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
