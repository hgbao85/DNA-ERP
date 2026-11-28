'use client'
import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, MessageSquarePlus, Package, Phone, Rows3 } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import { getWeavingBoard, type WeavingBoardRow } from '../../../services/weaving-coordination-api'
import FilterPills from '../../../components/FilterPills'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import RefreshButton from '../../../components/RefreshButton'
import SearchInput from '../../../components/SearchInput'
import { pageSubtitle, pageTitle } from '../../../styles/typography'
import { badge, compactTd, compactTh, emptyBox, stickyHeaderRow, tableScrollBox, tableWrap } from '../../../styles/table'
import { focusAttr } from '../../../utils/notificationLink'
import FollowUpModal from './FollowUpModal'
import {
  STATUS_FILTERS,
  STATUS_META,
  type StatusFilter,
  countByStatus,
  dueHint,
  filterRows,
  fmtDay,
  lenhLabel,
  promiseLine,
} from './dieuPhoiDanModel'

/**
 * Đ1 - Bảng theo dõi điểm đan (chỉ xem): mỗi điểm đan × lệnh × mảnh - đã gửi (phiếu xuất đan đã xác nhận), đã trả (kho Thành phẩm
 * nhập đan), còn giữ, hạn trả (mốc "Nhập đan" của lệnh), trạng thái + lời hẹn mới nhất ngay dưới. Ô tổng: mảnh đang ở ngoài, số dòng
 * trễ, số hẹn hôm nay. Bấm 1 dòng mở ghi chú làm việc (Đ2). `canWrite` = Điều phối đan / Admin (người khác chỉ xem lịch sử).
 * Lọc điểm đan lưu ở query `point` (thông báo nhắc hẹn trỏ thẳng vào đây).
 */
export default function TheoDoiDiemDanPage({ canWrite }: { canWrite: boolean }) {
  const isCompact = useIsCompact()
  const [pointParam, setPointParam] = useUrlState('point')
  const [status, setStatus] = useState<StatusFilter>('OPEN')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<WeavingBoardRow | null>(null)
  const showDone = status === 'DONE'
  const { data, isLoading, error, refetch } = useFetch(
    () => getWeavingBoard(showDone ? { status: 'DONE' } : {}),
    [showDone],
  )

  const points = useMemo(() => data?.points ?? [], [data])
  const pointId = pointParam && points.some((p) => p.id === pointParam) ? pointParam : null
  const rows = useMemo(
    () => filterRows(data?.rows ?? [], { pointId, status, search }),
    [data, pointId, status, search],
  )
  const counts = useMemo(() => (showDone ? {} : countByStatus(data?.rows ?? [], pointId)), [data, pointId, showDone])

  if (isLoading) return <LoadingState />
  if (error || !data) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />
  const today = data.today
  const point = pointId ? points.find((p) => p.id === pointId) : null

  const tiles = [
    { label: 'Mảnh đang ở điểm đan', value: data.tiles.piecesOut, sub: `${data.tiles.openRows} dòng còn giữ`, icon: <Package size={18} />, color: 'var(--blue)', bg: 'var(--blue-bg)' },
    { label: 'Dòng trễ hạn', value: data.tiles.overdueRows, sub: 'quá mốc Nhập đan', icon: <AlertTriangle size={18} />, color: 'var(--red)', bg: 'var(--red-bg)' },
    { label: 'Hẹn trả hôm nay', value: data.tiles.promisesDueToday, sub: fmtDay(today), icon: <CalendarClock size={18} />, color: 'var(--amber)', bg: 'var(--amber-bg)' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <div>
          <h2 style={{ ...pageTitle, margin: 0 }}>Theo dõi điểm đan</h2>
          <div style={pageSubtitle}>Số đã gửi / đã trả lấy từ phiếu xuất đan và nhập đan - màn này chỉ xem, ghi chú bấm vào từng dòng.</div>
        </div>
        <RefreshButton onRefresh={refetch} />
      </div>

      {/* Ô tổng (mọi điểm đan) */}
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 'var(--space-5)' }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.color, flexShrink: 0 }}>{t.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: t.value > 0 ? t.color : 'var(--text)', lineHeight: 1.2 }}>{t.value.toLocaleString('vi-VN')}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bộ lọc */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select
          aria-label="Điểm đan"
          value={pointId ?? ''}
          onChange={(e) => setPointParam(e.target.value || null)}
          style={{ padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', minWidth: 200 }}
        >
          <option value="">Tất cả điểm đan</option>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.held > 0 ? ` - đang giữ ${p.held}` : ''}{p.lateRows > 0 ? ` (${p.lateRows} trễ)` : ''}{p.isActive ? '' : ' - ngừng'}
            </option>
          ))}
        </select>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm lệnh, PO, mảnh..." width={240} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <FilterPills
          options={STATUS_FILTERS.map((f) => (f.key === 'OPEN' ? f : { ...f, color: STATUS_META[f.key].color, bg: STATUS_META[f.key].bg }))}
          active={status}
          onChange={setStatus}
          countFor={showDone ? undefined : (k) => counts[k] ?? 0}
        />
      </div>

      {point && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
          <strong style={{ color: 'var(--text)' }}>{point.name}</strong>
          {point.contactPerson && <span>Liên hệ: {point.contactPerson}</span>}
          {point.phone && (
            <a href={`tel:${point.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--blue)', textDecoration: 'none' }}>
              <Phone size={13} />{point.phone}
            </a>
          )}
          <span>Đang giữ: <strong style={{ color: 'var(--text)' }}>{point.held}</strong></span>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={emptyBox}>
          {showDone ? 'Chưa có dòng nào đã trả đủ.' : (data.rows.length === 0 ? 'Không điểm đan nào đang giữ mảnh.' : 'Không có dòng nào khớp bộ lọc.')}
        </div>
      ) : (
        <div style={tableWrap}>
          <div style={tableScrollBox}>
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={stickyHeaderRow}>
                  <th style={{ ...compactTh, textAlign: 'left' }}>Điểm đan</th>
                  <th style={{ ...compactTh, textAlign: 'left' }}>Lệnh / PO</th>
                  <th style={{ ...compactTh, textAlign: 'left' }}>Mảnh</th>
                  <th style={{ ...compactTh, textAlign: 'right' }}>Đã gửi</th>
                  <th style={{ ...compactTh, textAlign: 'right' }}>Đã trả</th>
                  <th style={{ ...compactTh, textAlign: 'right' }}>Còn giữ</th>
                  <th style={{ ...compactTh, textAlign: 'left' }}>Hạn trả</th>
                  <th style={{ ...compactTh, textAlign: 'left', width: 250 }}>Trạng thái / lời hẹn</th>
                  <th style={{ ...compactTh, width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status]
                  const promise = promiseLine(r.latestPromise, today)
                  const hint = dueHint(r)
                  return (
                    <tr
                      key={r.key}
                      {...focusAttr('WEAVING_FOLLOW_UP', r.latestPromise?.followUpId)}
                      onClick={() => setSelected(r)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <td style={compactTd}>
                        <div style={{ fontWeight: 600 }}>{r.weavingPointName}</div>
                        {r.weavingPointName !== r.weavingPointCode && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.weavingPointCode}</div>}
                      </td>
                      <td style={compactTd}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {lenhLabel(r)}
                          {/* Câu 17 (chốt 25/11/2026): lệnh đã huỷ chỉ còn hiện khi điểm đan còn giữ hàng - cần đòi về. */}
                          {r.cancelled && (
                            <span title='Lệnh đã huỷ - điểm đan còn giữ hàng, cần đòi về' style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'var(--red-bg)', color: 'var(--red)' }}>Đã huỷ</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.salesOrderCode ?? r.poNumber}{r.productName ? ` · ${r.productName}` : ''}</div>
                      </td>
                      <td style={compactTd}>
                        <div>{r.pieceName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.pieceCode}</div>
                      </td>
                      <td style={{ ...compactTd, textAlign: 'right' }}>{r.sent}</td>
                      <td style={{ ...compactTd, textAlign: 'right', color: 'var(--green)' }}>{r.returned}</td>
                      <td style={{ ...compactTd, textAlign: 'right', fontWeight: 700, color: r.held > 0 ? 'var(--fg-e65100)' : 'var(--text3)' }}>{r.held}</td>
                      <td style={compactTd}>
                        <div style={{ whiteSpace: 'nowrap' }}>{fmtDay(r.dueDate)}</div>
                        {hint && <div style={{ fontSize: 11, color: r.status === 'LATE' ? 'var(--red)' : 'var(--text3)' }}>{hint}</div>}
                      </td>
                      <td style={compactTd}>
                        <span style={{ ...badge, background: meta.bg, color: meta.color }}>{meta.label}</span>
                        {promise && (
                          <div style={{ fontSize: 11, marginTop: 4, color: promise.tone === 'warn' ? 'var(--red)' : promise.tone === 'ok' ? 'var(--green)' : 'var(--text2)' }}>
                            {promise.text}
                          </div>
                        )}
                      </td>
                      <td style={{ ...compactTd, textAlign: 'center' }} title={canWrite ? 'Ghi chú / hẹn trả' : 'Xem ghi chú'}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--text3)', fontSize: 11 }}>
                          {canWrite ? <MessageSquarePlus size={15} /> : <Rows3 size={15} />}
                          {r.followUpCount > 0 && r.followUpCount}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <FollowUpModal
          row={selected}
          today={today}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  )
}
