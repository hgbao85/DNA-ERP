import { NOTE_MAX, reasonLabel, type ReasonChoice } from '../cutAllocationModel'
import { rowWrap, smallInput } from '../qlsxUi'

interface Props {
  reason: ReasonChoice
  note: string
  onReason: (r: ReasonChoice) => void
  onNote: (n: string) => void
  /** Dòng theo bó đổi máy: bắt buộc chọn "Máy hư". */
  required?: boolean
  disabled?: boolean
}

/** Lý do + ghi chú của lần đổi máy / tách. */
export default function ReasonFields({ reason, note, onReason, onNote, required, disabled }: Props) {
  return (
    <div style={{ ...rowWrap, flex: '1 1 100%' }}>
      <select style={{ ...smallInput, minWidth: 0 }} value={reason} disabled={disabled} aria-label="Lý do"
        onChange={(e) => onReason(e.target.value as ReasonChoice)}>
        <option value="">{required ? '- Chọn lý do -' : 'Lý do (không bắt buộc)'}</option>
        <option value="MACHINE_BROKEN">{reasonLabel('MACHINE_BROKEN')}</option>
        {!required && <option value="OTHER">{reasonLabel('OTHER')}</option>}
      </select>
      <input style={{ ...smallInput, flex: '1 1 160px', minWidth: 0 }} type="text" maxLength={NOTE_MAX} value={note}
        disabled={disabled} placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú" onChange={(e) => onNote(e.target.value)} />
    </div>
  )
}
