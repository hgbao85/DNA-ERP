import { useEffect, useState } from 'react'
import { getPlanningParams } from '../services/system-config-api'
import type { PlanningParams } from '../types/containerLoad'

/**
 * Phần A – Đợt 3 (YC10): tham số năng lực (`capacityContPerDay`, `daysPerContPhuocAn`) đọc qua `GET /system-config/planning-params`
 * (mọi người đăng nhập đọc được). Lỗi / BE cũ thiếu field -> mặc định 1,3 cont/ngày và 4 ngày/cont (công thức vẫn chạy, BE vẫn là
 * nguồn đúng khi kiểm năng lực). Nhớ trong phiên trang; Admin lưu Cấu hình thì gọi `invalidatePlanningParams()`.
 */
export interface CapacityParams {
  capacityContPerDay: number
  daysPerContPhuocAn: number
  /** Phần A – Đợt 4 (YC6): hàng vật tư được về sớm nhất N ngày trước hạn chót (số nguyên 0–30, mặc định 4). */
  materialEarliestArrivalDays: number
}

export const DEFAULT_CAPACITY_PARAMS: CapacityParams = { capacityContPerDay: 1.3, daysPerContPhuocAn: 4, materialEarliestArrivalDays: 4 }

let cache: Promise<PlanningParams | null> | null = null

function load(): Promise<PlanningParams | null> {
  if (!cache) {
    cache = getPlanningParams().catch(() => {
      cache = null // lần sau thử lại
      return null
    })
  }
  return cache
}

export function invalidatePlanningParams() {
  cache = null
}

export function capacityParamsOf(p: PlanningParams | null | undefined): CapacityParams {
  const cap = Number(p?.capacityContPerDay)
  const days = Number(p?.daysPerContPhuocAn)
  const early = Number(p?.materialEarliestArrivalDays)
  return {
    materialEarliestArrivalDays: Number.isInteger(early) && early >= 0 && early <= 30 ? early : DEFAULT_CAPACITY_PARAMS.materialEarliestArrivalDays,
    capacityContPerDay: Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_CAPACITY_PARAMS.capacityContPerDay,
    daysPerContPhuocAn: Number.isFinite(days) && days > 0 ? days : DEFAULT_CAPACITY_PARAMS.daysPerContPhuocAn,
  }
}

export function useCapacityParams(): CapacityParams {
  const [params, setParams] = useState<CapacityParams>(DEFAULT_CAPACITY_PARAMS)
  useEffect(() => {
    let alive = true
    load().then((p) => { if (alive) setParams(capacityParamsOf(p)) })
    return () => { alive = false }
  }, [])
  return params
}
