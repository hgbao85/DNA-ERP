'use client'

/**
 * Khối "Đang chờ KCS chấm" của 1 tổ (màn QLSX "Sản lượng xưởng", 2026-10-13, mục 15 plan QR; P1 18/11/2026): các đợt công
 * nhân đã báo mà KCS chưa chấm, kèm TỪNG lần báo (ai / máy nào / lúc nào / bao nhiêu). KCS tự chấm nên QLSX KHÔNG còn "Gửi
 * KCS" - ở đây QLSX chỉ xem và hủy 1 lần báo sai kèm lý do (BE gọi là "đảo": ghi dòng sổ âm, không xoá) cho tới lúc KCS
 * bấm "Chấm" (sau đó BE trả 409 và không hủy được nữa).
 *
 * Mỗi đợt hiện số "đã tính / cần" của SKU và cảnh báo VƯỢT (cỡ đoạn / mảnh báo quá số cần; đoạn báo vượt sắt đã nhận) - chỉ để
 * QLSX nắm, không chặn gì. Dòng xám (blockedReason của BE: lệnh dừng / dữ liệu cũ chưa gắn SKU) vẫn hiện nhưng KHÔNG đếm vào
 * số đầu khối (S5: cùng cách đếm `summary.open` với pill tab). Pat / chân nhôm không có sổ báo nên không hiện ở đây.
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Undo2 } from 'lucide-react'
import {
  floorAdmin, type BeFloorReview, type BeReviewReport, type BeSteelBalance, type FloorStage,
} from '../../../services/floor-api'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { errMsg } from '../../../utils/errors'
import ReasonModal from '../../../components/ReasonModal'
import { isStaleConflict } from './QlsxQueue'
import { ageText, blockedTextOf, btn, card, countedOf, fmtMm, fmtTime, isStale, Notice, Pill, STEP_LABEL } from './qlsxUi'

/** Câu nhắc dưới tên khối và ở chân từng đợt (hợp đồng v2, mục 16). */
const NO_CANCEL_NOTE = 'KCS bấm Chấm thì không hủy được nữa'

/** 1 dòng "đã tính/cần": cỡ đoạn hoặc mảnh. required = 0 -> không rõ số cần, chỉ hiện số trong đợt. */
interface ItemLine {
  label: string
  qty: number
  required: number
  /** Số ĐƯỢC TÍNH của SKU (đã báo - lỗi - thiếu KCS ghi). */
  done: number
  over: number
}

interface Item {
  key: string
  title: string
  sub: string
  total: string
  who: string | null
  /** Lần báo còn hiệu lực đầu tiên chưa được KCS chấm - "chờ bao lâu" tính từ đây. */
  since: string
  lines: ItemLine[]
  steel: BeSteelBalance | null
  /** Dòng xám: chưa chấm được (kèm lý do) - hiện nhưng không đếm, không tính "quá 4 giờ". */
  blocked: string | null
  reports: BeReviewReport[]
}

const lineText = (r: BeReviewReport) => r.lines
  .map((l) => l.cutLengthMm != null ? `${l.qty} đoạn ${fmtMm(l.cutLengthMm)}mm` : `${l.qty} ${l.piece?.name ?? 'mảnh'}`)
  .join(', ')

/** "6 đoạn 441mm" (1 cỡ) hoặc "10 đoạn: 6×441, 4×405" (nhiều cỡ). */
function segText(segments: { cutLengthMm: number; qty: number }[]): string {
  const total = segments.reduce((t, s) => t + s.qty, 0)
  if (segments.length === 1) return `${total} đoạn ${fmtMm(segments[0].cutLengthMm)}mm`
  return `${total} đoạn: ${segments.map((s) => `${s.qty}×${fmtMm(s.cutLengthMm)}`).join(', ')}`
}

const meters = (mm: number) => (mm / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/** Các cảnh báo vượt của 1 đợt - dùng cho viền / nhãn "vượt" trên thẻ. */
function warningsOf(it: Item): string[] {
  const w = it.lines.filter((l) => l.over > 0).map((l) => `${l.label} đã tính ${l.done}/${l.required} (vượt ${l.over})`)
  if (it.steel && it.steel.overMm > 0) {
    w.push(`đoạn báo vượt sắt đã nhận ${meters(it.steel.overMm)} m (nhận ${it.steel.receivedBarCount} cây)`)
  }
  return w
}

function buildItems(data: BeFloorReview): Item[] {
  const where = (pi: { code: string } | null, order: { sku: string } | null) =>
    [pi?.code, order?.sku].filter(Boolean).join(' · ')
  const items: Item[] = []
  for (const b of data.cutBundles) {
    items.push({
      key: `cut-${b.cutBundleId}`,
      title: `Cắt · ${b.material.name}`,
      sub: where(b.pi, b.order),
      total: segText(b.segments),
      who: b.openedByName,
      since: b.waitingSince,
      lines: b.progress.map((p) => ({ label: `${fmtMm(p.cutLengthMm)}mm`, qty: p.qty, required: p.required, done: p.done, over: p.over })),
      steel: b.steelBalance,
      blocked: blockedTextOf(b.blockedReason),
      reports: b.reports,
    })
  }
  for (const g of data.stepGroups) {
    const names = [...new Set(g.reports.map((r) => r.reportedByName).filter(Boolean))].join(', ')
    items.push({
      // Mỗi công nhân 1 nhóm riêng (mục 20.5/26) - khoá có workerId.
      key: `step-${g.pi?.productionInvoiceId}-${g.material.materialId}-${g.step}-${g.order?.productionOrderId}-${g.workerId ?? 'cu'}`,
      title: `${STEP_LABEL[g.step] ?? g.step} · ${g.material.name}`,
      sub: where(g.pi, g.order),
      total: segText(g.segments),
      who: g.workerName ?? (names || null),
      since: g.waitingSince,
      lines: g.progress.map((p) => ({ label: `${fmtMm(p.cutLengthMm)}mm`, qty: p.qty, required: p.required, done: p.done, over: p.over })),
      steel: null,
      // Theo blockedReason của BE; chỉ khi BE cũ chưa có trường này mới suy từ order / pi = null.
      blocked: blockedTextOf(g.blockedReason, !(g.order && g.pi)),
      reports: g.reports,
    })
  }
  for (const b of data.pieceBatches) {
    items.push({
      key: `piece-${b.productionBatchId}`,
      title: `${b.piece.name}`,
      sub: where(b.pi, b.order),
      total: `${b.reportedQty} mảnh`,
      who: b.openedByName,
      since: b.waitingSince,
      lines: [{ label: b.piece.name, qty: b.reportedQty, required: b.progress.required, done: b.progress.reported, over: b.progress.over }],
      steel: null,
      blocked: blockedTextOf(b.blockedReason),
      reports: b.reports,
    })
  }
  return items.sort((a, b) => a.since.localeCompare(b.since))
}

export default function QlsxReview({ data, onChanged }: {
  stage: FloorStage
  data: BeFloorReview
  onChanged: () => void
}) {
  const items = useMemo(() => buildItems(data), [data])
  const isMobile = useIsMobile()
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [rev, setRev] = useState<{ report: BeReviewReport; label: string } | null>(null)
  const [reason, setReason] = useState('')
  const [revBusy, setRevBusy] = useState(false)
  const [revErr, setRevErr] = useState<string | null>(null)
  // Đồng hồ 1 phút/lần để "chờ 3 giờ" tự nhảy mà không tải lại dữ liệu.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])

  const toggle = (k: string) => setOpenKeys((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  // Số đầu khối = số dòng KHÔNG xám (= summary.open của BE); dòng xám đếm riêng để ghi chú dưới khối.
  const counted = countedOf(items)
  const blockedCount = items.length - counted.length
  const warnCount = counted.filter((i) => warningsOf(i).length > 0).length

  const cancelBtn = (r: BeReviewReport) => (
    <button type="button" style={btn('danger')} title={`Hủy lần báo sai này (phải ghi lý do, công nhân sẽ thấy). ${NO_CANCEL_NOTE}.`}
      aria-label={`Hủy lần báo ${lineText(r)} của ${r.reportedByName ?? 'công nhân'}`}
      onClick={() => { setRev({ report: r, label: `${lineText(r)} (${r.reportedByName ?? '—'}, ${fmtTime(r.createdAt)})` }); setReason(''); setRevErr(null) }}>
      <Undo2 size={14} /> Hủy
    </button>
  )

  const doReverse = async () => {
    if (!rev) return
    setRevBusy(true); setRevErr(null)
    try {
      await floorAdmin.reverse(rev.report.floorReportId, reason.trim())
      setMsg({ tone: 'ok', text: `Đã hủy lần báo ${rev.label}` })
      setRev(null); setReason(''); onChanged()
    } catch (e) {
      // 409 = KCS vừa bấm Chấm đợt này (hoặc đợt đã đổi): giữ câu của máy chủ trong hộp và tải lại danh sách để đợt biến khỏi khối.
      setRevErr(errMsg(e))
      if (isStaleConflict(e)) onChanged()
    } finally { setRevBusy(false) }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Đang chờ KCS chấm">
      <ReasonModal
        open={!!rev} title="Hủy lần báo này?" busy={revBusy} error={revErr}
        description={rev ? `Hủy ${rev.label}. Số này được trừ khỏi đợt; lần báo vẫn được lưu lại kèm lý do hủy và công nhân sẽ thấy lý do này. ${NO_CANCEL_NOTE}.` : undefined}
        reason={reason} onReasonChange={setReason} placeholder="Lý do hủy - vd: đếm lại tại máy chỉ có 40 đoạn"
        confirmLabel="Hủy lần báo" cancelLabel="Không hủy" confirmDisabled={reason.trim().length < 3}
        onCancel={() => { setRev(null); setReason(''); setRevErr(null) }} onConfirm={() => void doReverse()}
      />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Đang chờ KCS chấm</span>
          {counted.length > 0 && <Pill tone="amber">{counted.length}</Pill>}
          {warnCount > 0 && <Pill tone="red">{warnCount} có cảnh báo vượt</Pill>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          Công nhân báo là sang KCS; KCS tự chấm. Báo sai thì hủy lần báo ở đây. {NO_CANCEL_NOTE}.
        </div>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {items.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text3)', padding: 28 }}>
          Không có đợt nào đang chờ KCS chấm. Công nhân báo xong sẽ hiện ở đây.
        </div>
      ) : items.map((it) => {
        const open = openKeys.has(it.key)
        // Dòng xám không tính "quá 4 giờ" (BE cũng không tính vào stale).
        const stale = !it.blocked && isStale(it.since, now)
        const live = it.reports.filter((r) => !r.reversed)
        const warns = warningsOf(it)
        const known = it.lines.filter((l) => l.required > 0)
        return (
          <article key={it.key} style={{ ...card, padding: 0, borderColor: warns.length ? 'var(--amber)' : undefined, background: it.blocked ? 'var(--surface2)' : undefined }}>
            {/* 2026-10-20 (mục 53, "gọn thẻ"): cả đầu thẻ bấm được để mở/đóng; xem từng lần báo ở phần mở ra (kèm nút Hủy). */}
            <div role="button" tabIndex={0} aria-expanded={open} onClick={() => toggle(it.key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(it.key) } }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', flexWrap: 'wrap', cursor: 'pointer' }}>
              <span aria-hidden style={{ display: 'inline-flex', color: 'var(--text2)' }}>
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: it.blocked ? 'var(--text2)' : undefined }}>{it.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{it.sub}{it.who ? ` · ${it.who}` : ''}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{it.total} · <span style={{ color: 'var(--text3)' }}>{live.length} lần báo</span></div>
              </div>
              <div style={{ fontSize: 12, color: stale ? 'var(--amber)' : 'var(--text3)', fontWeight: stale ? 700 : 400, whiteSpace: 'nowrap' }}
                title="Tính từ lần báo đầu tiên chưa được KCS chấm">
                {stale ? '⚠ ' : ''}chờ {ageText(it.since, now)}
              </div>
              {warns.length > 0 && <Pill tone="amber">vượt</Pill>}
              <span style={{ fontSize: 12, color: 'var(--blue-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{open ? 'Thu gọn' : 'Xem lần báo'}</span>
            </div>
            {(known.length > 0 || warns.length > 0 || it.blocked) && (
              <div style={{ padding: '0 14px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {known.length > 0 && (
                  <ul style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12 }}
                    aria-label="Đã tính so với số cần">
                    {known.map((l) => (
                      <li key={l.label} style={{ color: l.over > 0 ? 'var(--amber)' : 'var(--text2)', fontWeight: l.over > 0 ? 700 : 400 }}>
                        {l.label}: đã tính {l.done}/{l.required}{l.over > 0 ? ` · vượt ${l.over}` : l.done >= l.required ? ' · đủ' : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {it.steel && it.steel.overMm > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}
                    title={`Sắt dùng được ${meters(it.steel.usableMm)} m, đoạn đã báo ${meters(it.steel.reportedMm)} m (loại sắt này, cả lệnh)`}>
                    ⚠ Đoạn báo vượt sắt đã nhận {meters(it.steel.overMm)} m (nhận {it.steel.receivedBarCount} cây)
                  </div>
                )}
                {it.blocked && <div style={{ fontSize: 12, color: 'var(--text3)', overflowWrap: 'anywhere' }}>{it.blocked}</div>}
              </div>
            )}
            {open && (
              <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                {isMobile ? (
                  // Màn hẹp: mỗi lần báo là 1 thẻ 2 tầng, nút Hủy nằm ngay trong khung nhìn (không phải cuộn ngang).
                  <div>
                    {it.reports.map((r) => (
                      <div key={r.floorReportId} style={{ borderTop: '1px solid var(--border)', padding: '9px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                          <span>{fmtTime(r.createdAt)}</span>
                          <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>
                            {r.reportedByName ?? '—'} · {r.workstation ? r.workstation.name : 'màn cũ'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere', textDecoration: r.reversed ? 'line-through' : 'none', color: r.reversed ? 'var(--text3)' : 'var(--text)' }}>
                            {lineText(r)}
                          </span>
                          {!r.reversed && cancelBtn(r)}
                        </div>
                        {r.reversed && <span style={{ fontSize: 12, color: 'var(--amber)' }}>Đã hủy: {r.reversed.reason ?? '—'}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                  <tbody>
                    {it.reports.map((r) => (
                      <tr key={r.floorReportId} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtTime(r.createdAt)}</td>
                        <td style={{ padding: '9px 8px', fontSize: 13, fontWeight: 600, textDecoration: r.reversed ? 'line-through' : 'none', color: r.reversed ? 'var(--text3)' : 'var(--text)' }}>
                          {lineText(r)}
                        </td>
                        <td style={{ padding: '9px 8px', fontSize: 12, color: 'var(--text2)' }}>
                          {r.reportedByName ?? '—'} · {r.workstation ? <span title={`Mã máy ${r.workstation.code}`}>{r.workstation.name}</span> : <span title="Báo từ màn thống kê cũ, không qua QR">màn cũ</span>}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          {r.reversed ? (
                            <span style={{ fontSize: 12, color: 'var(--amber)' }}>Đã hủy: {r.reversed.reason ?? '—'}</span>
                          ) : (
                            cancelBtn(r)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
                  {NO_CANCEL_NOTE}. Số sai sau đó thì báo KCS ghi “số thực có” khi chấm.
                </div>
              </div>
            )}
          </article>
        )
      })}
      {blockedCount > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {blockedCount} đợt xám (lệnh đang tạm dừng / đã kết thúc, hoặc dữ liệu cũ chưa gắn SKU) chưa chấm được nên không tính vào số ở trên.
        </div>
      )}
    </section>
  )
}
