'use client'
import { useMemo, useState } from 'react'
import { Scissors, Info } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import SearchInput from '../../../../components/SearchInput'
import FilterPills from '../../../../components/FilterPills'
import EmptyState from '../../../../components/EmptyState'
import LoadingState from '../../../../components/LoadingState'
import Pagination from '../../../../components/Pagination'
import Modal from '../../../../components/Modal'
import ConfirmModal from '../../../../components/ConfirmModal'
import { tableWrap, tbl, th, td, row, badge } from '../../../../styles/table'
import {
  getCuttingProposals,
  getCuttingProposal,
  retryCuttingProposal,
  type CuttingProposal,
  type CuttingProposalStatus,
} from '../../../../services/cutting-proposals-api'

const ACCENT = '#3949ab'

const STATUS_LABELS: Record<CuttingProposalStatus, { label: string; bg: string; color: string }> = {
  CALCULATING: { label: 'Đang tính', bg: '#eceff1', color: '#546e7a' },
  DRAFT: { label: 'Chờ duyệt', bg: '#fff3e0', color: '#e65100' },
  FAILED: { label: 'Lỗi', bg: '#ffebee', color: '#c62828' },
  APPROVED: { label: 'Đã duyệt', bg: '#e8f5e9', color: '#2e7d32' },
  SUPERSEDED: { label: 'Đã thay thế', bg: '#eceff1', color: '#78909c' },
}

const ALL_KEY = '__all__'
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '—')
const fmtPct = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

export default function CuttingProposalsPage() {
  const { data, isLoading, refetch } = useFetch(() => getCuttingProposals(), [])
  const items = useMemo(() => data ?? [], [data])

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>(ALL_KEY)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CuttingProposal | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [retryTarget, setRetryTarget] = useState<CuttingProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const filterOptions = [
    { key: ALL_KEY, label: 'Tất cả' },
    ...(Object.entries(STATUS_LABELS) as [CuttingProposalStatus, (typeof STATUS_LABELS)[CuttingProposalStatus]][])
      .map(([key, s]) => ({ key, label: s.label, color: s.color, bg: s.bg })),
  ]
  const countFor = (key: string) =>
    key === ALL_KEY ? items.length : items.filter(p => p.status === key).length

  const filtered = useMemo(() => {
    let list = items
    if (activeFilter !== ALL_KEY) list = list.filter(p => p.status === activeFilter)
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('vi')
      list = list.filter(p =>
        p.poNumber.toLocaleLowerCase('vi').includes(q) ||
        p.mfgProductCode.toLocaleLowerCase('vi').includes(q) ||
        (p.mfgProductName ?? '').toLocaleLowerCase('vi').includes(q),
      )
    }
    return list
  }, [items, activeFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openDetail = async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    try {
      setDetail(await getCuttingProposal(id))
    } finally {
      setDetailLoading(false)
    }
  }

  const doRetry = async () => {
    if (!retryTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await retryCuttingProposal(retryTarget.productionOrderId)
      setRetryTarget(null)
      refetch()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Lỗi tính lại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <Scissors size={16} color={ACCENT} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Cắt sắt</h3>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>({filtered.length})</span>
        </div>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Tìm theo mã PO hoặc SKU..." />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        <Info size={13} />
        Phase 7 (cắt sắt) chưa có màn nghiệp vụ riêng — &quot;Tính lại&quot; tạm thời đặt ở đây (chỉ dùng khi tính lỗi).
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterPills options={filterOptions} active={activeFilter} onChange={k => { setActiveFilter(k); setPage(1) }} countFor={countFor} />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Scissors size={16} color={ACCENT} />} message="Chưa có đề xuất cắt sắt nào" />
      ) : (
        <div style={tableWrap}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>Mã PO</th>
                  <th style={th}>SKU / Sản phẩm</th>
                  <th style={th}>Trạng thái</th>
                  <th style={{ ...th, textAlign: 'right' }}>Tổng số cây</th>
                  <th style={{ ...th, textAlign: 'right' }}>Hao hụt %</th>
                  <th style={th}>Ngày yêu cầu</th>
                  <th style={th}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(p => {
                  const s = STATUS_LABELS[p.status]
                  const canRetry = p.status === 'FAILED'
                  return (
                    <tr key={p.id} style={row} onClick={() => void openDetail(p.id)}>
                      <td style={td}>{p.poNumber}</td>
                      <td style={td}>{p.mfgProductName ? `${p.mfgProductCode} — ${p.mfgProductName}` : p.mfgProductCode}</td>
                      <td style={td}>
                        <span style={{ ...badge, background: s.bg, color: s.color }}>{s.label}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{p.totalBarsAll ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmtPct(p.wastePercentage)}</td>
                      <td style={td}>{fmtDate(p.requestedAt)}</td>
                      <td style={td} onClick={e => e.stopPropagation()}>
                        {canRetry && (
                          <button
                            onClick={() => setRetryTarget(p)}
                            style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}
                          >
                            Tính lại
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
          </div>
        </div>
      )}

      {/* Modal chi tiết - liệt kê từng vật tư (khả thi/không, lý do) */}
      <Modal open={detailId !== null} onClose={() => { setDetailId(null); setDetail(null) }} maxWidth={640}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Chi tiết đề xuất cắt sắt</h3>
        {detail && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
            {detail.poNumber} — {detail.mfgProductCode}
          </div>
        )}
        {detailLoading ? (
          <LoadingState />
        ) : detail?.errorMessage ? (
          <div style={{ background: 'rgba(198,40,40,.08)', border: '1px solid rgba(198,40,40,.3)', borderRadius: 8, padding: '10px 12px', color: '#c62828', fontSize: 13 }}>
            {detail.errorMessage}
          </div>
        ) : detail?.lines && detail.lines.length > 0 ? (
          <div style={{ ...tableWrap, marginBottom: 0 }}>
            <table style={tbl}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>Vật tư</th>
                  <th style={th}>Khả thi</th>
                  <th style={{ ...th, textAlign: 'right' }}>Số cây</th>
                  <th style={{ ...th, textAlign: 'right' }}>Hao hụt %</th>
                  <th style={{ ...th, textAlign: 'right' }}>Chiều dài</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map(l => (
                  <tr key={l.materialId} style={row}>
                    <td style={td}>{l.materialCode} — {l.materialName}</td>
                    <td style={td}>
                      <span style={{ ...badge, background: l.feasible ? '#e8f5e9' : '#ffebee', color: l.feasible ? '#2e7d32' : '#c62828' }}>
                        {l.feasible ? 'Khả thi' : 'Không khả thi'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.totalBars ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtPct(l.wastePercentage)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.bestStockLengthMm ? `${l.bestStockLengthMm}mm` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Chưa có dữ liệu (đang tính).</div>
        )}
      </Modal>

      <ConfirmModal
        open={retryTarget !== null}
        title="Tính lại phương án cắt"
        message={`Gọi lại solver cho ${retryTarget?.poNumber ?? ''} — kết quả cũ (nếu có) sẽ được thay thế bằng phương án mới.`}
        confirmLabel="Tính lại"
        busy={busy}
        error={actionError}
        onConfirm={() => void doRetry()}
        onCancel={() => { setRetryTarget(null); setActionError(null) }}
      />
    </div>
  )
}
