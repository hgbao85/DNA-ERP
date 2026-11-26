'use client'

/**
 * Màn công nhân Sơn sau khi quét tem pallet (24/11/2026, docs THIET-KE-PALLET-SON): pallet đã có sẵn lệnh, mảnh, số - công nhân chỉ
 * bấm "Sơn xong pallet này" (hoặc "Báo thiếu" + số + lý do). BE ghi 1 lần báo Sơn bình thường qua điểm sơn công nhân quét gần
 * nhất (`ws` = LAST_WS_KEY), giữ mọi chặn của báo Sơn (kế hoạch, số Sơn đã nhận). Chưa quét điểm sơn thì báo "Quét tem điểm sơn
 * trước".
 */
import { useCallback, useEffect, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { getPalletForWorker, paintPallet, type Pallet } from '../../../../services/pallets-api'
import { useRetrySafeKey } from '../../../../hooks/useRetrySafeKey'
import { hhmm } from '../floorUi'
import {
  checkShort, NO_WS_TEXT, PALLET_STATUS_LABEL, PALLET_STATUS_TONE, qtyDigits, workerPalletNote,
} from '../../InboundWarehouse/palletModel'
import { errText } from './scanModel'
import { Banner } from './ScanParts'
import { useOpenScanner } from './scannerContext'
import { btn, card, column, heading, hint, label, loadingText, numInput, pill, rowBetween } from './scanUi'

type Flash = { tone: 'ok' | 'err' | 'warn'; text: string }

export default function PalletPanel({ token, ws }: { token: string; ws: string | null }) {
  const openScanner = useOpenScanner()
  const [pallet, setPallet] = useState<Pallet | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [busy, setBusy] = useState(false)
  const [short, setShort] = useState(false)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const retryKey = useRetrySafeKey()

  const load = useCallback(async () => {
    try {
      const v = await getPalletForWorker(token)
      setEnabled(v.enabled); setPallet(v.pallet); setLoadErr(null)
    } catch (e) { setLoadErr(errText(e)) }
  }, [token])
  // Tải pallet khi mở màn - setState chỉ xảy ra sau khi request trả về.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const submit = async (input: { qty?: number; shortReason?: string }) => {
    if (!ws || !pallet) return
    setBusy(true); setFlash(null)
    try {
      const out = await paintPallet(ws, token, input, retryKey.take({ token, ...input }))
      retryKey.settle()
      const n = input.qty ?? pallet.load?.qty ?? 0
      setFlash({
        tone: out.short ? 'warn' : 'ok',
        text: out.short
          ? `Đã báo thiếu: sơn xong ${n} / ${pallet.load?.qty ?? n} mảnh pallet ${pallet.code} · ${hhmm()}. Quản lý và kho Sơn đã được báo.`
          : `Đã báo Sơn xong ${n} mảnh pallet ${pallet.code} · ${hhmm()}`,
      })
      setShort(false); setQty(''); setReason('')
      if (out.pallet) setPallet(out.pallet)
      else await load()
    } catch (e) {
      retryKey.settle(e)
      setFlash({ tone: 'err', text: errText(e) })
      void load()
    } finally {
      setBusy(false)
    }
  }

  if (loadErr) return <Banner tone="err">{loadErr}</Banner>
  if (!enabled) return <Banner tone="warn">Báo Sơn theo pallet chưa bật. Báo số mảnh ở tem điểm sơn như bình thường.</Banner>
  if (!pallet) return <div style={loadingText}>Đang tải pallet…</div>

  const ld = pallet.load
  const tone = PALLET_STATUS_TONE[pallet.status]
  const note = workerPalletNote(pallet)
  const shortCheck = ld ? checkShort(ld.qty, qty, reason) : null
  const canReport = pallet.status === 'LOADED' && !!ld && !!ws

  return (
    <div style={column(12)}>
      {flash && <Banner tone={flash.tone}>{flash.text}</Banner>}
      <div style={card}>
        <div style={rowBetween}>
          <h2 style={heading}>Pallet {pallet.code}</h2>
          <span style={pill(tone.bg, tone.fg)}>{PALLET_STATUS_LABEL[pallet.status]}</span>
        </div>
        {ld ? (
          <div style={{ ...column(6), marginTop: 10 }}>
            <div style={hint}>Lệnh <b>{ld.lenhCode}</b> · SKU <b>{ld.sku}</b></div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{ld.pieceName}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{ld.qty}</span>
              <span style={hint}>mảnh trên pallet{ld.paintedQty != null && ld.paintedQty !== ld.qty ? ` · đã báo ${ld.paintedQty}` : ''}</span>
            </div>
          </div>
        ) : <div style={{ ...hint, marginTop: 8 }}>Pallet chưa có hàng.</div>}
      </div>

      {note && <Banner tone={note.tone}>{note.text}</Banner>}
      {pallet.status === 'LOADED' && !ws && (
        <Banner tone="warn">{NO_WS_TEXT}</Banner>
      )}

      {canReport && !short && (
        <div style={column(10)}>
          <button type="button" disabled={busy} onClick={() => void submit({})} style={btn(true, busy)}>
            {busy ? 'Đang gửi…' : `Sơn xong pallet này (${ld.qty} mảnh)`}
          </button>
          <button type="button" disabled={busy} onClick={() => { setShort(true); setFlash(null) }} style={btn(false, busy)}>
            Báo thiếu
          </button>
        </div>
      )}

      {canReport && short && shortCheck && (
        <div style={{ ...card, ...column(12) }}>
          <div style={label}>Báo thiếu - số mảnh đã sơn xong (trên pallet có {ld.qty})</div>
          <input inputMode="numeric" pattern="[0-9]*" aria-label="Số mảnh sơn xong" value={qty}
            onChange={(e) => setQty(qtyDigits(e.target.value))} style={{ ...numInput, width: 120 }} />
          <div style={label}>Lý do thiếu (bắt buộc)</div>
          <textarea aria-label="Lý do thiếu" value={reason} maxLength={300} rows={3}
            onChange={(e) => setReason(e.target.value)}
            style={{ fontSize: 16, padding: 10, borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)' }} />
          {(qty || reason) && shortCheck.error && <div style={{ ...hint, color: 'var(--red)' }}>{shortCheck.error}</div>}
          <button type="button" disabled={busy || !!shortCheck.error}
            onClick={() => void submit({ qty: shortCheck.qty!, shortReason: shortCheck.reason })}
            style={btn(true, busy || !!shortCheck.error)}>
            {busy ? 'Đang gửi…' : 'Gửi báo thiếu'}
          </button>
          <button type="button" disabled={busy} onClick={() => setShort(false)} style={btn(false)}>Quay lại</button>
        </div>
      )}

      {openScanner && (
        <button type="button" onClick={openScanner}
          style={{ ...btn(false), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ScanLine size={20} aria-hidden /> {ws ? 'Quét pallet khác' : 'Quét tem điểm sơn'}
        </button>
      )}
    </div>
  )
}
