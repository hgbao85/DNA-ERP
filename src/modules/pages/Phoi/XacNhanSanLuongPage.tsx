'use client'

/**
 * Xác nhận sản lượng (Phôi) — mục sidebar, TRÊN "Lệnh sản xuất".
 *
 * Bảng phẳng các đợt sắt kho xuất qua. Phôi đối chiếu với output cắt sắt rồi bấm
 * "Xác nhận" (chốt sản lượng cây đã cắt). Nếu máy cắt sai → "Báo sai lệch" để sửa
 * số cây thực. Không nhập tay từ đầu — chỉ đếm & xác nhận.
 */

import { Fragment, useState } from 'react'
import { Check, CircleAlert, ChevronRight, ChevronDown } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { SatIssueView } from '../../../services/api'
import { moTaKieuCat } from '../../../lib/quy-doi-sat'
import LoadingState from '../../../components/LoadingState'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

export default function XacNhanSanLuongPage({ readOnly = false }: { readOnly?: boolean }) {
  const { data: lines, isLoading, refetch } = useFetch<SatIssueView[]>(() => api.getDotXuatSat(), [])
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (isLoading || !lines) return <LoadingState />

  const xacNhan = async (id: string, soCayThuc?: number) => {
    await api.xacNhanCatXong(id, soCayThuc)
    setEdit(e => { const { [id]: _, ...rest } = e; return rest })
    refetch()
  }

  // Chờ xác nhận trước, đã xác nhận (mờ) sau — trong cùng thời điểm giữ theo giờ xuất.
  const rows = [...lines].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'DA_NHAN' ? -1 : 1
    return b.dotThoiGian.localeCompare(a.dotThoiGian)
  })
  const choXacNhan = lines.filter(l => l.status === 'DA_NHAN').length

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Xác nhận sản lượng</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Đối chiếu số cây với output cắt sắt rồi bấm <b>Xác nhận</b>. Máy cắt sai → <b>Báo sai lệch</b> để sửa số cây thực.
        {choXacNhan > 0 && <> · <b style={{ color: '#e65100' }}>{choXacNhan}</b> đợt chờ xác nhận.</>}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO</th>
              <th style={th}>Loại sắt</th>
              <th style={th}>Quy cách</th>
              <th style={thR}>Chiều dài (mm)</th>
              <th style={thR}>Số lượng (cây)</th>
              <th style={th}>Thời gian xuất</th>
              <th style={{ ...th, textAlign: 'center', width: 260 }}>Xác nhận</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(l => {
              const done = l.status === 'DA_CAT'
              const editing = edit[l.id] != null
              const sai = done && l.soCayThuc != null && l.soCayThuc !== l.soCay
              const isOpen = open.has(l.id)
              return (
                <Fragment key={l.id}>
                <tr style={{ borderTop: '1px solid var(--border)', opacity: done ? 0.7 : 1 }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    <button onClick={() => toggle(l.id)} title="Xem cắt ra được gì"
                      style={{ display: 'inline-flex', verticalAlign: -3, marginRight: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {l.poNumber}
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{l.loaiSat}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{l.quyCach}</td>
                  <td style={tdR}>{l.barLen.toLocaleString('vi-VN')}</td>
                  <td style={tdR}>
                    {editing ? (
                      <input type="number" min={0} value={edit[l.id]} autoFocus
                        onChange={e => setEdit(prev => ({ ...prev, [l.id]: e.target.value }))}
                        style={{ width: 72, padding: '4px 8px', border: '1px solid #e65100', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                    ) : (
                      <span style={{ fontWeight: 700 }}>{done ? (l.soCayThuc ?? l.soCay) : l.soCay}</span>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{l.dotThoiGian}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {done ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                        <Check size={14} /> Đã xác nhận
                        {sai && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#d97706', marginLeft: 4 }}>
                            <CircleAlert size={11} /> lệch {l.soCayThuc! - l.soCay > 0 ? '+' : ''}{l.soCayThuc! - l.soCay}
                          </span>
                        )}
                      </span>
                    ) : readOnly ? (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>chờ xác nhận</span>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => xacNhan(l.id, editing ? Math.max(0, Number(edit[l.id]) || 0) : undefined)}
                          style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#e65100', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {editing ? 'Lưu & xác nhận' : 'Xác nhận'}
                        </button>
                        {!editing && (
                          <button
                            onClick={() => setEdit(prev => ({ ...prev, [l.id]: String(l.soCay) }))}
                            style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Báo sai lệch
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr style={{ background: 'var(--surface2)' }}>
                    <td colSpan={7} style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                        Cắt ra <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(theo kế hoạch cắt sắt · hao hụt {l.hhTongMm.toLocaleString('vi-VN')}mm)</span>:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {l.doanQuyDoi.map(d => (
                          <span key={d.len} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <b style={{ color: '#e65100' }}>{d.count}</b> đoạn <span style={{ color: 'var(--text2)' }}>{d.len}mm</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Kiểu cắt:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {l.bundles.map((b, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--text)' }}>
                            <b>{b.soCay} cây</b> <span style={{ color: 'var(--text3)' }}>→ mỗi cây:</span> {moTaKieuCat(b)}
                            <span style={{ color: 'var(--text3)' }}> · hao hụt {b.hhPerCay}mm/cây</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có đợt sắt nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
