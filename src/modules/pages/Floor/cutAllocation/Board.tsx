import { useCallback } from 'react'
import { floorAdmin, type BeCutAllocationBoard } from '../../../../services/floor-api'
import { useFetch } from '../../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../../realtime/hooks'
import LoadingState from '../../../../components/LoadingState'
import LoadErrorState from '../../../../components/LoadErrorState'
import { groupRowsByMachine, maxMachineBars, workshopHasLaser, workshopLabel as fmtWorkshopName } from '../cutAllocationModel'
import { emptyBox, Notice, stack } from '../qlsxUi'
import BoardToolbar from './BoardToolbar'
import ChangeHistory from './ChangeHistory'
import MachineCard from './MachineCard'
import { UnallocatedPanel, WaitingPanel } from './StockPanels'
import { useBoardActions } from './useBoardActions'

const TOPICS = ['floor', 'steel-issues'] as const
const REALTIME_DEBOUNCE_MS = 1500

type Actions = ReturnType<typeof useBoardActions>

interface ViewProps {
  data: BeCutAllocationBoard
  workshopId: string | null
  workshopName: string
  act: Actions
}

/** Lưới thẻ máy; xưởng chưa khai máy cắt thì báo. */
function MachineGrid({ data, workshopName, act }: ViewProps) {
  if (data.machines.length === 0) {
    return <div style={emptyBox}>{fmtWorkshopName(workshopName)} chưa khai máy cắt. Khai ở tab “Máy &amp; tem QR”.</div>
  }
  const laserAllowed = data.workshop.laserAllowed
  const hasLaser = workshopHasLaser(laserAllowed, data.machines)
  const maxBars = maxMachineBars(data.machines)
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', alignItems: 'start' }}>
      {groupRowsByMachine(data).map((g) => (
        <MachineCard key={g.machine.id} group={g} machines={data.machines} maxBars={maxBars} laserAllowed={laserAllowed}
          hasLaser={hasLaser} actions={act.actions} />
      ))}
    </div>
  )
}

function BoardView({ data, workshopId, workshopName, act }: ViewProps) {
  const { actions } = act
  const hasLaser = workshopHasLaser(data.workshop.laserAllowed, data.machines)
  return (
    <div style={stack(12)}>
      {act.confirmModal}
      <BoardToolbar hasRows={data.rows.length > 0} hasLaser={hasLaser} busy={actions.busy} staleCount={data.staleCount}
        onAuto={act.auto} onRedo={act.redo} onPrintAll={() => actions.print(groupRowsByMachine(data), true)} />
      {act.err && <Notice tone="err">{act.err}</Notice>}
      {data.warnings.length > 0 && <Notice tone="warn">{data.warnings.map((w, i) => <div key={i}>{w}</div>)}</Notice>}
      <MachineGrid data={data} workshopId={workshopId} workshopName={workshopName} act={act} />
      <ChangeHistory workshopId={workshopId} tick={act.logTick} />
      {data.unallocated.length > 0 && (
        <UnallocatedPanel items={data.unallocated} busy={actions.busy} onAuto={() => act.auto('append')} />
      )}
      {data.waiting.length > 0 && <WaitingPanel items={data.waiting} busy={actions.busy} onAddAnyway={act.addAnyway} />}
    </div>
  )
}

/** Bảng chia của một xưởng: tải bảng từ BE, tự tải lại khi có báo mới, rồi vẽ. */
export default function Board({ workshopId, workshopLabel }: { workshopId: string | null; workshopLabel: string }) {
  const { data, isLoading, error, refetch, mutate } = useFetch<BeCutAllocationBoard>(
    () => floorAdmin.getCutAllocation(workshopId), [workshopId],
  )
  const workshopName = data?.workshop.name || workshopLabel
  const act = useBoardActions({ workshopId, workshopName, mutate })
  const reload = useCallback(() => { void refetch() }, [refetch])
  useRealtimeRefetch(TOPICS, reload, { debounceMs: REALTIME_DEBOUNCE_MS })

  if (isLoading) return <LoadingState />
  if (error || !data) return <LoadErrorState error={error ?? 'Không có dữ liệu'} onRetry={reload} />
  return <BoardView data={data} workshopId={workshopId} workshopName={workshopName} act={act} />
}
