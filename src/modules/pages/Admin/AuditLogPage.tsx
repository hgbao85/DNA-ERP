'use client'
import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { getUsers } from '../../../services/api'
import { getAuditLogs, type AuditLogPageResult, type AuditLogQuery } from '../../../services/audit-log-api'
import { AUDIT_ACTION_META, AUDIT_TABLE_LABEL } from '../../../services/audit-log-format'
import EmptyState from '../../../components/EmptyState'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import Pagination from '../../../components/Pagination'
import AuditLogList from '../../../components/AuditLogList'
import type { SystemUser } from '../../../types/admin'

const selectStyle = { padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', width: 'auto', maxWidth: '100%' } as const

const TABLE_OPTIONS = Object.entries(AUDIT_TABLE_LABEL).sort((a, b) => a[1].localeCompare(b[1], 'vi'))

/** 'YYYY-MM-DD' (ngày theo giờ máy) -> ISO đầu/cuối ngày đó, để BE lọc createdAt đúng theo giờ Việt Nam. */
function dayBoundary(day: string, end: boolean): string | undefined {
  if (!day) return undefined
  const d = new Date(`${day}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  if (end) d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

/**
 * Nhật ký hoạt động THẬT (16/11/2026): đọc bảng `audit_logs` BE tự ghi cho mọi bảng nghiệp vụ (tạo/sửa/
 * xoá + ảnh chụp trước/sau). Trước đây là mock localStorage - mỗi trình duyệt chỉ thấy thao tác của chính
 * nó. Lọc + phân trang đều ở BE vì bảng tăng mãi.
 */
export default function AuditLogPage() {
  const [tableName, setTableName] = useState('')
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState<'' | AuditLogQuery['action']>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data: users } = useFetch<SystemUser[]>(getUsers)
  const userNames = useMemo(() => new Map((users ?? []).map(u => [String(u.id), u.name])), [users])
  const sortedUsers = useMemo(() => [...(users ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'vi')), [users])

  const { data, isLoading, error, refetch } = useFetch<AuditLogPageResult>(
    () => getAuditLogs({
      page,
      limit: pageSize,
      tableName: tableName || undefined,
      userId: userId || undefined,
      action: action || undefined,
      from: dayBoundary(dateFrom, false),
      to: dayBoundary(dateTo, true),
    }),
    [page, pageSize, tableName, userId, action, dateFrom, dateTo],
  )

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <History size={18} color="var(--fg-3949ab)" />
        <h2 style={{ ...pageTitle, margin: 0 }}>Nhật ký hoạt động</h2>
        {data && <span style={{ fontSize: 12, color: 'var(--text3)' }}>({data.total.toLocaleString('vi-VN')})</span>}
      </div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Hệ thống tự ghi mọi lần tạo/sửa/xoá dữ liệu nghiệp vụ, kèm người thực hiện và các trường đã đổi.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <select value={tableName} onChange={e => resetPage(setTableName)(e.target.value)} style={selectStyle} aria-label="Đối tượng">
          <option value="">Tất cả đối tượng</option>
          {TABLE_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={action} onChange={e => resetPage(setAction)(e.target.value as '' | AuditLogQuery['action'])} style={selectStyle} aria-label="Hành động">
          <option value="">Tất cả hành động</option>
          {Object.entries(AUDIT_ACTION_META).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
        </select>
        <select value={userId} onChange={e => resetPage(setUserId)(e.target.value)} style={selectStyle} aria-label="Người thực hiện">
          <option value="">Tất cả người thực hiện</option>
          {sortedUsers.map(u => <option key={String(u.id)} value={String(u.id)}>{u.name}</option>)}
        </select>
        <input
          type="date" value={dateFrom} onChange={e => resetPage(setDateFrom)(e.target.value)} aria-label="Từ ngày"
          style={{ ...selectStyle, padding: '6px 10px' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>đến</span>
        <input
          type="date" value={dateTo} onChange={e => resetPage(setDateTo)(e.target.value)} aria-label="Đến ngày"
          style={{ ...selectStyle, padding: '6px 10px' }}
        />
      </div>

      {isLoading && !data ? (
        <LoadingState />
      ) : error || !data ? (
        <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <EmptyState icon={<History size={28} />} message="Không có hoạt động nào khớp bộ lọc" />
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          <div style={{ padding: '4px 14px' }}>
            <AuditLogList entries={data.data} userNames={userNames} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={s => { setPageSize(s); setPage(1) }}
              pageSizeOptions={[20, 50, 100]}
            />
          </div>
        </div>
      )}
    </div>
  )
}
