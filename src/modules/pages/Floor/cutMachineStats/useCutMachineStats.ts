import { useCallback, useEffect, useState } from 'react'
import { floorAdmin, type BeCutMachineStats } from '../../../../services/floor-api'
import { useRealtimeRefetch } from '../../../../realtime/hooks'
import { statsErrorText } from '../cutMachineStats'

const TOPICS = ['floor'] as const
const REALTIME_DEBOUNCE_MS = 1500

interface Result { key: string; reqKey: string; data: BeCutMachineStats | null; err: string | null }

/**
 * Tải năng suất máy cắt theo xưởng + khoảng ngày; tự tải lại khi có báo mới (realtime) hoặc bấm làm mới.
 * Số cũ giữ trên màn khi tải lại; chỉ khi đổi xưởng / khoảng ngày mới thành "đang tải".
 */
export function useCutMachineStats(workshopId: string | null, from: string, to: string, enabled: boolean) {
  const [result, setResult] = useState<Result | null>(null)
  const [tick, setTick] = useState(0)
  const key = `${workshopId ?? ''}|${from}|${to}`
  const reqKey = `${key}|${tick}`

  // Kết quả gắn với `reqKey` đã hỏi nên kết quả cũ (về muộn) không đè lên khi đổi xưởng / khoảng ngày.
  useEffect(() => {
    if (!enabled) return
    let alive = true
    floorAdmin.getCutMachineStats({ workshopId, from, to })
      .then((data) => { if (alive) setResult({ key, reqKey, data, err: null }) })
      .catch((e) => { if (alive) setResult({ key, reqKey, data: null, err: statsErrorText(e, 'Không thể tải dữ liệu') }) })
    return () => { alive = false }
  }, [enabled, workshopId, from, to, key, reqKey])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  useRealtimeRefetch(TOPICS, reload, { debounceMs: REALTIME_DEBOUNCE_MS })

  const current = result?.key === key ? result : null
  return {
    data: current?.data ?? null,
    error: current?.err ?? null,
    loading: enabled && !current,
    fetching: enabled && result?.reqKey !== reqKey,
    reload,
  }
}
