'use client'

/** Tổ Hàn / Sơn: chọn mảnh rồi nhập số mảnh. */

import { useState } from 'react'
import type { BeScanPieceItem } from '../../../../services/floor-api'
import { digits, fmtQty, handoverTiles, pieceAction, pieceConfirmRow, pieceMaxNow, receivedOverText, type HandoverTiles } from './scanModel'
import { ActionBar, Banner, ConfirmSheet } from './ScanParts'
import { card, cardFlush, divider, hint, numInput } from './scanUi'

/** Giao nhận giữa tổ (24/11/2026): 3 ô "Đã nhận / Đã làm / Còn" theo hàng kho đã giao qua phiếu + số còn theo kế hoạch. */
function HandoverTilesBox({ t }: { t: HandoverTiles }) {
  const tiles: [string, number, string | undefined][] = [
    ['Đã nhận', t.received, undefined],
    ['Đã làm', t.used, undefined],
    ['Còn', t.left, t.left <= 0 ? 'var(--red)' : 'var(--green)'],
  ]
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {tiles.map(([label, n, color]) => (
          <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{fmtQty(n)}</div>
          </div>
        ))}
      </div>
      <div style={{ ...hint, marginTop: 8, textAlign: 'center' }}>Kế hoạch: còn báo được <b style={{ color: 'var(--text)' }}>{fmtQty(t.planLeft)}</b></div>
    </div>
  )
}

function PieceList({ items, pieceId, onPick }: { items: BeScanPieceItem[]; pieceId: string | null; onPick: (id: string) => void }) {
  return (
    <div style={cardFlush}>
      {items.map((p, i) => {
        const on = p.pieceId === pieceId
        const done = p.passedQty + p.awaitingQcQty
        return (
          <button key={p.pieceId} type="button" aria-pressed={on} onClick={() => onPick(p.pieceId)} style={{
            display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 12,
            padding: '14px 16px', border: 'none', ...divider(i),
            background: on ? 'var(--blue-bg)' : 'transparent', color: 'var(--text)', cursor: 'pointer',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{p.pieceName}</div>
              <div style={hint}>
                Đã báo {done + p.openQty}/{p.plannedQty}
                {p.openQty > 0 && <> · <span style={{ color: 'var(--amber)' }}>{p.openQty} chờ kiểm hàng</span></>}
                {' · '}<b style={{ color: 'var(--text)' }}>còn báo được {pieceMaxNow(p)}</b>
              </div>
            </div>
            <span aria-hidden style={{ fontSize: 20, color: on ? 'var(--blue)' : 'var(--floor-hint)' }}>{on ? '●' : '○'}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function PieceForm({ items, context, stageLabel, onSubmit }: {
  items: BeScanPieceItem[]
  /** "PI-2026-040 · GHE-J55" - hiện ở bảng xác nhận. */
  context: string
  stageLabel: string
  onSubmit: (pieceId: string, qty: number, summary: string) => Promise<boolean>
}) {
  const [pieceId, setPieceId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const piece = items.find((p) => p.pieceId === pieceId) ?? null
  const n = Number(qty || 0)

  if (!items.length) return <Banner tone="info">Sản phẩm này không có mảnh nào làm ở đây.</Banner>
  const submit = async () => {
    if (!piece || !n || over) return
    setBusy(true)
    const ok = await onSubmit(piece.pieceId, n, `${n} ${piece.pieceName}`)
    setBusy(false)
    setConfirming(false) // lỗi thì banner đỏ ở đầu trang, số vẫn còn nguyên để bấm lại
    if (ok) setQty('')
  }
  // Nhập nhiều hơn số còn báo được (maxNow của BE) thì BE chặn: khoá nút Lưu và nút xác nhận.
  const max = piece ? pieceMaxNow(piece) : 0
  const over = !!piece && n > max
  const tiles = piece ? handoverTiles(piece) : null
  const receivedOver = piece ? receivedOverText(piece, n) : null
  return (
    <>
      <PieceList items={items} pieceId={pieceId} onPick={(id) => { setPieceId(id); setQty('') }} />
      {tiles && <HandoverTilesBox t={tiles} />}
      {receivedOver && <Banner tone="err">{receivedOver}</Banner>}
      <ActionBar
        action={pieceAction({ busy, pieceName: piece?.pieceName ?? null, n, over })}
        onClick={() => { if (piece && n && !over) setConfirming(true) }}
        leading={piece && (
          <input aria-label={`Số mảnh ${piece.pieceName}`} inputMode="numeric" value={qty} placeholder="0"
            autoFocus style={{ ...numInput, width: 96 }} onChange={(e) => setQty(digits(e.target.value))} />
        )}
      />
      {confirming && piece && (
        <ConfirmSheet
          title={`Xác nhận báo ${stageLabel}`}
          context={context}
          rows={[pieceConfirmRow(piece, n)]}
          confirmLabel={`Đúng, lưu ${n} mảnh`}
          busy={busy}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
