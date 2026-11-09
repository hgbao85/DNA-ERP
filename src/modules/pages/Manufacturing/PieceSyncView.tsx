import { useCallback, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { tableWrap, tableScrollBox, stickyHeaderRow, emptyBox } from '../../../styles/table'
import { getPieceSyncBoard, type PieceSyncBoard, type PieceSyncRow } from '../../../services/piece-sync-board-api'
import { bottleneckLine, buildGroups, limitingText, pendingQcValue, stepsText, syncExplainText, type SyncFilter, type SyncGroup } from './pieceSyncModel'

// "Đồng bộ Phôi – Hàn" (2026-11-04, changelog BE 2026-10-08 mục 59): mỗi dòng = lệnh × mảnh, so số mảnh Phôi đã đồng bộ (ước tính)
// với số Hàn đã báo. Ở trang "Tổng hợp lệnh SX" (?view=dong-bo). Chỉ để theo dõi - không chặn Hàn.

const fmt = (n: number) => n.toLocaleString('vi-VN')
const NO_DATA = 'Mảnh chưa có định mức Phôi hoặc chưa tải được tiến độ Phôi'
const num = (n: number | null) => (n === null ? <span title={NO_DATA} style={{ color: 'var(--text3)' }}>—</span> : fmt(n))
const PENDING_QC_TIP = 'Số mảnh sẽ đồng bộ thêm khi KCS chấm đạt phần Phôi đã báo'
// Cột "Chưa qua KCS": 0 hiện mờ cho khỏi lẫn với số còn việc; null/BE cũ hiện "—".
const pendingQc = (n: number | null) => (n === 0 ? <span style={{ color: 'var(--text3)' }}>0</span> : num(n))

const FILTERS: { key: SyncFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PHOI_THIEU', label: 'Phôi chưa đủ' },
  { key: 'HAN_VUOT', label: 'Hàn vượt Phôi' },
  { key: 'CON_CHO_HAN', label: 'Còn phôi chờ hàn' },
]

const th: CSSProperties = { padding: '9px 10px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }
/** Tiêu đề bảng chính được xuống 2 dòng: 9 cột phải vừa khung ~750 px ở màn 1024 px (có thanh bên), khỏi cuộn ngang. */
const thWrap: CSSProperties = { ...th, whiteSpace: 'normal', verticalAlign: 'bottom', lineHeight: 1.3, minWidth: 64 }
const stickyCol: CSSProperties = { position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }

function Percent({ value }: { value: number | null }) {
  if (value === null) return num(null)
  return <span style={{ fontWeight: 700, color: value >= 100 ? 'var(--green)' : 'var(--amber)' }}>{fmt(value)}%</span>
}

function AheadTag() {
  return (
    <span title="Hàn đã báo nhiều hơn số Phôi đồng bộ ước tính" style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: 'var(--red-bg)', color: 'var(--red)', whiteSpace: 'nowrap' }}>
      Hàn vượt Phôi
    </span>
  )
}

/** Chi tiết sắt của 1 mảnh: bảng nhỏ (cuộn ngang trong khung riêng) + dòng sắt tự tính nếu có. */
function LinesDetail({ row }: { row: PieceSyncRow }) {
  const worst = bottleneckLine(row)
  return (
    <div style={{ padding: '8px 10px 12px' }}>
      {row.lines.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: 'var(--text2)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Loại sắt</th>
                <th style={th}>Dài (mm)</th>
                <th style={th}>Đoạn/mảnh</th>
                <th style={{ ...th, textAlign: 'left' }}>Công đoạn</th>
                <th style={th}>Đoạn đủ công đoạn (đạt)</th>
                <th style={th}>Làm được (mảnh)</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((l, i) => {
                const isWorst = l === worst
                return (
                  // 1 mảnh có thể có nhiều dòng cùng cỡ đoạn - khoá kèm chỉ số dòng, không chỉ theo cỡ.
                  <tr key={`${l.segmentSpecId}:${l.steps.join('>')}:${i}`} style={{ borderTop: '1px solid var(--border)', background: isWorst ? 'var(--red-bg)' : undefined, color: isWorst ? 'var(--red)' : undefined }}>
                    <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal' }}>{l.materialCode} · {l.materialName}{l.materialSpec ? ` (${l.materialSpec})` : ''}</td>
                    <td style={td}>{fmt(l.cutLengthMm)}</td>
                    <td style={td}>{fmt(l.qtyPerPiece)}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{stepsText(l.steps)}</td>
                    <td style={td}>{fmt(l.usableQty)}</td>
                    <td style={{ ...td, fontWeight: isWorst ? 700 : 400 }}>
                      {fmt(l.makeablePieces)}
                      {isWorst && <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>thiếu nhất{limitingText(l) && ` · ${limitingText(l)}`}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Mảnh này chưa có sắt cấu thành.</div>
      )}
      {row.selfCalcPieceQty !== null && (
        <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text2)' }}>Sắt tự tính (vd PAT): Phôi đã báo {fmt(row.selfCalcPieceQty)} mảnh</div>
      )}
    </div>
  )
}

function GroupHead({ g }: { g: SyncGroup }) {
  const s = g.summary
  return (
    <div style={{ lineHeight: 1.45 }}>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--fg-1d4ed8)' }}>{g.piCode}</span>
      <span style={{ fontWeight: 600 }}> · {g.skuCode}{g.skuName ? ` ${g.skuName}` : ''}</span>
      <span style={{ color: 'var(--text3)' }}> · {fmt(g.orderQuantity)} bộ</span>
      <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
        Phôi đủ bộ: <b>{s.phoiSets === null ? '—' : `${fmt(s.phoiSets)} bộ`}</b>
        {/* Đã đủ bộ thì không có gì "nghẽn" - chỉ ghi khi còn thiếu. */}
        {s.phoiBottleneckPieceName && s.phoiSets !== null && s.phoiSets < g.orderQuantity && <> (nghẽn: {s.phoiBottleneckPieceName})</>}
        {' · '}Hàn đủ bộ: <b>{s.hanSets === null ? '—' : `${fmt(s.hanSets)} bộ`}</b>
      </div>
    </div>
  )
}

export default function PieceSyncView({ viewSwitch }: { viewSwitch: ReactNode }) {
  const isMobile = useIsMobile()
  // Giống Bảng mốc: cờ "Tải lại" tắt khi chính lần gọi đó xong (thành công hay lỗi).
  const [reloading, setReloading] = useState(false)
  const { data, isLoading, error, refetch } = useFetch<PieceSyncBoard>(
    () => getPieceSyncBoard().finally(() => setReloading(false)),
    [],
  )
  // Hàn/Phôi báo sản lượng ở nhiều chỗ - tải lại ngầm, gom 5 giây 1 lần vì mỗi lần BE tính lại cả bảng. Bảng chỉ để xem.
  useRealtimeRefetch(
    ['production-orders', 'production-invoices', 'steel-issues', 'production-batches', 'qc-reviews', 'floor'],
    () => { void refetch() },
    { debounceMs: 5000 },
  )
  const [filter, setFilter] = useState<SyncFilter>('ALL')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  // Bề rộng NHÌN THẤY của khung bảng (bảng rộng hơn, cuộn ngang) - phần xổ chi tiết lấy đúng bề rộng này để các cột "Làm
  // được / nghẽn ở" không bị đẩy khuất bên phải.
  const [boxWidth, setBoxWidth] = useState<number | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    roRef.current = null
    if (!el) return
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth))
    ro.observe(el)
    roRef.current = ro
    setBoxWidth(el.clientWidth)
  }, [])
  const reload = () => {
    setReloading(true)
    void refetch()
  }
  const toggle = (key: string) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const rows = useMemo(() => data?.rows ?? [], [data])
  const groups = useMemo(() => buildGroups(rows, search, filter), [rows, search, filter])

  const header = (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ ...pageTitle, margin: 0 }}>Đồng bộ Phôi – Hàn</h2>
        {viewSwitch}
      </div>
      <p style={{ ...pageSubtitle, margin: '2px 0 0' }}>
        Số &quot;Phôi đã đồng bộ&quot; là ước tính. {syncExplainText()} Đoạn dùng chung nhiều mảnh thì hệ thống tự chia (đủ bộ trước). Chỉ để theo dõi, không chặn Hàn.
        {data && <> Cập nhật lúc {new Date(data.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.</>}
      </p>
    </div>
  )

  if (isLoading && !data) return <div>{header}<LoadingState /></div>
  if (error && !data) return <div>{header}<LoadErrorState error={error} onRetry={refetch} /></div>

  const pill = (active: boolean): CSSProperties => ({
    padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
    background: active ? 'var(--bg-1d4ed8)' : 'var(--surface2)', color: active ? '#fff' : 'var(--text)',
  })
  const banner = (bg: string, color: string): CSSProperties => ({ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: bg, color, fontSize: 12.5 })
  const rowKey = (r: PieceSyncRow) => `${r.productionOrderId}|${r.pieceId}`
  // BE trả id PI - đổi sang mã PI qua chính các dòng của bảng (PI nào cũng có dòng vì BE chỉ báo PI đang có trên bảng).
  const piCodeById = new Map(rows.map(r => [r.productionInvoiceId, r.piCode]))
  const unassigned = (data?.unassignedPhoiPiIds ?? []).map(id => piCodeById.get(id) ?? id)

  return (
    <div>
      {header}
      {error && data && (
        <div style={banner('var(--red-bg)', 'var(--red)')}>
          Không tải lại được bảng - đang hiện số lúc {new Date(data.generatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Bấm Tải lại để thử lại.
        </div>
      )}
      {data && data.failedSources.length > 0 && (
        <div style={banner('var(--amber-bg)', 'var(--amber)')}>
          Không tải được một phần tiến độ ({data.failedSources.join(', ')}) - các số liên quan có thể thiếu (hiện &quot;—&quot;). Bấm Tải lại để thử lại.
        </div>
      )}
      {unassigned.length > 0 && (
        <div style={banner('var(--surface2)', 'var(--text2)')}>
          Lệnh {unassigned.join(', ')} có đợt cắt cũ chưa gắn SKU, phần đó chưa tính.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => <button key={f.key} type="button" onClick={() => setFilter(f.key)} style={pill(filter === f.key)}>{f.label}</button>)}
          <button type="button" onClick={reload} disabled={reloading} title="Tải lại" style={{ ...pill(false), display: 'inline-flex', alignItems: 'center', gap: 5, cursor: reloading ? 'wait' : 'pointer', opacity: reloading ? 0.7 : 1 }}>
            <RefreshCw size={12} /> {reloading ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã PI, SKU, mảnh..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={emptyBox}>Chưa có lệnh nào đang chạy để so Phôi với Hàn.</div>
      ) : groups.length === 0 ? (
        <div style={emptyBox}>Không có mảnh nào khớp bộ lọc.</div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(g => (
            <div key={g.key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <GroupHead g={g} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {g.rows.map(r => <MobilePiece key={rowKey(r)} row={r} expanded={open.has(rowKey(r))} onToggle={() => toggle(rowKey(r))} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div ref={boxRef} style={{ ...tableWrap, ...tableScrollBox }}>
          <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={stickyHeaderRow}>
                <th style={{ ...thWrap, textAlign: 'left', minWidth: 160 }}>Mảnh</th>
                <th style={thWrap}>SL mảnh cần</th>
                <th style={thWrap}>Phôi đã đồng bộ</th>
                <th style={thWrap} title={PENDING_QC_TIP}>Chưa qua KCS</th>
                <th style={thWrap}>% đồng bộ</th>
                <th style={thWrap}>Đã hàn luỹ kế</th>
                <th style={thWrap}>Hàn hôm nay</th>
                <th style={thWrap}>Còn chưa hàn (phôi đã đồng bộ)</th>
                <th style={thWrap}>Phôi chưa đồng bộ</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <GroupRows key={g.key} g={g} open={open} toggle={toggle} rowKey={rowKey} detailWidth={boxWidth} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function GroupRows({ g, open, toggle, rowKey, detailWidth }: {
  g: SyncGroup; open: Set<string>; toggle: (k: string) => void; rowKey: (r: PieceSyncRow) => string; detailWidth: number | null
}) {
  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <td colSpan={9} style={{ padding: '8px 10px', textAlign: 'left' }}><GroupHead g={g} /></td>
      </tr>
      {g.rows.map(r => {
        const key = rowKey(r)
        const expanded = open.has(key)
        return (
          <RowFragment key={key}>
            <tr onClick={() => toggle(key)} onKeyDown={e => onToggleKey(e, () => toggle(key))} tabIndex={0} aria-expanded={expanded}
              style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
              <td style={{ ...td, ...stickyCol, textAlign: 'left', whiteSpace: 'normal' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontWeight: 600 }}>{r.pieceName}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>{r.pieceCode}</span>
                </span>
                {r.hanAheadOfPhoi && <div style={{ marginTop: 2 }}><AheadTag /></div>}
              </td>
              <td style={td}>{fmt(r.requiredQty)}</td>
              <td style={td}>{num(r.phoiSyncedQty)}</td>
              <td style={td} title={PENDING_QC_TIP}>{pendingQc(pendingQcValue(r))}</td>
              <td style={td}><Percent value={r.syncPercent} /></td>
              <td style={td}>{fmt(r.hanDoneQty)}</td>
              <td style={td}>{fmt(r.hanTodayQty)}</td>
              <td style={td}>{num(r.notWeldedQty)}</td>
              <td style={td}>{num(r.phoiNotSyncedQty)}</td>
            </tr>
            {expanded && (
              <tr style={{ background: 'var(--surface2)' }}>
                <td colSpan={9} style={{ padding: 0 }}>
                  {/* Chi tiết nằm trong ô sticky-trái để khỏi bị cuộn ngang đẩy mất khi bảng rộng. */}
                  <div style={{ position: 'sticky', left: 0, width: detailWidth ?? undefined, maxWidth: '100%', boxSizing: 'border-box' }}><LinesDetail row={r} /></div>
                </td>
              </tr>
            )}
          </RowFragment>
        )
      })}
    </>
  )
}

function RowFragment({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Enter/Space mở-đóng dòng như bấm chuột (dòng có tabIndex để đi bằng phím Tab). */
function onToggleKey(e: KeyboardEvent, toggle: () => void) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  toggle()
}

// Điện thoại: mỗi mảnh 1 thẻ nhỏ trong thẻ SKU, bấm để xổ chi tiết sắt - không có bảng rộng nên không tràn ngang.
function MobilePiece({ row: r, expanded, onToggle }: { row: PieceSyncRow; expanded: boolean; onToggle: () => void }) {
  const cell = (label: string, value: ReactNode) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  )
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div onClick={onToggle} onKeyDown={e => onToggleKey(e, onToggle)} role="button" tabIndex={0} aria-expanded={expanded}
        style={{ padding: 10, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, wordBreak: 'break-word' }}>
            {expanded ? <ChevronDown size={14} style={{ verticalAlign: -2 }} /> : <ChevronRight size={14} style={{ verticalAlign: -2 }} />} {r.pieceName}
            <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11.5 }}> {r.pieceCode}</span>
          </span>
          <Percent value={r.syncPercent} />
        </div>
        {r.hanAheadOfPhoi && <div style={{ marginTop: 4 }}><AheadTag /></div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8, fontSize: 13 }}>
          {cell('SL mảnh cần', fmt(r.requiredQty))}
          {cell('Phôi đã đồng bộ', num(r.phoiSyncedQty))}
          {cell('Chưa qua KCS', pendingQc(pendingQcValue(r)))}
          {cell('Đã hàn luỹ kế', fmt(r.hanDoneQty))}
          {cell('Hàn hôm nay', fmt(r.hanTodayQty))}
          {cell('Còn chưa hàn (phôi đã đồng bộ)', num(r.notWeldedQty))}
          {cell('Phôi chưa đồng bộ', num(r.phoiNotSyncedQty))}
        </div>
      </div>
      {expanded && <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}><LinesDetail row={r} /></div>}
    </div>
  )
}
