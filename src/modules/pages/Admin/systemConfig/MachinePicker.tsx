'use client'

/** Nhóm "Theo máy": hai thẻ chọn máy (chỉ để XEM/SỬA, không đổi máy mặc định) + khung thông số của máy đang xem. */

import { CheckCircle2 } from 'lucide-react'
import type { SolverMachine, SystemConfig } from '../../../../types/admin'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import { summarizeBundle } from '../systemConfigUi'
import { NumField, type ConfigForm } from './fieldParts'
import { fmtMcNum, LASER_FIELDS, MACHINE_DESC, MACHINE_KEYS } from './mcFields'
import { dot, FIELD_GRID } from './systemConfigStyles'
import TuDongFields, { type SpecTableProps } from './TuDongFields'

const MACHINES: SolverMachine[] = ['laser', 'tu_dong']

/** Dòng tóm tắt trên thẻ máy: lưỡi, tề đầu, và với MC Tự động thêm số cây/bó (bảng quy cách được ưu tiên). */
function machineSummary(m: SolverMachine, v: SystemConfig, specCount: number): string {
  if (m === 'laser') return `Lưỡi ${fmtMcNum(v.solverBladeWidthMm)} mm · Tề ${fmtMcNum(v.solverTrimStartMm)} mm`
  const bundle = summarizeBundle(v.solverBundleFactors ?? [], specCount)
  return `Lưỡi ${fmtMcNum(v.solverMctdBladeWidthMm)} mm · Tề ${fmtMcNum(v.solverMctdTrimStartMm)} mm${bundle ? ` · ${bundle}` : ''}`
}

function MachineCard({ m, selected, isDefault, hasError, dirty, summary, onPick }: {
  m: SolverMachine; selected: boolean; isDefault: boolean; hasError: boolean; dirty: boolean; summary: string; onPick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-controls="machine-params"
      onClick={onPick}
      style={{
        flex: '1 1 240px', textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', font: 'inherit',
        color: 'var(--text)',
        border: `${selected ? 2 : 1}px solid ${selected ? 'var(--fg-3949ab)' : 'var(--border)'}`,
        background: selected ? 'var(--surface2)' : 'var(--surface)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13, fontWeight: 700 }}>
        {MACHINE_LABEL[m]}
        {isDefault && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
            color: 'var(--fg-2e7d32)', background: 'var(--bg-e8f5e9)',
          }}>Mặc định</span>
        )}
        {hasError ? (
          <span title="Có ô chưa hợp lệ" aria-label="có ô chưa hợp lệ" style={dot('var(--fg-c62828)')} />
        ) : dirty && (
          <span title="Có thay đổi chưa lưu" aria-label="có thay đổi chưa lưu" style={dot('var(--fg-e65100)')} />
        )}
      </span>
      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{MACHINE_DESC[m]}</span>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {summary}
      </span>
    </button>
  )
}

/** Đầu khung thông số của máy đang xem: tên + trạng thái máy mặc định (đổi máy mặc định CHỈ bằng nút này). */
function PanelHeader({ m, isDefault, onMakeDefault }: { m: SolverMachine; isDefault: boolean; onMakeDefault: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Thông số {MACHINE_LABEL[m]}</div>
      {isDefault ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--fg-2e7d32)' }}>
          <CheckCircle2 size={14} aria-hidden /> Đang là máy mặc định
        </span>
      ) : (
        <button
          type="button"
          onClick={onMakeDefault}
          title="Đợt cắt nào KHSX không chọn máy sẽ dùng máy mặc định. Bấm Lưu thay đổi để áp dụng."
          style={{
            padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--fg-3949ab)', borderRadius: 8,
            background: 'var(--surface)', color: 'var(--fg-3949ab)', cursor: 'pointer',
          }}
        >
          Đặt làm máy mặc định
        </button>
      )}
    </div>
  )
}

export default function MachinePicker({ form, view, onView, spec, specDirty }: {
  form: ConfigForm
  /** Máy đang xem thông số. */
  view: SolverMachine
  onView: (m: SolverMachine) => void
  spec: SpecTableProps
  /** Bảng quy cách đã sửa mà chưa lưu. */
  specDirty: boolean
}) {
  const defaultMachine: SolverMachine = form.values.solverMachine ?? 'laser'
  const dirty = (m: SolverMachine) => MACHINE_KEYS[m].some((k) => form.text[k] !== undefined) || (m === 'tu_dong' && specDirty)
  const hasError = (m: SolverMachine) => MACHINE_KEYS[m].some((k) => form.errors[k])
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MACHINES.map((m) => (
          <MachineCard key={m} m={m} selected={view === m} isDefault={defaultMachine === m} hasError={hasError(m)} dirty={dirty(m)}
            summary={machineSummary(m, form.values, spec.rows.length)} onPick={() => onView(m)} />
        ))}
      </div>
      <div id="machine-params" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <PanelHeader m={view} isDefault={defaultMachine === view} onMakeDefault={() => form.patch({ solverMachine: view })} />
        {view === 'laser' && <div style={FIELD_GRID}>{LASER_FIELDS.map((f) => <NumField key={f.name} f={f} form={form} />)}</div>}
        {view === 'tu_dong' && <TuDongFields form={form} spec={spec} />}
      </div>
    </>
  )
}
