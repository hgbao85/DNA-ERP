'use client'

/**
 * Xác nhận sản lượng (Hàn / Sơn) — mục sidebar DƯỚI "Lệnh sản xuất".
 *
 * Tổ đối chiếu VẬT TƯ TIÊU HAO kho vừa cấp qua "Phân phối nội bộ" rồi bấm "Xác nhận
 * đã nhận" (ghi mốc thời gian). Đơn giản hơn Phôi: KHÔNG qua KCS.
 * Toggle góc phải: "Xác nhận" (đợt chờ) · "Lịch sử" (log đã nhận + tổng theo vật tư).
 */

import { useMemo, useState } from 'react'
import { Check, PackageCheck, Clock } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { tabBtn } from '../../../styles/buttons'
import * as api from '../../../services/api'
import type { VatTuStage, VatTuIssue } from '../../../services/api'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#e65100'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }
const emptyBox: React.CSSProperties = { padding: 44, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14 }

const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function XacNhanVatTuPage({ stage, readOnly = false }: { stage: VatTuStage; readOnly?: boolean }) {
  const { data: issues, isLoading, refetch } = useFetch<VatTuIssue[]>(() => api.getVatTuIssues(stage), [stage])
  const [view, setView] = useState<'confirm' | 'history'>('confirm')
  const [edit, setEdit] = useState<Record<string, string>>({})

  const choNhan = useMemo(
    () => (issues ?? []).filter(i => i.status === 'CHO_NHAN').sort((a, b) => a.xuatAt.localeCompare(b.xuatAt)),
    [issues],
  )
  const daNhan = useMemo(
    () => (issues ?? []).filter(i => i.status === 'DA_NHAN').sort((a, b) => (b.nhanAt ?? '').localeCompare(a.nhanAt ?? '')),
    [issues],
  )
  // Tổng đã nhận theo vật tư — để analys "đã dùng bao nhiêu".
  const tongTheoVatTu = useMemo(() => {
    const m = new Map<string, { tenVatTu: string; dvt: string; tong: number }>()
    for (const i of daNhan) {
      const k = `${i.tenVatTu}|${i.dvt}`
      const ex = m.get(k)
      const add = i.soLuongNhan ?? i.soLuong
      if (ex) ex.tong += add
      else m.set(k, { tenVatTu: i.tenVatTu, dvt: i.dvt, tong: add })
    }
    return [...m.values()]
  }, [daNhan])

  if (isLoading || !issues) return <LoadingState />

  const xacNhan = async (i: VatTuIssue) => {
    const raw = edit[i.id]
    const soNhan = raw != null ? Math.max(0, Math.floor(Number(raw) || 0)) : undefined
    await api.xacNhanNhanVatTu(i.id, soNhan)
    setEdit(e => { const { [i.id]: _, ...rest } = e; return rest })
    refetch()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PackageCheck size={20} /> Xác nhận sản lượng
        </h2>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setView('confirm')} style={tabBtn(view === 'confirm', ACCENT)}>
            Xác nhận
            {choNhan.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: '#fff3e0', color: ACCENT }}>{choNhan.length}</span>}
          </button>
          <button onClick={() => setView('history')} style={tabBtn(view === 'history', ACCENT)}>
            <Clock size={13} /> Lịch sử
          </button>
        </div>
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>
        Đối chiếu <b>vật tư kho vừa cấp</b> (Phân phối nội bộ) rồi bấm <b style={{ color: ACCENT }}>Xác nhận đã nhận</b> — mọi lần nhận được ghi vào <b>Lịch sử</b> để theo dõi vật tư đã dùng.
      </div>

      {/* ── View: Xác nhận (đợt chờ) ─────────────────────────── */}
      {view === 'confirm' && (
        choNhan.length === 0 ? (
          <div style={emptyBox}>Không có đợt nào chờ xác nhận</div>
        ) : (
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>PO</th>
                  <th style={th}>Vật tư</th>
                  <th style={th}>ĐVT</th>
                  <th style={thR}>SL kho xuất</th>
                  <th style={th}>Thời gian xuất</th>
                  <th style={{ ...th, textAlign: 'center', width: 280 }}>Xác nhận nhận</th>
                </tr>
              </thead>
              <tbody>
                {choNhan.map(i => {
                  const editing = edit[i.id] != null
                  return (
                    <tr key={i.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{i.poNumber}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{i.tenVatTu}</td>
                      <td style={{ ...td, color: 'var(--text3)' }}>{i.dvt}</td>
                      <td style={tdR}>
                        {editing ? (
                          <input type="number" min={0} value={edit[i.id]} autoFocus
                            onChange={e => setEdit(prev => ({ ...prev, [i.id]: e.target.value }))}
                            style={{ width: 72, padding: '4px 8px', border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                        ) : (
                          <span style={{ fontWeight: 700 }}>{fmt(i.soLuong)}</span>
                        )}
                      </td>
                      <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{i.xuatAt}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        {readOnly ? (
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>chờ xác nhận</span>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button onClick={() => xacNhan(i)}
                              style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              {editing ? 'Lưu & xác nhận' : 'Xác nhận đã nhận'}
                            </button>
                            {!editing && (
                              <button onClick={() => setEdit(prev => ({ ...prev, [i.id]: String(i.soLuong) }))}
                                style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Nhận thiếu
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── View: Lịch sử đã nhận ────────────────────────────── */}
      {view === 'history' && (
        daNhan.length === 0 ? (
          <div style={emptyBox}>Chưa nhận đợt vật tư nào</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {tongTheoVatTu.map(t => (
                <span key={t.tenVatTu} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, fontSize: 12, padding: '5px 12px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text2)' }}>{t.tenVatTu}:</span>
                  <b style={{ color: '#16a34a' }}>{fmt(t.tong)}</b>
                  <span style={{ color: 'var(--text3)' }}>{t.dvt}</span>
                </span>
              ))}
            </div>
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={th}>PO</th>
                    <th style={th}>Vật tư</th>
                    <th style={th}>ĐVT</th>
                    <th style={thR}>SL đã nhận</th>
                    <th style={th}>Thời gian xuất</th>
                    <th style={th}>Thời gian nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {daNhan.map(i => {
                    const nhan = i.soLuongNhan ?? i.soLuong
                    const thieu = nhan < i.soLuong
                    return (
                      <tr key={i.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{i.poNumber}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{i.tenVatTu}</td>
                        <td style={{ ...td, color: 'var(--text3)' }}>{i.dvt}</td>
                        <td style={tdR}>
                          <span style={{ fontWeight: 700 }}>{fmt(nhan)}</span>
                          {thieu && <span style={{ fontSize: 11, color: '#c2410c' }}> / {fmt(i.soLuong)} xuất</span>}
                        </td>
                        <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{i.xuatAt}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 600 }}>
                            <Check size={14} /> {i.nhanAt}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}
