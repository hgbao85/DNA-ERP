'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Scissors, Info, ChevronDown, ChevronRight, X, Loader2, AlertTriangle } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import SearchInput from '../../../../components/SearchInput'
import FilterPills from '../../../../components/FilterPills'
import EmptyState from '../../../../components/EmptyState'
import LoadingState from '../../../../components/LoadingState'
import Pagination from '../../../../components/Pagination'
import ConfirmModal from '../../../../components/ConfirmModal'
import { tableWrap, tbl, th, td, row, badge } from '../../../../styles/table'
import { buildCuttingGuideTable, exportCuttingGuideExcel, printCuttingGuide } from '../../../../utils/cuttingGuide'
import PrintExportButton from '../../../../components/PrintExportButton'
import {
  getCuttingProposals,
  getCuttingProposal,
  retryCuttingProposal,
  retryCuttingProposalForInvoice,
  type CuttingProposal,
  type CuttingProposalDisplayStatus,
} from '../../../../services/cutting-proposals-api'

const ACCENT = '#3949ab'

/** 3 nhãn rút gọn (2026-08-19, xem BE CuttingProposalDisplayStatus) - SUPERSEDED không nằm trong
 *  danh sách lọc, bị ẩn khỏi `items` mặc định (bản cũ đã bị "Tính lại" thay thế, không ai cần
 *  xem lại trừ khi audit trực tiếp qua DB). */
const DISPLAY_LABELS: Record<Exclude<CuttingProposalDisplayStatus, 'SUPERSEDED'>, { label: string; bg: string; color: string }> = {
  CALCULATING: { label: 'Đang tính', bg: '#eceff1', color: '#546e7a' },
  OK: { label: 'Đạt', bg: '#e8f5e9', color: '#2e7d32' },
  NEEDS_ACTION: { label: 'Cần xử lý', bg: '#ffebee', color: '#c62828' },
}

const ALL_KEY = '__all__'
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '—')
const fmtPct = (n: number | null) => (n == null ? '—' : `${n.toFixed(2)}%`)

/** "Đang tính... (đã chạy X phút)" - thời gian solve dao động rất lớn (đo thật: 4,7 -> hơn 15
 *  phút tuỳ vật tư). Tự đếm bằng interval riêng (không phụ thuộc refetch cha) để số luôn đúng dù
 *  danh sách có tự làm mới hay không - mirror LenhSXPage.tsx::CalculatingBadge. */
function CalculatingBadge({ requestedAt }: { requestedAt: string }) {
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(n => n + 1), 15000)
    return () => clearInterval(id)
  }, [])
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(requestedAt).getTime()) / 60000))
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#546e7a', background: '#eceff1', padding: '2px 8px', borderRadius: 10 }}>
      <Loader2 size={10} className="spin" /> Đang tính... (đã chạy {minutes} phút)
    </span>
  )
}

/** Gọi đúng route retry theo neo của phương án (1 lệnh SX riêng, hoặc cả PI gộp) - xem
 *  cutting-proposals-api.ts. Trước 2026-08-19 chỉ có nhánh productionOrderId, phương án neo PI
 *  gộp bấm "Tính lại" luôn lỗi vì route BE tương ứng chưa tồn tại. */
async function retryProposal(p: CuttingProposal): Promise<CuttingProposal> {
  if (p.productionOrderId) return retryCuttingProposal(p.productionOrderId)
  if (p.productionInvoiceId) return retryCuttingProposalForInvoice(p.productionInvoiceId)
  throw new Error('Phương án không neo vào lệnh sản xuất hay đợt gộp nào (dữ liệu hỏng)')
}

export default function CuttingProposalsPage() {
  const { data, isLoading, refetch } = useFetch(() => getCuttingProposals(), [])
  // SUPERSEDED ẩn mặc định - bản cũ đã bị "Tính lại" thay thế, xem DISPLAY_LABELS.
  const items = useMemo(() => (data ?? []).filter(p => p.displayStatus !== 'SUPERSEDED'), [data])

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>(ALL_KEY)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CuttingProposal | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set())

  const [retryTarget, setRetryTarget] = useState<CuttingProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Poll có điều kiện: chỉ khi còn dòng đang tính, tự tắt ngay khi hết - tránh request vô ích khi
  // màn hình đứng yên. Mirror LenhSXPage.tsx (đã chạy ổn với cùng bài toán ở màn Lệnh SX).
  const hasCalculating = items.some(p => p.displayStatus === 'CALCULATING')
  useEffect(() => {
    if (!hasCalculating) return
    const id = setInterval(refetch, 20000)
    return () => clearInterval(id)
  }, [hasCalculating, refetch])

  const filterOptions = [
    { key: ALL_KEY, label: 'Tất cả' },
    ...(Object.entries(DISPLAY_LABELS) as [CuttingProposalDisplayStatus, (typeof DISPLAY_LABELS)[keyof typeof DISPLAY_LABELS]][])
      .map(([key, s]) => ({ key, label: s.label, color: s.color, bg: s.bg })),
  ]
  const countFor = (key: string) =>
    key === ALL_KEY ? items.length : items.filter(p => p.displayStatus === key).length

  const filtered = useMemo(() => {
    let list = items
    if (activeFilter !== ALL_KEY) list = list.filter(p => p.displayStatus === activeFilter)
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('vi')
      list = list.filter(p =>
        (p.salesOrderCode ?? '').toLocaleLowerCase('vi').includes(q) ||
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
    setExpandedLines(new Set())
    try {
      setDetail(await getCuttingProposal(id))
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleLine = (materialId: string) => {
    setExpandedLines(prev => {
      const next = new Set(prev)
      if (next.has(materialId)) next.delete(materialId)
      else next.add(materialId)
      return next
    })
  }

  const doRetry = async () => {
    if (!retryTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await retryProposal(retryTarget)
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
        Phase 7 (cắt sắt) chưa có màn nghiệp vụ riêng — &quot;Tính lại&quot; tạm thời đặt ở đây (chỉ dùng khi cần xử lý).
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
                  const s = DISPLAY_LABELS[p.displayStatus as Exclude<CuttingProposalDisplayStatus, 'SUPERSEDED'>]
                  const canRetry = p.displayStatus === 'NEEDS_ACTION'
                  return (
                    <tr key={p.id} style={row} onClick={() => void openDetail(p.id)}>
                      <td style={td}>{p.salesOrderCode ?? '—'}</td>
                      <td style={td}>{p.mfgProductName ? `${p.mfgProductCode} — ${p.mfgProductName}` : p.mfgProductCode}</td>
                      <td style={td}>
                        {p.displayStatus === 'CALCULATING' ? (
                          <CalculatingBadge requestedAt={p.requestedAt} />
                        ) : (
                          <div>
                            <span style={{ ...badge, background: s.bg, color: s.color }}>{s.label}</span>
                            {p.displayStatus === 'NEEDS_ACTION' && p.displayReason && (
                              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, maxWidth: 260 }}>{p.displayReason}</div>
                            )}
                          </div>
                        )}
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

      {/* Side panel chi tiết (thay modal giữa màn hình) - danh sách vẫn thấy được bên trái,
          liệt kê từng vật tư (khả thi/không, lý do), mở rộng xem bảng hướng dẫn cắt. */}
      {detailId !== null && (
        <div
          onClick={() => { setDetailId(null); setDetail(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(720px, 92vw)',
              background: 'var(--surface)', boxShadow: '-8px 0 32px rgba(0,0,0,.18)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 12px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Chi tiết đề xuất cắt sắt</h3>
                {detail && (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {detail.salesOrderCode ?? '—'} — {detail.mfgProductCode}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {detail?.displayStatus === 'NEEDS_ACTION' && (
                  <button
                    onClick={() => setRetryTarget(detail)}
                    style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}
                  >
                    Tính lại
                  </button>
                )}
                <button
                  onClick={() => { setDetailId(null); setDetail(null) }}
                  aria-label="Đóng"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--text3)' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {detailLoading ? (
          <LoadingState />
        ) : detail?.displayStatus === 'NEEDS_ACTION' && detail.displayReason ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(198,40,40,.08)', border: '1px solid rgba(198,40,40,.3)', borderRadius: 8, padding: '10px 12px', color: '#c62828', fontSize: 13, marginBottom: 16 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{detail.displayReason}</span>
          </div>
        ) : null}
        {detail?.lines && detail.lines.length > 0 ? (
          <div style={{ ...tableWrap, marginBottom: 0 }}>
            <table style={tbl}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}></th>
                  <th style={th}>Vật tư</th>
                  <th style={th}>Khả thi</th>
                  <th style={{ ...th, textAlign: 'right' }}>Số cây</th>
                  <th style={{ ...th, textAlign: 'right' }}>Hao hụt %</th>
                  <th style={{ ...th, textAlign: 'right' }}>Chiều dài</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map(l => {
                  const hasGuide = l.patterns && l.patterns.length > 0
                  const expanded = expandedLines.has(l.materialId)
                  const guide = expanded && hasGuide ? buildCuttingGuideTable(l) : null
                  return (
                    <Fragment key={l.materialId}>
                      <tr
                        style={{ ...row, cursor: hasGuide ? 'pointer' : 'default' }}
                        onClick={() => hasGuide && toggleLine(l.materialId)}
                      >
                        <td style={{ ...td, width: 24 }}>
                          {hasGuide && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        </td>
                        <td style={td}>
                          {l.materialCode} — {l.materialName}
                          {l.displayReason && (
                            <div style={{ fontSize: 11, color: '#c62828', marginTop: 4, maxWidth: 320 }}>{l.displayReason}</div>
                          )}
                        </td>
                        <td style={td}>
                          <span style={{ ...badge, background: l.feasible ? '#e8f5e9' : '#ffebee', color: l.feasible ? '#2e7d32' : '#c62828' }}>
                            {l.feasible ? 'Khả thi' : 'Không khả thi'}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{l.totalBars ?? '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtPct(l.wastePercentage)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{l.bestStockLengthMm ? `${l.bestStockLengthMm}mm` : '—'}</td>
                      </tr>
                      {guide && (
                        <tr>
                          <td colSpan={6} style={{ padding: '4px 12px 16px 32px', background: 'var(--surface2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                                Mẫu nguyên chưa cắt: {l.mauNguyenMm ?? 0}mm · Tổng khúc thừa (phế liệu): {l.totalWasteMm ?? 0}mm
                              </div>
                              {/* stopPropagation trên cả khối - PrintExportButton tự có menu con,
                                  click chọn Excel/PDF bên trong cũng không được để lọt lên tr.onClick
                                  (toggleLine) như nút rời trước đây đã chặn riêng từng cái. */}
                              <div onClick={e => e.stopPropagation()}>
                                <PrintExportButton
                                  label="In"
                                  color={ACCENT}
                                  onExcel={() => exportCuttingGuideExcel(detail.poNumber, l)}
                                  onPdf={() => printCuttingGuide(detail.poNumber, [l])}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {guide.rows.map(r => {
                                const isRemnant = !!r.mauNguyenMm && r.mauNguyenMm > 0
                                const chips = guide.columns
                                  .map((c, i) => ({ size: c, label: guide.columnLabels[i], count: r.counts[i] }))
                                  .filter(c => c.count > 0)
                                return (
                                  <div
                                    key={r.patternIndex}
                                    style={{
                                      border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                                      background: isRemnant ? '#fff8e1' : 'var(--surface)',
                                    }}
                                  >
                                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                                      Thanh <b>{l.bestStockLengthMm ?? '—'}mm</b> × <b>{r.barCount} cây</b>
                                      <span style={{ color: 'var(--text3)' }}> · hao hụt {r.wastePerBarMm ?? '—'}mm/cây</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {chips.map(c => (
                                        <span
                                          key={c.size}
                                          style={{ fontSize: 12, padding: '3px 9px', borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)' }}
                                        >
                                          {c.label} ×{c.count}
                                        </span>
                                      ))}
                                    </div>
                                    {isRemnant && (
                                      <div style={{ fontSize: 11, color: '#8d6e00', fontStyle: 'italic', marginTop: 6 }}>
                                        ↳ Cây này cắt dở — còn {r.mauNguyenMm}mm để nguyên, nhập kho (cắt được cỡ bất kỳ sau này)
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : !detailLoading && detail?.displayStatus !== 'NEEDS_ACTION' ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Chưa có dữ liệu (đang tính).</div>
        ) : null}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={retryTarget !== null}
        title="Tính lại phương án cắt"
        message={`Gọi lại solver cho ${retryTarget?.salesOrderCode ?? ''} — kết quả cũ (nếu có) sẽ được thay thế bằng phương án mới.`}
        confirmLabel="Tính lại"
        busy={busy}
        error={actionError}
        onConfirm={() => void doRetry()}
        onCancel={() => { setRetryTarget(null); setActionError(null) }}
      />
    </div>
  )
}
