'use client'

/**
 * Khối "Chờ gửi KCS" của 1 tổ (màn QLSX "Sản lượng xưởng", 2026-10-13, mục 15 plan QR): các đợt công nhân đã báo
 * mà QLSX chưa gửi KCS, kèm TỪNG lần báo (ai / máy nào / lúc nào / bao nhiêu). QLSX kiểm rồi "Gửi KCS" (từng đợt
 * hoặc tất cả), hoặc đảo 1 lần báo sai kèm lý do. Gửi KCS gọi đúng luồng cũ - KCS không đổi.
 *
 * Mỗi đợt hiện số "đã báo / cần" của SKU và cảnh báo VƯỢT (cỡ đoạn / mảnh báo quá số cần; đoạn báo vượt sắt đã nhận) - chỉ
 * để QLSX kiểm trước khi gửi, KHÔNG chặn gửi (quy tắc "không cap lúc báo, KCS mới là chốt kiểm soát").
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Send, Undo2 } from 'lucide-react'
import {
  floorAdmin, type BeFloorReview, type BeReviewReport, type BeSteelBalance, type FloorStage,
} from '../../../services/floor-api'
import { useConfirm } from '../../../hooks/useConfirm'
import { errMsg } from '../../../utils/errors'
import ReasonModal from '../../../components/ReasonModal'
import { ageText, btn, card, fmtMm, fmtTime, isStale, Notice, Pill, STEP_LABEL } from './qlsxUi'

/** 1 dòng "đã báo/cần": cỡ đoạn hoặc mảnh. required = 0 -> không rõ số cần, chỉ hiện số trong đợt. */
interface ItemLine {
  label: string
  qty: number
  required: number
  done: number
  over: number
}

interface Item {
  key: string
  title: string
  sub: string
  total: string
  who: string | null
  /** Lần báo còn hiệu lực đầu tiên chưa gửi KCS - "chờ bao lâu" tính từ đây. */
  since: string
  lines: ItemLine[]
  steel: BeSteelBalance | null
  /** Không gửi KCS được (kèm lý do) - vd đợt cũ chưa gắn SKU. */
  blocked: string | null
  reports: BeReviewReport[]
  send: () => Promise<unknown>
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

/** Các cảnh báo vượt của 1 đợt - dùng cho dòng nhắc trên thẻ và lời xác nhận khi gửi KCS. */
function warningsOf(it: Item): string[] {
  const w = it.lines.filter((l) => l.over > 0).map((l) => `${l.label} báo ${l.done}/${l.required} (vượt ${l.over})`)
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
      blocked: null,
      reports: b.reports,
      send: () => floorAdmin.sendCutBundle(b.cutBundleId),
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
      blocked: g.order && g.pi ? null : 'Đợt cũ chưa gắn SKU - gán SKU ở màn Phôi trước khi gửi KCS',
      reports: g.reports,
      send: () => floorAdmin.sendStepGroup({
        productionInvoiceId: g.pi!.productionInvoiceId, materialId: g.material.materialId,
        step: g.step, productionOrderId: g.order!.productionOrderId, workerId: g.workerId,
      }),
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
      blocked: null,
      reports: b.reports,
      send: () => floorAdmin.sendProductionBatch(b.productionBatchId),
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
  const { ask, confirmModal } = useConfirm()
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [rev, setRev] = useState<{ report: BeReviewReport; label: string } | null>(null)
  const [reason, setReason] = useState('')
  const [revBusy, setRevBusy] = useState(false)
  const [revErr, setRevErr] = useState<string | null>(null)
  // Đồng hồ 1 phút/lần để "chờ 3 giờ" tự nhảy mà không tải lại dữ liệu.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])

  const toggle = (k: string) => setOpenKeys((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })

  const sendOne = (it: Item) => {
    const warns = warningsOf(it)
    ask(
      {
        title: 'Gửi KCS',
        message: [
          `Gửi KCS: ${it.title} (${it.sub}) - ${it.total}.`,
          ...(warns.length ? [`⚠ Cảnh báo: ${warns.join('; ')}. Kiểm lại số thật trước khi gửi.`] : []),
          'Sau khi gửi không đảo được lần báo nào của đợt này nữa.',
        ].join('\n'),
        confirmLabel: 'Gửi KCS',
        danger: warns.length > 0,
      },
      async () => { await it.send(); setMsg({ tone: 'ok', text: `Đã gửi KCS: ${it.title}` }); onChanged() },
    )
  }

  const sendable = items.filter((i) => !i.blocked)
  const warnCount = sendable.filter((i) => warningsOf(i).length > 0).length
  const sendAll = () => ask(
    {
      title: `Gửi KCS tất cả (${sendable.length})`,
      message: [
        `Gửi KCS cả ${sendable.length} đợt đang chờ của tổ này. Đã kiểm hết chưa?`,
        ...(warnCount ? [`⚠ ${warnCount} đợt có cảnh báo vượt - mở từng đợt xem trước nếu chưa kiểm.`] : []),
      ].join('\n'),
      confirmLabel: `Gửi ${sendable.length} đợt`,
      danger: warnCount > 0,
    },
    async () => {
      let ok = 0
      const failed: string[] = []
      for (const it of sendable) {
        setBusyKey(it.key)
        try { await it.send(); ok++ } catch (e) { failed.push(`${it.title}: ${errMsg(e)}`) }
      }
      setBusyKey(null)
      onChanged()
      if (failed.length) throw new Error(`Đã gửi ${ok}/${sendable.length}. Lỗi: ${failed.join('; ')}`)
      setMsg({ tone: 'ok', text: `Đã gửi KCS ${ok} đợt` })
    },
  )

  const doReverse = async () => {
    if (!rev) return
    setRevBusy(true); setRevErr(null)
    try {
      await floorAdmin.reverse(rev.report.floorReportId, reason.trim())
      setMsg({ tone: 'ok', text: `Đã đảo lần báo ${rev.label}` })
      setRev(null); setReason(''); onChanged()
    } catch (e) { setRevErr(errMsg(e)) } finally { setRevBusy(false) }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Chờ gửi KCS">
      {confirmModal}
      <ReasonModal
        open={!!rev} title="Đảo lần báo" busy={revBusy} error={revErr}
        description={rev ? `Đảo ${rev.label}. Số này được trừ khỏi đợt; dòng báo vẫn lưu lại kèm lý do và công nhân sẽ thấy lý do này.` : undefined}
        reason={reason} onReasonChange={setReason} placeholder="Vd: đếm lại tại máy chỉ có 40 đoạn"
        confirmLabel="Đảo lần báo" confirmDisabled={reason.trim().length < 3}
        onCancel={() => { setRev(null); setReason(''); setRevErr(null) }} onConfirm={() => void doReverse()}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>
          Chờ gửi KCS {items.length > 0 && <Pill tone="amber">{items.length}</Pill>}
          {warnCount > 0 && <> <Pill tone="red">{warnCount} có cảnh báo vượt</Pill></>}
        </div>
        {sendable.length > 1 && (
          <button type="button" style={btn('secondary')} onClick={sendAll}><Send size={14} /> Gửi KCS tất cả</button>
        )}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {items.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text3)', padding: 28 }}>
          Không có đợt nào đang chờ. Công nhân báo xong sẽ hiện ở đây.
        </div>
      ) : items.map((it) => {
        const open = openKeys.has(it.key)
        const stale = isStale(it.since, now)
        const live = it.reports.filter((r) => !r.reversed)
        const warns = warningsOf(it)
        const known = it.lines.filter((l) => l.required > 0)
        return (
          <article key={it.key} style={{ ...card, padding: 0, borderColor: warns.length ? 'var(--amber)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', flexWrap: 'wrap' }}>
              <button type="button" aria-expanded={open} aria-label={open ? 'Thu gọn các lần báo' : 'Xem từng lần báo'}
                onClick={() => toggle(it.key)} style={{ ...btn('ghost'), minHeight: 44, minWidth: 44 }}>
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{it.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{it.sub}{it.who ? ` · ${it.who}` : ''}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{it.total}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: stale ? 'var(--amber)' : 'var(--text3)', fontWeight: stale ? 700 : 400 }}
                  title="Tính từ lần báo đầu tiên chưa gửi KCS">
                  chờ {ageText(it.since, now)}{stale ? ' ⚠' : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{live.length} lần báo</div>
              </div>
              <button type="button" disabled={busyKey === it.key || !!it.blocked} title={it.blocked ?? undefined}
                style={btn('primary', busyKey === it.key || !!it.blocked)} onClick={() => sendOne(it)}>
                <Send size={14} /> Gửi KCS
              </button>
            </div>
            {(known.length > 0 || warns.length > 0 || it.blocked) && (
              <div style={{ padding: '0 14px 12px 68px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {known.length > 0 && (
                  <ul style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12 }}
                    aria-label="Đã báo so với số cần">
                    {known.map((l) => (
                      <li key={l.label} style={{ color: l.over > 0 ? 'var(--amber)' : 'var(--text2)', fontWeight: l.over > 0 ? 700 : 400 }}>
                        {l.label}: đã {l.done}/{l.required}{l.over > 0 ? ` · vượt ${l.over}` : l.done >= l.required ? ' · đủ' : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {it.steel && it.steel.overMm > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}
                    title={`Sắt dùng được ${meters(it.steel.usableMm)} m, đoạn đã báo ${meters(it.steel.reportedMm)} m (loại sắt này, cả PI)`}>
                    ⚠ Đoạn báo vượt sắt đã nhận {meters(it.steel.overMm)} m (nhận {it.steel.receivedBarCount} cây)
                  </div>
                )}
                {it.blocked && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{it.blocked}</div>}
              </div>
            )}
            {open && (
              <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                  <tbody>
                    {it.reports.map((r) => (
                      <tr key={r.floorReportId} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmtTime(r.createdAt)}</td>
                        <td style={{ padding: '9px 8px', fontSize: 13, fontWeight: 600, textDecoration: r.reversed ? 'line-through' : 'none', color: r.reversed ? 'var(--text3)' : 'var(--text)' }}>
                          {lineText(r)}
                        </td>
                        <td style={{ padding: '9px 8px', fontSize: 12, color: 'var(--text2)' }}>
                          {r.reportedByName ?? '—'} · {r.workstation ? r.workstation.code : <span title="Báo từ màn thống kê cũ, không qua QR">màn cũ</span>}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          {r.reversed ? (
                            <span style={{ fontSize: 12, color: 'var(--amber)' }}>Đã đảo: {r.reversed.reason ?? '—'}</span>
                          ) : (
                            <button type="button" style={btn('danger')} onClick={() => { setRev({ report: r, label: `${lineText(r)} (${r.reportedByName ?? '—'}, ${fmtTime(r.createdAt)})` }); setReason(''); setRevErr(null) }}>
                              <Undo2 size={14} /> Đảo
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
