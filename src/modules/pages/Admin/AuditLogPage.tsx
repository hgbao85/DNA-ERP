'use client'
import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { getAllAuditLogs } from '../../../services/api'
import SearchInput from '../../../components/SearchInput'
import FilterPills from '../../../components/FilterPills'
import EmptyState from '../../../components/EmptyState'
import LoadingState from '../../../components/LoadingState'
import Pagination from '../../../components/Pagination'
import AuditLogTimeline from '../../../components/AuditLogTimeline'
import { AUDIT_ACTIONS, type AuditLogEntry } from '../../../context/AuditLogContext'

const ENTITY_LABEL: Record<string, string> = {
  proposal: 'Đề xuất mua hàng',
  planform: 'SKU / Định mức',
  kcs: 'KCS',
  user: 'Người dùng',
  supplier: 'Nhà cung cấp',
  'sales-customer': 'Khách hàng bán hàng',
  'export-customer': 'Khách hàng xuất khẩu',
  'material-group': 'Nhóm vật tư',
  material: 'Vật tư',
  'weaving-point': 'Điểm đan',
  'defect-reason': 'Lý do lỗi',
  'export-purpose': 'Mục đích xuất',
}

export default function AuditLogPage() {
  const { data, isLoading } = useFetch<AuditLogEntry[]>(() => getAllAuditLogs() as Promise<AuditLogEntry[]>)
  const logs = useMemo(() => data ?? [], [data])

  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [action, setAction] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const entityOptions = useMemo(() => {
    const types = [...new Set(logs.map(l => l.entityType))]
    return [{ key: 'all', label: 'Tất cả' }, ...types.map(t => ({ key: t, label: ENTITY_LABEL[t] ?? t }))]
  }, [logs])

  const actionOptions = useMemo(() => [...new Set(logs.map(l => l.action))], [logs])

  const filtered = useMemo(() => {
    let list = [...logs].sort((a, b) => b.at.localeCompare(a.at))
    if (entityFilter !== 'all') list = list.filter(l => l.entityType === entityFilter)
    if (action !== 'all') list = list.filter(l => l.action === action)
    if (dateFrom) list = list.filter(l => l.at >= dateFrom)
    if (dateTo) list = list.filter(l => l.at <= `${dateTo}T23:59:59`)
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('vi')
      list = list.filter(l => l.actorName.toLocaleLowerCase('vi').includes(q) || (l.note ?? '').toLocaleLowerCase('vi').includes(q))
    }
    return list
  }, [logs, entityFilter, action, dateFrom, dateTo, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <History size={18} color="#3949ab" />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nhật ký hoạt động</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>({filtered.length})</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Nhật ký chỉ ghi nhận các hoạt động phát sinh sau khi tính năng này được bật — dữ liệu trước đó không được lưu lại.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Tìm theo người thực hiện, ghi chú..." />
        <select
          value={action}
          onChange={e => { setAction(e.target.value); setPage(1) }}
          style={{ padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
        >
          <option value="all">Tất cả hành động</option>
          {actionOptions.map(a => (
            <option key={a} value={a}>{AUDIT_ACTIONS[a as keyof typeof AUDIT_ACTIONS]?.label ?? a}</option>
          ))}
        </select>
        <input
          type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>đến</span>
        <input
          type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterPills options={entityOptions} active={entityFilter} onChange={k => { setEntityFilter(k); setPage(1) }} />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<History size={28} />} message="Chưa có hoạt động nào" />
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          <div style={{ padding: 14 }}>
            <AuditLogTimeline entries={paged} bare />
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
          </div>
        </div>
      )}
    </div>
  )
}
