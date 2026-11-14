'use client'

/**
 * Khung "Cài đặt đợt tính": MỘT hàng ô (xuống dòng khi hẹp) + các dòng trạng thái ngắn đang cần. Câu giải thích dài vào dấu "?"
 * (rê chuột) và nút "Giải thích" (chạm). Số ước tính trên bảng và chip CHƯA áp luật xưởng.
 */

import type { ReactNode, RefObject } from 'react'
import { HelpCircle, Settings } from 'lucide-react'
import type { SolverMachine } from '../../../../types/admin'
import type { Workshop } from '../../../../types/workshop'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import { cutModesHelp } from '../gomDotCatUi'
import { mutedBox, panelBox, statusLine, textBtn } from './gomDotCatStyles'
import { HELP_LENGTH, HELP_MACHINE, HELP_WASTE, helpWorkshop, TU_DONG_NOTE } from './settingsHelp'
import {
  LengthField, MachineField, ModeField, WasteField, WorkshopField,
  type LengthFieldProps, type MachineFieldProps, type ModeFieldProps, type WorkshopFieldProps,
} from './SettingsFields'
import StockLengthEditor, { LengthChangedLine, type StockLengthProps } from './StockLengthEditor'

export interface SettingsPanelProps {
  panelRef: RefObject<HTMLDivElement>
  isMobile: boolean
  workshops: Workshop[]
  workshopId: string
  onWorkshop: (id: string) => void
  selectedWorkshop: Workshop | null
  /** Luật số cỡ đoạn/cây của xưởng đang chọn (nếu có). */
  workshopMaxSizes: number | undefined
  selectedCount: number
  /** Máy hiệu lực (xưởng bắt buộc thì theo xưởng, không thì máy KHSX chọn); null = theo mặc định. */
  usedMachine: SolverMachine | null
  /** Máy bắt buộc theo xưởng (ô máy khoá). */
  forcedMachine: SolverMachine | null
  defaultMachine: SolverMachine | undefined
  onMachine: (m: SolverMachine | null) => void
  maxWastePct: number | undefined
  modeText: string
  modeOpen: boolean
  onToggleMode: () => void
  overrideNeeded: boolean
  helpOpen: boolean
  onToggleHelp: () => void
  lengthOpen: boolean
  onToggleLength: () => void
  length: StockLengthProps
  machineParamsButton: ReactNode
  machineParamsBody: ReactNode
  cutModeDetail: ReactNode
}

type Props = Omit<SettingsPanelProps, 'panelRef'>

function Header({ p }: { p: Props }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 14px', marginBottom: 8 }}>
      <b style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--text)' }}>
        <Settings size={14} /> Cài đặt đợt tính
      </b>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 14px' }}>
        {p.machineParamsButton}
        <button type="button" aria-expanded={p.helpOpen} onClick={p.onToggleHelp} style={textBtn(p.isMobile)}>
          <HelpCircle size={14} /> {p.helpOpen ? 'Ẩn giải thích' : 'Giải thích'}
        </button>
      </span>
    </div>
  )
}

function StatusLines({ p }: { p: Props }) {
  const amber = 'var(--fg-92400e)'
  const tuDongEff = (p.usedMachine ?? p.defaultMachine) === 'tu_dong'
  const ws = p.selectedWorkshop
  return (
    <>
      {!p.workshopId && <div style={statusLine(amber)}>Chọn xưởng trước khi tính — lệnh tạo ra sẽ làm ở xưởng này.</div>}
      {p.forcedMachine && ws ? (
        <div style={statusLine(amber)}>
          {ws.name} chỉ cắt bằng <b>{MACHINE_LABEL[p.forcedMachine]}</b> (cấu hình hệ thống).
          {p.forcedMachine === 'tu_dong' ? ` ${TU_DONG_NOTE}` : ''}
        </div>
      ) : tuDongEff ? (
        <div style={statusLine(amber)}>Với {MACHINE_LABEL.tu_dong}: {TU_DONG_NOTE.charAt(0).toLowerCase() + TU_DONG_NOTE.slice(1)}</div>
      ) : null}
      {ws && p.workshopMaxSizes != null && (
        <div style={statusLine('var(--text2)')}>
          {ws.name}: tối đa <b>{p.workshopMaxSizes}</b> cỡ đoạn/cây. Ước tính trên bảng chưa áp luật này; kết quả Tính mới áp.
        </div>
      )}
      {p.length.changed.length > 0 && !p.lengthOpen && <LengthChangedLine p={p.length} />}
    </>
  )
}

function HelpBox({ workshopHelp }: { workshopHelp: string }) {
  const rows: [string, string][] = [
    ['Hao hụt tối đa.', HELP_WASTE],
    ['Máy cắt.', HELP_MACHINE],
    ['Chế độ cắt.', cutModesHelp(' ')],
    ['Xưởng cơ khí.', workshopHelp],
    ['Chiều dài cây sắt.', HELP_LENGTH],
  ]
  return (
    <div style={{
      ...mutedBox, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5,
    }}>
      {rows.map(([title, text]) => <div key={title}><b>{title}</b> {text}</div>)}
    </div>
  )
}

export default function SettingsPanel({ panelRef, ...p }: SettingsPanelProps) {
  const helpWs = helpWorkshop(p.selectedWorkshop?.name, p.workshopMaxSizes)
  const workshop: WorkshopFieldProps = {
    workshops: p.workshops, value: p.workshopId, onChange: p.onWorkshop, highlight: !p.workshopId && p.selectedCount >= 1, help: helpWs,
  }
  const machine: MachineFieldProps = {
    value: p.usedMachine, locked: p.forcedMachine != null, onChange: p.onMachine, help: HELP_MACHINE,
    defaultLabel: p.defaultMachine ? MACHINE_LABEL[p.defaultMachine] : null,
  }
  const mode: ModeFieldProps = { modeText: p.modeText, open: p.modeOpen, onToggle: p.onToggleMode, highlight: p.overrideNeeded }
  const length: LengthFieldProps = {
    changedCount: p.length.changed.length, open: p.lengthOpen, onToggle: p.onToggleLength, help: HELP_LENGTH,
  }
  return (
    <div ref={panelRef} style={panelBox('10px 14px 12px')}>
      <Header p={p} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px', alignItems: 'flex-start' }}>
        <WorkshopField p={workshop} isMobile={p.isMobile} />
        <MachineField p={machine} isMobile={p.isMobile} />
        <ModeField p={mode} isMobile={p.isMobile} />
        <WasteField maxWastePct={p.maxWastePct} help={HELP_WASTE} isMobile={p.isMobile} />
        {p.length.materials.length > 0 && <LengthField p={length} isMobile={p.isMobile} />}
      </div>
      <StatusLines p={p} />
      {p.machineParamsBody}
      {p.helpOpen && <HelpBox workshopHelp={helpWs} />}
      {p.cutModeDetail}
      {p.lengthOpen && p.length.materials.length > 0 && <StockLengthEditor p={p.length} />}
    </div>
  )
}
