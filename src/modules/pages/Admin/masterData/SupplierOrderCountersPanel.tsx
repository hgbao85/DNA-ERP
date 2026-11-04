'use client'
import { useCallback, useEffect, useState } from 'react'
import { Hash } from 'lucide-react'
import {
  getSupplierOrderCounters,
  setSupplierOrderCounter,
  type SupplierOrderCounter,
} from '../../../../services/supplier-orders-api'

/** Năm theo giờ Việt Nam - khớp BE vnYear() (đơn tạo lúc 00:30 sáng 01/01 giờ VN thuộc năm mới). */
const vnYear = () => new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCFullYear()

const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)', textAlign: 'left' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13 }

/**
 * Số đơn đặt hàng theo từng NCC (2026-11-04, bản v8 mục 4.10, 4.13): Admin nạp "số đơn cuối cùng
 * đã dùng" của mỗi NCC trong năm (lấy từ sổ của phòng mua) trước khi người mua tạo đơn trên hệ
 * thống - đơn tiếp theo nhận số này + 1. Không nạp được số nhỏ hơn số hệ thống đã cấp.
 */
export default function SupplierOrderCountersPanel() {
  const [year, setYear] = useState(vnYear())
  const [rows, setRows] = useState<SupplierOrderCounter[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  // setLoading(true) đặt ở chỗ đổi năm (không trong effect) - tránh setState đồng bộ trong effect.
  const load = useCallback(async (y: number) => {
    try {
      setRows(await getSupplierOrderCounters(y))
      setDrafts({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(year) }, [load, year])

  const save = async (row: SupplierOrderCounter) => {
    const raw = drafts[row.supplierId]
    const n = Number(raw)
    if (raw === undefined || raw.trim() === '' || !Number.isInteger(n) || n < 0) {
      setMsg({ id: row.supplierId, text: 'Nhập số nguyên ≥ 0', ok: false })
      return
    }
    setSavingId(row.supplierId)
    setMsg(null)
    try {
      const saved = await setSupplierOrderCounter(row.supplierId, year, n)
      setRows(prev => prev.map(r => (r.supplierId === saved.supplierId ? saved : r)))
      setDrafts(prev => {
        const next = { ...prev }
        delete next[row.supplierId]
        return next
      })
      setMsg({ id: row.supplierId, text: `Đã lưu - đơn tiếp theo là ${saved.lastSeq + 1}/${year}`, ok: true })
    } catch (e) {
      setMsg({ id: row.supplierId, text: e instanceof Error ? e.message : String(e), ok: false })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={{ marginTop: 'var(--space-6)', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <Hash size={16} color="var(--fg-3949ab)" />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Số đơn đặt hàng theo nhà cung cấp</span>
        <div style={{ flex: 1 }} />
        <label htmlFor="so-year" style={{ fontSize: 12, color: 'var(--text2)' }}>Năm</label>
        <select id="so-year" value={year} onChange={e => { setLoading(true); setYear(Number(e.target.value)) }} style={{ padding: '4px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}>
          {[vnYear() - 1, vnYear(), vnYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
        Nhập số đơn cuối cùng phòng mua đã dùng với từng nhà cung cấp trong năm (vd Kim Phát đã tới đơn 52 thì nhập 52). Đơn người mua tạo tiếp theo trên hệ thống sẽ là số đó + 1. Nhà cung cấp chưa có đơn nào trong năm để 0.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Nhà cung cấp</th>
              <th style={{ ...th, textAlign: 'right' }}>Số đơn cuối cùng</th>
              <th style={{ ...th, textAlign: 'right' }}>Hệ thống đã cấp tới</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={{ ...td, color: 'var(--text3)' }} colSpan={4}>Đang tải…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td style={{ ...td, color: 'var(--text3)' }} colSpan={4}>Chưa có nhà cung cấp nào</td></tr>
            ) : rows.map(row => {
              const draft = drafts[row.supplierId]
              const dirty = draft !== undefined && draft !== String(row.lastSeq)
              return (
                <tr key={row.supplierId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{row.supplierName}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input
                      type="number"
                      min={row.maxIssuedSeq}
                      step={1}
                      aria-label={`Số đơn cuối cùng của ${row.supplierName}`}
                      value={draft ?? String(row.lastSeq)}
                      onChange={e => setDrafts(prev => ({ ...prev, [row.supplierId]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && dirty) void save(row) }}
                      style={{ width: 90, padding: '4px 6px', fontSize: 13, textAlign: 'right', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{row.maxIssuedSeq > 0 ? `${row.maxIssuedSeq}/${year}` : '—'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => void save(row)}
                        disabled={!dirty || savingId === row.supplierId}
                        style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: !dirty ? 'var(--bg-93c5fd)' : 'var(--bg-2563eb)', color: '#fff', cursor: !dirty ? 'default' : 'pointer' }}
                      >
                        {savingId === row.supplierId ? 'Đang lưu…' : 'Lưu'}
                      </button>
                      {msg?.id === row.supplierId && (
                        <span style={{ fontSize: 12, color: msg.ok ? 'var(--fg-16a34a)' : 'var(--fg-dc2626)' }}>{msg.text}</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
