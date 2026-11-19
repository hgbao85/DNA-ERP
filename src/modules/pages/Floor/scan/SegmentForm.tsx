'use client'

/** Tổ Phôi: nhập số đoạn theo từng cỡ của loại sắt đã chọn. */

import { useMemo, useState } from 'react'
import type { BeScanMaterial } from '../../../../services/floor-api'
import {
  anySegmentOverMax, digits, fmtMm, materialsForSku, segmentAction, segmentConfirmRows, segmentLeft, segmentLeftText, segmentLines,
  segmentMaxNow, segmentSummary, splitByReceived, type ScanMaterial,
} from './scanModel'
import { ActionBar, Banner, ConfirmSheet } from './ScanParts'
import { cardFlush, chip, chipRow, divider, hint, label, numInput } from './scanUi'

function LeftText({ s, kind }: { s: ScanMaterial['segments'][number]; kind: string }) {
  const left = segmentLeft(s)
  const strong = { fontSize: 16 } as const
  return (
    <div style={hint}>
      Đã {kind.toLowerCase()} {s.done}/{s.required}
      {left.kind === 'left' && <> · <b style={{ ...strong, color: 'var(--text)' }}>{segmentLeftText(s)}</b></>}
      {left.kind === 'none' && <> · <b style={{ ...strong, color: 'var(--amber)' }}>{segmentLeftText(s)}</b></>}
      {left.kind === 'done' && <> · <b style={{ ...strong, color: 'var(--green)' }}><span aria-hidden>✓ </span>{segmentLeftText(s)}</b></>}
    </div>
  )
}

function SegmentRows({ segments, kind, qty, blocked, onQty }: {
  segments: ScanMaterial['segments']; kind: string; qty: Record<string, string>; blocked: boolean
  onQty: (segmentSpecId: string, value: string) => void
}) {
  return (
    <div style={cardFlush}>
      {segments.map((s, i) => (
        <div key={s.segmentSpecId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', ...divider(i) }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtMm(s.cutLengthMm)} mm</div>
            <LeftText s={s} kind={kind} />
            {Number(qty[s.segmentSpecId] || 0) > segmentMaxNow(s) && (
              <div role="alert" style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>
                Chỉ còn báo được {segmentMaxNow(s)} đoạn. Sửa lại số.
              </div>
            )}
          </div>
          <input aria-label={`Số đoạn ${s.cutLengthMm}mm`} inputMode="numeric" disabled={blocked}
            value={qty[s.segmentSpecId] ?? ''} placeholder="0" style={numInput}
            onChange={(e) => onQty(s.segmentSpecId, digits(e.target.value))} />
        </div>
      ))}
    </div>
  )
}

const WAIT_HELP = 'Quét mã ở khu nhận sắt để nhận sắt trước, rồi mới báo cắt.'

/** Chọn loại sắt đã nhận; loại chưa nhận gom vào 1 dòng bấm mở (khỏi đẩy ô nhập số xuống dưới nếp gập). */
function MaterialChooser({ usable, waiting, current, onPick }: {
  usable: ScanMaterial[]; waiting: ScanMaterial[]; current: ScanMaterial; onPick: (id: string) => void
}) {
  const [showWaiting, setShowWaiting] = useState(false)
  return (
    <>
      {usable.length > 1 ? (
        <div>
          <div style={label}>Loại sắt</div>
          <div style={chipRow}>
            {usable.map((m) => (
              <button key={m.materialId} type="button" aria-pressed={m.materialId === current.materialId}
                style={chip(m.materialId === current.materialId)} onClick={() => onPick(m.materialId)}>
                {m.materialName}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={hint}>Loại sắt <b style={{ fontSize: 16, color: 'var(--text)' }}>{current.materialName}</b></div>
      )}
      {waiting.length > 0 && (
        <div>
          <button type="button" aria-expanded={showWaiting} onClick={() => setShowWaiting((v) => !v)}
            style={{ ...chip(false), fontSize: 14, color: 'var(--floor-hint)' }}>
            {waiting.length} loại sắt chưa nhận <span aria-hidden>{showWaiting ? '▴' : '▾'}</span>
          </button>
          {showWaiting && <div style={{ ...hint, marginTop: 8 }}>{waiting.map((m) => m.materialName).join(', ')}. {WAIT_HELP}</div>}
        </div>
      )}
    </>
  )
}

export default function SegmentForm({ materials, orderId, kindLabel, context, onSubmit }: {
  materials: BeScanMaterial[]; orderId: string; kindLabel: string
  /** "PI-2026-040 · GHE-J55" - hiện ở bảng xác nhận để công nhân biết đang lưu cho lệnh / SKU nào. */
  context: string
  onSubmit: (materialId: string, segments: { segmentSpecId: string; qty: number }[], summary: string) => Promise<boolean>
}) {
  const forSku = useMemo(() => materialsForSku(materials, orderId), [materials, orderId])
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { needsReceived, usable, waiting } = splitByReceived(forSku, kindLabel)
  const current = usable.find((m) => m.materialId === materialId) ?? usable[0] ?? forSku[0] ?? null

  if (!current) return <Banner tone="info">Sản phẩm này không có đoạn nào cần {kindLabel.toLowerCase()}.</Banner>

  const lines = segmentLines(current.segments, qty)
  const total = lines.reduce((t, x) => t + x.n, 0)
  const blocked = needsReceived && !current.hasReceivedSteel
  const confirmRows = segmentConfirmRows(lines)
  const over = anySegmentOverMax(lines)

  const submit = async () => {
    if (!lines.length || blocked || over) return
    setBusy(true)
    const segments = lines.map((x) => ({ segmentSpecId: x.s.segmentSpecId, qty: x.n }))
    const ok = await onSubmit(current.materialId, segments, segmentSummary(lines))
    setBusy(false)
    setConfirming(false) // lỗi thì banner đỏ ở đầu trang, số vẫn còn nguyên để bấm lại
    if (ok) setQty({})
  }

  return (
    <>
      <MaterialChooser usable={usable} waiting={waiting} current={current} onPick={(id) => { setMaterialId(id); setQty({}) }} />
      {blocked && <Banner tone="warn">Loại sắt này chưa nhận. {WAIT_HELP}</Banner>}
      <SegmentRows segments={current.segments} kind={kindLabel} qty={qty} blocked={blocked}
        onQty={(id, v) => setQty((q) => ({ ...q, [id]: v }))} />
      <ActionBar action={segmentAction({ busy, total, blocked, over })}
        onClick={() => { if (lines.length && !blocked && !over) setConfirming(true) }} />
      {confirming && (
        <ConfirmSheet
          title={`Xác nhận báo ${kindLabel.toLowerCase()}`}
          context={`${current.materialName} · ${context}`}
          rows={confirmRows}
          total={`Tổng ${total} đoạn`}
          confirmLabel={`Đúng, lưu ${total} đoạn`}
          busy={busy}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
