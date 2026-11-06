'use client'

/**
 * Tab "Phiếu xuất" của Phân phối nội bộ (Đợt 6, bản v8 YC4 4.1-4.4, 4.8, 4.9): lập phiếu xuất XK nhiều dòng, in, người nhận ký,
 * thủ kho tải ảnh phiếu đã ký rồi "Xác nhận xuất" - lúc đó hệ thống mới trừ tồn. Không có ảnh thì không xuất được (khoá cứng).
 */
import { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { FileText, Paperclip, Printer, Trash2, X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { getMaterials } from '../../../services/materials-api'
import { uploadDocument } from '../../../services/uploads-api'
import { newUuid } from '../../../services/core/uuid'
import {
  cancelIssueSlip,
  confirmIssueSlip,
  createIssueSlip,
  getIssueSlips,
  type IssueSlip,
} from '../../../services/issue-slips-api'
import { errMsg } from '../../../utils/errors'
import { useIssueSlipCart } from './IssueSlipCart'
import { printIssueSlip } from './printIssueSlip'
import LenhCode from '../../../components/LenhCode'

const th: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }
const input: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }
const btn = (enabled: boolean, color = 'var(--bg-2563eb)'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
  background: enabled ? color : 'var(--surface2)', color: enabled ? '#fff' : 'var(--text3)', cursor: enabled ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
})
const ghost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }

const KIND_LABEL = { STEEL: 'Sắt', CONSUMABLE: 'Tiêu hao', SHARED: 'Dùng chung' } as const
const fmtQty = (n: number) => String(Math.round(n * 10_000) / 10_000)

export default function PhieuXuatPage() {
  const { user } = useAuth()
  const cart = useIssueSlipCart()
  const { data: drafts, refetch: refetchDrafts } = useFetch(() => getIssueSlips('DRAFT'), [])
  const { data: issued, refetch: refetchIssued } = useFetch(() => getIssueSlips('ISSUED'), [])
  useRealtimeRefetch(['issue-slips'], () => { void refetchDrafts(); void refetchIssued() })
  const { data: materials } = useFetch(getMaterials, [])

  const [recipient, setRecipient] = useState('')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [sharedMaterialId, setSharedMaterialId] = useState('')
  const [sharedQty, setSharedQty] = useState('')
  const [sharedNote, setSharedNote] = useState('')

  const scope = user?.warehouseScope ?? null
  // Dòng "Dùng chung": vật tư không phải sắt, nằm ở kho mình phụ trách.
  const sharedOptions = useMemo(
    () => (materials ?? []).filter(m => m.isActive && m.steelSubGroup == null && m.warehouseCode && (!scope || m.warehouseCode === scope))
      .sort((a, b) => a.code.localeCompare(b.code)),
    [materials, scope],
  )

  const addShared = () => {
    const m = sharedOptions.find(x => String(x.id) === sharedMaterialId)
    const q = Number(sharedQty)
    if (!m || !(q > 0)) return
    cart.add({
      kind: 'SHARED', materialId: String(m.id), qty: q, note: sharedNote.trim() || undefined,
      materialName: `${m.code} ${m.name}`, unit: m.unit, lenhLabel: 'Dùng chung',
    })
    setSharedMaterialId(''); setSharedQty(''); setSharedNote('')
  }

  const create = async () => {
    setCreating(true); setCreateErr('')
    try {
      await createIssueSlip({
        lines: cart.lines.map(l => ({
          kind: l.kind, materialId: l.materialId, productionInvoiceId: l.productionInvoiceId, productionOrderId: l.productionOrderId,
          stage: l.stage, barLengthMm: l.barLengthMm, qty: l.qty, note: l.note,
        })),
        recipientName: recipient.trim() || undefined,
        note: note.trim() || undefined,
      })
      cart.clear(); setRecipient(''); setNote('')
      await refetchDrafts()
    } catch (e) {
      setCreateErr(errMsg(e, 'Không tạo được phiếu xuất'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {/* ── Phiếu đang lập ── */}
      <div style={card}>
        <div style={head}>
          <FileText size={16} color="var(--fg-4527a0)" />
          <b style={{ fontSize: 14 }}>Phiếu đang lập</b>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Thêm dòng từ các tab xuất sắt / vật tư hàn / vật tư sơn, hoặc dòng dùng chung bên dưới. Mỗi phiếu chỉ cho một kho.</span>
        </div>
        {cart.lines.length === 0 ? (
          <div style={{ padding: 14, fontSize: 13, color: 'var(--text3)' }}>Chưa có dòng nào.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Loại</th><th style={th}>Vật tư</th><th style={th}>Lệnh</th><th style={{ ...th, textAlign: 'right' }}>Số lượng</th><th style={th}>ĐVT</th><th style={th} /></tr></thead>
              <tbody>
                {cart.lines.map(l => (
                  <tr key={l.key} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{KIND_LABEL[l.kind]}{l.stage ? ` ${l.stage === 'HAN' ? 'Hàn' : 'Sơn'}` : ''}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{l.materialName}{l.barLengthMm ? <span style={{ fontWeight: 400, color: 'var(--fg-e65100)' }}> · cây {l.barLengthMm}mm</span> : null}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}><LenhCode piCode={l.lenhLabel} /></td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtQty(l.qty)}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{l.unit}</td>
                    <td style={td}><button onClick={() => cart.remove(l.key)} aria-label={`Bỏ ${l.materialName}`} style={{ ...ghost, padding: 4 }}><X size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Dòng dùng chung (không theo lệnh, lấy từ tồn chưa giữ):</span>
          <select value={sharedMaterialId} onChange={e => setSharedMaterialId(e.target.value)} style={{ ...input, maxWidth: 280 }} aria-label="Vật tư dùng chung">
            <option value="">Chọn vật tư…</option>
            {sharedOptions.map(m => <option key={m.id} value={m.id}>{m.code} · {m.name} ({m.unit})</option>)}
          </select>
          <input type="number" min={0} step="any" value={sharedQty} onChange={e => setSharedQty(e.target.value)} placeholder="SL" style={{ ...input, width: 80, textAlign: 'right' }} aria-label="Số lượng dùng chung" />
          <input value={sharedNote} onChange={e => setSharedNote(e.target.value)} placeholder="Dùng cho việc gì" style={{ ...input, width: 180 }} aria-label="Ghi chú dùng chung" />
          <button onClick={addShared} disabled={!sharedMaterialId || !(Number(sharedQty) > 0)} style={ghost}>Thêm dòng</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Người nhận (tổ / tên)" style={{ ...input, width: 200 }} aria-label="Người nhận" />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú phiếu" style={{ ...input, flex: 1, minWidth: 160 }} aria-label="Ghi chú phiếu" />
          {cart.lines.length > 0 && <button onClick={cart.clear} disabled={creating} style={ghost}><Trash2 size={13} /> Xoá hết</button>}
          <button onClick={() => void create()} disabled={cart.lines.length === 0 || creating} style={btn(cart.lines.length > 0 && !creating)}>
            {creating ? 'Đang tạo…' : 'Tạo phiếu xuất'}
          </button>
        </div>
        {createErr && <div style={{ padding: '0 14px 12px', fontSize: 12, color: 'var(--fg-dc2626, #dc2626)' }}>{createErr}</div>}
      </div>

      {/* ── Phiếu chờ ký ── */}
      <div style={{ fontSize: 14, fontWeight: 700, margin: '4px 0 10px' }}>Phiếu chờ ký ({drafts?.length ?? 0})</div>
      {(drafts ?? []).length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Không có phiếu nào chờ ký.</div>}
      {(drafts ?? []).map(s => (
        <DraftSlip key={s.id} slip={s} onChanged={() => { void refetchDrafts(); void refetchIssued() }} />
      ))}

      {/* ── Đã xuất ── */}
      <div style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 10px' }}>Phiếu đã xuất gần đây</div>
      <div style={card}>
        {(issued ?? []).length === 0 ? (
          <div style={{ padding: 14, fontSize: 13, color: 'var(--text3)' }}>Chưa có phiếu nào.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Số phiếu</th><th style={th}>Ngày xuất</th><th style={th}>Nội dung</th><th style={th}>Người nhận</th><th style={th}>Phiếu ký</th></tr></thead>
              <tbody>
                {(issued ?? []).slice(0, 30).map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{s.code}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{s.issuedAt ? format(new Date(s.issuedAt), 'dd/MM HH:mm') : '—'}</td>
                    <td style={td}>{s.lines.map(l => `${l.materialCode} ${fmtQty(l.qty)} ${l.unit}${l.lenhCode ? ` (${l.lenhCode})` : l.kind === 'SHARED' ? ' (dùng chung)' : ''}`).join('; ')}</td>
                    <td style={td}>{s.recipientName ?? '—'}</td>
                    <td style={td}>{s.signedSlipUrls.map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2563eb)', marginRight: 6 }}>ảnh {i + 1}</a>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function DraftSlip({ slip, onChanged }: { slip: IssueSlip; onChanged: () => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  // Giữ key + ảnh đã tải giữa các lần bấm lại của cùng 1 lần xác nhận.
  const [confirmKey] = useState(() => newUuid())
  const uploaded = useRef(new WeakMap<File, string>())

  const confirm = async () => {
    setBusy(true); setErr('')
    try {
      const urls: string[] = []
      for (const f of files) {
        let u = uploaded.current.get(f)
        if (!u) { u = await uploadDocument(f); uploaded.current.set(f, u) }
        urls.push(u)
      }
      await confirmIssueSlip(slip.id, urls, confirmKey)
      onChanged()
    } catch (e) {
      setErr(errMsg(e, 'Không xuất được'))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true); setErr('')
    try {
      await cancelIssueSlip(slip.id, reason.trim())
      onChanged()
    } catch (e) {
      setErr(errMsg(e, 'Không huỷ được'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={card}>
      <div style={{ ...head, background: 'var(--bg-fffbeb)' }}>
        <b style={{ fontFamily: 'monospace', fontSize: 14 }}>{slip.code}</b>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{slip.warehouseName} · lập {format(new Date(slip.createdAt), 'dd/MM HH:mm')}{slip.createdByName ? ` · ${slip.createdByName}` : ''}{slip.recipientName ? ` · người nhận ${slip.recipientName}` : ''}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => printIssueSlip(slip)} style={ghost}><Printer size={13} /> In phiếu</button>
        <button onClick={() => setCancelling(c => !c)} disabled={busy} style={ghost}>Huỷ phiếu</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Loại</th><th style={th}>Mã hàng</th><th style={th}>Tên</th><th style={th}>Lệnh</th><th style={{ ...th, textAlign: 'right' }}>Số lượng</th><th style={th}>ĐVT</th></tr></thead>
          <tbody>
            {slip.lines.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}>{KIND_LABEL[l.kind]}{l.stage ? ` ${l.stage === 'HAN' ? 'Hàn' : 'Sơn'}` : ''}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{l.materialCode}</td>
                <td style={td}>{l.materialName}{l.barLengthMm ? ` · cây ${l.barLengthMm}mm` : ''}{l.note ? <span style={{ color: 'var(--text3)' }}> · {l.note}</span> : null}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{l.lenhCode ?? (l.kind === 'SHARED' ? 'Dùng chung' : '—')}{l.sku ? ` · ${l.sku}` : ''}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtQty(l.qty)}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{l.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
        <label style={{ ...ghost, cursor: 'pointer' }}>
          <Paperclip size={13} /> Ảnh phiếu đã ký <span style={{ color: 'var(--fg-dc2626, #dc2626)' }}>*</span>
          <input type="file" accept="image/*,application/pdf" multiple hidden onChange={e => { const fl = Array.from(e.target.files ?? []); setFiles(prev => [...prev, ...fl]); e.target.value = '' }} />
        </label>
        {files.map((f, i) => (
          <span key={i} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {f.name}
            <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} aria-label={`Bỏ ${f.name}`} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}><X size={12} /></button>
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => void confirm()} disabled={files.length === 0 || busy} style={btn(files.length > 0 && !busy, 'var(--bg-2e7d32)')}>
          {busy ? 'Đang ghi…' : 'Xác nhận xuất'}
        </button>
      </div>
      {files.length === 0 && <div style={{ padding: '0 14px 10px', fontSize: 12, color: 'var(--text3)' }}>In phiếu → người nhận ký → chụp tải lên rồi mới xác nhận xuất được. Tồn kho chỉ trừ lúc xác nhận.</div>}
      {cancelling && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '0 14px 12px' }}>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Lý do huỷ (vd in sai)" style={{ ...input, flex: 1, minWidth: 200 }} aria-label="Lý do huỷ phiếu" />
          <button onClick={() => void cancel()} disabled={busy || reason.trim().length < 3} style={btn(!busy && reason.trim().length >= 3, 'var(--fg-dc2626, #dc2626)')}>Xác nhận huỷ</button>
        </div>
      )}
      {err && <div style={{ padding: '0 14px 12px', fontSize: 12, color: 'var(--fg-dc2626, #dc2626)' }}>{err}</div>}
    </div>
  )
}
