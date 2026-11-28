import { describe, expect, it } from 'vitest'
import { defaultScanOrder, orderReportable } from './scanModel'

// Lỗi 2 (báo 28/11/2026): SKU đã huỷ mà QLSX cho cắt tiếp có floorStage FINISHED - màn quét hiện nhầm "quản lý chưa cho làm".
describe('orderReportable', () => {
  it('SKU đang chạy hoặc SKU cắt tiếp thì báo được; tạm dừng / kết thúc thường thì không', () => {
    expect(orderReportable({ floorStage: 'ACTIVE' })).toBe(true)
    expect(orderReportable({ floorStage: 'FINISHED', cutContinued: true })).toBe(true)
    expect(orderReportable({ floorStage: 'FINISHED' })).toBe(false)
    expect(orderReportable({ floorStage: 'PAUSED' })).toBe(false)
  })
})

describe('defaultScanOrder', () => {
  const live = { productionOrderId: '77', floorStage: 'ACTIVE' as const }
  const cont = { productionOrderId: '78', floorStage: 'FINISHED' as const, cutContinued: true }
  const paused = { productionOrderId: '79', floorStage: 'PAUSED' as const }

  it('giữ SKU đang chọn nếu còn trong lệnh', () => {
    expect(defaultScanOrder([live, cont], '78')).toBe(cont)
  })

  it('chưa chọn: SKU đang chạy trước, rồi SKU cắt tiếp, rồi SKU đầu', () => {
    expect(defaultScanOrder([cont, live], null)).toBe(live)
    expect(defaultScanOrder([paused, cont], null)).toBe(cont)
    expect(defaultScanOrder([paused], null)).toBe(paused)
    expect(defaultScanOrder([], null)).toBeNull()
  })
})
