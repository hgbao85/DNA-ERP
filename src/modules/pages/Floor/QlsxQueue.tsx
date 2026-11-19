'use client'

/**
 * Khối "PI đang chạy + hàng đợi" của 1 tổ (màn QLSX "Sản lượng xưởng", 2026-10-13, mục 19 plan QR):
 * mỗi tổ chạy 1 PI một lúc theo thứ tự QLSX xếp; QLSX bấm "Chuyển lệnh tiếp" (không tự chuyển - còn đợt đang mở /
 * cắt bù). Tổ báo đủ số cần thì hiện nhắc nhưng KHÔNG chặn gì. P1: KCS tự chấm các đợt công nhân báo, QLSX không còn
 * "gửi KCS" - ở đây chỉ nhắc "Còn N đợt đang mở".
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, ListChecks, Plus, Trash2, Undo2 } from 'lucide-react'
import { floorAdmin, otherWorkshopLabel, type BeFloorReview, type BeQueueCandidate, type BeQueueEntry, type BeStageDetail, type FloorStage } from '../../../services/floor-api'
import { useConfirm } from '../../../hooks/useConfirm'
import { useFetch } from '../../../hooks/useFetch'
import { ApiError } from '../../../services/core/apiError'
import { errMsg } from '../../../utils/errors'
import QlsxPiDetail from './QlsxPiDetail'
import { missingText, openBatchesOf, phoiMaterialsOf, piecesOf, shortMaterials, shortPieces, stepLabel } from './piDetailModel'
import { btn, card, fmtTime, input, Notice, Pill, STAGE_LABEL, STEP_LABEL, StackedProgress } from './qlsxUi'
import LenhCode, { useLenhCodeLookup } from '../../../components/LenhCode'
import { QueueWorkshopPicker, type QueueWorkshop } from './queueWorkshop'

/** Câu "Còn N đợt đang mở." (N = đợt đang mở của lệnh, không tính dòng xám); N = 0 thì rỗng. */
export function openBatchesNote(n: number): string {
  return n > 0 ? `Còn ${n} đợt đang mở.` : ''
}

/** Chú thích tổ Sơn: hàng đợi Sơn theo nơi sơn, không theo xưởng làm lệnh. */
export const SON_QUEUE_NOTE = 'Hàng đợi Sơn theo nơi sơn: lệnh của Phước An sơn ở Phú An.'

/** Tổ Phôi: "Xong Phôi" hệ thống tự tính, tự đóng lệnh và chạy lệnh tiếp - QLSX không bấm tay nữa. */
export const PHOI_AUTO_ADVANCE_NOTE = 'Xong Phôi: hệ thống tự chuyển khi mọi đoạn đủ công đoạn và KCS đạt.'
/**
 * Tổ Phôi đã đủ để hệ thống tự đóng lệnh (mọi dòng KCS đạt đủ: required > 0 và passed ≥ required) mà dòng hàng đợi vẫn RUNNING
 * (lượt nhắc nền chưa chạy / FLOOR_ALERTS tắt) - khi đó thẻ hiện nút "Chuyển lệnh tiếp" để QLSX tự đóng. Chỉ tổ Phôi.
 */
export function phoiAwaitingAutoClose(stage: string, running: Pick<BeQueueEntry, 'progress'> | null | undefined): boolean {
  if (stage !== 'PHOI') return false
  const p = running?.progress
  return !!p && p.required > 0 && p.passed >= p.required
}
/** Tên người bấm của dòng hàng đợi; tổ Phôi không ai bấm (hệ thống tự đóng / tự chạy lệnh kế) thì ghi rõ. */
export function queueActorText(stage: string, name: string | null, at: string | null): string {
  if (name) return ` · ${name}`
  return stage === 'PHOI' && at ? ' · hệ thống tự chuyển' : ''
}

/**
 * Máy chủ trả 409 khi lệnh đang chạy đã đổi so với màn đang xem ("Chuyển lệnh tiếp" gửi id cũ). Khi đó phải tải lại hàng đợi,
 * đóng hộp xác nhận (dữ liệu trong hộp đã cũ) và hiện câu của máy chủ ở thẻ.
 */
export function isStaleConflict(e: unknown): boolean {
  return e instanceof ApiError && e.statusCode === 409
}

/** PI đang mở trong ngăn "còn thiếu gì". */
interface DetailTarget { productionInvoiceId: string; piCode: string }

export default function QlsxQueue({ stage, entries, workshop, review, onChanged, onGoToReview }: {
  stage: FloorStage
  entries: BeQueueEntry[]
  /** Xưởng đang xem (14/11/2026): mọi nút gửi đúng xưởng này; người không gắn xưởng chọn xưởng ở đầu khối. */
  workshop: QueueWorkshop
  /** Khối "Đang chờ KCS chấm" của tổ - số đợt đang mở của lệnh + ngăn chi tiết đếm đợt chờ quá lâu của từng PI. */
  review: BeFloorReview | null
  onChanged: () => void
  /** Cuộn tới khối "Đang chờ KCS chấm" (nút ở ngăn chi tiết). */
  onGoToReview: () => void
}) {
  const { ask, confirmModal } = useConfirm()
  const workshopId = workshop.workshopId
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  // Bản chụp lệnh đang chạy + lệnh kế LÚC BẤM mở hộp: màn tự tải lại (realtime) làm `running` đổi sang lệnh mới thì hộp vẫn nói và
  // gửi đúng lệnh đã hiện lúc bấm (máy chủ thấy khác thì 409 -> onStale đóng hộp, tải lại).
  const [confirmShort, setConfirmShort] = useState<{ running: BeQueueEntry; next: BeQueueEntry | null } | null>(null)

  // Hiện số LSX (không hiện mã PI nội bộ) ở mọi chữ trong hộp xác nhận + hàng đợi.
  const lenhOf = useLenhCodeLookup(entries.map((e) => e.piCode))
  const running = entries.find((e) => e.status === 'RUNNING') ?? null
  const queued = entries.filter((e) => e.status === 'QUEUED')
  const done = entries.filter((e) => e.status === 'DONE')

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { await fn(); onChanged() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }

  const move = (i: number, dir: -1 | 1) => {
    const ids = queued.map((q) => q.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    void run(() => floorAdmin.reorder(stage, ids, workshopId))
  }

  const next = queued[0] ?? null
  // Tổ Phôi đang có lệnh chạy: hệ thống tự chuyển nên ẩn "Chuyển lệnh tiếp" - trừ khi KCS đã đạt đủ mà hệ thống chưa tự chuyển
  // (awaitingClose). Chưa có lệnh chạy thì vẫn bắt đầu tay được. "Mở lại" ẩn khi tổ Phôi đang có lệnh chạy.
  const phoiRunning = stage === 'PHOI' && !!running
  const awaitingClose = phoiAwaitingAutoClose(stage, running)
  const autoAdvance = phoiRunning && !awaitingClose
  const p = running?.progress ?? null
  const piOpenCount = running ? openBatchesOf(review, running.productionInvoiceId).length : 0
  // Tổ CHƯA đủ số (hoặc không tính được) mà bấm chuyển → hộp hỏi lại nêu đúng thiếu gì (mục 45.4), nút an toàn mặc định.
  const onAdvanceClick = () => {
    if (running && !p?.complete) setConfirmShort({ running, next })
    else advance()
  }
  const advance = () => {
    const lines = [
      running
        ? `${lenhOf(running.piCode)} sẽ chuyển sang "đã xong" - tổ ${STAGE_LABEL[stage]} không báo thêm vào lệnh này nữa (trừ mục "Bù lỗi" khi KCS chấm lỗi).`
        : `Tổ ${STAGE_LABEL[stage]} chưa chạy lệnh nào.`,
      next ? `${lenhOf(next.piCode)} bắt đầu chạy.` : 'Hàng đợi hết - tổ sẽ không còn lệnh đang chạy.',
    ]
    if (piOpenCount > 0) lines.push(openBatchesNote(piOpenCount))
    ask(
      { title: 'Chuyển lệnh tiếp', message: lines.join('\n'), confirmLabel: 'Chuyển lệnh tiếp' },
      // Gửi id lệnh màn đang thấy (null = màn thấy tổ chưa chạy lệnh nào): máy chủ thấy khác thì 409 bắt tải lại màn.
      async () => {
        try { await floorAdmin.advance(stage, workshopId, running?.productionInvoiceId ?? null); setErr(null); onChanged() } catch (e) {
          if (!isStaleConflict(e)) throw e
          // Không ném lỗi nữa nên hộp đóng; tải lại hàng đợi, câu của máy chủ hiện ở thẻ.
          setErr(errMsg(e)); onChanged()
        }
      },
    )
  }

  // "Chuyển nhầm?" - PI vừa đóng mà mở lại được (BE chỉ bật cờ khi PI đang chạy chưa có lần báo nào). done đã xếp mới nhất trước.
  const reopenable = phoiRunning ? null : (done.find((d) => d.canReopen) ?? null)
  const reopen = () => {
    if (!reopenable) return
    const lines = [
      `${lenhOf(reopenable.piCode)} chạy lại làm lệnh đang chạy của tổ ${STAGE_LABEL[stage]}.`,
      running
        ? `${lenhOf(running.piCode)} chưa có lần báo nào nên trở về đầu hàng đợi.`
        : 'Tổ đang không chạy lệnh nào nên không có lệnh nào bị đẩy lùi.',
    ]
    ask(
      { title: 'Mở lại lệnh vừa chuyển', message: lines.join('\n'), confirmLabel: 'Mở lại' },
      async () => { await floorAdmin.reopen(stage, workshopId); setErr(null); onChanged() },
    )
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label={`Lệnh của tổ ${STAGE_LABEL[stage]}`}>
      {confirmModal}
      <div style={card}><QueueWorkshopPicker ws={workshop} /></div>
      {detail && (
        <QlsxPiDetail stage={stage} productionInvoiceId={detail.productionInvoiceId} piCode={detail.piCode} review={review}
          onClose={() => setDetail(null)} onGoToReview={() => { setDetail(null); onGoToReview() }} />
      )}
      {confirmShort && (
        <AdvanceShortDialog stage={stage} workshopId={workshopId} running={confirmShort.running} next={confirmShort.next}
          piOpenCount={openBatchesOf(review, confirmShort.running.productionInvoiceId).length}
          onCancel={() => setConfirmShort(null)}
          onShowDetail={() => { setDetail({ productionInvoiceId: confirmShort.running.productionInvoiceId, piCode: confirmShort.running.piCode }); setConfirmShort(null) }}
          onDone={() => { setConfirmShort(null); setErr(null); onChanged() }}
          onStale={(msg) => { setConfirmShort(null); setErr(msg); onChanged() }} />
      )}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Lệnh đang chạy · tổ {STAGE_LABEL[stage]}</div>
            {running ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}><LenhCode piCode={running.piCode} /></div>
                {otherWorkshopLabel(running) && <div style={{ marginTop: 2 }}><Pill tone="blue">{otherWorkshopLabel(running)}</Pill></div>}
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Bắt đầu {running.startedAt ? fmtTime(running.startedAt) : '—'}{queueActorText(stage, running.startedByName, running.startedAt)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 15, color: 'var(--text2)', marginTop: 4 }}>
                Chưa có lệnh đang chạy - công nhân quét mã sẽ chưa thấy việc.
              </div>
            )}
          </div>
          {/* Chỉ nổi bật khi tổ đã báo đủ số (hoặc chưa chạy PI nào) - tránh bấm nhầm khi tổ còn đang làm. */}
          {!autoAdvance && (
            <button type="button" disabled={busy || (!running && !next)} onClick={onAdvanceClick}
              style={btn(!running || p?.complete ? 'primary' : 'secondary', busy || (!running && !next))}>
              {running ? 'Chuyển lệnh tiếp' : 'Bắt đầu lệnh đầu hàng đợi'} <ChevronRight size={16} />
            </button>
          )}
        </div>
        {awaitingClose && running && (
          <div style={{ marginTop: 10 }}>
            <Notice tone="warn">
              KCS đã đạt đủ nhưng hệ thống chưa tự chuyển lệnh - bấm “Chuyển lệnh tiếp” để đóng Phôi của {lenhOf(running.piCode)}.
              {piOpenCount > 0 ? ` ${openBatchesNote(piOpenCount)}` : ''}
            </Notice>
          </div>
        )}
        {autoAdvance && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10 }}>{PHOI_AUTO_ADVANCE_NOTE}</div>}
        {running && p && (
          <div style={{ marginTop: 12 }}
            title={`Cùng cách tính với "Tổng hợp lệnh SX": mỗi cỡ đoạn / mảnh tính tối đa bằng số cần (báo vượt dòng này không che dòng khác còn thiếu), đã trừ số KCS chấm lỗi.${stage === 'PHOI' ? ' Tổ Phôi gồm Cắt + công đoạn phụ (Uốn, Dập…) + mảnh Phôi.' : ''}`}>
            <StackedProgress parts={p} percent={p.percent} />
            {p.breakdown.length > 1 && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                {p.breakdown.map((b) => `${stepLabel(b.step, STEP_LABEL)} ${b.percent}%`).join(' · ')}
              </div>
            )}
          </div>
        )}
        {running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {p && !p.complete && (
              <span style={{ flex: 1, minWidth: 200, fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', gap: 6, alignItems: 'flex-start' }}>
                <AlertTriangle size={15} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{missingText(p.missing, piOpenCount)}</span>
              </span>
            )}
            {!p && <span style={{ flex: 1, fontSize: 13, color: 'var(--text3)' }}>Chưa tính được tiến độ - mở chi tiết để thử lại.</span>}
            <button type="button" onClick={() => setDetail({ productionInvoiceId: running.productionInvoiceId, piCode: running.piCode })}
              style={{ ...btn('secondary'), marginLeft: 'auto' }}>
              <ListChecks size={15} /> {p && !p.complete ? 'Xem còn thiếu gì' : 'Xem chi tiết'}
            </button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: running ? 12 : 0 }}>
          {running && p?.complete && !awaitingClose && (
            <Notice tone="ok">
              Tổ đã báo đủ số cần của {lenhOf(running.piCode)}.
              {autoAdvance
                ? (piOpenCount > 0 ? ` ${openBatchesNote(piOpenCount)} Hệ thống sẽ tự chuyển lệnh khi KCS chấm đạt.` : '')
                : (piOpenCount > 0 ? ` ${openBatchesNote(piOpenCount)} Bấm “Chuyển lệnh tiếp” khi sẵn sàng.` : ' Bấm “Chuyển lệnh tiếp” khi sẵn sàng.')}
            </Notice>
          )}
          {running && !running.hasActiveFloor && (
            <Notice tone="warn">
              QLSX chưa bấm “Bắt đầu” SKU nào của {lenhOf(running.piCode)} (ở “Tổng hợp lệnh SX”) - công nhân quét được nhưng chưa báo được.
            </Notice>
          )}
          {err && <Notice tone="err">{err}</Notice>}
          {reopenable && (
            <div>
              <button type="button" disabled={busy} onClick={reopen}
                title="Hoàn tác lần bấm “Chuyển lệnh tiếp” vừa rồi - chỉ làm được khi lệnh đang chạy chưa có công nhân nào báo."
                style={{ ...btn('ghost', busy), padding: 0, fontSize: 12 }}>
                <Undo2 size={13} /> Chuyển nhầm? Mở lại {lenhOf(reopenable.piCode)}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Hàng đợi {queued.length > 0 && <Pill tone="gray">{queued.length}</Pill>}</div>
          <button type="button" onClick={() => setAdding((v) => !v)} style={btn('secondary')}>
            <Plus size={14} /> Thêm lệnh
          </button>
        </div>
        {stage === 'SON' && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{SON_QUEUE_NOTE}</div>}
        {adding && <AddPi stage={stage} workshopId={workshopId} onAdded={() => { setAdding(false); setErr(null); onChanged() }} />}
        {queued.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Không có lệnh nào đang chờ.</div>
        ) : (
          <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queued.map((q, i) => (
              <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ width: 22, fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>
                  {lenhOf(q.piCode)}{i === 0 && <> <Pill tone="blue">tiếp theo</Pill></>}
                  {otherWorkshopLabel(q) && <> <Pill tone="gray">{otherWorkshopLabel(q)}</Pill></>}
                </span>
                <button type="button" onClick={() => setDetail({ productionInvoiceId: q.productionInvoiceId, piCode: q.piCode })}
                  aria-label={`Xem trước ${lenhOf(q.piCode)}`} title="Xem trước: đã nhận sắt chưa, cần làm những gì" style={{ ...btn('ghost'), fontSize: 12 }}>Xem</button>
                <button type="button" aria-label={`Đưa ${lenhOf(q.piCode)} lên`} disabled={busy || i === 0} onClick={() => move(i, -1)} style={btn('ghost', busy || i === 0)}><ArrowUp size={16} /></button>
                <button type="button" aria-label={`Đưa ${lenhOf(q.piCode)} xuống`} disabled={busy || i === queued.length - 1} onClick={() => move(i, 1)} style={btn('ghost', busy || i === queued.length - 1)}><ArrowDown size={16} /></button>
                <button type="button" aria-label={`Bỏ ${lenhOf(q.piCode)} khỏi hàng đợi`} disabled={busy} style={btn('ghost', busy)}
                  onClick={() => ask({ title: 'Bỏ khỏi hàng đợi', message: `Bỏ ${lenhOf(q.piCode)} khỏi hàng đợi tổ ${STAGE_LABEL[stage]}? Thêm lại được sau.${stage === 'PHOI' ? ' Lệnh đã Bắt đầu mà còn dòng chia máy cắt sẽ được hệ thống xếp lại vào hàng đợi Phôi.' : ''}`, confirmLabel: 'Bỏ', danger: true },
                    async () => { await floorAdmin.removeEntry(q.id); setErr(null); onChanged() })}>
                  <Trash2 size={16} color="var(--red)" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {done.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setShowDone((v) => !v)} style={{ ...btn('ghost'), padding: 0, fontSize: 12 }}>
              {showDone ? 'Ẩn' : 'Xem'} {done.length} lệnh đã xong
            </button>
            {showDone && (
              <ul style={{ listStyle: 'none', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {done.map((d) => (
                  <li key={d.id} style={{ fontSize: 12, color: 'var(--text2)' }}>
                    <b>{lenhOf(d.piCode)}</b>{otherWorkshopLabel(d) ? ` · ${otherWorkshopLabel(d)}` : ''} · {d.startedAt ? fmtTime(d.startedAt) : '—'} → {d.endedAt ? fmtTime(d.endedAt) : '—'}
                    {queueActorText(stage, d.endedByName, d.endedAt)}
                    {' '}<button type="button" onClick={() => setDetail({ productionInvoiceId: d.productionInvoiceId, piCode: d.piCode })}
                      aria-label={`Xem ${lenhOf(d.piCode)} còn thiếu gì`} title="Xem còn thiếu gì (để báo bù lỗi)" style={{ ...btn('ghost'), minHeight: 24, padding: '0 6px', fontSize: 12 }}>Xem</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function AddPi({ stage, workshopId, onAdded }: { stage: FloorStage; workshopId: string | null; onAdded: () => void }) {
  const { data, isLoading, error } = useFetch<BeQueueCandidate[]>(() => floorAdmin.queueCandidates(stage, workshopId), [stage, workshopId])
  const lenhOf = useLenhCodeLookup((data ?? []).map(c => c.code))
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const add = async () => {
    if (!sel) return
    setBusy(true); setErr(null)
    try { await floorAdmin.enqueue(stage, sel); onAdded() } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="Chọn lệnh" value={sel} onChange={(e) => setSel(e.target.value)} disabled={isLoading}
          style={{ ...input, flex: 1, minWidth: 200 }}>
          <option value="">{isLoading ? 'Đang tải…' : (data ?? []).length ? 'Chọn lệnh…' : 'Không còn lệnh nào để thêm'}</option>
          {(data ?? []).map((c) => (
            <option key={c.productionInvoiceId} value={c.productionInvoiceId}>
              {lenhOf(c.code)} · {c.orderCount} SKU{c.activeOrderCount ? ` (${c.activeOrderCount} đã Bắt đầu)` : ' (chưa Bắt đầu)'}
            </option>
          ))}
        </select>
        <button type="button" disabled={!sel || busy} onClick={add} style={btn('primary', !sel || busy)}>Thêm vào cuối hàng</button>
      </div>
      {(err || error) && <Notice tone="err">{err ?? error}</Notice>}
    </div>
  )
}

/**
 * Hỏi lại khi "Chuyển lệnh tiếp" lúc tổ CHƯA đủ số (mục 45.4): nêu đúng thiếu gì (3 mục đầu + "và N mục khác"), số đợt đang
 * mở của PI, và nhắc công nhân vẫn báo bù được. Nút được focus sẵn là nút an toàn "Xem còn thiếu gì"; Esc = đóng.
 */
function AdvanceShortDialog({ stage, workshopId, running, next, piOpenCount, onCancel, onShowDetail, onDone, onStale }: {
  stage: FloorStage
  workshopId: string | null
  running: BeQueueEntry
  next: BeQueueEntry | null
  piOpenCount: number
  onCancel: () => void
  onShowDetail: () => void
  onDone: () => void
  /** Máy chủ báo lệnh đang chạy đã đổi (409): cha đóng hộp, tải lại hàng đợi và hiện câu lỗi. */
  onStale: (message: string) => void
}) {
  const lenhOf = useLenhCodeLookup([running.piCode, next?.piCode])
  const { data, error } = useFetch<BeStageDetail>(() => floorAdmin.stageDetail(stage, running.productionInvoiceId), [stage, running.productionInvoiceId])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const safeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { safeRef.current?.focus() }, [])

  const items: string[] = []
  let more = 0
  if (data) {
    const fmt = (n: number) => n.toLocaleString('vi-VN')
    const all = [
      ...shortMaterials(phoiMaterialsOf(data, null)).map((m) => `${m.name} — ${m.notReceived ? 'chưa nhận sắt, ' : ''}thiếu ${fmt(m.remaining)} đoạn`),
      ...shortPieces(piecesOf(data, null)).map((x) => `${x.name} — ${fmt(x.reported)}/${fmt(x.required)}, thiếu ${fmt(x.remaining)}`),
    ]
    items.push(...all.slice(0, 3))
    more = Math.max(0, all.length - 3)
  }
  const p = running.progress

  const confirm = async () => {
    setBusy(true); setErr(null)
    try { await floorAdmin.advance(stage, workshopId, running.productionInvoiceId); onDone() } catch (e) {
      if (isStaleConflict(e)) { onStale(errMsg(e)); return }
      setErr(errMsg(e)); setBusy(false)
    }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Escape' && !busy) onCancel() }
  const titleId = `advance-short-${stage}`

  return (
    <div onClick={() => { if (!busy) onCancel() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 480, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <h3 id={titleId} style={{ fontSize: 16, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={18} color="var(--amber)" aria-hidden /> Chuyển lệnh tiếp cho tổ {STAGE_LABEL[stage]}?
        </h3>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, lineHeight: 1.55 }}>
          {p
            ? <div><b>{lenhOf(running.piCode)}</b> mới được <b>{p.percent}%</b>. {missingText(p.missing, 0)}:</div>
            : <div><b>{lenhOf(running.piCode)}</b>: chưa tính được tiến độ.</div>}
          {!data && !error && <div style={{ color: 'var(--text3)' }}>Đang tải danh sách còn thiếu…</div>}
          {error && <div style={{ color: 'var(--text3)' }}>Không tải được danh sách còn thiếu.</div>}
          {items.length > 0 && (
            <ul style={{ margin: '6px 0 0 18px' }}>
              {items.map((l) => <li key={l}>{l}</li>)}
              {more > 0 && <li>… và {more} mục khác</li>}
            </ul>
          )}
          {piOpenCount > 0 && <div style={{ marginTop: 6 }}>Còn <b>{piOpenCount}</b> đợt đang mở của lệnh này.</div>}
          <div style={{ marginTop: 6 }}>
            Sau khi chuyển, {next ? <><b>{lenhOf(next.piCode)}</b> bắt đầu chạy; </> : 'hàng đợi hết; '}công nhân vẫn báo bù được cho {lenhOf(running.piCode)} (mục “Bù lỗi”).
          </div>
        </div>
        {err && <div style={{ marginTop: 10 }}><Notice tone="err">{err}</Notice></div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
          <button ref={safeRef} type="button" disabled={busy} onClick={onShowDetail} style={btn('primary', busy)}>Xem còn thiếu gì</button>
          <button type="button" disabled={busy} onClick={() => { void confirm() }} style={btn('danger', busy)}>{busy ? 'Đang chuyển…' : 'Vẫn chuyển lệnh tiếp'}</button>
        </div>
      </div>
    </div>
  )
}
