'use client'

/**
 * Khối "PI đang chạy + hàng đợi" của 1 tổ (màn QLSX "Sản lượng xưởng", 2026-10-13, mục 19 plan QR):
 * mỗi tổ chạy 1 PI một lúc theo thứ tự QLSX xếp; QLSX bấm "Chuyển PI tiếp" (không tự chuyển - còn đợt chờ KCS /
 * cắt bù). Tổ báo đủ số cần thì hiện nhắc nhưng KHÔNG chặn gì.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, ListChecks, Plus, Trash2, Undo2 } from 'lucide-react'
import { floorAdmin, type BeFloorReview, type BeQueueCandidate, type BeQueueEntry, type BeStageDetail, type FloorStage } from '../../../services/floor-api'
import { useConfirm } from '../../../hooks/useConfirm'
import { useFetch } from '../../../hooks/useFetch'
import { errMsg } from '../../../utils/errors'
import QlsxPiDetail from './QlsxPiDetail'
import { missingText, openBatchesOf, phoiMaterialsOf, piecesOf, shortMaterials, shortPieces, stepLabel } from './piDetailModel'
import { btn, card, fmtTime, input, Notice, Pill, STAGE_LABEL, STEP_LABEL, StackedProgress } from './qlsxUi'

/** PI đang mở trong ngăn "còn thiếu gì". */
interface DetailTarget { productionInvoiceId: string; piCode: string }

export default function QlsxQueue({ stage, entries, openCount, review, onChanged, onGoToReview }: {
  stage: FloorStage
  entries: BeQueueEntry[]
  /** Số đợt của tổ còn chờ gửi KCS - đưa vào lời xác nhận khi chuyển PI. */
  openCount: number
  /** Danh sách "Chờ gửi KCS" của tổ - ngăn chi tiết đếm đợt chờ quá lâu của từng PI. */
  review: BeFloorReview | null
  onChanged: () => void
  /** Cuộn tới danh sách "Chờ gửi KCS" (nút ở ngăn chi tiết). */
  onGoToReview: () => void
}) {
  const { ask, confirmModal } = useConfirm()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [confirmShort, setConfirmShort] = useState(false)

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
    void run(() => floorAdmin.reorder(stage, ids))
  }

  const next = queued[0] ?? null
  const p = running?.progress ?? null
  const piOpenCount = running ? openBatchesOf(review, running.productionInvoiceId).length : 0
  // Tổ CHƯA đủ số (hoặc không tính được) mà bấm chuyển → hộp hỏi lại nêu đúng thiếu gì (mục 45.4), nút an toàn mặc định.
  const onAdvanceClick = () => {
    if (running && !p?.complete) setConfirmShort(true)
    else advance()
  }
  const advance = () => {
    const lines = [
      running
        ? `${running.piCode} sẽ chuyển sang "đã xong" - tổ ${STAGE_LABEL[stage]} không báo thêm vào PI này nữa (trừ mục "Bù lỗi" khi KCS chấm lỗi).`
        : `Tổ ${STAGE_LABEL[stage]} chưa chạy PI nào.`,
      next ? `${next.piCode} bắt đầu chạy.` : 'Hàng đợi hết - tổ sẽ không còn PI đang chạy.',
    ]
    if (openCount > 0) lines.push(`Còn ${openCount} đợt chưa gửi KCS - nên gửi trước khi chuyển.`)
    ask(
      { title: 'Chuyển PI tiếp', message: lines.join('\n'), confirmLabel: 'Chuyển PI tiếp', danger: openCount > 0 },
      async () => { await floorAdmin.advance(stage); onChanged() },
    )
  }

  // "Chuyển nhầm?" - PI vừa đóng mà mở lại được (BE chỉ bật cờ khi PI đang chạy chưa có lần báo nào). done đã xếp mới nhất trước.
  const reopenable = done.find((d) => d.canReopen) ?? null
  const reopen = () => {
    if (!reopenable) return
    const lines = [
      `${reopenable.piCode} chạy lại làm PI đang chạy của tổ ${STAGE_LABEL[stage]}.`,
      running
        ? `${running.piCode} chưa có lần báo nào nên trở về đầu hàng đợi.`
        : 'Tổ đang không chạy PI nào nên không có PI nào bị đẩy lùi.',
    ]
    ask(
      { title: 'Mở lại PI vừa chuyển', message: lines.join('\n'), confirmLabel: 'Mở lại' },
      async () => { await floorAdmin.reopen(stage); onChanged() },
    )
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label={`PI của tổ ${STAGE_LABEL[stage]}`}>
      {confirmModal}
      {detail && (
        <QlsxPiDetail stage={stage} productionInvoiceId={detail.productionInvoiceId} piCode={detail.piCode} review={review}
          onClose={() => setDetail(null)} onGoToReview={() => { setDetail(null); onGoToReview() }} />
      )}
      {confirmShort && running && (
        <AdvanceShortDialog stage={stage} running={running} next={next} piOpenCount={piOpenCount}
          onCancel={() => setConfirmShort(false)}
          onShowDetail={() => { setConfirmShort(false); setDetail({ productionInvoiceId: running.productionInvoiceId, piCode: running.piCode }) }}
          onDone={() => { setConfirmShort(false); onChanged() }} />
      )}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>PI đang chạy · tổ {STAGE_LABEL[stage]}</div>
            {running ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{running.piCode}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Bắt đầu {running.startedAt ? fmtTime(running.startedAt) : '—'}{running.startedByName ? ` · ${running.startedByName}` : ''}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 15, color: 'var(--text2)', marginTop: 4 }}>
                Chưa có PI đang chạy - công nhân quét mã sẽ chưa thấy việc.
              </div>
            )}
          </div>
          {/* Chỉ nổi bật khi tổ đã báo đủ số (hoặc chưa chạy PI nào) - tránh bấm nhầm khi tổ còn đang làm. */}
          <button type="button" disabled={busy || (!running && !next)} onClick={onAdvanceClick}
            style={btn(!running || p?.complete ? 'primary' : 'secondary', busy || (!running && !next))}>
            {running ? 'Chuyển PI tiếp' : 'Bắt đầu PI đầu hàng đợi'} <ChevronRight size={16} />
          </button>
        </div>
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
          {running && p?.complete && (
            <Notice tone="ok">
              Tổ đã báo đủ số cần của {running.piCode}.
              {openCount > 0 ? ` Còn ${openCount} đợt chờ gửi KCS - kiểm và gửi, rồi bấm “Chuyển PI tiếp”.` : ' Bấm “Chuyển PI tiếp” khi sẵn sàng.'}
            </Notice>
          )}
          {running && !running.hasActiveFloor && (
            <Notice tone="warn">
              QLSX chưa bấm “Bắt đầu” SKU nào của {running.piCode} (ở “Tổng hợp lệnh SX”) - công nhân quét được nhưng chưa báo được.
            </Notice>
          )}
          {err && <Notice tone="err">{err}</Notice>}
          {reopenable && (
            <div>
              <button type="button" disabled={busy} onClick={reopen}
                title="Hoàn tác lần bấm “Chuyển PI tiếp” vừa rồi - chỉ làm được khi PI đang chạy chưa có công nhân nào báo."
                style={{ ...btn('ghost', busy), padding: 0, fontSize: 12 }}>
                <Undo2 size={13} /> Chuyển nhầm? Mở lại {reopenable.piCode}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Hàng đợi {queued.length > 0 && <Pill tone="gray">{queued.length}</Pill>}</div>
          <button type="button" onClick={() => setAdding((v) => !v)} style={btn('secondary')}>
            <Plus size={14} /> Thêm PI
          </button>
        </div>
        {adding && <AddPi stage={stage} onAdded={() => { setAdding(false); onChanged() }} />}
        {queued.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Không có PI nào đang chờ.</div>
        ) : (
          <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queued.map((q, i) => (
              <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ width: 22, fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{q.piCode}{i === 0 && <> <Pill tone="blue">tiếp theo</Pill></>}</span>
                <button type="button" onClick={() => setDetail({ productionInvoiceId: q.productionInvoiceId, piCode: q.piCode })}
                  aria-label={`Xem trước ${q.piCode}`} title="Xem trước: đã nhận sắt chưa, cần làm những gì" style={{ ...btn('ghost'), fontSize: 12 }}>Xem</button>
                <button type="button" aria-label={`Đưa ${q.piCode} lên`} disabled={busy || i === 0} onClick={() => move(i, -1)} style={btn('ghost', busy || i === 0)}><ArrowUp size={16} /></button>
                <button type="button" aria-label={`Đưa ${q.piCode} xuống`} disabled={busy || i === queued.length - 1} onClick={() => move(i, 1)} style={btn('ghost', busy || i === queued.length - 1)}><ArrowDown size={16} /></button>
                <button type="button" aria-label={`Bỏ ${q.piCode} khỏi hàng đợi`} disabled={busy} style={btn('ghost', busy)}
                  onClick={() => ask({ title: 'Bỏ khỏi hàng đợi', message: `Bỏ ${q.piCode} khỏi hàng đợi tổ ${STAGE_LABEL[stage]}? Thêm lại được sau.`, confirmLabel: 'Bỏ', danger: true },
                    async () => { await floorAdmin.removeEntry(q.id); onChanged() })}>
                  <Trash2 size={16} color="var(--red)" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {done.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setShowDone((v) => !v)} style={{ ...btn('ghost'), padding: 0, fontSize: 12 }}>
              {showDone ? 'Ẩn' : 'Xem'} {done.length} PI đã xong
            </button>
            {showDone && (
              <ul style={{ listStyle: 'none', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {done.map((d) => (
                  <li key={d.id} style={{ fontSize: 12, color: 'var(--text2)' }}>
                    <b>{d.piCode}</b> · {d.startedAt ? fmtTime(d.startedAt) : '—'} → {d.endedAt ? fmtTime(d.endedAt) : '—'}
                    {d.endedByName ? ` · ${d.endedByName}` : ''}
                    {' '}<button type="button" onClick={() => setDetail({ productionInvoiceId: d.productionInvoiceId, piCode: d.piCode })}
                      aria-label={`Xem ${d.piCode} còn thiếu gì`} title="Xem còn thiếu gì (để báo bù lỗi)" style={{ ...btn('ghost'), minHeight: 24, padding: '0 6px', fontSize: 12 }}>Xem</button>
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

function AddPi({ stage, onAdded }: { stage: FloorStage; onAdded: () => void }) {
  const { data, isLoading, error } = useFetch<BeQueueCandidate[]>(() => floorAdmin.queueCandidates(stage), [stage])
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
        <select aria-label="Chọn PI" value={sel} onChange={(e) => setSel(e.target.value)} disabled={isLoading}
          style={{ ...input, flex: 1, minWidth: 200 }}>
          <option value="">{isLoading ? 'Đang tải…' : (data ?? []).length ? 'Chọn PI…' : 'Không còn PI nào để thêm'}</option>
          {(data ?? []).map((c) => (
            <option key={c.productionInvoiceId} value={c.productionInvoiceId}>
              {c.code} · {c.orderCount} SKU{c.activeOrderCount ? ` (${c.activeOrderCount} đã Bắt đầu)` : ' (chưa Bắt đầu)'}
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
 * Hỏi lại khi "Chuyển PI tiếp" lúc tổ CHƯA đủ số (mục 45.4): nêu đúng thiếu gì (3 mục đầu + "và N mục khác"), số đợt chờ gửi
 * KCS của PI, và nhắc công nhân vẫn báo bù được. Nút được focus sẵn là nút an toàn "Xem còn thiếu gì"; Esc = đóng.
 */
function AdvanceShortDialog({ stage, running, next, piOpenCount, onCancel, onShowDetail, onDone }: {
  stage: FloorStage
  running: BeQueueEntry
  next: BeQueueEntry | null
  piOpenCount: number
  onCancel: () => void
  onShowDetail: () => void
  onDone: () => void
}) {
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
    try { await floorAdmin.advance(stage); onDone() } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Escape' && !busy) onCancel() }
  const titleId = `advance-short-${stage}`

  return (
    <div onClick={() => { if (!busy) onCancel() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 480, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <h3 id={titleId} style={{ fontSize: 16, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={18} color="var(--amber)" aria-hidden /> Chuyển PI tiếp cho tổ {STAGE_LABEL[stage]}?
        </h3>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, lineHeight: 1.55 }}>
          {p
            ? <div><b>{running.piCode}</b> mới được <b>{p.percent}%</b>. {missingText(p.missing, 0)}:</div>
            : <div><b>{running.piCode}</b>: chưa tính được tiến độ.</div>}
          {!data && !error && <div style={{ color: 'var(--text3)' }}>Đang tải danh sách còn thiếu…</div>}
          {error && <div style={{ color: 'var(--text3)' }}>Không tải được danh sách còn thiếu.</div>}
          {items.length > 0 && (
            <ul style={{ margin: '6px 0 0 18px' }}>
              {items.map((l) => <li key={l}>{l}</li>)}
              {more > 0 && <li>… và {more} mục khác</li>}
            </ul>
          )}
          {piOpenCount > 0 && <div style={{ marginTop: 6 }}>Còn <b>{piOpenCount}</b> đợt chờ gửi KCS của PI này.</div>}
          <div style={{ marginTop: 6 }}>
            Sau khi chuyển, {next ? <><b>{next.piCode}</b> bắt đầu chạy; </> : 'hàng đợi hết; '}công nhân vẫn báo bù được cho {running.piCode} (mục “Bù lỗi”).
          </div>
        </div>
        {err && <div style={{ marginTop: 10 }}><Notice tone="err">{err}</Notice></div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
          <button ref={safeRef} type="button" disabled={busy} onClick={onShowDetail} style={btn('primary', busy)}>Xem còn thiếu gì</button>
          <button type="button" disabled={busy} onClick={() => { void confirm() }} style={btn('danger', busy)}>{busy ? 'Đang chuyển…' : 'Vẫn chuyển PI tiếp'}</button>
        </div>
      </div>
    </div>
  )
}
