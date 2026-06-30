import { useState, useEffect } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useConfirm } from '../../../hooks/useConfirm'
import * as api from '../../../services/api'
import { ArrowDownToLine, Search, Check, FileInput } from 'lucide-react'
import { filterWarehousesByGroup } from './MfgWarehousesPage'
import type { WarehouseReceipt } from '../../../types/purchase-order'

interface Wh { id: number; name: string }
interface Item { id: number; name: string; unit: string; quantity: number; code?: string | null }
interface Txn { id: number; type: string; quantity: number; refCode?: string | null; note?: string | null; date: string; item?: { name: string; unit: string } | null; createdBy?: { name: string } | null }

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error

export default function NhapKhoPage({ lockedGroup }: { lockedGroup?: string | null } = {}) {
  const [nhapTab, setNhapTab] = useState<'manual' | 'receipts'>('manual')

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

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([
          ['manual',   'Nhập thủ công',         ArrowDownToLine],
          ['receipts', 'Phiếu nhập từ đơn mua', FileInput],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setNhapTab(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', fontSize: 13, fontWeight: nhapTab === id ? 700 : 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: nhapTab === id ? '#2e7d32' : 'var(--text2)',
            borderBottom: nhapTab === id ? '2px solid #2e7d32' : '2px solid transparent',
            marginBottom: -1,
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {nhapTab === 'receipts' && <PhieuNhapSection whs={whList} />}

      {nhapTab === 'manual' && <>
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
    </>}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// PhieuNhapSection — Phiếu nhập từ đơn mua đã được GĐ duyệt
// ──────────────────────────────────────────────────────────
function PhieuNhapSection({ whs }: { whs: { id: number; name: string }[] }) {
  const { data: receipts, refetch } = useFetch<WarehouseReceipt[]>(
    () => (api as any).getWarehouseReceipts()
  )

  const pending = (receipts ?? []).filter(r => r.status === 'PENDING')

  const [expanded, setExpanded] = useState<number | null>(null)
  const [draftItems, setDraftItems] = useState<Record<number, { receivedQty: string; warehouseId: number | '' }[]>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [msgs, setMsgs] = useState<Record<number, string>>({})
  const { ask, confirmModal } = useConfirm()

  const initDraft = (r: WarehouseReceipt) => {
    if (draftItems[r.id]) return
    setDraftItems(prev => ({
      ...prev,
      [r.id]: r.items.map(it => ({ receivedQty: String(it.orderedQty), warehouseId: whs.length === 1 ? whs[0].id : '' })),
    }))
  }

  const toggle = (r: WarehouseReceipt) => {
    if (expanded === r.id) { setExpanded(null) } else { setExpanded(r.id); initDraft(r) }
  }

  const setField = (rid: number, idx: number, field: 'receivedQty' | 'warehouseId', val: string | number) => {
    setDraftItems(prev => {
      const rows = [...(prev[rid] ?? [])]
      rows[idx] = { ...rows[idx], [field]: val }
      return { ...prev, [rid]: rows }
    })
  }

  const handleConfirmReceipt = (r: WarehouseReceipt) => {
    const rows = draftItems[r.id] ?? []
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].warehouseId) { setMsgs(p => ({ ...p, [r.id]: `Chọn kho cho dòng ${i + 1}` })); return }
      if (!rows[i].receivedQty || Number(rows[i].receivedQty) < 0) { setMsgs(p => ({ ...p, [r.id]: `Số lượng không hợp lệ dòng ${i + 1}` })); return }
    }
    ask(
      { message: `Xác nhận đã nhận hàng cho phiếu ${r.code}? Tồn kho sẽ được cộng ngay sau khi xác nhận.` },
      async () => {
        setBusy(r.id)
        setMsgs(p => ({ ...p, [r.id]: '' }))
        try {
          await (api as any).confirmWarehouseReceipt(r.id, rows.map((row, i) => ({
            id: r.items[i].id,
            receivedQty: Number(row.receivedQty),
            warehouseId: Number(row.warehouseId),
          })))
          setMsgs(p => ({ ...p, [r.id]: '✓ Đã xác nhận nhập kho thành công!' }))
          setExpanded(null)
          refetch()
        } catch { setMsgs(p => ({ ...p, [r.id]: 'Lỗi xác nhận' })) }
        finally { setBusy(null) }
      }
    )
  }

  if (pending.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 14 }}>
        Không có phiếu nhập nào đang chờ xác nhận
      </div>
    )
  }

  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        {pending.length} phiếu nhập đang chờ xác nhận nhận hàng
      </div>
      {pending.map((r: WarehouseReceipt) => {
        const open = expanded === r.id
        const rows = draftItems[r.id] ?? []
        const msg = msgs[r.id] ?? ''
        return (
          <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12, overflow: 'hidden' }}>
            <div
              onClick={() => toggle(r)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: open ? '#e8f5e9' : 'var(--surface)' }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#2e7d32', marginRight: 10 }}>{r.code}</span>
                {r.skuName && <span style={{ fontSize: 12, color: 'var(--text3)' }}>SKU: {r.skuName} · </span>}
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đơn mua: {r.purchaseOrderCode} · {r.items.length} vật tư</span>
              </div>
              <span style={{ fontSize: 18, color: 'var(--text3)' }}>{open ? '▲' : '▼'}</span>
            </div>

            {open && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                        <th style={th}>Vật tư</th>
                        <th style={{ ...th, textAlign: 'right' }}>SL đặt</th>
                        <th style={{ ...th, textAlign: 'right' }}>SL thực nhận</th>
                        <th style={th}>Kho nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((it, idx) => (
                        <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={td}>{it.materialName} <span style={{ color: 'var(--text3)', fontSize: 11 }}>({it.unit})</span></td>
                          <td style={{ ...td, textAlign: 'right' }}>{it.orderedQty}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <input
                              type="number" min={0}
                              value={rows[idx]?.receivedQty ?? ''}
                              onChange={e => setField(r.id, idx, 'receivedQty', e.target.value)}
                              style={{ ...inp, width: 80, textAlign: 'right' }}
                            />
                          </td>
                          <td style={td}>
                            <select
                              value={rows[idx]?.warehouseId ?? ''}
                              onChange={e => setField(r.id, idx, 'warehouseId', e.target.value ? Number(e.target.value) : '')}
                              style={{ ...inp, width: 180 }}
                            >
                              <option value="">— chọn kho —</option>
                              {whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {msg && (
                  <div style={{ fontSize: 13, marginBottom: 10, color: msg.startsWith('✓') ? '#2e7d32' : '#c62828' }}>{msg}</div>
                )}

                <button
                  onClick={() => handleConfirmReceipt(r)}
                  disabled={busy === r.id}
                  style={btnGreen}
                >
                  <Check size={15} /> {busy === r.id ? 'Đang xác nhận…' : 'Xác nhận đã nhận hàng'}
                </button>
              </div>
            )}
          </div>
        )
      })}
      {confirmModal}
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
