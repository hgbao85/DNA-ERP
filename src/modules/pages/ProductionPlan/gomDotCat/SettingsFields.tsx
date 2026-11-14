'use client'

/**
 * Hàng ô của khung "Cài đặt đợt tính": Xưởng | Máy cắt | Chế độ cắt | Hao hụt tối đa (chỉ đọc) | Chiều dài cây.
 * Xưởng đứng trước Máy cắt vì xưởng quyết định máy (máy bắt buộc theo xưởng).
 */

import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import type { SolverMachine } from '../../../../types/admin'
import type { Workshop } from '../../../../types/workshop'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import { fmtNum } from '../../../../utils/numberFormat'
import { cutModesHelp, DEFAULT_STOCK_LENGTH_MM, fmtBarMm } from '../gomDotCatUi'
import {
  ellipsisText, fieldBox, fieldCtl, fieldHeight, fieldLabel, ghostBtn,
} from './gomDotCatStyles'

const AMBER_EDGE = 'var(--fg-fcd34d)'
const NORMAL_EDGE = 'var(--border)'

export function QMark({ text }: { text: string }) {
  return (
    <span title={text} role="img" aria-label={text} style={{ display: 'inline-flex', color: 'var(--text3)', cursor: 'help' }}>
      <HelpCircle size={13} />
    </span>
  )
}

function Field({ basis, isMobile, style, children }: {
  basis: number; isMobile: boolean; style?: React.CSSProperties; children: ReactNode
}) {
  return <div style={{ ...fieldBox(basis, isMobile), ...style }}>{children}</div>
}

export interface WorkshopFieldProps {
  workshops: Workshop[]
  value: string
  onChange: (id: string) => void
  /** Đã chọn SKU mà chưa chọn xưởng: viền vàng nhắc. */
  highlight: boolean
  help: string
}

export function WorkshopField({ p, isMobile }: { p: WorkshopFieldProps; isMobile: boolean }) {
  return (
    <Field basis={200} isMobile={isMobile}>
      <div style={fieldLabel}>
        <label htmlFor="solver-workshop">Xưởng cơ khí</label>
        <span aria-hidden="true" style={{ color: 'var(--fg-b91c1c)' }} title="Bắt buộc">*</span>
        <QMark text={p.help} />
      </div>
      <select id="solver-workshop" value={p.value} onChange={(e) => p.onChange(e.target.value)} aria-required="true"
        style={{ ...fieldCtl(isMobile), border: `1px solid ${p.highlight ? AMBER_EDGE : NORMAL_EDGE}` }}>
        <option value="">— Chọn xưởng —</option>
        {p.workshops.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
      </select>
    </Field>
  )
}

export interface MachineFieldProps {
  /** Máy hiệu lực (máy bắt buộc theo xưởng, không thì máy KHSX chọn). */
  value: SolverMachine | null
  /** Xưởng có máy bắt buộc: ô khoá. */
  locked: boolean
  defaultLabel: string | null
  onChange: (m: SolverMachine | null) => void
  help: string
}

export function MachineField({ p, isMobile }: { p: MachineFieldProps; isMobile: boolean }) {
  return (
    <Field basis={200} isMobile={isMobile}>
      <div style={fieldLabel}>
        <label htmlFor="solver-machine">Máy cắt</label>
        <QMark text={p.help} />
      </div>
      <select id="solver-machine" value={p.value ?? ''} disabled={p.locked} style={fieldCtl(isMobile)}
        onChange={(e) => p.onChange(e.target.value === '' ? null : (e.target.value as SolverMachine))}>
        <option value="">{p.defaultLabel ? `Theo mặc định (${p.defaultLabel})` : 'Theo mặc định'}</option>
        <option value="laser">{MACHINE_LABEL.laser}</option>
        <option value="tu_dong">{MACHINE_LABEL.tu_dong}</option>
      </select>
    </Field>
  )
}

export interface ModeFieldProps {
  modeText: string
  open: boolean
  onToggle: () => void
  /** Đợt đang chọn có thể vượt ngưỡng: viền vàng nhắc. */
  highlight: boolean
}

export function ModeField({ p, isMobile }: { p: ModeFieldProps; isMobile: boolean }) {
  return (
    <Field basis={200} isMobile={isMobile}>
      <div style={fieldLabel}>
        <span>Chế độ cắt</span>
        <QMark text={cutModesHelp('\n')} />
      </div>
      {/* Tên nút bắt đầu "Chế độ cắt:" (e2e dựa vào) - nhãn nhìn thấy nằm ở dòng trên, nên đặt qua aria-label. */}
      <button type="button" aria-label={`Chế độ cắt: ${p.modeText}`} aria-expanded={p.open} onClick={p.onToggle} title={p.modeText}
        style={{
          ...fieldCtl(isMobile), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          textAlign: 'left', cursor: 'pointer', border: `1px solid ${p.highlight ? AMBER_EDGE : NORMAL_EDGE}`,
        }}>
        <span style={ellipsisText}>{p.modeText}</span>
        {p.open ? <ChevronUp size={14} style={{ flexShrink: 0 }} /> : <ChevronDown size={14} style={{ flexShrink: 0 }} />}
      </button>
    </Field>
  )
}

export function WasteField({ maxWastePct, help, isMobile }: { maxWastePct: number | undefined; help: string; isMobile: boolean }) {
  return (
    <Field basis={120} isMobile={isMobile} style={{ flexGrow: 0, flexBasis: isMobile ? '40%' : 150 }}>
      <div style={fieldLabel}>
        <span>Hao hụt tối đa</span>
        <QMark text={help} />
      </div>
      <div style={{
        minHeight: fieldHeight(isMobile), display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700,
        color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
      }}>
        {maxWastePct != null ? `${fmtNum(maxWastePct)}%` : '…'}
      </div>
    </Field>
  )
}

export interface LengthFieldProps {
  changedCount: number
  open: boolean
  onToggle: () => void
  help: string
}

export function LengthField({ p, isMobile }: { p: LengthFieldProps; isMobile: boolean }) {
  return (
    <Field basis={230} isMobile={isMobile}>
      <div style={fieldLabel}>
        <span>Chiều dài cây sắt</span>
        <QMark text={p.help} />
      </div>
      <div style={{ minHeight: fieldHeight(isMobile), display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...ellipsisText, fontSize: 13, color: 'var(--text)' }}>
          {p.changedCount === 0
            ? <>{fmtBarMm(DEFAULT_STOCK_LENGTH_MM)} <span style={{ color: 'var(--text3)' }}>(cây chuẩn)</span></>
            : <b style={{ color: 'var(--fg-b45309)' }}>Đã đổi {p.changedCount} loại sắt</b>}
        </span>
        <button onClick={p.onToggle} style={{ ...ghostBtn, flexShrink: 0, minHeight: isMobile ? 36 : undefined }}>
          {p.open ? 'Xong' : 'Đổi'}
        </button>
      </div>
    </Field>
  )
}
