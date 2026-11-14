'use client'

/** 3 cách xử lý của 1 loại sắt vượt ngưỡng (gộp thêm đơn / đặt riêng / đơn gấp): dựng dòng + vẽ dòng. */

import type { CSSProperties, ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { CuttingBatchCandidate, CuttingBatchFixMaterial } from '../../../../services/cutting-batch-api'
import { fmtPct } from '../../../../utils/numberFormat'
import { fmtBarMm, fmtDate, overThresholdText, pctColor, type CutModeKey } from '../gomDotCatUi'
import { outlineBtn, smallBtn } from './gomDotCatStyles'

export interface FixRow {
  key: string
  name: ReactNode
  detail?: ReactNode
  pct?: ReactNode
  note?: ReactNode
  action?: ReactNode
  dim?: boolean
  wide?: boolean
}

export interface FixRowsCtx {
  m: CuttingBatchFixMaterial
  /** "cây chuẩn 6.000 mm" hoặc "cây 5.850 mm". */
  std: string
  /** Ngưỡng đã ghi sẵn, vd "1". */
  thr: string
  mergeMax: number
  hasWsRule: boolean
  workshopName: string | undefined
  itemById: Map<string, CuttingBatchCandidate>
  isMobile: boolean
  cutMode: CutModeKey
  onAddItems: (ids: string[]) => void
  onGoUrgent: () => void
}

/** Lưới 3 cột (máy tính): Cách xử lý | Hao hụt ước tính + ghi chú | nút. Cột trái cố định ~200 px. Điện thoại xếp dọc. */
export const fixGrid: CSSProperties = {
  display: 'grid', gridTemplateColumns: '200px minmax(0,1fr) auto', columnGap: 12, alignItems: 'center',
}

// Mọi số trong lưới do bộ giải BE tính (đã kiểm): đạt ngưỡng xanh, không đạt ĐỎ. Số ước tính (chưa kiểm) mới vàng cam.
const GOOD: CSSProperties = { color: pctColor('checked', true), fontWeight: 700 }
const BAD: CSSProperties = { color: pctColor('checked', false), fontWeight: 700 }
const AMBER = { color: 'var(--fg-b45309)' }

function addRow(c: FixRowsCtx): FixRow {
  const { m } = c
  const a = m.addSuggestion
  if (!a) return { key: 'add', name: 'Gộp thêm đơn', pct: '—', note: m.addReason ?? 'không có đơn nào dùng chung loại sắt này.', dim: true }
  const overText = overThresholdText(`${c.thr}%`, fmtPct(a.wastePct))
  return {
    key: 'add',
    name: <>Gộp thêm đơn {a.itemIds.map((id, k) => (
      <span key={id}>{k > 0 && ', '}<b>{c.itemById.get(id)?.mfgProductCode ?? id}</b></span>
    ))}</>,
    detail: <>{a.itemIds.map((id, k) => {
      const it = c.itemById.get(id)
      const code = it?.salesOrderCode ?? it?.productionInvoiceCode ?? '—'
      return <span key={id}>{k > 0 && ', '}{code}, mốc {fmtDate(it?.deadline ?? null)}</span>
    })}{a.spanDaysAfter != null && a.spanDaysAfter > 0 ? ` · mốc chênh ${a.spanDaysAfter} ngày` : ''}</>,
    pct: (
      <span title={a.meetsThreshold ? undefined : 'Tổng hao hụt thấp nhất của cả đợt nếu chấp nhận các cây vượt ngưỡng'}
        style={a.meetsThreshold ? GOOD : BAD}>{fmtPct(a.wastePct)}</span>
    ),
    note: a.meetsThreshold ? `ở ${c.std}, đạt ngưỡng` : `vẫn ${overText} — gộp tối đa ${c.mergeMax} SKU chưa cứu được`,
    // Gộp KHÔNG đạt ngưỡng thì không có nút: bấm vào cũng không cứu được (chỉ giữ câu giải thích, dòng mờ).
    action: a.meetsThreshold ? (
      <button type="button" onClick={() => c.onAddItems(a.itemIds)} style={outlineBtn(c.isMobile, 'var(--fg-15803d)')}>
        <Check size={13} /> Thêm vào đợt
      </button>
    ) : undefined,
    dim: !a.meetsThreshold,
  }
}

function customRow(c: FixRowsCtx): FixRow {
  const { m } = c
  if (c.hasWsRule) {
    // Xưởng có luật số cỡ: hệ thống giữ cây chuẩn + nới số cỡ trước, nên số cây riêng ước tính không còn đúng - không hiện.
    return {
      key: 'custom',
      name: 'Đặt riêng',
      note: `${c.workshopName}: hệ thống giữ cây chuẩn, thử nới số cỡ đoạn/cây trước; chỉ khi vẫn không đạt mới đặt cây riêng. `
        + 'Số chính xác có sau khi Tính.',
      wide: true,
      dim: true,
    }
  }
  if (!m.customLength) {
    return {
      key: 'custom',
      name: 'Đặt riêng',
      pct: '—',
      note: 'không tìm được cây riêng đạt ngưỡng trong dải dò — chế độ Bình thường sẽ báo “Cần xử lý”.',
      dim: true,
    }
  }
  const ok = m.customLength.wastePct <= m.thresholdPct
  return {
    key: 'custom',
    name: 'Đặt riêng',
    pct: <span style={ok ? GOOD : BAD}>{fmtPct(m.customLength.wastePct)}</span>,
    note: <>cây {fmtBarMm(m.customLength.lengthMm)} <span style={AMBER}>· phải chờ NCC cán cây</span></>,
  }
}

function urgentRow(c: FixRowsCtx): FixRow {
  const { m } = c
  const action = c.cutMode !== 'ACCEPT_OVER' ? (
    <button type="button" onClick={c.onGoUrgent}
      style={{ ...smallBtn(c.isMobile), border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)' }}>
      Chuyển sang đơn gấp
    </button>
  ) : undefined
  const name = 'Đơn gấp (chấp nhận hao hụt cao)'
  if (!m.urgent) {
    return { key: 'urgent', name, pct: '—', note: `bộ giải chưa tính kịp mức hao hụt khi vẫn mua ${c.std}.`, action, dim: true }
  }
  return {
    key: 'urgent',
    name,
    pct: <span style={m.urgent.wastePct <= m.thresholdPct ? GOOD : BAD}>{fmtPct(m.urgent.wastePct)}</span>,
    note: <>vẫn mua {c.std} <span style={AMBER}>· cần Sếp duyệt</span></>,
    action,
  }
}

/** Ba dòng theo thứ tự: gộp thêm đơn, đặt riêng, đơn gấp. */
export function buildFixRows(c: FixRowsCtx): FixRow[] {
  return [addRow(c), customRow(c), urgentRow(c)]
}

export function FixRowView({ r, best, isMobile }: { r: FixRow; best: boolean; isMobile: boolean }) {
  const base: CSSProperties = {
    border: best ? '2px solid var(--fg-15803d)' : '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '8px 10px', fontSize: 12.5, color: r.dim ? 'var(--text3)' : 'var(--text2)',
  }
  const nameEl = (
    <div style={{ minWidth: 0, color: r.dim ? 'var(--text2)' : 'var(--text)' }}>
      {r.name}
      {best && (
        <span style={{
          marginLeft: 6, fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
          background: 'var(--bg-e8f5e9)', color: 'var(--fg-166534)', whiteSpace: 'nowrap',
        }}>nên chọn</span>
      )}
      {r.detail && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{r.detail}</div>}
    </div>
  )
  const pctNote = (
    <div style={{ minWidth: 0 }}>
      {r.pct != null && <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', marginRight: 6 }}>{r.pct}</span>}
      {r.note != null && <span style={{ fontSize: 12 }}>{r.note}</span>}
    </div>
  )
  if (isMobile) {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {nameEl}{pctNote}{r.action && <div>{r.action}</div>}
      </div>
    )
  }
  return (
    <div style={{ ...base, ...fixGrid }}>
      {nameEl}
      <div style={{ gridColumn: r.wide ? '2 / 4' : undefined, minWidth: 0 }}>{pctNote}</div>
      {!r.wide && <div>{r.action}</div>}
    </div>
  )
}
