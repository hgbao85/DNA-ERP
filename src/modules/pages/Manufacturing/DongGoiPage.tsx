import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format } from 'date-fns'
import { AlertCircle, Box, Send, CheckCircle2 } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface PackBox { boxIndex: number; label: string; target: number; packed: number; remaining: number; canPackNow: number; lastPackedAt: string | null }
interface PackProduct {
  productVariantId: number; productName: string; variantDesc: string
  boxesPerSet: number; boxNote: string | null; target: number; readyToPackSets: number; boxes: PackBox[]
}
interface PackPI {
  piId: number; code: string; poNumber: string | null
  totalTarget: number; totalPacked: number; allDone: boolean; products: PackProduct[]
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--border)' }
const fmt = (n: number) => n.toLocaleString('vi-VN')
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function DongGoiPage({ readOnly = false, filterPiId }: { readOnly?: boolean; filterPiId?: number }) {
  const { data, isLoading, error, refetch } = useFetch<PackPI[]>(() => api.getPacking(), [])
  const all = Array.isArray(data) ? data : []
  const pis = filterPiId ? all.filter((p) => p.piId === filterPiId) : all

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text3)' }}>Đang tải...</div>
  if (error) return <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Đóng gói</h2>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
        Đóng thành phẩm vào thùng theo quy cách của đơn. Đóng đủ tất cả thùng → báo Sales.
      </p>
      {pis.length > 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 16 }}>
          Hiện có {pis.length} lệnh đóng gói đang theo dõi
        </div>
      )}

      {pis.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Chưa có lệnh SX nào để đóng gói. Kiểm tra trạng thái KCS/SX và lệnh sản xuất.</div>}

      {pis.map((pi) => <DongGoiPICard key={pi.piId} pi={pi} onChanged={refetch} readOnly={readOnly} />)}
    </div>
  )
}

function DongGoiPICard({ pi, onChanged, readOnly = false }: { pi: PackPI; onChanged: () => void; readOnly?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // form theo từng thùng: key = `${productVariantId}:${boxIndex}`
  const [forms, setForms] = useState<Record<string, { qty: string; time: string }>>({})

  const overallPct = pi.totalTarget > 0 ? Math.round(pi.totalPacked / pi.totalTarget * 100) : 0

  const setForm = (key: string, patch: Partial<{ qty: string; time: string }>) =>
    setForms((m) => ({ ...m, [key]: { qty: '', time: '', ...m[key], ...patch } }))

  const submit = async (productVariantId: number, box: PackBox) => {
    const key = `${productVariantId}:${box.boxIndex}`
    const f = forms[key] ?? { qty: '', time: '' }
    const q = Number(f.qty)
    if (!q || q <= 0) { setErr('Nhập số bộ đóng > 0'); return }
    if (q > box.canPackNow) { setErr(`Chỉ được đóng tối đa ${box.canPackNow} bộ (giới hạn chuyền kiểm / mục tiêu thùng)`); return }
    const when = f.time ? new Date(f.time) : new Date()
    if (when.getTime() > Date.now() + 60_000) { setErr('Thời gian đóng gói không ở tương lai'); return }
    try {
      setBusy(true); setErr('')
      await api.reportPacking({ piId: pi.piId, productVariantId, boxIndex: box.boxIndex, quantity: q, packedAt: when.toISOString() })
      setForms((m) => ({ ...m, [key]: { qty: '', time: '' } }))
      onChanged()
    } catch (e) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi đóng gói')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 18, overflow: 'hidden' }}>
      {/* Header: PO + % đóng gói + cờ báo Sales */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {pi.poNumber ? `PO ${pi.poNumber}` : pi.code}
            <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>· {pi.code}</span>
          </div>
          {pi.allDone && (
            <div style={{ fontSize: 12, color: '#2e7d32', fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={14} /> Đã đóng xong — báo Sales
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' }}>Đóng gói</span>
          <span style={{ fontWeight: 800, fontSize: 24, lineHeight: 1, color: overallPct >= 100 ? '#2e7d32' : '#e65100' }}>{overallPct}%</span>
        </div>
      </div>

      {err && <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 16px', fontSize: 13 }}>{err}</div>}

      {pi.products.length === 0 && (
        <div style={{ padding: 16, color: 'var(--text3)' }}>
          Lệnh này chưa có sản phẩm đóng gói. Kiểm tra trạng thái đóng gói hoặc cấu hình sản phẩm của lệnh SX.
        </div>
      )}

      {/* Mỗi sản phẩm 1 bảng thùng */}
      {pi.products.map((prod) => (
        <div key={prod.productVariantId} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {prod.productName} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{prod.variantDesc}</span>
            <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>· {prod.boxesPerSet} thùng/bộ · mục tiêu {fmt(prod.target)} bộ</span>
            {prod.readyToPackSets < prod.target && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#00838f', background: '#e0f7fa', padding: '2px 8px', borderRadius: 10 }}>
                Sẵn sàng đóng (đã chuyền kiểm): {fmt(prod.readyToPackSets)} bộ
              </span>
            )}
            {prod.boxNote && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Quy cách: {prod.boxNote}</div>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Thùng</th>
                <th style={{ ...th, textAlign: 'center' }}>Mục tiêu</th>
                <th style={{ ...th, textAlign: 'center' }}>Đã đóng gói</th>
                <th style={{ ...th, textAlign: 'center' }}>Còn lại</th>
                <th style={th}>Thời gian đóng gói</th>
                <th style={th}>Đóng</th>
              </tr>
            </thead>
            <tbody>
              {prod.boxes.map((b) => {
                const key = `${prod.productVariantId}:${b.boxIndex}`
                const f = forms[key] ?? { qty: '', time: '' }
                const done = b.remaining <= 0
                return (
                  <tr key={b.boxIndex}>
                    <td style={{ ...td, fontWeight: 600 }}><Box size={13} style={{ verticalAlign: -2, marginRight: 4, color: 'var(--text3)' }} />{b.label}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{fmt(b.target)}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#2e7d32' }}>{fmt(b.packed)}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: done ? '#2e7d32' : '#e65100' }}>{done ? '✓ Đủ' : fmt(b.remaining)}</td>
                    <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{b.lastPackedAt ? format(new Date(b.lastPackedAt), 'dd/MM HH:mm') : '—'}</td>
                    <td style={td}>
                      {readOnly ? (
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                      ) : done ? (
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>hoàn tất</span>
                      ) : b.canPackNow <= 0 ? (
                        <span style={{ color: '#e65100', fontSize: 12 }}>chờ chuyền kiểm</span>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <input type="number" min={1} max={b.canPackNow} value={f.qty}
                            onChange={(e) => setForm(key, { qty: e.target.value })}
                            placeholder={`≤${b.canPackNow}`}
                            style={{ width: 64, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, textAlign: 'center', background: 'var(--surface)' }} />
                          <input type="datetime-local" value={f.time} max={toLocalInput(new Date())}
                            onChange={(e) => setForm(key, { time: e.target.value })}
                            style={{ width: 178, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, background: 'var(--surface)' }} />
                          <button onClick={() => submit(prod.productVariantId, b)} disabled={busy}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#e65100', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <Send size={12} /> Đóng
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
