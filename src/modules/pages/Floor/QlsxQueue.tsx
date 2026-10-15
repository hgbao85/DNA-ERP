'use client'

/**
 * Khối "PI đang chạy + hàng đợi" của 1 tổ (màn QLSX "Sản lượng xưởng", 2026-10-13, mục 19 plan QR):
 * mỗi tổ chạy 1 PI một lúc theo thứ tự QLSX xếp; QLSX bấm "Chuyển PI tiếp" (không tự chuyển - còn đợt chờ KCS /
 * cắt bù). Tổ báo đủ số cần thì hiện nhắc nhưng KHÔNG chặn gì.
 */

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2, Undo2 } from 'lucide-react'
import { floorAdmin, type BeQueueCandidate, type BeQueueEntry, type FloorStage } from '../../../services/floor-api'
import { useConfirm } from '../../../hooks/useConfirm'
import { useFetch } from '../../../hooks/useFetch'
import { errMsg } from '../../../utils/errors'
import ProgressBar from '../../../components/ProgressBar'
import { btn, card, fmtTime, input, Notice, Pill, STAGE_LABEL } from './qlsxUi'

export default function QlsxQueue({ stage, entries, openCount, onChanged }: {
  stage: FloorStage
  entries: BeQueueEntry[]
  /** Số đợt của tổ còn chờ gửi KCS - đưa vào lời xác nhận khi chuyển PI. */
  openCount: number
  onChanged: () => void
}) {
  const { ask, confirmModal } = useConfirm()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)

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

  const p = running?.progress ?? null

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label={`PI của tổ ${STAGE_LABEL[stage]}`}>
      {confirmModal}
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
          <button type="button" disabled={busy || (!running && !next)} onClick={advance}
            style={btn(!running || p?.complete ? 'primary' : 'secondary', busy || (!running && !next))}>
            {running ? 'Chuyển PI tiếp' : 'Bắt đầu PI đầu hàng đợi'} <ChevronRight size={16} />
          </button>
        </div>
        {running && p && (
          <div style={{ marginTop: 12 }}>
            <ProgressBar value={p.reported} max={p.required} />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}
              title="Mỗi cỡ đoạn / mảnh tính tối đa bằng số cần - báo vượt ở dòng này không che dòng khác còn thiếu. Gồm cả đợt chưa gửi KCS.">
              Đã báo {p.reported.toLocaleString('vi-VN')}/{p.required.toLocaleString('vi-VN')}
            </div>
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
