import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { focusAttr } from '../../../utils/notificationLink'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { tableWrap, tableScrollBox, stickyHeaderRow, emptyBox } from '../../../styles/table'
import {
  getMilestoneBoard,
  type MilestoneBoard,
  type MilestoneCell,
  type MilestoneRow,
  type MilestoneStatus,
} from '../../../services/milestone-board-api'

// "Bảng mốc" (2026-10-29, changelog BE 2026-09-25 mục 32.24): mỗi dòng SKU đang chạy × 9 mốc, tô màu theo trạng thái BE tính
// so với hạn ĐÃ LƯU. Ở trong trang "Tổng hợp lệnh SX" (?view=moc - link tin sáng/cảnh báo hạn giao mở thẳng vào đây).

// `border`: 2 trạng thái không có nền màu - "Chưa biết" (nguồn tiến độ lỗi) viền vàng đứt cho khỏi lẫn với "Chưa đặt hạn".
const STATUS_META: Record<MilestoneStatus, { label: string; color: string; bg: string; border?: string }> = {
  LATE: { label: 'Trễ', color: 'var(--red)', bg: 'var(--red-bg)' },
  DUE_SOON: { label: 'Sắp tới hạn', color: 'var(--amber)', bg: 'var(--amber-bg)' },
  ON_TRACK: { label: 'Đúng hạn', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  DONE: { label: 'Xong', color: 'var(--green)', bg: 'var(--green-bg)' },
  NO_DEADLINE: { label: 'Chưa đặt hạn', color: 'var(--text3)', bg: 'var(--surface2)' },
  UNKNOWN: { label: 'Chưa biết', color: 'var(--text2)', bg: 'transparent', border: '1px dashed var(--amber)' },
  NA: { label: 'Không cần', color: 'var(--text3)', bg: 'transparent', border: '1px dashed var(--border)' },
}
const LEGEND: MilestoneStatus[] = ['LATE', 'DUE_SOON', 'ON_TRACK', 'DONE', 'NO_DEADLINE', 'UNKNOWN', 'NA']
const ATTENTION = new Set<MilestoneStatus>(['LATE', 'DUE_SOON'])

const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const ddmmyyyy = (day: string) => `${ddmm(day)}/${day.slice(0, 4)}`

function cellText(c: MilestoneCell): string {
  switch (c.status) {
    case 'LATE': return `Trễ ${-(c.daysLeft ?? 0)} ngày`
    case 'DUE_SOON': return c.daysLeft === 0 ? 'Hôm nay' : `Còn ${c.daysLeft} ngày`
    case 'ON_TRACK': return `Còn ${c.daysLeft} ngày`
    // Hạn giao "xong" chỉ nghĩa là đã đóng gói đủ - app chưa theo dõi việc giao.
    case 'DONE': return c.key === 'HAN_GIAO' ? 'Đã đóng đủ' : 'Xong'
    case 'NO_DEADLINE': return 'Chưa đặt hạn'
    case 'UNKNOWN': return 'Chưa biết'
    case 'NA': return '—'
  }
}

/** Động từ cho % của từng mốc: mua hàng là hàng đã về, Đan là đã nhận về (Q2, 32.27), đóng gói là đã đóng. */
function percentVerb(c: MilestoneCell): string {
  if (c.key === 'MUA_VT_KHUNG' || c.key === 'MUA_VT_CON_LAI') return 'đã về'
  if (c.key === 'DAN') return 'đã nhận về'
  if (c.key === 'DONG_GOI' || c.key === 'HAN_GIAO') return 'đã đóng'
  return 'đã làm'
}

/** Chữ khi rê chuột: trạng thái, hạn, % và lý do (vật tư chưa về đủ / số đã làm). Lý do đã có % thì không lặp lại. */
function cellTitle(c: MilestoneCell): string {
  const parts = [`${c.label}: ${c.status === 'DONE' ? cellText(c) : STATUS_META[c.status].label}`]
  if (c.deadline && c.status !== 'NA') parts.push(`hạn ${ddmmyyyy(c.deadline)}`)
  if (c.status !== 'DONE' && c.status !== 'NA' && c.percent > 0 && !c.reason?.includes(`${c.percent}%`)) {
    parts.push(`${percentVerb(c)} ${c.percent}%`)
  }
  return parts.join(' · ') + (c.reason ? `\n${c.reason}` : '')
}

function StatusCell({ cell }: { cell: MilestoneCell }) {
  const meta = STATUS_META[cell.status]
  const showPct = cell.status !== 'DONE' && cell.status !== 'NA' && cell.status !== 'UNKNOWN' && cell.percent > 0
  // Mốc "Không cần" có ngày lưu sẵn cũng không hiện - ngày đó không có ý nghĩa gì.
  const showDate = !!cell.deadline && cell.status !== 'NA'
  return (
    <div title={cellTitle(cell)} style={{ background: meta.bg, color: meta.color, border: meta.border ?? 'none', borderRadius: 6, padding: '4px 6px', textAlign: 'center', lineHeight: 1.25, cursor: 'help' }}>
      <div style={{ fontSize: 12, fontWeight: ATTENTION.has(cell.status) ? 700 : 600, whiteSpace: 'nowrap' }}>{cellText(cell)}</div>
      {(showDate || showPct) && (
        <div style={{ fontSize: 10.5, opacity: 0.85, whiteSpace: 'nowrap' }}>
          {showDate ? ddmm(cell.deadline!) : ''}{showDate && showPct ? ' · ' : ''}{showPct ? `${cell.percent}%` : ''}
        </div>
      )}
    </div>
  )
}

function Chip({ status, children }: { status: MilestoneStatus; children: ReactNode }) {
  const meta = STATUS_META[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: meta.bg, color: meta.color, border: meta.border ?? 'none', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export default function MilestoneBoardView({ viewSwitch }: { viewSwitch: ReactNode }) {
  const isMobile = useIsMobile()
  // useFetch chỉ báo isLoading ở lần đầu - "Tải lại" tự giữ cờ, tắt khi chính lần gọi đó xong (thành công hay lỗi). Cách so bảng /
  // lỗi cũ trước đây kẹt "Đang tải…" khi 2 lần lỗi liền ra cùng 1 câu lỗi (review 32.27).
  const [reloading, setReloading] = useState(false)
  const { data, isLoading, error, refetch } = useFetch<MilestoneBoard>(
    () => getMilestoneBoard().finally(() => setReloading(false)),
    [],
  )
  // Tiến độ đổi ở nhiều phòng (mua hàng, xưởng, KCS, kho đan) - tải lại ngầm, gom 5 giây 1 lần vì mỗi lần BE tính lại cả bảng.
  // Bảng chỉ để xem, không có ô nhập nào bị đè khi tải lại.
  // 'floor' = công nhân báo sản lượng bằng QR tại máy (không đi qua 'production-batches'). Đóng gói không phát realtime - bấm Tải lại.
  useRealtimeRefetch(
    ['production-orders', 'production-invoices', 'purchase-proposals', 'steel-issues', 'production-batches', 'qc-reviews', 'weaving-issues', 'floor'],
    () => { void refetch() },
    { debounceMs: 5000 },
  )
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [search, setSearch] = useState('')
  const reload = () => {
    setReloading(true)
    void refetch()
  }

  const rows = useMemo(() => data?.rows ?? [], [data])
  const counts = useMemo(() => {
    const cells = rows.flatMap(r => r.milestones)
    return {
      late: cells.filter(c => c.status === 'LATE').length,
      dueSoon: cells.filter(c => c.status === 'DUE_SOON').length,
      attentionRows: rows.filter(r => ATTENTION.has(r.worst)).length,
    }
  }, [rows])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (!onlyAttention || ATTENTION.has(r.worst)) &&
      (!q || `${r.piCode} ${r.skuCode} ${r.skuName ?? ''}`.toLowerCase().includes(q)))
  }, [rows, onlyAttention, search])
  const columns = rows[0]?.milestones.map(m => ({ key: m.key, label: m.label })) ?? []

  const header = (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ ...pageTitle, margin: 0 }}>Tổng hợp lệnh SX</h2>
        {viewSwitch}
      </div>
      <p style={{ ...pageSubtitle, margin: '2px 0 0' }}>
        {/* Chưa có bảng (đang tải / tải lỗi) thì chưa biết số SKU - không ghi "0 SKU" (test thật 32.27). */}
        {data ? `${rows.length} SKU đang chạy` : isLoading ? 'Đang tải bảng mốc…' : 'Chưa tải được bảng mốc'}
        {counts.late > 0 && <span style={{ color: 'var(--red)', fontWeight: 700 }}> · {counts.late} mốc trễ</span>}
        {counts.dueSoon > 0 && <span style={{ color: 'var(--amber)', fontWeight: 700 }}> · {counts.dueSoon} mốc sắp tới hạn</span>}
        {data && <> · cập nhật lúc {new Date(data.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</>}
      </p>
    </div>
  )

  if (isLoading && !data) return <div>{header}<LoadingState /></div>
  if (error && !data) return <div>{header}<LoadErrorState error={error} onRetry={refetch} /></div>

  const pill = (active: boolean): CSSProperties => ({
    padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-1d4ed8)' : 'var(--surface2)', color: active ? '#fff' : 'var(--text)',
  })

  return (
    <div>
      {header}
      {error && (
        // Đã có bảng từ lần trước mà lần tải lại lỗi: báo rõ đang xem số cũ, không im lặng (review 32.26).
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--red-bg)', color: 'var(--red)', fontSize: 12.5 }}>
          Không tải lại được bảng - đang hiện số lúc {new Date(data!.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Bấm Tải lại để thử lại.
        </div>
      )}
      {data && data.failedSources.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: 12.5 }}>
          Không tải được một phần tiến độ ({data.failedSources.join(', ')}) - các mốc liên quan hiện &quot;Chưa biết&quot;. Bấm Tải lại để thử lại.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setOnlyAttention(false)} style={pill(!onlyAttention)}>Tất cả <span style={{ opacity: 0.75 }}>({rows.length})</span></button>
          <button onClick={() => setOnlyAttention(true)} style={pill(onlyAttention)}>Cần chú ý <span style={{ opacity: 0.75 }}>({counts.attentionRows})</span></button>
          <button onClick={reload} disabled={reloading} title="Tải lại" style={{ ...pill(false), display: 'inline-flex', alignItems: 'center', gap: 5, cursor: reloading ? 'wait' : 'pointer', opacity: reloading ? 0.7 : 1 }}>
            <RefreshCw size={12} /> {reloading ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : 260 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã PI, SKU..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>
        {LEGEND.map(s => <Chip key={s} status={s}>{STATUS_META[s].label}</Chip>)}
        <span>
          · Sắp tới hạn = còn ≤ 2 ngày. Hạn theo ngày đã lưu (&quot;Sửa thời hạn&quot;); 2 mốc mua vật tư chưa lưu thì theo hạn Khung / Đóng gói rồi hạn PI, Hạn giao chưa lưu thì theo hạn PI.
          {isMobile ? '' : ' Rê chuột vào ô để xem lý do.'}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={emptyBox}>Chưa có SKU nào đang chạy (đã Sếp duyệt, chưa Kết thúc).</div>
      ) : shown.length === 0 ? (
        <div style={emptyBox}>Không có SKU nào khớp bộ lọc.</div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(r => <MobileCard key={r.itemId} row={r} />)}
        </div>
      ) : (
        <div style={{ ...tableWrap, ...tableScrollBox }}>
          <table style={{ width: '100%', minWidth: 170 + columns.length * 92, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={stickyHeaderRow}>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', minWidth: 170 }}>PI · SKU</th>
                {columns.map(c => (
                  <th key={c.key} style={{ padding: '9px 4px', textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', width: 92 }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                // Cảnh báo "nguy cơ trễ hạn giao" (entity PRODUCTION_INVOICE_ITEM) mở vào đây thì nháy đúng dòng SKU.
                <tr key={r.itemId} {...focusAttr('PRODUCTION_INVOICE_ITEM', r.itemId)} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--fg-1d4ed8)' }}>{r.piCode}</div>
                    <div style={{ fontWeight: 600 }}>{r.skuCode}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                      ×{r.quantity.toLocaleString('vi-VN')}{r.floorStage === 'PENDING' ? ' · chưa bắt đầu' : r.floorStage === 'PAUSED' ? ' · tạm dừng' : ''}
                    </div>
                  </td>
                  {r.milestones.map(c => (
                    <td key={c.key} style={{ padding: '6px 4px', verticalAlign: 'middle' }}><StatusCell cell={c} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Điện thoại: 9 cột không vừa - mỗi SKU 1 thẻ, chỉ liệt kê mốc còn việc có hạn. Mốc xong/không cần và mốc chưa đặt hạn gộp
// thành 1 dòng mỗi loại (test thật 32.27: liệt kê cả mốc chưa đặt hạn kèm lý do làm thẻ rất cao).
function MobileCard({ row }: { row: MilestoneRow }) {
  const open = row.milestones.filter(m => m.status !== 'DONE' && m.status !== 'NA' && m.status !== 'NO_DEADLINE')
  const noDeadline = row.milestones.filter(m => m.status === 'NO_DEADLINE')
  const doneCount = row.milestones.filter(m => m.status === 'DONE').length
  const floorNote = row.floorStage === 'PENDING' ? 'chưa bắt đầu' : row.floorStage === 'PAUSED' ? 'tạm dừng' : null
  return (
    <div {...focusAttr('PRODUCTION_INVOICE_ITEM', row.itemId)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--fg-1d4ed8)' }}>{row.piCode}</div>
          <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>
            {row.skuCode} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>×{row.quantity.toLocaleString('vi-VN')}{floorNote ? ` · ${floorNote}` : ''}</span>
          </div>
        </div>
        <Chip status={row.worst}>{STATUS_META[row.worst].label}</Chip>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {open.map(c => (
          <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <span style={{ minWidth: 0 }}>
              {c.label}
              {c.reason && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', wordBreak: 'break-word' }}>{c.reason}</span>}
            </span>
            <Chip status={c.status}>{cellText(c)}{c.deadline ? ` · ${ddmm(c.deadline)}` : ''}</Chip>
          </div>
        ))}
        {noDeadline.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa đặt hạn: {noDeadline.map(m => m.label).join(', ')}.</div>
        )}
        {doneCount > 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{doneCount} mốc đã xong{open.length + noDeadline.length === 0 ? ', còn lại không cần' : ''}.</div>}
      </div>
    </div>
  )
}
