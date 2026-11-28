'use client'

/**
 * Tab "Pallet" của kho Sơn (24/11/2026, docs THIET-KE-PALLET-SON, chốt P1-P7) - chỉ hiện khi BE bật PALLET_SON_ENABLED.
 *  - Danh sách pallet cố định (tem QR dán sẵn, dùng lại) + lọc theo trạng thái Trống / Chờ sơn / Sơn xong / Trên phiếu đan; tạo
 *    pallet mới (mã PL-NNN), in tem; xem lịch sử từng pallet; gỡ lượt xếp chưa sơn (xếp nhầm).
 *  - Xếp pallet: chọn lệnh -> mảnh (Sơn đã nhận / Đã xếp pallet / Còn xếp được / Kế hoạch) -> pallet trống -> số mảnh. 1 pallet =
 *    1 SKU + 1 mảnh. Chặn vượt "Còn xếp được" (BE kiểm lại trong khoá), cảnh báo vượt sức chứa của mảnh (sửa được ngay ở bảng).
 * Công nhân Sơn quét tem -> "Sơn xong"; xuất đan quét pallet ở tab "Xuất đan".
 */
import { useMemo, useState } from 'react'
import { History, Plus, Printer, Search, X } from 'lucide-react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import ReasonModal from '../../../components/ReasonModal'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  clearPaintedPallet, createPallets, getPallet, getPalletLoadRows, loadPallet, setPieceCapacity, unloadPallet,
  type Pallet, type PalletDetail, type PalletList, type PalletLoadOptionsList, type PalletPieceRow, type PalletStatus,
} from '../../../services/pallets-api'
import LoadingState from '../../../components/LoadingState'
import { errMsg } from '../../../utils/errors'
import { printPalletTems } from '../Floor/qrPrint'
import {
  checkLoad, countByStatus, filterPallets, loadTiles, PALLET_STATUS_LABEL, PALLET_STATUS_ORDER, PALLET_STATUS_TONE, parseQty,
  qtyDigits,
} from './palletModel'

const ACCENT = 'var(--fg-4527a0)'
const ACCENT_BG = 'var(--bg-ede7f6)'
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const th: React.CSSProperties = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const input: React.CSSProperties = {
  padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)',
}
const smallBtn = (primary = false, disabled = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 8,
  border: primary ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap',
  background: disabled ? 'var(--surface2)' : primary ? ACCENT : 'var(--surface)',
  color: disabled ? 'var(--text3)' : primary ? '#fff' : 'var(--text2)', cursor: disabled ? 'not-allowed' : 'pointer',
})
const fmtTime = (s: string | null) => (s ? format(new Date(s), 'dd/MM HH:mm') : '—')

export function StatusPill({ status }: { status: PalletStatus }) {
  const t = PALLET_STATUS_TONE[status]
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: t.bg, color: t.fg, whiteSpace: 'nowrap' }}>
      {PALLET_STATUS_LABEL[status]}
    </span>
  )
}

export default function PalletSonPage({ list, refetchList, loadPis }: {
  list: PalletList
  refetchList: () => void
  loadPis: PalletLoadOptionsList | null
}) {
  const [status, setStatus] = useState<PalletStatus | 'ALL'>('ALL')
  const [q, setQ] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const { ask, confirmModal } = useConfirm()
  // Câu 7a (chốt 25/11/2026): gỡ pallet đã sơn - lý do bắt buộc.
  const [clearing, setClearing] = useState<Pallet | null>(null)
  const [clearReason, setClearReason] = useState('')
  const [clearBusy, setClearBusy] = useState(false)
  const [clearErr, setClearErr] = useState<string | null>(null)
  useRealtimeRefetch(['issue-slips', 'production-batches', 'floor'], refetchList)

  const counts = countByStatus(list.pallets)
  const shown = filterPallets(list.pallets, status, q)
  const empties = list.pallets.filter(p => p.status === 'EMPTY')

  const [newCount, setNewCount] = useState('5')
  const [creating, setCreating] = useState(false)
  const create = async () => {
    const n = parseQty(newCount)
    if (!n) return
    setCreating(true); setMsg(null)
    try {
      const made = await createPallets(n)
      setMsg({ ok: true, text: `Đã tạo ${made.length} pallet ${made[0]?.code ?? ''}${made.length > 1 ? ` … ${made[made.length - 1].code}` : ''} - bấm "In tem" để in tem dán.` })
      refetchList()
      await printPalletTems(made.map(p => ({ code: p.code, qrToken: p.qrToken, warehouseName: p.warehouseName }))).catch(() => undefined)
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e, 'Không tạo được pallet') })
    } finally {
      setCreating(false)
    }
  }

  const printList = (ps: Pallet[]) => {
    void printPalletTems(ps.map(p => ({ code: p.code, qrToken: p.qrToken, warehouseName: p.warehouseName })))
      .catch(e => setMsg({ ok: false, text: errMsg(e, 'Không in được tem') }))
  }

  const unload = (p: Pallet) => ask(
    { message: `Gỡ hàng khỏi pallet ${p.code} (${p.load?.qty ?? 0} mảnh ${p.load?.pieceName ?? ''})? Pallet về Trống, lịch sử vẫn giữ.`, danger: true },
    async () => {
      try {
        await unloadPallet(p.id)
        setMsg({ ok: true, text: `Đã gỡ pallet ${p.code}` })
        refetchList()
      } catch (e) {
        setMsg({ ok: false, text: errMsg(e, 'Không gỡ được pallet') })
      }
    },
  )

  const clearPainted = async () => {
    if (!clearing) return
    setClearBusy(true); setClearErr(null)
    try {
      await clearPaintedPallet(clearing.id, clearReason.trim())
      setMsg({ ok: true, text: `Đã gỡ pallet đã sơn ${clearing.code} - pallet về Trống` })
      setClearing(null); setClearReason('')
      refetchList()
    } catch (e) {
      setClearErr(errMsg(e, 'Không gỡ được pallet'))
    } finally {
      setClearBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ReasonModal
        open={!!clearing}
        title={clearing ? `Gỡ pallet đã sơn ${clearing.code}` : ''}
        description={clearing ? `${clearing.load?.qty ?? 0} mảnh ${clearing.load?.pieceName ?? ''} - pallet về Trống để dùng lại, số đã báo Sơn không đổi, lịch sử vẫn giữ. Ghi lý do (vd SKU huỷ, KCS Sơn chấm lỗi, đi đan bằng phiếu nhập tay).` : undefined}
        reason={clearReason}
        onReasonChange={setClearReason}
        placeholder="Lý do gỡ pallet"
        onCancel={() => { if (!clearBusy) { setClearing(null); setClearReason(''); setClearErr(null) } }}
        onConfirm={() => void clearPainted()}
        confirmLabel="Gỡ pallet"
        busy={clearBusy}
        confirmDisabled={clearReason.trim().length < 3}
        error={clearErr}
      />
      <div style={{ color: 'var(--text3)', fontSize: 13 }}>
        Pallet cố định có tem QR dán sẵn. Xếp pallet theo lệnh + mảnh + số → công nhân Sơn quét tem, bấm “Sơn xong” → quét pallet ở tab
        “Xuất đan” để lập phiếu đan. Xác nhận phiếu đan thì pallet tự về Trống.
      </div>

      <LoadForm loadPis={loadPis} empties={empties} onLoaded={(text) => { setMsg({ ok: true, text }); refetchList() }} />

      {msg && (
        <div role={msg.ok ? 'status' : 'alert'} style={{ padding: '9px 14px', borderRadius: 10, fontSize: 13, background: msg.ok ? 'var(--bg-e8f5e9)' : 'var(--bg-fdecea, var(--surface2))', color: msg.ok ? 'var(--fg-2e7d32)' : 'var(--fg-dc2626)' }}>
          {msg.text}
        </div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div role="group" aria-label="Lọc theo trạng thái" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['ALL', ...PALLET_STATUS_ORDER] as const).map(s => {
              const on = status === s
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => setStatus(s)} style={{
                  padding: '5px 11px', fontSize: 12.5, fontWeight: 600, borderRadius: 20, cursor: 'pointer', border: '1px solid',
                  borderColor: on ? ACCENT : 'var(--border)', background: on ? ACCENT_BG : 'var(--surface)', color: on ? ACCENT : 'var(--text2)',
                }}>
                  {s === 'ALL' ? 'Tất cả' : PALLET_STATUS_LABEL[s]} <span style={{ fontWeight: 400 }}>{counts[s]}</span>
                </button>
              )
            })}
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...input, padding: '4px 8px' }}>
            <Search size={14} aria-hidden />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Mã pallet, lệnh, SKU, mảnh" aria-label="Tìm pallet"
              style={{ border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text)', width: 180 }} />
          </label>
          <div style={{ flex: 1 }} />
          <input value={newCount} onChange={e => setNewCount(qtyDigits(e.target.value).slice(0, 3))} aria-label="Số pallet tạo mới" inputMode="numeric"
            style={{ ...input, width: 56, textAlign: 'right' }} />
          <button type="button" onClick={() => void create()} disabled={creating || !parseQty(newCount)} style={smallBtn(true, creating || !parseQty(newCount))}>
            <Plus size={14} /> {creating ? 'Đang tạo…' : 'Tạo pallet + in tem'}
          </button>
          <button type="button" onClick={() => printList(shown)} disabled={shown.length === 0} style={smallBtn(false, shown.length === 0)}>
            <Printer size={14} /> In tem ({shown.length})
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Pallet</th><th style={th}>Trạng thái</th><th style={th}>Lệnh</th><th style={th}>SKU</th><th style={th}>Mảnh</th>
                <th style={{ ...th, textAlign: 'right' }}>Số xếp</th><th style={{ ...th, textAlign: 'right' }}>Sơn xong</th>
                <th style={th}>Phiếu đan</th><th style={th}>Cập nhật</th><th style={th} />
              </tr>
            </thead>
            <tbody>
              {shown.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{p.code}</td>
                  <td style={td}><StatusPill status={p.status} /></td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{p.load?.lenhCode ?? '—'}</td>
                  <td style={td}>{p.load?.sku ?? '—'}</td>
                  <td style={td}>{p.load?.pieceName ?? '—'}</td>
                  <td style={tdR}>
                    {p.load?.qty ?? '—'}
                    {p.load?.overCapacity && <span title={`Vượt sức chứa ${p.load.capacity}`} style={{ color: 'var(--fg-b45309)', marginLeft: 4 }}>!</span>}
                  </td>
                  <td style={tdR} title={p.load?.shortReason ? `Báo thiếu: ${p.load.shortReason}` : undefined}>
                    {p.load?.paintedQty ?? '—'}
                    {p.load?.shortReason && <span style={{ color: 'var(--fg-dc2626)', marginLeft: 4 }}>thiếu</span>}
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{p.load?.slip?.code ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtTime(p.load?.paintedAt ?? p.load?.loadedAt ?? p.updatedAt)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" onClick={() => setDetailId(p.id)} style={smallBtn()} aria-label={`Lịch sử ${p.code}`}><History size={13} /></button>
                      <button type="button" onClick={() => printList([p])} style={smallBtn()} aria-label={`In tem ${p.code}`}><Printer size={13} /></button>
                      {p.status === 'LOADED' && <button type="button" onClick={() => unload(p)} style={smallBtn()}>Gỡ</button>}
                      {p.status === 'PAINTED' && <button type="button" onClick={() => { setClearErr(null); setClearing(p) }} style={smallBtn()}>Gỡ pallet đã sơn</button>}
                    </span>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  {list.pallets.length === 0 ? 'Kho chưa có pallet nào - tạo pallet và in tem ở trên.' : 'Không có pallet nào khớp bộ lọc.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && <PalletHistory id={detailId} onClose={() => setDetailId(null)} />}
      {confirmModal}
    </div>
  )
}

/** Khối "Xếp pallet": lệnh -> mảnh -> pallet trống -> số. */
function LoadForm({ loadPis, empties, onLoaded }: {
  loadPis: PalletLoadOptionsList | null
  empties: Pallet[]
  onLoaded: (text: string) => void
}) {
  const [piId, setPiId] = useState<string | null>(null)
  const { data: detail, isLoading, refetch } = useFetch(
    () => (piId ? getPalletLoadRows(piId) : Promise.resolve(null)),
    [piId],
  )
  const [rowKey, setRowKey] = useState<string | null>(null)
  const [palletId, setPalletId] = useState('')
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [capText, setCapText] = useState<string | null>(null)

  const rows = useMemo(() => detail?.rows ?? [], [detail])
  const keyOf = (r: PalletPieceRow) => `${r.productionOrderId}:${r.pieceId}`
  const row = rows.find(r => keyOf(r) === rowKey) ?? null
  const pallet = empties.find(p => p.id === palletId) ?? null
  const check = checkLoad(row, pallet?.id ?? null, qty)
  const pis = loadPis?.pis ?? []

  const submit = async () => {
    if (!row || !pallet || check.error || !check.qty) return
    setBusy(true); setErr(null)
    try {
      const out = await loadPallet(pallet.id, { productionOrderId: row.productionOrderId, pieceId: row.pieceId, qty: check.qty })
      onLoaded(`Đã xếp pallet ${pallet.code}: ${check.qty} mảnh ${row.pieceName} (${row.sku})${out.warning ? ` - ${out.warning}` : ''}`)
      setPalletId(''); setQty('')
      refetch()
    } catch (e) {
      setErr(errMsg(e, 'Không xếp được pallet'))
      refetch()
    } finally {
      setBusy(false)
    }
  }

  const saveCapacity = async () => {
    if (!row || capText == null) return
    const cap = capText.trim() === '' ? null : parseQty(capText)
    if (capText.trim() !== '' && cap == null) { setErr('Sức chứa phải là số nguyên lớn hơn 0'); return }
    try {
      await setPieceCapacity(row.pieceId, cap)
      setCapText(null); refetch()
    } catch (e) {
      setErr(errMsg(e, 'Không lưu được sức chứa'))
    }
  }

  return (
    <div style={card}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>Xếp pallet</b>
        <select value={piId ?? ''} onChange={e => { setPiId(e.target.value || null); setRowKey(null); setErr(null) }} aria-label="Chọn lệnh sản xuất" style={{ ...input, minWidth: 200 }}>
          <option value="">{pis.length === 0 ? 'Chưa có lệnh nào đang chạy ở kho Sơn này' : 'Chọn lệnh sản xuất…'}</option>
          {pis.map(p => <option key={p.productionInvoiceId} value={p.productionInvoiceId}>{p.lenhCode}{p.deadline ? ` · hạn ${format(new Date(p.deadline), 'dd/MM')}` : ''}</option>)}
        </select>
        {piId && isLoading && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đang tải…</span>}
      </div>
      {piId && !isLoading && rows.length === 0 && (
        <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)' }}>Lệnh này không có mảnh nào qua Sơn.</div>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th} /><th style={th}>SKU</th><th style={th}>Mảnh</th>
                {loadTiles(rows[0]).map(t => <th key={t.label} style={{ ...th, textAlign: 'right' }}>{t.label}</th>)}
                <th style={{ ...th, textAlign: 'right' }}>Sức chứa / pallet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const on = keyOf(r) === rowKey
                return (
                  <tr key={keyOf(r)} onClick={() => { setRowKey(keyOf(r)); setCapText(null); setErr(null) }}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: on ? ACCENT_BG : undefined }}>
                    <td style={td}><input type="radio" readOnly checked={on} aria-label={`Chọn ${r.pieceName}`} /></td>
                    <td style={td}>{r.sku}</td>
                    <td style={td}><b>{r.pieceName}</b> <span style={{ color: 'var(--text3)', fontSize: 12 }}>{r.pieceCode}</span></td>
                    {loadTiles(r).map(t => (
                      <td key={t.label} style={{ ...tdR, ...(t.label === 'Còn xếp được' ? { fontWeight: 700, color: r.remainingQty > 0 ? 'var(--fg-15803d)' : 'var(--fg-dc2626)' } : {}) }}
                        title={t.hint}>
                        {t.value}
                        {t.hint && <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>{t.hint}</div>}
                      </td>
                    ))}
                    <td style={tdR} onClick={e => e.stopPropagation()}>
                      {on && capText != null ? (
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          <input value={capText} onChange={e => setCapText(qtyDigits(e.target.value))} aria-label="Sức chứa" style={{ ...input, width: 64, textAlign: 'right' }} />
                          <button type="button" onClick={() => void saveCapacity()} style={smallBtn(true)}>Lưu</button>
                          <button type="button" onClick={() => setCapText(null)} style={smallBtn()} aria-label="Bỏ"><X size={13} /></button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => { setRowKey(keyOf(r)); setCapText(r.capacity == null ? '' : String(r.capacity)) }}
                          style={{ ...smallBtn(), padding: '3px 8px' }}>{r.capacity ?? 'Khai'}</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {row && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <span style={{ fontSize: 13 }}>Xếp <b>{row.pieceName}</b> ({row.sku}) lên</span>
          <select value={palletId} onChange={e => setPalletId(e.target.value)} aria-label="Pallet trống" style={{ ...input, minWidth: 130 }}>
            <option value="">{empties.length === 0 ? 'Hết pallet trống' : 'Chọn pallet trống…'}</option>
            {empties.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
          <input value={qty} onChange={e => setQty(qtyDigits(e.target.value))} inputMode="numeric" placeholder={`tối đa ${row.remainingQty}`}
            aria-label="Số mảnh xếp" style={{ ...input, width: 100, textAlign: 'right' }} />
          <button type="button" onClick={() => void submit()} disabled={busy || !!check.error} style={smallBtn(true, busy || !!check.error)}>
            {busy ? 'Đang xếp…' : 'Xếp pallet'}
          </button>
          {qty && check.error && <span style={{ fontSize: 12, color: 'var(--fg-dc2626)' }}>{check.error}</span>}
          {!check.error && check.warning && <span style={{ fontSize: 12, color: 'var(--fg-b45309)' }}>{check.warning}</span>}
          {err && <span role="alert" style={{ width: '100%', fontSize: 12, color: 'var(--fg-dc2626)' }}>{err}</span>}
        </div>
      )}
    </div>
  )
}

function PalletHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, error } = useFetch<PalletDetail>(() => getPallet(id), [id])
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <b style={{ fontSize: 14 }}>Lịch sử pallet {data?.code ?? ''}</b>
        {data && <StatusPill status={data.status} />}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onClose} style={smallBtn()} aria-label="Đóng lịch sử"><X size={13} /></button>
      </div>
      {isLoading ? <LoadingState /> : error ? <div style={{ padding: 14, color: 'var(--fg-dc2626)', fontSize: 13 }}>{error}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Xếp lúc</th><th style={th}>Người xếp</th><th style={th}>Lệnh · SKU · Mảnh</th>
                <th style={{ ...th, textAlign: 'right' }}>Số</th><th style={th}>Sơn xong</th><th style={th}>Phiếu đan</th><th style={th}>Giải phóng</th>
              </tr>
            </thead>
            <tbody>
              {(data?.history ?? []).map(h => (
                <tr key={h.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtTime(h.loadedAt)}</td>
                  <td style={td}>{h.loadedByName ?? '—'}</td>
                  <td style={td}><span style={{ fontFamily: 'monospace' }}>{h.lenhCode}</span> · {h.sku} · {h.pieceName}</td>
                  <td style={tdR}>{h.qty}</td>
                  <td style={td}>
                    {h.paintedQty == null ? '—' : `${h.paintedQty} · ${fmtTime(h.paintedAt)}${h.paintedByName ? ` · ${h.paintedByName}` : ''}`}
                    {h.shortReason && <div style={{ fontSize: 11.5, color: 'var(--fg-dc2626)' }}>Thiếu: {h.shortReason}</div>}
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{h.slip ? `${h.slip.code}${h.slip.status === 'DRAFT' ? ' (chờ ký)' : ''}` : '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {h.clearedAt ? `${h.clearedReason === 'UNLOADED' ? 'Gỡ' : h.clearedReason === 'REMOVED_PAINTED' ? `Gỡ đã sơn${h.clearNote ? ` (${h.clearNote})` : ''}` : 'Xuất đan'} · ${fmtTime(h.clearedAt)}` : '—'}
                  </td>
                </tr>
              ))}
              {(data?.history ?? []).length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Pallet chưa xếp lần nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
