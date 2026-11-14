import { useState } from 'react'
import {
  floorAdmin, type BeCutAllocationBoard, type BeCutAllocationRow, type BeCutAllocationWaiting, type CutAllocationMode,
} from '../../../../services/floor-api'
import { useConfirm } from '../../../../hooks/useConfirm'
import { errMsg } from '../../../../utils/errors'
import { addAnywayMessage, deleteMessage, moveRowIds, REDO_MESSAGE, type MachineGroup } from '../cutAllocationModel'
import { printSheets } from './printSheets'
import type { BoardActions } from './types'

type Mutate = (updater: (prev: BeCutAllocationBoard | null) => BeCutAllocationBoard | null) => void

interface Args {
  workshopId: string | null
  workshopName: string
  mutate: Mutate
}

const BLOCKED_PRINT = 'Trình duyệt đang chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.'

/**
 * Mọi thao tác ghi của bảng chia: gọi API, thay bảng bằng bảng BE trả về, giữ trạng thái bận / lỗi.
 * Thao tác nguy hiểm (chia lại, chia luôn, xoá) hỏi xác nhận trước.
 */
export function useBoardActions({ workshopId, workshopName, mutate }: Args) {
  const { ask, confirmModal } = useConfirm()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [logTick, setLogTick] = useState(0)

  /** Chạy 1 thao tác ghi; thành công thì thay bảng, lỗi hiện nguyên câu. */
  const run = async (fn: () => Promise<BeCutAllocationBoard>) => {
    setBusy(true); setErr(null)
    try { const b = await fn(); mutate(() => b); setLogTick((n) => n + 1) } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const replace = async (fn: () => Promise<BeCutAllocationBoard>) => { const b = await fn(); mutate(() => b) }

  const actions: BoardActions = {
    busy,
    patch: (id, d) => void run(() => floorAdmin.updateCutAllocation(id, d)),
    split: (id, d) => void run(() => floorAdmin.splitCutAllocation(id, d)),
    remove: (row: BeCutAllocationRow) => ask(
      { title: 'Xoá dòng', message: deleteMessage(row), confirmLabel: 'Xoá', danger: true },
      () => replace(() => floorAdmin.deleteCutAllocation(row.id)),
    ),
    reorder: (g: MachineGroup, row, dir) => {
      const next = moveRowIds(g.rows.map((r) => r.id), row.id, dir)
      if (next) void run(() => floorAdmin.reorderCutAllocation({ workstationId: g.machine.id, rowIds: next }))
    },
    print: (list, skipEmpty) => {
      setErr(null)
      if (!printSheets(list, workshopName, skipEmpty)) setErr(BLOCKED_PRINT)
    },
  }

  const auto = (mode: CutAllocationMode) => void run(() => floorAdmin.autoCutAllocation({ workshopId, mode }))
  const redo = () => ask(
    { title: 'Chia lại', message: REDO_MESSAGE, confirmLabel: 'Chia lại' },
    () => replace(() => floorAdmin.autoCutAllocation({ workshopId, mode: 'redo' })),
  )
  const addAnyway = (w: BeCutAllocationWaiting) => ask(
    { title: 'Chia luôn', message: addAnywayMessage(`${w.piCode} · ${w.materialLabel}`), confirmLabel: 'Vẫn chia' },
    () => replace(() => floorAdmin.addCutAllocation({ workshopId, productionInvoiceId: w.productionInvoiceId, materialId: w.materialId })),
  )

  return { actions, auto, redo, addAnyway, err, logTick, confirmModal }
}
