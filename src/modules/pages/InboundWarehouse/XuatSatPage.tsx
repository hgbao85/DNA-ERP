'use client'

/**
 * Xuất sắt cho Phôi (kho Phôi Sơn Hàn) — mục sidebar dưới "Xuất kho".
 *
 * Kho xuất sắt theo kế hoạch cắt sắt. Màn này cũng cho kho thấy loại sắt nào đang
 * CHƯA ĐỒNG BỘ (Phôi cắt chưa kịp so với các loại khác trong cùng mảnh) → ưu tiên
 * xuất loại đó. Bấm "Xuất" → tạo đợt DA_NHAN trong mock service dùng chung → hiện
 * NGAY bên Phôi (Xác nhận sản lượng / Lịch sử nhận sắt). Phôi chỉ việc nhận & xác nhận.
 */

import { useMemo, useState } from 'react'
import { ArrowUpFromLine, Check, AlertTriangle } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { KeHoachSatView } from '../../../services/api'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#4527A0'
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function XuatSatPage() {
  const { data: plan, isLoading, refetch } = useFetch<KeHoachSatView[]>(() => api.getKeHoachXuatSat(), [])
  const [qty, setQty] = useState<Record<string, string>>({})

  // Điểm nghẽn đồng bộ: trong 1 mảnh, loại sắt nào có tỷ lệ đã-cắt/kế-hoạch THẤP hơn
  // loại dẫn đầu → đang kéo mảnh lại → cần ưu tiên xuất.
  const nghen = useMemo(() => {
    const set = new Set<string>()
    const byManh = new Map<string, KeHoachSatView[]>()
    for (const p of plan ?? []) {
      const k = p.poNumber + '|' + p.manhTen
      if (!byManh.has(k)) byManh.set(k, [])
      byManh.get(k)!.push(p)
    }
    for (const items of byManh.values()) {
      const frac = items.map(p => p.planCay > 0 ? p.daCat / p.planCay : 0)
      const leader = Math.max(...frac)
      items.forEach((p, i) => { if (frac[i] < leader - 1e-9) set.add(p.id) })
    }
    return set
  }, [plan])

  if (isLoading || !plan) return <LoadingState />

  const xuat = async (p: KeHoachSatView) => {
    const n = Math.max(0, Math.min(p.conXuat, Math.floor(Number(qty[p.id] ?? p.conXuat) || 0)))
    if (n <= 0) return
    await api.xuatSatChoPhoi(p.id, n)
    setQty(q => { const { [p.id]: _, ...rest } = q; return rest })
    refetch()
  }

  const groups = [...new Map((plan).map(p => [p.poNumber, p.sku])).entries()]
    .map(([po, sku]) => ({ po, sku, items: plan.filter(p => p.poNumber === po) }))
  const conTong = plan.reduce((s, p) => s + p.conXuat, 0)

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <ArrowUpFromLine size={20} /> Xuất sắt cho Phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Xuất sắt theo kế hoạch cắt sắt. Loại <b style={{ color: '#dc2626' }}>chưa đồng bộ</b> = Phôi đang cắt chậm hơn loại khác cùng mảnh → ưu tiên xuất. Xuất xong hiện ngay bên Phôi.
        {conTong > 0 && <> · Còn <b style={{ color: ACCENT }}>{conTong}</b> cây cần xuất.</>}
      </div>

      {groups.map(g => {
        const uuTien = g.items.filter(p => nghen.has(p.id) && p.conXuat > 0)
        return (
          <div key={g.po} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
              <span style={{ fontFamily: 'monospace' }}>{g.po}</span>
              <span style={{ fontWeight: 400, color: 'var(--text2)' }}> — {g.sku}</span>
            </div>

            {uuTien.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', marginBottom: 8, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
                <AlertTriangle size={16} />
                <span>Ưu tiên xuất (đang chưa đồng bộ): <b>{uuTien.map(p => `${p.loaiSat} ${p.quyCach}`).join(', ')}</b></span>
              </div>
            )}

            <div style={{ ...card, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={th}>Mảnh</th>
                    <th style={th}>Loại sắt</th>
                    <th style={th}>Quy cách</th>
                    <th style={thR}>Tổng sắt cần xuất (cây)</th>
                    <th style={thR}>Đã xuất</th>
                    <th style={thR}>Phôi đã cắt</th>
                    <th style={thR}>Còn phải xuất</th>
                    <th style={{ ...th, textAlign: 'center', width: 210 }}>Xuất cho Phôi</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map(p => {
                    const du = p.conXuat <= 0
                    const lech = nghen.has(p.id)
                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--border)', background: lech ? 'var(--red-bg, #fef2f2)' : undefined }}>
                        <td style={{ ...td, color: 'var(--text3)' }}>{p.manhTen}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {p.loaiSat}
                          {lech && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#dc2626', marginLeft: 6, fontWeight: 700 }}><AlertTriangle size={11} /> chưa đồng bộ</span>}
                        </td>
                        <td style={{ ...td, color: 'var(--text3)' }}>{p.quyCach}</td>
                        <td style={tdR}>{p.planCay}</td>
                        <td style={tdR}>{p.daXuat}</td>
                        <td style={tdR}>{p.daCat}</td>
                        <td style={{ ...tdR, fontWeight: 700, color: du ? 'var(--green)' : '#dc2626' }}>{p.conXuat}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          {du ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                              <Check size={14} /> đã xuất đủ
                            </span>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <input type="number" min={1} max={p.conXuat}
                                value={qty[p.id] ?? String(p.conXuat)}
                                onChange={e => setQty(q => ({ ...q, [p.id]: e.target.value }))}
                                style={{ width: 68, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                              <button onClick={() => xuat(p)}
                                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: lech ? '#dc2626' : ACCENT, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Xuất
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
          </div>
        )
      })}
      {groups.length === 0 && (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Không có kế hoạch xuất sắt</div>
      )}
    </div>
  )
}
