'use client'

/**
 * Xác nhận nhận sắt (Phôi) — mục sidebar, TRÊN "Lệnh sản xuất".
 *
 * Gộp 2 màn cũ (2026-08-22): "Xác nhận sản lượng" và "Lịch sử nhận sắt" — thành 1 màn có 2 tab con:
 * "Xác nhận" (mặc định, hành động) và "Lịch sử" (đọc-only).
 *
 * Phạm vi tab "Xác nhận" CHỈ còn đúng 1 việc (2026-08-22, chốt lại lần 2): xác nhận đã nhận đợt kho
 * vừa xuất (ISSUED -> RECEIVED). "Báo cắt xong" (chọn kiểu cắt + complete-cutting) và đánh dấu công
 * đoạn chi tiết (uốn/dập) đã CHUYỂN SANG "Lệnh sản xuất" — đợt sau khi nhận xong không còn hành
 * động gì ở màn này nữa, chỉ hiện trạng thái tham khảo (đọc từ đúng cùng nguồn dữ liệu).
 */

import { Fragment, useMemo, useState } from 'react'
import { Check, ChevronLeft, Clock, RotateCcw, Package, Wrench, ArrowDownToLine } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue, BeQcReview } from '../../../services/steel-issues-api'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

type SubTab = 'xac-nhan' | 'lich-su'

export default function XacNhanNhanSatPage({ readOnly = false }: { readOnly?: boolean }) {
  const [subTab, setSubTab] = useState<SubTab>('xac-nhan')
  // Chung 1 nguồn dữ liệu cho cả 2 tab - trước đây 2 màn riêng mỗi màn tự gọi GET /steel-issues
  // (2 lần cùng 1 dữ liệu), gộp lại còn 1 lần.
  const { data: lines, isLoading, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: reviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])

  if (isLoading || !lines) return <LoadingState />

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <SubTabBtn active={subTab === 'xac-nhan'} onClick={() => setSubTab('xac-nhan')} icon={<Package size={14} />}>
          Xác nhận
        </SubTabBtn>
        <SubTabBtn active={subTab === 'lich-su'} onClick={() => setSubTab('lich-su')} icon={<ArrowDownToLine size={14} />}>
          Lịch sử
        </SubTabBtn>
      </div>
      {subTab === 'xac-nhan'
        ? <XacNhanTab lines={lines} reviews={reviews ?? []} readOnly={readOnly} refetch={refetch} />
        : <LichSuTab lines={lines} />}
    </div>
  )
}

function SubTabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600,
      border: 'none', borderRadius: 8, cursor: 'pointer',
      background: active ? '#fff3e0' : 'var(--surface2)', color: active ? '#e65100' : 'var(--text2)',
    }}>
      {icon}{children}
    </button>
  )
}

// ── Tab "Xác nhận" — CHỈ còn xác nhận đã nhận (2026-08-22, chốt lại lần 2). Báo cắt xong + đánh
// dấu công đoạn chi tiết đã chuyển sang "Lệnh sản xuất" (LenhSanXuatPhoi.tsx) - đợt sau khi nhận
// xong hiện trạng thái tham khảo ở đây, thao tác làm bên đó.

function XacNhanTab({ lines, reviews, readOnly, refetch }: {
  lines: BeSteelIssue[]; reviews: BeQcReview[]; readOnly: boolean; refetch: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})

  const reviewByIssue = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews) if (r.steelIssueId) m.set(r.steelIssueId, r)
    return m
  }, [reviews])

  const doReceive = async (l: BeSteelIssue) => {
    setBusy(l.id); setErr(p => ({ ...p, [l.id]: '' }))
    try { await api.receiveSteelIssue(l.id); refetch() }
    catch (e) { setErr(p => ({ ...p, [l.id]: errMsg(e, 'Không xác nhận được') })) }
    finally { setBusy(null) }
  }

  // Thứ tự ưu tiên: chờ nhận (việc của màn này) → phần còn lại (chỉ tham khảo, việc của "Lệnh sản
  // xuất") → đã duyệt (mờ).
  const rank = (l: BeSteelIssue) =>
    l.status === 'ISSUED' ? 0
      : l.status === 'RECEIVED' ? 1
      : l.status === 'IN_PROCESS' ? 2
      : l.status === 'AWAITING_QC' ? 3
      : 4
  const rows = [...lines].sort((a, b) => {
    const r = rank(a) - rank(b)
    return r !== 0 ? r : b.issuedAt.localeCompare(a.issuedAt)
  })
  const choNhan = lines.filter(l => l.status === 'ISSUED').length
  const traVeList = lines.filter(l => l.status === 'RECEIVED' && l.reworkOfId)
  const traVe = traVeList.length
  const traVeCay = traVeList.reduce((s, l) => s + l.barCount, 0)

  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Xác nhận <b>đã nhận</b> đợt kho vừa xuất. Báo cắt xong và đánh dấu công đoạn làm ở <b>Lệnh sản xuất</b>.
        {choNhan > 0 && <> · <b style={{ color: '#e65100' }}>{choNhan}</b> đợt chờ nhận.</>}
      </div>

      {traVe > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
          <RotateCcw size={16} />
          <span><b>{traVe}</b> đợt KCS trả về cần <b>cắt lại</b> · tổng <b>{traVeCay}</b> cây — xử lý ở <b>Lệnh sản xuất</b>.</span>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO</th>
              <th style={th}>Loại sắt</th>
              <th style={thR}>Chiều dài (mm)</th>
              <th style={thR}>Số lượng (cây)</th>
              <th style={th}>Thời gian xuất</th>
              <th style={{ ...th, textAlign: 'center', width: 200 }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(l => {
              const review = reviewByIssue.get(l.id)
              const baoCat = l.actualBarCount ?? l.barCount
              const failed = review?.failedQty ?? 0
              const passed = baoCat - failed
              const isReturn = l.status === 'RECEIVED' && !!l.reworkOfId
              return (
                <Fragment key={l.id}>
                  <tr style={{ borderTop: '1px solid var(--border)', opacity: l.status === 'QC_PASSED' && failed === 0 ? 0.75 : 1, background: isReturn ? 'var(--red-bg, #fef2f2)' : undefined }}>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {l.salesOrderCode ?? '—'}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {l.materialName}
                      {isReturn && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#c62828', marginLeft: 6 }}><RotateCcw size={11} /> KCS trả về · cắt lại</span>}
                    </td>
                    <td style={tdR}>{l.barLengthMm.toLocaleString('vi-VN')}</td>
                    <td style={{ ...tdR, fontWeight: 700 }}>{l.status === 'ISSUED' || l.status === 'RECEIVED' ? l.barCount : baoCat}</td>
                    <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(l.issuedAt).toLocaleString('vi-VN')}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {l.status === 'ISSUED' ? (
                        readOnly ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>chờ xác nhận nhận</span> : (
                          <button onClick={() => doReceive(l)} disabled={busy === l.id}
                            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#e65100', color: '#fff', cursor: busy === l.id ? 'not-allowed' : 'pointer' }}>
                            {busy === l.id ? '...' : 'Xác nhận đã nhận'}
                          </button>
                        )
                      ) : l.status === 'RECEIVED' ? (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>đã nhận · chờ cắt</span>
                      ) : l.status === 'IN_PROCESS' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#7b1fa2' }}>
                          <Wrench size={12} /> đang gia công
                        </span>
                      ) : l.status === 'AWAITING_QC' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#d97706' }}>
                          <Clock size={13} /> Chờ KCS duyệt
                        </span>
                      ) : failed > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#16a34a' }}><Check size={13} /> Đạt {passed}</span>
                          <span style={{ color: '#c62828' }}>Lỗi {failed}</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                          <Check size={14} /> KCS: ĐẠT
                        </span>
                      )}
                    </td>
                  </tr>
                  {err[l.id] && (
                    <tr><td colSpan={6} style={{ padding: '4px 18px 8px', fontSize: 12, color: '#c62828' }}>{err[l.id]}</td></tr>
                  )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có đợt sắt nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab "Lịch sử" — nguyên vẹn từ LichSuNhanSatPage.tsx cũ, chỉ nhận lines qua prop ──────────

interface PiGroup { productionInvoiceId: string; po: string; items: BeSteelIssue[]; thoiGianNhan: string; hoanThanh: string | null }

function LichSuTab({ lines }: { lines: BeSteelIssue[] }) {
  const [selPi, setSelPi] = useState<string | null>(null)

  const groups: PiGroup[] = useMemo(() => {
    // Gom theo productionInvoiceId (luôn duy nhất, gộp cả PI - xem changelog
    // 2026-08-18-xuat-sat-po-pi-vat-tu.md) chứ KHÔNG theo mã hiển thị salesOrderCode.
    const map = new Map<string, BeSteelIssue[]>()
    for (const l of lines) {
      if (!map.has(l.productionInvoiceId)) map.set(l.productionInvoiceId, [])
      map.get(l.productionInvoiceId)!.push(l)
    }
    return [...map.entries()].map(([productionInvoiceId, items]) => {
      const nhan = items.map(i => i.issuedAt).sort()[0] ?? ''
      const allDone = items.every(i => i.status === 'QC_PASSED')
      const hoanThanh = allDone ? (items.map(i => i.completedAt ?? '').sort().at(-1) || null) : null
      return { productionInvoiceId, po: items[0].salesOrderCode ?? items[0].piCode, items, thoiGianNhan: nhan, hoanThanh }
    })
  }, [lines])

  const sel = selPi ? groups.find(g => g.productionInvoiceId === selPi) ?? null : null
  if (sel) return <LichSuDetail g={sel} onBack={() => setSelPi(null)} />

  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Kho xuất sắt qua theo từng PI. Bấm 1 PI để xem kho đã xuất bao nhiêu cây theo từng chiều dài.
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: 150 }} /><col style={{ width: 190 }} /><col style={{ width: 190 }} /></colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO / PI</th>
              <th style={th}>Thời gian nhận</th>
              <th style={th}>Thời gian hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.productionInvoiceId}
                onClick={() => setSelPi(g.productionInvoiceId)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{g.po}</td>
                <td style={{ ...td, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} />{new Date(g.thoiGianNhan).toLocaleString('vi-VN')}</span>
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {g.hoanThanh
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 600 }}><Check size={14} />{new Date(g.hoanThanh).toLocaleString('vi-VN')}</span>
                    : <span style={{ color: '#e65100', fontWeight: 600 }}>Đang tiến hành</span>}
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa nhận đợt sắt nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LichSuDetail({ g, onBack }: { g: PiGroup; onBack: () => void }) {
  // Tổng cây theo chiều dài nguyên cây (6000mm, 5850mm…)
  const byLen = new Map<number, number>()
  for (const it of g.items) byLen.set(it.barLengthMm, (byLen.get(it.barLengthMm) ?? 0) + it.barCount)
  const lenRows = [...byLen.entries()].sort((a, b) => b[0] - a[0])
  const rows = [...g.items].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.materialName.localeCompare(b.materialName))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          <span style={{ fontFamily: 'monospace' }}>{g.po}</span>
        </h2>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16, marginLeft: 2 }}>
        Thời gian nhận: {new Date(g.thoiGianNhan).toLocaleString('vi-VN')} · Hoàn thành: {g.hoanThanh ? new Date(g.hoanThanh).toLocaleString('vi-VN') : 'đang tiến hành'}
      </div>

      {/* Tổng cây theo chiều dài — kho xuất qua bao nhiêu cây 6m / 5m */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>Kho đã xuất qua:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {lenRows.map(([len, cay]) => (
          <div key={len} style={{ ...card, padding: '12px 18px', minWidth: 150 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Cây {len.toLocaleString('vi-VN')}mm <span style={{ color: 'var(--text3)' }}>(~{(len / 1000).toFixed(2)}m)</span></div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e65100' }}>{cay} <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 400 }}>cây</span></div>
          </div>
        ))}
      </div>

      {/* Chi tiết từng đợt / loại sắt */}
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Loại sắt</th>
              <th style={thR}>Chiều dài (mm)</th>
              <th style={thR}>Số cây</th>
              <th style={th}>Thời gian xuất</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{l.materialName}</td>
                <td style={tdR}>{l.barLengthMm.toLocaleString('vi-VN')}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{l.barCount}</td>
                <td style={{ ...td, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(l.issuedAt).toLocaleString('vi-VN')}</td>
                <td style={td}>
                  {l.status === 'QC_PASSED'
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16a34a' }}><Check size={13} /> Đã cắt xong</span>
                    : <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>Chưa cắt xong</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
