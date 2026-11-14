import type { BeCutAllocationRow, CutAllocationReason } from '../../../../services/floor-api'
import type { MachineGroup } from '../cutAllocationModel'

/** Lý do + ghi chú kèm lần đổi máy / tách. */
export type MoveExtra = { reason?: CutAllocationReason; note?: string }

export type PatchData = { workstationId?: string; barCount?: number } & MoveExtra
export type SplitData = { barCount: number; workstationId: string } & MoveExtra

/** Các thao tác ghi của bảng chia; thẻ máy và dòng chỉ gọi, không biết gọi API thế nào. */
export interface BoardActions {
  busy: boolean
  patch: (id: string, d: PatchData) => void
  split: (id: string, d: SplitData) => void
  remove: (row: BeCutAllocationRow) => void
  reorder: (g: MachineGroup, row: BeCutAllocationRow, dir: 'up' | 'down') => void
  print: (list: MachineGroup[], skipEmpty: boolean) => void
}
