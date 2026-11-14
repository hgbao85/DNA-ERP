'use client'

/**
 * Khối "Đợt đang chọn": cách xử lý cho ĐÚNG tổ hợp đang tick (bộ giải thật, BE cutting-batch-fix-options). Gộp chỉ để CỨU loại
 * sắt vượt ngưỡng ở cây chuẩn mà không muốn chuyển đơn gấp. Luật gộp: mốc cần sắt cả đợt trong khung N ngày, tối đa M SKU.
 * `fix` chỉ có giá trị khi gợi ý đã về ĐÚNG đợt đang tick; null = đang tìm.
 */

import { useState, type RefObject } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type {
  CuttingBatchCandidate, CuttingBatchFixMaterial, CuttingBatchFixOptions,
} from '../../../../services/cutting-batch-api'
import { fmtNum, fmtPct } from '../../../../utils/numberFormat'
import {
  fmtBarMm, materialLabel, needDatesText, splitFixMaterials, stdLabelFor, type CutModeKey,
} from '../gomDotCatUi'
import FixMaterialBlock from './FixMaterialBlock'
import { amberNote, noteText, outlineBtn, panelBox, pill, redNote, smallBtn } from './gomDotCatStyles'

export interface FixOptionsPanelProps {
  panelRef: RefObject<HTMLDivElement>
  isMobile: boolean
  items: CuttingBatchCandidate[]
  selectedCount: number
  selectedCodes: { text: string; full: string }
  /** Hạn của các SKU đang chọn, đã sắp tăng dần. */
  selDates: string[]
  mergeWindow: number
  mergeMax: number
  loading: boolean
  error: string | null
  fix: CuttingBatchFixOptions | null
  ruleReason: string | null
  deadItems: CuttingBatchCandidate[]
  daysEarlyOf: (it: CuttingBatchCandidate) => number
  cutMode: CutModeKey
  stdLenMm: number
  hasWsRule: boolean
  workshopName: string | undefined
  onToggleItem: (id: string) => void
  onAddItems: (ids: string[]) => void
  onGoUrgent: () => void
}

function DeadItemNote({ it, days, isMobile, onRemove }: {
  it: CuttingBatchCandidate; days: number; isMobile: boolean; onRemove: () => void
}) {
  return (
    <div style={{ ...amberNote, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: '1 1 240px' }}>
        <b>{it.mfgProductCode}</b> không dùng chung loại sắt nào với các SKU còn lại — gộp chung không bớt được cây nào
        {days > 0 ? `, mà phải cắt sớm ${days} ngày` : ''}.
      </span>
      <button type="button" onClick={onRemove}
        style={{ ...outlineBtn(isMobile, 'var(--fg-92400e)'), border: '1px solid var(--fg-fcd34d)' }}>Bỏ khỏi đợt</button>
    </div>
  )
}

function OkList({ ok, stdLabel, isMobile, nameOf }: {
  ok: CuttingBatchFixMaterial[]; stdLabel: string; isMobile: boolean; nameOf: (m: CuttingBatchFixMaterial) => string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        style={{ ...smallBtn(isMobile), border: 'none', background: 'none', padding: '2px 0', color: 'var(--fg-166534)' }}>
        <Check size={13} /> {ok.length} loại sắt đạt ngưỡng ở {stdLabel} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {ok.map((m) => (
            <span key={m.materialId} style={pill('var(--bg-e8f5e9)', 'var(--fg-166534)', { fontSize: 11, fontWeight: 600 })}>
              <span title={m.materialCode}>{nameOf(m)}</span> {fmtPct(m.wastePct ?? 0)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function AddAllRow({ fix, isMobile, onAddItems }: { fix: CuttingBatchFixOptions; isMobile: boolean; onAddItems: (ids: string[]) => void }) {
  const ids = fix.addAllItemIds ?? []
  return (
    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {ids.length > 0 ? (
        <button type="button" onClick={() => onAddItems(ids)}
          style={{ ...smallBtn(isMobile), border: 'none', background: 'var(--bg-2e7d32)', color: '#fff' }}>
          <Check size={13} /> Thêm tất cả đơn gợi ý ({ids.length} đơn)
        </button>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{fix.addAllReason}</span>
      )}
    </div>
  )
}

function Head({ p, overCount }: { p: Omit<FixOptionsPanelProps, 'panelRef'>; overCount: number }) {
  const over = overCount > 0
  const firstOver = splitFixMaterials(p.fix).over[0]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <b style={{ fontSize: 14, color: 'var(--text)' }}>
        Đợt đang chọn · {p.selectedCount} SKU
        {p.selectedCodes.text && (
          <span title={p.selectedCodes.full} style={{ fontWeight: 600, color: 'var(--text2)' }}>: {p.selectedCodes.text}</span>
        )}
      </b>
      <span style={{ fontSize: 12, color: 'var(--text2)' }}>
        {needDatesText(p.selDates)}
        {` · luật gộp: khung ${p.mergeWindow} ngày, tối đa ${p.mergeMax} SKU`}
      </span>
      {p.loading && <Loader2 size={14} className="spin" color="var(--text3)" />}
      {p.fix && !p.ruleReason && (
        <span style={pill(over ? 'var(--bg-fffbeb)' : 'var(--bg-e8f5e9)', over ? 'var(--fg-92400e)' : 'var(--fg-166534)', {
          marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '2px 9px',
        })}>
          {over
            ? `Ước tính ở ${stdLabelFor(firstOver.stockLengthMm, p.stdLenMm)}: `
              + `${overCount} loại sắt có thể vượt ${fmtNum(firstOver.thresholdPct)}%`
            : `Cắt được ở cây chuẩn ${fmtBarMm(p.stdLenMm)}, mọi loại sắt đạt ngưỡng`}
        </span>
      )}
    </div>
  )
}

export default function FixOptionsPanel({ panelRef, ...p }: FixOptionsPanelProps) {
  const { fix, items } = p
  const groups = splitFixMaterials(fix)
  const itemById = new Map(items.map((i) => [i.productionInvoiceItemId, i]))
  // Tên · Quy cách của loại sắt (bản ghi gợi ý chỉ có mã) - lấy từ bảng SKU đang hiện; thiếu thì rơi về mã.
  const nameById = new Map<string, string>()
  for (const it of items) {
    for (const mm of it.materials) {
      if (!nameById.has(mm.materialId)) nameById.set(mm.materialId, materialLabel(mm.materialName, mm.materialSpec, mm.materialCode))
    }
  }
  const nameOf = (m: { materialId: string; materialCode: string }) => nameById.get(m.materialId) ?? m.materialCode
  const borderColor = p.ruleReason ? 'var(--fg-dc2626)' : groups.over.length ? 'var(--fg-fcd34d)' : 'var(--border)'
  const shared = {
    mergeMax: p.mergeMax, hasWsRule: p.hasWsRule, workshopName: p.workshopName, itemById, isMobile: p.isMobile,
    cutMode: p.cutMode, onAddItems: p.onAddItems, onGoUrgent: p.onGoUrgent,
  }
  return (
    <div ref={panelRef} aria-busy={p.loading} style={panelBox('12px 14px', borderColor)}>
      <Head p={p} overCount={groups.over.length} />
      {p.ruleReason && (
        <div role="alert" style={{ ...redNote, marginTop: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b>Không tính / gộp được đợt này:</b> {p.ruleReason}</span>
        </div>
      )}
      {p.error && <div style={noteText('var(--fg-b91c1c)')}>{p.error}</div>}
      {!fix && !p.error && <div style={noteText('var(--text2)')}>Đang tìm cách xử lý cho đợt này…</div>}

      {/* Ngay dưới cảnh báo luật gộp, KHÔNG đặt sau danh sách loại sắt: gợi ý tải xong đẩy ô xuống -> bấm "Bỏ khỏi đợt" trượt. */}
      {p.deadItems.map((it) => (
        <DeadItemNote key={it.productionInvoiceItemId} it={it} days={p.daysEarlyOf(it)} isMobile={p.isMobile}
          onRemove={() => p.onToggleItem(it.productionInvoiceItemId)} />
      ))}

      {groups.over.map((m) => (
        <FixMaterialBlock key={m.materialId} m={m} label={nameOf(m)} stdLenMm={p.stdLenMm} shared={shared} />
      ))}

      {groups.unknown.length > 0 && (
        <div style={noteText('var(--text2)')}>
          Chưa kiểm kịp: {groups.unknown.map((m) => nameOf(m)).join(', ')} — bấm “Tải lại” để thử lại.
        </div>
      )}
      {groups.ok.length > 0 && (
        <OkList ok={groups.ok} stdLabel={`cây chuẩn ${fmtBarMm(p.stdLenMm)}`} isMobile={p.isMobile} nameOf={nameOf} />
      )}
      {fix && (fix.addAllItemIds?.length || fix.addAllReason) && <AddAllRow fix={fix} isMobile={p.isMobile} onAddItems={p.onAddItems} />}
      {fix?.incomplete && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text2)' }}>
          Một số cách xử lý chưa tính kịp trong thời gian cho phép — bấm “Tải lại” để tính tiếp.
        </div>
      )}
    </div>
  )
}
