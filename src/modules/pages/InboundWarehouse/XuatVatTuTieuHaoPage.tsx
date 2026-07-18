'use client'

/**
 * Xuất vật tư TIÊU HAO cho 1 tổ (Hàn / Sơn) — dùng chung cho 2 subtab của "Phân phối nội bộ".
 * Khác "Xuất sắt cho Phôi": đây là vật tư phụ (khí CO₂, dây hàn / bột sơn, dung môi…),
 * KHÔNG phải WIP. Bấm "Xuất" → tạo đợt CHỜ NHẬN (vat-tu-noi-bo.service) → hiện ngay bên
 * "Xác nhận sản lượng" của tổ để họ xác nhận đã nhận.
 */

import { Fragment, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { VatTuStage, VatTuDinhMuc, VatTuIssue } from '../../../services/api'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#4527A0'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function XuatVatTuTieuHaoPage({ stage, desc }: { stage: VatTuStage; desc: string }) {
  const { data: dinhMuc, isLoading } = useFetch<VatTuDinhMuc[]>(() => api.getDinhMucVatTu(stage), [stage])
  const { data: issues, refetch: refetchIssue } = useFetch<VatTuIssue[]>(() => api.getVatTuIssues(stage), [stage])
  const [qty, setQty] = useState<Record<string, string>>({})

  // Đã xuất (kho đã gửi) = Σ mọi đợt theo (PO · vật tư).
  const daXuatMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of issues ?? []) m.set(`${i.poNumber}|${i.tenVatTu}`, (m.get(`${i.poNumber}|${i.tenVatTu}`) ?? 0) + i.soLuong)
    return m
  }, [issues])

  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, VatTuDinhMuc[]>()
    for (const d of dinhMuc ?? []) { if (!map.has(d.poNumber)) { map.set(d.poNumber, []); order.push(d.poNumber) } map.get(d.poNumber)!.push(d) }
    return order.map(po => ({ po, sku: map.get(po)![0].sku, items: map.get(po)! }))
  }, [dinhMuc])

  if (isLoading || !dinhMuc) return <LoadingState />

  const daXuat = (d: VatTuDinhMuc) => daXuatMap.get(`${d.poNumber}|${d.tenVatTu}`) ?? 0
  const con = (d: VatTuDinhMuc) => Math.max(0, d.can - daXuat(d))
  const clampN = (d: VatTuDinhMuc) => Math.max(0, Math.min(con(d), Math.floor(Number(qty[d.id] ?? con(d)) || 0)))

  const xuat = async (d: VatTuDinhMuc) => {
    const n = clampN(d)
    if (n <= 0) return
    await api.xuatVatTu({ stage, poNumber: d.poNumber, sku: d.sku, tenVatTu: d.tenVatTu, dvt: d.dvt, soLuong: n })
    setQty(q => { const { [d.id]: _, ...rest } = q; return rest })
    refetchIssue()
  }

  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>{desc}</div>
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Vật tư</th>
              <th style={th}>ĐVT</th>
              <th style={thR}>Cần</th>
              <th style={thR}>Đã xuất</th>
              <th style={thR}>Còn phải xuất</th>
              <th style={{ ...th, textAlign: 'center', width: 220 }}>Xuất cho tổ</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <Fragment key={g.po}>
                <tr style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
                  <td colSpan={6} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                    <span style={{ fontFamily: 'monospace' }}>{g.po}</span> <span style={{ fontWeight: 400, color: 'var(--text3)' }}>· {g.sku}</span>
                  </td>
                </tr>
                {g.items.map(d => {
                  const c = con(d)
                  const du = c <= 0
                  return (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>{d.tenVatTu}</td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{d.dvt}</td>
                      <td style={tdR}>{d.can.toLocaleString('vi-VN')}</td>
                      <td style={{ ...tdR, color: 'var(--text3)' }}>{daXuat(d).toLocaleString('vi-VN')}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: du ? 'var(--green)' : '#dc2626' }}>{c.toLocaleString('vi-VN')}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        {du ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                            <Check size={14} /> đã xuất đủ
                          </span>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <input type="number" min={1} max={c}
                              value={qty[d.id] ?? String(c)}
                              onChange={e => {
                                const raw = e.target.value
                                if (raw === '') { setQty(q => ({ ...q, [d.id]: '' })); return }
                                const v = Math.max(0, Math.min(c, Math.floor(Number(raw) || 0)))
                                setQty(q => ({ ...q, [d.id]: String(v) }))
                              }}
                              style={{ width: 70, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                            <button onClick={() => xuat(d)}
                              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              Xuất
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 28 }}>Chưa có vật tư cần xuất</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
