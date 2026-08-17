'use client'

/**
 * Xác nhận sản lượng (Phôi) — mục sidebar, TRÊN "Lệnh sản xuất".
 *
 * Đã nối BE thật (M3, 2026-08-12 — "Xuất sắt Phôi"): module `steel-issues`, thay
 * `phoi-sat.service.ts` mock. Khác mock (gộp "nhận" + "báo cắt xong" thành 1 nút "Xác nhận"):
 * BE tách 2 bước thật ISSUED → (receive) → RECEIVED → (complete-cutting) → AWAITING_QC → (KCS
 * duyệt) → QC_PASSED — 2 hành động riêng ở đây. "Báo cắt xong" bắt buộc khai báo đúng theo 1
 * hoặc nhiều kiểu cắt (pattern) đã duyệt của phương án cắt sắt (proposalPatternId thật, vừa lộ
 * qua CuttingProposalPatternResponseDto.id) — không nhập tay đoạn tự do.
 */

import { Fragment, useMemo, useState } from 'react'
import { Check, ChevronRight, ChevronDown, Clock, RotateCcw, Plus, Trash2, Package, Wrench } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue, BeQcReview, CompleteCuttingBundleInput } from '../../../services/steel-issues-api'
import type { CuttingProposalPattern } from '../../../services/cutting-proposals-api'
import type { ProcessStep } from '../../../types/sku'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import { errMsg } from '../../../utils/errors'
import LoadingState from '../../../components/LoadingState'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

const patternLabel = (p: CuttingProposalPattern) => {
  const segs = p.segments.map(s => `${s.countPerBar}×${s.cutLengthMm}mm`).join(' + ')
  return `Kiểu ${p.patternIndex + 1}: ${segs}${p.wastePerBarMm ? ` (hao hụt ${p.wastePerBarMm}mm/cây)` : ''}`
}

interface BundleRow { patternId: string; barCount: string }

export default function XacNhanSanLuongPage({ readOnly = false }: { readOnly?: boolean }) {
  const { data: lines, isLoading, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: reviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})
  // Form "báo cắt xong" theo từng đợt: các kiểu cắt đã chọn + số cây thực.
  const [bundles, setBundles] = useState<Record<string, BundleRow[]>>({})
  const [actualBarCount, setActualBarCount] = useState<Record<string, string>>({})
  const [patternsCache, setPatternsCache] = useState<Record<string, CuttingProposalPattern[]>>({})
  const [patternsLoading, setPatternsLoading] = useState<Set<string>>(new Set())

  const reviewByIssue = useMemo(() => {
    const m = new Map<string, BeQcReview>()
    for (const r of reviews ?? []) if (r.steelIssueId) m.set(r.steelIssueId, r)
    return m
  }, [reviews])

  if (isLoading || !lines) return <LoadingState />

  const toggle = async (l: BeSteelIssue) => {
    const isOpening = !open[l.id]
    setOpen(o => ({ ...o, [l.id]: isOpening }))
    if (isOpening && l.status === 'RECEIVED' && !patternsCache[l.id]) {
      setPatternsLoading(s => new Set(s).add(l.id))
      try {
        const patterns = await api.getApprovedPatternsForMaterial(l.productionOrderId, l.materialId)
        setPatternsCache(c => ({ ...c, [l.id]: patterns }))
        setBundles(b => ({ ...b, [l.id]: patterns.length > 0 ? [{ patternId: patterns[0].id, barCount: String(l.barCount) }] : [] }))
        setActualBarCount(a => ({ ...a, [l.id]: String(l.barCount) }))
      } catch (e) {
        setErr(p => ({ ...p, [l.id]: errMsg(e, 'Không tải được kiểu cắt đã duyệt') }))
      } finally {
        setPatternsLoading(s => { const n = new Set(s); n.delete(l.id); return n })
      }
    }
  }

  const doReceive = async (l: BeSteelIssue) => {
    setBusy(l.id); setErr(p => ({ ...p, [l.id]: '' }))
    try { await api.receiveSteelIssue(l.id); await refetch() }
    catch (e) { setErr(p => ({ ...p, [l.id]: errMsg(e, 'Không xác nhận được') })) }
    finally { setBusy(null) }
  }

  const addBundleRow = (issueId: string) => {
    const patterns = patternsCache[issueId] ?? []
    if (patterns.length === 0) return
    setBundles(b => ({ ...b, [issueId]: [...(b[issueId] ?? []), { patternId: patterns[0].id, barCount: '' }] }))
  }
  const removeBundleRow = (issueId: string, idx: number) =>
    setBundles(b => ({ ...b, [issueId]: (b[issueId] ?? []).filter((_, i) => i !== idx) }))
  const updateBundleRow = (issueId: string, idx: number, patch: Partial<BundleRow>) =>
    setBundles(b => ({ ...b, [issueId]: (b[issueId] ?? []).map((r, i) => i === idx ? { ...r, ...patch } : r) }))

  const doCompleteCutting = async (l: BeSteelIssue) => {
    const rows = bundles[l.id] ?? []
    const patterns = patternsCache[l.id] ?? []
    if (rows.length === 0) { setErr(p => ({ ...p, [l.id]: 'Phải khai báo ít nhất 1 kiểu cắt' })); return }
    const bundlePayload: CompleteCuttingBundleInput[] = []
    for (const r of rows) {
      const pattern = patterns.find(pt => pt.id === r.patternId)
      const barCount = Math.floor(Number(r.barCount) || 0)
      if (!pattern || barCount <= 0) { setErr(p => ({ ...p, [l.id]: 'Mỗi kiểu cắt phải chọn đúng và nhập số cây > 0' })); return }
      bundlePayload.push({
        proposalPatternId: pattern.id, barCount, wastePerBarMm: pattern.wastePerBarMm ?? undefined,
        segments: pattern.segments.map(s => ({ segmentSpecId: s.segmentSpecId, countPerBar: s.countPerBar })),
      })
    }
    const actual = actualBarCount[l.id] != null && actualBarCount[l.id] !== '' ? Math.floor(Number(actualBarCount[l.id])) : undefined
    setBusy(l.id); setErr(p => ({ ...p, [l.id]: '' }))
    try {
      await api.completeCutting(l.id, { actualBarCount: actual, bundles: bundlePayload })
      setOpen(o => ({ ...o, [l.id]: false }))
      await refetch()
    } catch (e) { setErr(p => ({ ...p, [l.id]: errMsg(e, 'Không báo cắt xong được') })) }
    finally { setBusy(null) }
  }

  const doCompleteStep = async (l: BeSteelIssue, step: ProcessStep) => {
    setBusy(l.id); setErr(p => ({ ...p, [l.id]: '' }))
    try { await api.completeStep(l.id, step); await refetch() }
    catch (e) { setErr(p => ({ ...p, [l.id]: errMsg(e, 'Không đánh dấu công đoạn được') })) }
    finally { setBusy(null) }
  }

  // Thứ tự ưu tiên: đợt trả về (rework) → chờ nhận → đã nhận (chờ báo) → đang gia công (chờ đánh
  // dấu công đoạn) → chờ KCS → đã duyệt (mờ).
  const rank = (l: BeSteelIssue) =>
    l.reworkOfId ? 0
      : l.status === 'ISSUED' ? 1
      : l.status === 'RECEIVED' ? 2
      : l.status === 'IN_PROCESS' ? 3
      : l.status === 'AWAITING_QC' ? 4
      : 5
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
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Xác nhận sản lượng</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>
        Xác nhận <b>đã nhận</b> đợt kho vừa xuất, sau đó <b>báo cắt xong</b> theo đúng kiểu cắt đã duyệt. Nếu mảnh có thêm công đoạn khác ngoài Cắt (uốn/dập/...), đợt sẽ <b style={{ color: '#7b1fa2' }}>đang gia công</b> cho tới khi đánh dấu xong hết — rồi mới chuyển <b style={{ color: '#d97706' }}>chờ KCS duyệt</b>. KCS chấm xong sẽ hiện <b style={{ color: '#16a34a' }}>ĐẠT</b> / <b style={{ color: '#c62828' }}>LỖI</b> ngay tại đây.
        {choNhan > 0 && <> · <b style={{ color: '#e65100' }}>{choNhan}</b> đợt chờ nhận.</>}
      </div>

      {traVe > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'var(--red-bg, #fef2f2)', color: '#b91c1c', fontSize: 13 }}>
          <RotateCcw size={16} />
          <span><b>{traVe}</b> đợt KCS trả về cần <b>cắt lại</b> · tổng <b>{traVeCay}</b> cây.</span>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO</th>
              <th style={th}>Loại sắt</th>
              <th style={thR}>Chiều dài (mm)</th>
              <th style={thR}>Số lượng (cây)</th>
              <th style={th}>Thời gian xuất</th>
              <th style={{ ...th, textAlign: 'center', width: 260 }}>Trạng thái / Xác nhận</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(l => {
              const isOpen = !!open[l.id]
              const review = reviewByIssue.get(l.id)
              const baoCat = l.actualBarCount ?? l.barCount
              const failed = review?.failedQty ?? 0
              const passed = baoCat - failed
              const isReturn = l.status === 'RECEIVED' && !!l.reworkOfId
              const canExpand = l.status === 'RECEIVED'
              return (
                <Fragment key={l.id}>
                  <tr style={{ borderTop: '1px solid var(--border)', opacity: l.status === 'QC_PASSED' && failed === 0 ? 0.75 : 1, background: isReturn ? 'var(--red-bg, #fef2f2)' : undefined }}>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {canExpand && (
                        <button onClick={() => toggle(l)} title="Báo cắt xong"
                          style={{ display: 'inline-flex', verticalAlign: -3, marginRight: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}>
                          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      )}
                      {l.poNumber}
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
                        readOnly ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>chờ báo cắt xong</span> : (
                          <button onClick={() => toggle(l)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#e65100', color: '#fff', cursor: 'pointer' }}>
                            <Package size={13} /> {isOpen ? 'Đóng' : 'Báo cắt xong'}
                          </button>
                        )
                      ) : l.status === 'IN_PROCESS' ? (
                        readOnly ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>đang gia công</span> : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#7b1fa2' }}>
                              <Wrench size={12} /> Còn thiếu công đoạn
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
                              {l.requiredSteps.filter(s => !l.completedSteps.includes(s)).map(step => (
                                <button key={step} onClick={() => doCompleteStep(l, step)} disabled={busy === l.id}
                                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, background: '#7b1fa2', color: '#fff', cursor: busy === l.id ? 'not-allowed' : 'pointer' }}>
                                  Xong {PROCESS_STEP_LABELS[step]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
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
                  {isOpen && l.status === 'RECEIVED' && (
                    <tr style={{ background: 'var(--surface2)' }}>
                      <td colSpan={6} style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                        {patternsLoading.has(l.id) ? <LoadingState /> : (patternsCache[l.id]?.length ?? 0) === 0 ? (
                          <div style={{ fontSize: 13, color: '#c62828' }}>Chưa có kiểu cắt nào đã duyệt cho vật tư này — không thể báo cắt xong.</div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                              Khai báo theo kiểu cắt đã duyệt (có thể gồm nhiều kiểu, tổng số cây tối đa {l.barCount}):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {(bundles[l.id] ?? []).map((row, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <select value={row.patternId} onChange={e => updateBundleRow(l.id, idx, { patternId: e.target.value })}
                                    style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}>
                                    {(patternsCache[l.id] ?? []).map(p => <option key={p.id} value={p.id}>{patternLabel(p)}</option>)}
                                  </select>
                                  <input type="number" min={1} placeholder="số cây" value={row.barCount}
                                    onChange={e => updateBundleRow(l.id, idx, { barCount: e.target.value })}
                                    style={{ width: 90, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                                  <button onClick={() => removeBundleRow(l.id, idx)} title="Xoá"
                                    style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'inline-flex' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                              <button onClick={() => addBundleRow(l.id)}
                                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                                <Plus size={13} /> Thêm kiểu cắt
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Số cây thực cắt được (mặc định = đã xuất):</span>
                              <input type="number" min={0} value={actualBarCount[l.id] ?? ''} onChange={e => setActualBarCount(a => ({ ...a, [l.id]: e.target.value }))}
                                style={{ width: 80, padding: '5px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }} />
                              <button onClick={() => doCompleteCutting(l)} disabled={busy === l.id}
                                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#e65100', color: '#fff', cursor: busy === l.id ? 'not-allowed' : 'pointer' }}>
                                {busy === l.id ? '...' : 'Gửi báo cắt xong'}
                              </button>
                            </div>
                          </div>
                        )}
                        {err[l.id] && <div style={{ marginTop: 8, fontSize: 12, color: '#c62828' }}>{err[l.id]}</div>}
                      </td>
                    </tr>
                  )}
                  {err[l.id] && !isOpen && (
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
