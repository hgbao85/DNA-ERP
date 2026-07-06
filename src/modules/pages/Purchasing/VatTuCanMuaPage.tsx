import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Calculator, Scale, X, Check, Award } from 'lucide-react'

interface CmdRow { id: number; code: string; source: string; status: string; productLabel?: string | null }
interface Item {
  id: number; materialId?: number | null; requiredQty: number; stockQty: number; buyQty: number; unit?: string | null
  unitPrice?: number | null; expectedDate?: string | null; actualReceiveDate?: string | null
  material?: { id: number; name: string; unit: string } | null; customName?: string | null
  chosenSupplier?: { id: number; name: string } | null
}
interface Detail { id: number; code: string; source: string; piCode?: string | null; items: Item[] }
interface Link { id: number; price?: number | null; leadTimeDays?: number | null; supplier?: { id: number; name: string } | null }

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error
const vnd = (n?: number | null) => (n == null ? '—' : n.toLocaleString('vi-VN') + 'đ')
const round = (n: number) => Math.round(n * 10) / 10

export default function VatTuCanMuaPage({ commandId }: { commandId?: number }) {
  const { data: commands } = useFetch<CmdRow[]>(() => api.getPurchaseCommands())
  const [selId, setSelId] = useState<number | ''>(commandId ?? '')
  const { data: detail, refetch } = useFetch<Detail | null>(() => (selId ? api.getPurchaseCommand(Number(selId)) : Promise.resolve(null)), [selId])
  const [busy, setBusy] = useState(false)
  const [compareItem, setCompareItem] = useState<Item | null>(null)

  const items = safeArr(detail?.items)
  const isPI = detail?.source === 'PI'
  const total = items.reduce((s, it) => s + (it.unitPrice ? it.unitPrice * it.buyQty : 0), 0)

  const compute = async () => {
    if (!selId) return
    setBusy(true)
    try { await api.computePurchaseCommand(Number(selId)); refetch() }
    catch (e) { alert(errMsg(e) ?? 'Lỗi tính') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Vật tư cần mua</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>Theo Mã lệnh = (định mức × số lượng) − tồn kho. So sánh giá NCC để chọn.</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selId} onChange={e => setSelId(e.target.value ? Number(e.target.value) : '')} style={{ ...inp, width: 320 }}>
          <option value="">— chọn mã lệnh —</option>
          {safeArr(commands).map(c => <option key={c.id} value={c.id}>{c.code} · {c.productLabel || 'Đề xuất'}</option>)}
        </select>
        {selId && isPI && <button onClick={compute} disabled={busy} style={btnPrimary}><Calculator size={15} /> {busy ? 'Đang tính…' : (items.length ? 'Tính lại' : 'Tính vật tư cần mua')}</button>}
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 18 }}>
        {safeArr(commands).length > 0 ? `${safeArr(commands).length} mã lệnh hiện có` : 'Chưa có mã lệnh. Tạo PI ở Sản xuất để bắt đầu.'}
      </div>

      {selId && (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Vật tư</th><th style={{ ...th, textAlign: 'right' }}>Cần</th><th style={{ ...th, textAlign: 'right' }}>Tồn</th>
                <th style={{ ...th, textAlign: 'right' }}>Cần mua</th><th style={th}>ĐVT</th><th style={th}>NCC chọn</th><th style={{ ...th, textAlign: 'right' }}>Đơn giá</th><th style={th}>Dự kiến về</th><th style={th}>Nhận thực tế</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{it.material?.name ?? it.customName}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{round(it.requiredQty)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{round(it.stockQty)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: it.buyQty > 0 ? '#c62828' : '#2e7d32' }}>{Math.ceil(it.buyQty)}</td>
                    <td style={td}>{it.unit}</td>
                    <td style={td}>{it.chosenSupplier?.name ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{vnd(it.unitPrice)}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{it.expectedDate ? new Date(it.expectedDate).toLocaleDateString('vi-VN') : '—'}</td>
                    <td style={td}>{it.actualReceiveDate ? <span style={{ color: '#2e7d32', fontWeight: 600 }}>{new Date(it.actualReceiveDate).toLocaleDateString('vi-VN')}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {it.materialId
                        ? <button onClick={() => setCompareItem(it)} style={btnGhost}><Scale size={13} /> So sánh giá</button>
                        : <span style={{ fontSize: 11, color: 'var(--text3)' }}>(Khác)</span>}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 22 }}>
                    {isPI ? 'Bấm "Tính vật tư cần mua" để sinh danh sách từ định mức.' : 'Mã lệnh chưa có vật tư.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div style={{ marginTop: 12, textAlign: 'right', fontSize: 14 }}>
              Tổng tiền dự kiến: <b style={{ color: '#4527a0' }}>{vnd(total)}</b>
            </div>
          )}
        </>
      )}

      {compareItem && <CompareModal item={compareItem} onClose={() => setCompareItem(null)} onDone={() => { setCompareItem(null); refetch() }} />}
    </div>
  )
}

// ── Modal So sánh giá ────────────────────────────────────────────────────
function CompareModal({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const { data: links } = useFetch<Link[]>(() => api.getMaterialSuppliers(item.materialId!), [item.materialId])
  const list = safeArr(links)
  const cheapest = list.filter(l => l.price != null).sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0]
  const [busyId, setBusyId] = useState<number | null>(null)

  const choose = async (l: Link) => {
    if (!l.supplier) return
    setBusyId(l.id)
    const expected = l.leadTimeDays ? new Date(Date.now() + l.leadTimeDays * 86400000).toISOString() : undefined
    try { await api.updateCommandItem(item.id, { chosenSupplierId: l.supplier.id, unitPrice: l.price ?? null, expectedDate: expected ?? null }); onDone() }
    catch { setBusyId(null) }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={modalCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>So sánh giá — {item.material?.name}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Cần mua {Math.ceil(item.buyQty)} {item.unit} · giá nhập ở màn &quot;Vật tư – NCC&quot;</div>
        {list.length === 0 ? (
          <div style={{ color: '#e65100', fontSize: 13 }}>Vật tư này chưa gắn NCC nào. Vào &quot;Vật tư – NCC&quot; để thêm + nhập giá.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
              <th style={th}>NCC</th><th style={{ ...th, textAlign: 'right' }}>Đơn giá</th><th style={{ ...th, textAlign: 'right' }}>Giao (ngày)</th><th style={{ ...th, textAlign: 'right' }}>Thành tiền</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {list.map(l => {
                const isCheap = cheapest && l.id === cheapest.id
                const chosen = item.chosenSupplier?.id === l.supplier?.id
                return (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)', background: isCheap ? '#f1f8e9' : 'transparent' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{l.supplier?.name} {isCheap && <span style={{ fontSize: 11, color: '#2e7d32', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Award size={12} /> rẻ nhất</span>}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{vnd(l.price)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{l.leadTimeDays ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{l.price != null ? vnd(l.price * Math.ceil(item.buyQty)) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => choose(l)} disabled={busyId === l.id} style={chosen ? btnChosen : btnPrimary}>
                        {chosen ? <><Check size={13} /> Đã chọn</> : 'Chọn'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px', color: 'var(--text)' }
const iconBtn: React.CSSProperties = { padding: 5, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: '#4527a0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnChosen: React.CSSProperties = { ...btnPrimary, background: '#2e7d32' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalCard: React.CSSProperties = { width: 560, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.2)' }
