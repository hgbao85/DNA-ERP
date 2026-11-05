// Phần A – Đợt 10a (YC5): bảng chọn "Hàng xếp lên cont" - chọn số bộ từ từng lệnh SX của từng SKU, nhóm theo mã PO khách.
import { useEffect, useMemo, useState } from 'react'
import { getBookingCandidates } from '../../../../services/bookings-api'
import { bookingTotalsPreview } from '../../../../utils/bookingVolume'
import { fmtDay } from '../../../../utils/bookingDates'
import { fmtM3 } from '../../../../utils/containerLoad'
import type { BookingCandidate, BookingItemInfo, BookingLine } from '../../../../types/booking'
import { errText } from './bookingShared'

const nf = (n: number) => n.toLocaleString('vi-VN')

/** Chỉ giữ chữ số; '' = chưa nhập. */
export const cleanQty = (raw: string): string => raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
export const parseQty = (s: string | undefined): number => (s ? Number(s) || 0 : 0)

/** Dòng có SL nhập vượt số còn được xếp -> không cho lưu. */
export function hasOverflowQty(candidates: BookingCandidate[], qty: Record<string, string>): boolean {
  return candidates.some(c => parseQty(qty[c.productionInvoiceItemId]) > c.availableQty)
}

/** Tải danh sách ứng viên của khách (kèm bookingId khi sửa để dòng đã xếp luôn hiện). */
export function useBookingCandidates(customerId: string, bookingId: string | undefined, enabled: boolean) {
  const [state, setState] = useState<{ key: string; data: BookingCandidate[] | null; error: string | null }>({ key: '', data: null, error: null })
  const key = `${customerId}|${bookingId ?? ''}`
  useEffect(() => {
    if (!enabled || !customerId) return
    let alive = true
    getBookingCandidates(customerId, bookingId)
      .then(data => { if (alive) setState({ key, data, error: null }) })
      .catch(e => { if (alive) setState({ key, data: null, error: errText(e, 'Không tải được danh sách hàng') }) })
    return () => { alive = false }
  }, [customerId, bookingId, enabled, key])
  const ready = state.key === key
  return {
    candidates: ready ? state.data : null,
    error: ready ? state.error : null,
    loading: enabled && !!customerId && !ready,
  }
}

interface RowGroup<T> { orderCode: string; rows: T[] }
function groupByOrder<T extends BookingItemInfo>(rows: T[]): RowGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const list = map.get(r.orderCode) ?? []
    list.push(r)
    map.set(r.orderCode, list)
  }
  return [...map.entries()].map(([orderCode, list]) => ({ orderCode, rows: list }))
}

const th: React.CSSProperties = { padding: '8px 8px', fontSize: 11, color: 'var(--text3)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }
const tdBase: React.CSSProperties = { padding: '8px 8px', fontSize: 12.5, verticalAlign: 'top' }
const num: React.CSSProperties = { ...tdBase, textAlign: 'right', whiteSpace: 'nowrap' }

function LenhText({ code }: { code: string | null }) {
  return code ? <b>{code}</b> : <span style={{ color: 'var(--text3)' }}>Chưa lên lệnh</span>
}

interface Props {
  customerChosen: boolean
  candidates: BookingCandidate[] | null
  loading: boolean
  error: string | null
  qty: Record<string, string>
  onQtyChange: (productionInvoiceItemId: string, value: string) => void
  /** Số bộ thiếu hàng theo dòng của lần lưu gần nhất (productionInvoiceItemId -> shortQty). */
  savedShort: Record<string, number>
  /** Chế độ chỉ xem: hiện đúng dòng của booking, không cần tải ứng viên. */
  readOnly: boolean
  viewLines: BookingLine[]
  containerVolumeM3: number
  containerQty: number
  warehouseCode: string
  warehouseName: string
  isMobile: boolean
}

export default function BookingLinePicker(p: Props) {
  const { candidates, qty, readOnly, viewLines, isMobile } = p

  const shown = useMemo(
    () => (candidates ?? []).filter(c => c.availableQty > 0 || c.currentQty > 0 || parseQty(qty[c.productionInvoiceItemId]) > 0),
    [candidates, qty],
  )
  const groups = useMemo(() => groupByOrder(shown), [shown])
  const viewGroups = useMemo(() => groupByOrder(viewLines), [viewLines])

  // Dòng đang tính tổng: chế độ xem lấy từ booking, chế độ sửa lấy theo SL đang nhập.
  const summaryLines = readOnly
    ? viewLines.map(l => ({ qty: l.qty, boxVolumeM3: l.boxVolumeM3, boxesPerSet: l.boxesPerSet, factoryCode: l.factoryCode, itemWarehouseCode: l.itemWarehouseCode, itemWarehouseName: l.itemWarehouseName }))
    : shown.map(c => ({ qty: parseQty(qty[c.productionInvoiceItemId]), boxVolumeM3: c.boxVolumeM3, boxesPerSet: c.boxesPerSet, factoryCode: c.factoryCode, itemWarehouseCode: c.itemWarehouseCode, itemWarehouseName: c.itemWarehouseName }))
  const totals = bookingTotalsPreview(summaryLines, p.containerVolumeM3, p.containerQty)
  const totalQty = summaryLines.reduce((s, l) => s + (l.qty > 0 ? l.qty : 0), 0)
  const over = totals.fillPct !== null && totals.fillPct > 100

  const wrongWarehouse = p.warehouseCode
    ? [...new Map(
        summaryLines
          .filter(l => l.qty > 0 && l.itemWarehouseCode && l.itemWarehouseCode !== p.warehouseCode)
          .map(l => [`${l.factoryCode}|${l.itemWarehouseCode}`, l] as const),
      ).values()]
    : []

  let body: React.ReactNode
  if (readOnly) {
    body = viewLines.length === 0
      ? <Hint>Booking này chưa có hàng.</Hint>
      : <ReadOnlyList groups={viewGroups} isMobile={isMobile} />
  } else if (!p.customerChosen) {
    body = <Hint>Chọn khách hàng để xem hàng có thể xếp lên cont.</Hint>
  } else if (p.loading) {
    body = <Hint>Đang tải danh sách hàng...</Hint>
  } else if (p.error) {
    body = <Hint danger>{p.error}</Hint>
  } else if (groups.length === 0) {
    body = <Hint>Khách này chưa có lệnh sản xuất nào còn hàng để xếp.</Hint>
  } else {
    body = <EditList groups={groups} qty={qty} onQtyChange={p.onQtyChange} savedShort={p.savedShort} isMobile={isMobile} />
  }

  return (
    <div>
      {body}
      {(readOnly ? viewLines.length > 0 : shown.length > 0) && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--surface2)', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 13, marginBottom: 8 }}>
            <span>Tổng: <b>{nf(totalQty)}</b> bộ</span>
            <span>
              Tổng khối: <b style={{ color: over ? 'var(--fg-c62828)' : 'var(--text)' }}>{fmtM3(totals.totalM3)} m³</b> / {fmtM3(totals.capacityM3)} m³
              {totals.fillPct !== null && <b style={{ color: over ? 'var(--fg-c62828)' : 'var(--text)' }}> ({totals.fillPct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)</b>}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, totals.fillPct ?? 0)}%`, height: '100%', background: over ? 'var(--bg-c62828)' : 'var(--bg-15803d)' }} />
          </div>
          {over && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--fg-c62828)' }}>Vượt sức chứa cont</div>}
          {totals.missingVolumeSkus.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-b45309)' }}>Chưa tính được m³ của SKU {totals.missingVolumeSkus.join(', ')}.</div>
          )}
          {wrongWarehouse.map(l => (
            <div key={`${l.factoryCode}|${l.itemWarehouseCode}`} style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-b45309)' }}>
              SKU {l.factoryCode} đang ở {l.itemWarehouseName ?? l.itemWarehouseCode}, khác kho gom {p.warehouseName || p.warehouseCode} - cần chuyển về kho gom trước khi đóng cont.
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Hint({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: danger ? 'var(--fg-e24b4a)' : 'var(--text3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
      {children}
    </div>
  )
}

function PoHeading({ code }: { code: string }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '10px 0 4px' }}>PO khách: <span style={{ color: 'var(--blue)' }}>{code}</span></div>
}

function QtyWarnings({ c, n, saved }: { c: BookingCandidate; n: number; saved: number }) {
  return (
    <>
      {n > c.availableQty && <div style={{ color: 'var(--fg-e24b4a)', fontSize: 11, fontWeight: 600, marginTop: 3 }}>vượt số còn lại {nf(c.availableQty)}</div>}
      {/* Đã lưu và còn thiếu: 1 dòng duy nhất (số thiếu sau khi chia hàng sẵn theo ngày) - không lặp thêm dòng "chưa đủ hàng". */}
      {saved > 0 ? (
        <div style={{ color: 'var(--fg-c62828)', fontSize: 11, fontWeight: 600, marginTop: 3 }}>thiếu {nf(saved)} bộ (đã đóng gói − đã xuất = {nf(c.readyQty)})</div>
      ) : n > c.readyQty && n <= c.availableQty && (
        <div style={{ color: 'var(--fg-e65100)', fontSize: 11, marginTop: 3 }}>chưa đủ hàng: đã đóng gói − đã xuất = {nf(c.readyQty)}</div>
      )}
    </>
  )
}

function EditList({ groups, qty, onQtyChange, savedShort, isMobile }: {
  groups: RowGroup<BookingCandidate>[]
  qty: Record<string, string>
  onQtyChange: (id: string, v: string) => void
  savedShort: Record<string, number>
  isMobile: boolean
}) {
  const input = (c: BookingCandidate, big: boolean) => {
    const id = c.productionInvoiceItemId
    const n = parseQty(qty[id])
    const bad = n > c.availableQty
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          inputMode="numeric"
          value={qty[id] ?? ''}
          placeholder="0"
          aria-label={`Số bộ ${c.factoryCode}`}
          onChange={e => onQtyChange(id, cleanQty(e.target.value))}
          style={{ width: big ? 110 : 80, textAlign: 'right', padding: big ? '11px 12px' : '6px 8px', fontSize: big ? 16 : 13, borderColor: bad ? 'var(--fg-e24b4a)' : undefined, borderWidth: bad ? 2 : 1 }}
        />
        <button
          type="button"
          onClick={() => onQtyChange(id, c.availableQty > 0 ? String(c.availableQty) : '')}
          disabled={c.availableQty <= 0}
          style={{ padding: big ? '11px 12px' : '5px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--blue)', cursor: c.availableQty > 0 ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
        >
          Lấy hết
        </button>
      </div>
    )
  }
  const vol = (c: BookingCandidate) => (c.setVolumeM3 !== null ? `${fmtM3(c.setVolumeM3)} m³` : <span style={{ color: 'var(--fg-b45309)' }}>chưa có kích thước</span>)

  if (isMobile) {
    return (
      <div>
        {groups.map(g => (
          <div key={g.orderCode}>
            <PoHeading code={g.orderCode} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.rows.map(c => {
                const id = c.productionInvoiceItemId
                const n = parseQty(qty[id])
                return (
                  <div key={id} style={{ border: `1px solid ${n > c.availableQty ? 'var(--fg-e24b4a)' : 'var(--border)'}`, borderRadius: 10, padding: 12, background: 'var(--surface)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.factoryCode} <span style={{ fontWeight: 400, color: 'var(--text2)' }}>– {c.skuName}</span></div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>Lệnh: <LenhText code={c.lenhCode} /> · Hạn giao {fmtDay(c.deliveryDate) || '—'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                      <span>SL đơn: {nf(c.orderQty)}</span><span>Đã xuất: {nf(c.orderShippedQty)}</span>
                      <span>Booking khác: {nf(c.bookedOtherQty)}</span><span>Đã đóng gói: {nf(c.packedQty)}</span>
                      <span>m³/bộ: {vol(c)}</span><span>Kho: {c.itemWarehouseName ?? '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13 }}>Còn được xếp: <b>{nf(c.availableQty)}</b></div>
                      {input(c, true)}
                    </div>
                    <QtyWarnings c={c} n={n} saved={n === c.currentQty ? savedShort[id] ?? 0 : 0} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['Lệnh SX', 'SKU', 'Hạn giao', 'SL đơn', 'Đã xuất', 'Xếp booking khác', 'Đã đóng gói', 'Còn được xếp', 'Nhập SL', 'm³/bộ', 'Kho đóng gói'].map((h, i) => (
              <th key={h} style={{ ...th, textAlign: i >= 3 && i <= 7 ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <GroupRows key={g.orderCode} g={g} qty={qty} savedShort={savedShort} input={input} vol={vol} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({ g, qty, savedShort, input, vol }: {
  g: RowGroup<BookingCandidate>
  qty: Record<string, string>
  savedShort: Record<string, number>
  input: (c: BookingCandidate, big: boolean) => React.ReactNode
  vol: (c: BookingCandidate) => React.ReactNode
}) {
  return (
    <>
      <tr style={{ background: 'var(--surface2)' }}>
        <td colSpan={11} style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
          PO khách: <span style={{ color: 'var(--blue)' }}>{g.orderCode}</span>
        </td>
      </tr>
      {g.rows.map(c => {
        const id = c.productionInvoiceItemId
        const n = parseQty(qty[id])
        return (
          <tr key={id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={tdBase}><LenhText code={c.lenhCode} /></td>
            <td style={{ ...tdBase, minWidth: 160 }}><b>{c.factoryCode}</b> – {c.skuName}</td>
            <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>{fmtDay(c.deliveryDate) || '—'}</td>
            <td style={num}>{nf(c.orderQty)}</td>
            <td style={num}>{nf(c.orderShippedQty)}</td>
            <td style={num}>{nf(c.bookedOtherQty)}</td>
            <td style={num}>{nf(c.packedQty)}</td>
            <td style={{ ...num, fontWeight: 700 }}>{nf(c.availableQty)}</td>
            <td style={{ ...tdBase, minWidth: 190 }}>
              {input(c, false)}
              <QtyWarnings c={c} n={n} saved={n === c.currentQty ? savedShort[id] ?? 0 : 0} />
            </td>
            <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>{vol(c)}</td>
            <td style={tdBase}>{c.itemWarehouseName ?? '—'}</td>
          </tr>
        )
      })}
    </>
  )
}

function ReadOnlyList({ groups, isMobile }: { groups: RowGroup<BookingLine>[]; isMobile: boolean }) {
  const short = (l: BookingLine) => (l.shortQty > 0 ? <span style={{ color: 'var(--fg-c62828)', fontWeight: 600 }}>thiếu {nf(l.shortQty)} bộ</span> : null)
  if (isMobile) {
    return (
      <div>
        {groups.map(g => (
          <div key={g.orderCode}>
            <PoHeading code={g.orderCode} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {g.rows.map(l => (
                <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700 }}>{l.factoryCode} <span style={{ fontWeight: 400 }}>– {l.skuName}</span></div>
                  <div>Lệnh: <LenhText code={l.lenhCode} /></div>
                  <div>Xếp <b>{nf(l.qty)}</b> bộ{l.shippedQty > 0 ? ` · đã xuất ${nf(l.shippedQty)}` : ''} {short(l)}</div>
                  <div style={{ color: 'var(--text2)' }}>{l.lineM3 !== null ? `${fmtM3(l.lineM3)} m³` : 'chưa có kích thước'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['Lệnh SX', 'SKU', 'SL xếp', 'Đã xuất', 'm³', 'Hàng'].map((h, i) => <th key={h} style={{ ...th, textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <FragmentGroup key={g.orderCode} code={g.orderCode}>
              {g.rows.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdBase}><LenhText code={l.lenhCode} /></td>
                  <td style={tdBase}><b>{l.factoryCode}</b> – {l.skuName}</td>
                  <td style={num}>{nf(l.qty)}</td>
                  <td style={num}>{nf(l.shippedQty)}</td>
                  <td style={num}>{l.lineM3 !== null ? fmtM3(l.lineM3) : '—'}</td>
                  <td style={tdBase}>{short(l) ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                </tr>
              ))}
            </FragmentGroup>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FragmentGroup({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <>
      <tr style={{ background: 'var(--surface2)' }}>
        <td colSpan={6} style={{ padding: '6px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>PO khách: <span style={{ color: 'var(--blue)' }}>{code}</span></td>
      </tr>
      {children}
    </>
  )
}
