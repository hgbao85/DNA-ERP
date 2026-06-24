import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuth } from '../../../context/AuthContext'
import * as api from '../../../services/api'
import { Plus, Trash2, Send, X, FileText, AlertTriangle, ClipboardCopy } from 'lucide-react'

interface Material { id: number; code: string; name: string; unit: string }
interface PItem { id: number; materialId?: number | null; customName?: string | null; quantity: number; unit?: string | null; note?: string | null; material?: { id: number; code: string; name: string; unit: string } | null }
interface Command { id: number; code: string; status: string }
interface Proposal {
  id: number; code: string; status: string; note?: string | null
  createdAt: string
  proposedBy?: { id: number; name: string } | null
  command?: Command | null
  items: PItem[]
}
interface Line { sel: string; customName: string; unit: string; quantity: string; note: string }

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error
const newLine = (): Line => ({ sel: '', customName: '', unit: '', quantity: '', note: '' })

// Tracking LMH status (không còn PENDING/APPROVED/REJECTED ở đây)
const CMD_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  QUOTING:  { label: 'Đang báo giá', bg: '#ede7f6', fg: '#4527a0' },
  ORDERED:  { label: 'Đang mua', bg: '#e3f2fd', fg: '#1565c0' },
  DONE:     { label: 'Hoàn thành', bg: '#e8f5e9', fg: '#2e7d32' },
}
const NO_CMD = { label: 'Chờ xử lý', bg: '#fff3e0', fg: '#e65100' }

export default function DeXuatMuaVatTuPage() {
  const { isManager } = useAuth()
  const { data: materials } = useFetch<Material[]>(() => api.getMaterials())
  const { data: proposals, refetch } = useFetch<Proposal[]>(() => api.getPurchaseProposals())

  const [lines, setLines] = useState<Line[]>([newLine()])
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null)

  const setLine = (i: number, patch: Partial<Line>) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const addLine = () => setLines(ls => [...ls, newLine()])
  const delLine = (i: number) => setLines(ls => ls.filter((_, j) => j !== i))

  const submit = async () => {
    setErr(''); setMsg('')
    const items = lines.map(l => {
      const qty = Number(l.quantity)
      if (!qty || qty <= 0) return null
      if (l.sel === 'KHAC') {
        if (!l.customName.trim()) return null
        return { customName: l.customName.trim(), unit: l.unit.trim() || undefined, quantity: qty, note: l.note || undefined }
      }
      if (l.sel) return { materialId: Number(l.sel), quantity: qty, note: l.note || undefined }
      return null
    }).filter(Boolean)
    if (items.length === 0) { setErr('Thêm ít nhất 1 vật tư hợp lệ (chọn vật tư hoặc nhập "Khác" + số lượng > 0)'); return }
    setBusy(true)
    try {
      const result = await api.createPurchaseProposal({ note: note || undefined, items })
      const lmhCode: string = result?.command?.code ?? ''
      setMsg(`✓ Đã gửi sang Mua hàng${lmhCode ? ` — ${lmhCode}` : ''}`)
      setLines([newLine()]); setNote(''); setLoadedFrom(null)
      refetch()
    } catch (e) { setErr(errMsg(e) ?? 'Lỗi gửi đề xuất') }
    finally { setBusy(false) }
  }

  const loadFromProposal = (p: Proposal) => {
    const filled = p.items.map(it => ({
      sel: it.materialId ? String(it.materialId) : 'KHAC',
      customName: it.materialId ? '' : (it.customName ?? ''),
      unit: it.unit ?? '',
      quantity: String(it.quantity),
      note: it.note ?? '',
    }))
    setLines(filled.length ? filled : [newLine()])
    setNote(p.note ?? '')
    setLoadedFrom(p.code)
    setErr(''); setMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const list = safeArr(proposals)

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Đề xuất mua vật tư</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>
        Chọn vật tư từ danh mục, hoặc nhập "Khác" nếu chưa có — gửi thẳng sang Mua hàng để xử lý
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 18 }}>
        {list.length} đề xuất hiện có
      </div>

      {/* Form tạo — chỉ thủ kho (không phải giám đốc) */}
      {!isManager && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Tạo đề xuất mới</div>
            {loadedFrom && (
              <div style={{ fontSize: 12, color: '#4527a0', background: '#ede7f6', padding: '3px 10px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ClipboardCopy size={12} /> Đã tải từ <strong>{loadedFrom}</strong>
                <button onClick={() => { setLines([newLine()]); setNote(''); setLoadedFrom(null) }} style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#4527a0', padding: 0, display: 'flex' }}><X size={12} /></button>
              </div>
            )}
          </div>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <select value={l.sel} onChange={e => setLine(i, { sel: e.target.value })} style={{ ...inp, flex: '2 1 200px' }}>
                <option value="">— chọn vật tư —</option>
                {safeArr(materials).map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                <option value="KHAC">★ Khác (tự nhập)</option>
              </select>
              {l.sel === 'KHAC' && <>
                <input value={l.customName} onChange={e => setLine(i, { customName: e.target.value })} placeholder="Tên vật tư mới" style={{ ...inp, flex: '2 1 160px' }} />
                <input value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} placeholder="ĐVT" style={{ ...inp, flex: '0 1 70px' }} />
              </>}
              <input type="number" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} placeholder="SL" style={{ ...inp, flex: '0 1 80px' }} />
              <input value={l.note} onChange={e => setLine(i, { note: e.target.value })} placeholder="Ghi chú" style={{ ...inp, flex: '1 1 120px' }} />
              <button onClick={() => delLine(i)} disabled={lines.length === 1} style={iconBtn}><Trash2 size={15} color="#c62828" /></button>
            </div>
          ))}
          <button onClick={addLine} style={btnGhost}><Plus size={14} /> Thêm dòng</button>

          <label style={lbl}>Ghi chú chung</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Lý do / độ ưu tiên…" style={inp} />

          {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 10 }}>{err}</div>}
          {msg && <div style={{ color: '#2e7d32', fontSize: 13, marginTop: 10 }}>{msg}</div>}
          <button onClick={submit} disabled={busy} style={{ ...btnPrimary, marginTop: 14 }}><Send size={15} /> {busy ? 'Đang gửi…' : 'Gửi đề xuất'}</button>
        </div>
      )}

      {/* Danh sách đề xuất */}
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map(p => {
          const cmdSt = p.command ? (CMD_STATUS[p.command.status] ?? NO_CMD) : NO_CMD
          return (
            <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <FileText size={16} color="var(--text3)" />
                <span style={{ fontWeight: 700 }}>{p.code}</span>
                {/* Tracking LMH */}
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: cmdSt.bg, color: cmdSt.fg, fontWeight: 600 }}>
                  {cmdSt.label}
                </span>
                {p.command && (
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{p.command.code}</span>
                )}
                {p.note?.startsWith('Từ Lệnh SX') && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#ede7f6', color: '#4527a0', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <AlertTriangle size={11} /> Từ Kế hoạch SX
                  </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.proposedBy?.name} · {new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>
                <div style={{ flex: 1 }} />
                {/* Tải vào form — chỉ thủ kho, đề xuất chưa hoàn thành */}
                {!isManager && p.command?.status !== 'DONE' && (
                  <button
                    onClick={() => loadFromProposal(p)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #b39ddb', borderRadius: 'var(--radius)', background: '#ede7f6', color: '#4527a0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <ClipboardCopy size={13} /> Tải vào form
                  </button>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 10 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
                  <th style={th}>Vật tư</th><th style={{ ...th, textAlign: 'right' }}>SL</th><th style={th}>Ghi chú</th>
                </tr></thead>
                <tbody>
                  {p.items.map(it => (
                    <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={td}>{it.material?.name ?? <>{it.customName} <span style={{ fontSize: 11, color: '#e65100' }}>(Khác)</span></>}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{it.quantity} {it.material?.unit ?? it.unit ?? ''}</td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{it.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {p.note && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>Ghi chú: {p.note}</div>}
            </div>
          )
        })}
        {list.length === 0 && <div style={{ color: 'var(--text3)' }}>Chưa có đề xuất nào.</div>}
      </div>
    </div>
  )
}

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 18, background: 'var(--surface)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }
const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', width: '100%' }
const th: React.CSSProperties = { padding: '6px 10px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '6px 10px', color: 'var(--text)' }
const iconBtn: React.CSSProperties = { padding: 7, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'inline-flex' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', marginTop: 4 }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: 'none', borderRadius: 'var(--radius)', background: '#e65100', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
