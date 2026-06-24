import { useState, useEffect } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { ArrowDownToLine, Search, Check } from 'lucide-react'
import { filterWarehousesByGroup } from './MfgWarehousesPage'

interface Wh { id: number; name: string }
interface Item { id: number; name: string; unit: string; quantity: number; code?: string | null }
interface Txn { id: number; type: string; quantity: number; refCode?: string | null; note?: string | null; date: string; item?: { name: string; unit: string } | null; createdBy?: { name: string } | null }

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error

export default function NhapKhoPage({ lockedGroup }: { lockedGroup?: string | null } = {}) {
  const { data: whs } = useFetch<Wh[]>(() => api.getMfgWarehouses())
  const whList = filterWarehousesByGroup(safeArr(whs), lockedGroup)
  const [whId, setWhId] = useState<number | ''>('')

  // Tài khoản kho bị giới hạn 1 kho → tự chọn luôn
  useEffect(() => {
    const only = whList.length === 1 ? whList[0] : undefined
    if (lockedGroup && whId === '' && only) setWhId(only.id)
  }, [lockedGroup, whId, whList])
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')

  const { data: items } = useFetch<Item[]>(() => (whId ? api.getMfgWarehouseItems(Number(whId), q || undefined) : Promise.resolve([])), [whId, q])
  const { data: txns, refetch: refetchTxns } = useFetch<Txn[]>(() => (whId ? api.getMfgWarehouseTxns(Number(whId)) : Promise.resolve([])), [whId])

  const [itemId, setItemId] = useState<number | ''>('')
  const [qty, setQty] = useState('')
  const [refCode, setRefCode] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr(''); setMsg('')
    if (!itemId) { setErr('Chọn vật tư'); return }
    const n = Number(qty); if (!n || n <= 0) { setErr('Số lượng phải > 0'); return }
    if (!refCode.trim()) { setErr('Nhập mã lệnh mua hàng'); return }
    setBusy(true)
    try {
      await api.importMfgStock({ itemId: Number(itemId), quantity: n, refCode: refCode.trim(), note: note || undefined })
      setMsg('✓ Đã nhập kho thành công'); setQty(''); setNote(''); setItemId('')
      refetchTxns()
    } catch (e) { setErr(errMsg(e) ?? 'Lỗi nhập kho') }
    finally { setBusy(false) }
  }

  const imports = safeArr(txns).filter(t => t.type === 'IMPORT')

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Nhập kho</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>Nhập vật tư về kho theo mã lệnh mua hàng</div>

      <div style={card}>
        <div style={grid2}>
          <div>
            <label style={lbl}>Kho *</label>
            <select value={whId} onChange={e => { setWhId(e.target.value ? Number(e.target.value) : ''); setItemId(''); setSearch(''); setQ('') }} style={inp}>
              <option value="">— chọn kho —</option>
              {whList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Mã lệnh mua hàng *</label>
            <input value={refCode} onChange={e => setRefCode(e.target.value)} placeholder="VD: PO-2026-001" style={inp} />
          </div>
        </div>

        {whId && (
          <>
            <label style={lbl}>Tìm vật tư</label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={14} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text3)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') setQ(search) }}
                onBlur={() => setQ(search)} placeholder="Gõ tên/mã rồi Enter để lọc…" style={{ ...inp, paddingLeft: 30 }} />
            </div>
            <label style={lbl}>Vật tư *</label>
            <select value={itemId} onChange={e => setItemId(e.target.value ? Number(e.target.value) : '')} style={inp}>
              <option value="">— chọn vật tư ({safeArr(items).length}) —</option>
              {safeArr(items).map(it => <option key={it.id} value={it.id}>{it.name} {it.code ? `(${it.code})` : ''} · tồn {it.quantity} {it.unit}</option>)}
            </select>

            <div style={grid2}>
              <div>
                <label style={lbl}>Số lượng nhập *</label>
                <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Ghi chú</label>
                <input value={note} onChange={e => setNote(e.target.value)} style={inp} />
              </div>
            </div>

            {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 10 }}>{err}</div>}
            {msg && <div style={{ color: '#2e7d32', fontSize: 13, marginTop: 10 }}>{msg}</div>}
            <button onClick={submit} disabled={busy} style={{ ...btnGreen, marginTop: 14 }}>
              <ArrowDownToLine size={15} /> {busy ? 'Đang nhập…' : 'Nhập kho'}
            </button>
          </>
        )}
      </div>

      {whId && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={15} color="#2e7d32" /> Lịch sử nhập gần đây</div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Ngày</th><th style={th}>Vật tư</th><th style={th}>Mã lệnh mua</th><th style={{ ...th, textAlign: 'right' }}>SL</th><th style={th}>Người nhập</th>
              </tr></thead>
              <tbody>
                {imports.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                    <td style={td}>{t.item?.name ?? '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{t.refCode || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#2e7d32', fontWeight: 700 }}>+{t.quantity}</td>
                    <td style={td}>{t.createdBy?.name ?? '—'}</td>
                  </tr>
                ))}
                {imports.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 18 }}>Chưa có lần nhập nào</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, maxWidth: 640, background: 'var(--surface)' }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '10px 0 4px', fontWeight: 600 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }
const btnGreen: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: 'none', borderRadius: 'var(--radius)', background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
