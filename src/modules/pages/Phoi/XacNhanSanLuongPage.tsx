'use client'

/**
 * Xác nhận sản lượng (Phôi) — mục sidebar, TRÊN "Lệnh sản xuất".
 *
 * Bảng phẳng các đợt sắt kho xuất qua. Phôi đối chiếu với output cắt sắt rồi bấm
 * "Xác nhận" (chốt sản lượng cây đã cắt). Nếu máy cắt sai → "Báo sai lệch" để sửa
 * số cây thực. Không nhập tay từ đầu — chỉ đếm & xác nhận.
 */

import { Fragment, useState } from 'react'
import { Check, CircleAlert, ChevronRight, ChevronDown, Clock, RotateCcw } from 'lucide-react'
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

  // Thứ tự ưu tiên: KCS trả về sửa lại → chờ xác nhận → chờ KCS → đã duyệt (mờ).
  const rank = (l: SatIssueView) =>
    l.status === 'DA_NHAN' && l.reworkOf ? 0
      : l.status === 'DA_NHAN' ? 1
        : l.status === 'CHO_KCS' ? 2 : 3
  const rows = [...lines].sort((a, b) => {
    const r = rank(a) - rank(b)
    return r !== 0 ? r : b.dotThoiGian.localeCompare(a.dotThoiGian)
  })
  const choXacNhan = lines.filter(l => l.status === 'DA_NHAN' && !l.reworkOf).length
  const traVeList = lines.filter(l => l.status === 'DA_NHAN' && l.reworkOf)
  const traVe = traVeList.length
  const traVeCay = traVeList.reduce((s, l) => s + l.soCay, 0)

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Xác nhận sản lượng</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Đối chiếu số cây với output cắt sắt rồi bấm <b>Xác nhận</b> → đợt chuyển sang <b style={{ color: '#d97706' }}>chờ KCS duyệt</b>. KCS chấm xong sẽ hiện <b style={{ color: '#16a34a' }}>ĐẠT</b> / <b style={{ color: '#c62828' }}>LỖI</b> ngay tại đây.
        {choXacNhan > 0 && <> · <b style={{ color: '#e65100' }}>{choXacNhan}</b> đợt chờ xác nhận.</>}
      </div>

      {traVe > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
          <RotateCcw size={16} />
          <span><b>{traVe}</b> đợt KCS trả về cần <b>sửa lại</b> · tổng <b>{traVeCay}</b> cây — sửa xong bấm <b>Đã sửa · gửi lại</b> để gửi kiểm lại.</span>
        </div>
      )}

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
              const confirmed = l.status !== 'DA_NHAN'   // đã xác nhận (CHO_KCS | DA_CAT)
              const daKcs = l.status === 'DA_CAT'         // KCS đã duyệt
              const editing = edit[l.id] != null
              const failed = l.kcsFailedQty ?? 0
              const scrap = l.kcsScrapQty ?? 0
              const rework = failed - scrap
              const passed = l.soCayThuc ?? l.soCay       // DA_CAT: soCayThuc = phần đạt
              const baoCat = passed + (daKcs ? failed : 0) // SL Phôi đã gửi (đạt + lỗi)
              const isReturn = l.status === 'DA_NHAN' && !!l.reworkOf
              const isOpen = open.has(l.id)
              return (
                <Fragment key={l.id}>
                <tr style={{ borderTop: '1px solid var(--border)', opacity: confirmed && !daKcs ? 0.75 : 1, background: isReturn ? 'var(--red-bg, #fef2f2)' : undefined }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    <button onClick={() => toggle(l.id)} title="Xem cắt ra được gì"
                      style={{ display: 'inline-flex', verticalAlign: -3, marginRight: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {l.poNumber}
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {l.loaiSat}
                    {isReturn && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#c62828', marginLeft: 6 }}><RotateCcw size={11} /> KCS trả về · sửa lại</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{l.quyCach}</td>
                  <td style={tdR}>{l.barLen.toLocaleString('vi-VN')}</td>
                  <td style={tdR}>
                    {editing ? (
                      <input type="number" min={0} value={edit[l.id]} autoFocus
                        onChange={e => setEdit(prev => ({ ...prev, [l.id]: e.target.value }))}
                        style={{ width: 72, padding: '4px 8px', border: '1px solid #e65100', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                    ) : (
                      <span style={{ fontWeight: 700 }}>{confirmed ? baoCat : l.soCay}</span>
                    )}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{l.dotThoiGian}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {confirmed ? (
                      daKcs ? (
                        failed > 0 ? (
                          <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 700 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#16a34a' }}><Check size={13} /> Đạt {passed}</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#c62828' }}><CircleAlert size={13} /> Lỗi {failed}</span>
                            </span>
                            {(rework > 0 || scrap > 0) && (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                                {[rework > 0 ? `${rework} sửa lại` : '', scrap > 0 ? `${scrap} cấp lại` : ''].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                            <Check size={14} /> KCS: ĐẠT
                          </span>
                        )
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#d97706' }}>
                          <Clock size={13} /> Chờ KCS duyệt
                        </span>
                      )
                    ) : readOnly ? (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>chờ xác nhận</span>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => xacNhan(l.id, editing ? Math.max(0, Number(edit[l.id]) || 0) : undefined)}
                          style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#e65100', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {editing ? 'Lưu & xác nhận' : isReturn ? 'Đã sửa · gửi lại' : 'Xác nhận'}
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
