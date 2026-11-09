import { describe, expect, it } from 'vitest'
import { pickCurrentStage, type ParallelStageInput } from './currentStagePick'

const par = (frame: number, weaving: number, ck: number, pack: number): ParallelStageInput[] => [
  { key: 'FRAME', pct: frame, na: false },
  { key: 'WEAVING', pct: weaving, na: false },
  { key: 'CHUYEN_KIEM', pct: ck, na: false },
  { key: 'PACKAGING', pct: pack, na: false },
]

describe('pickCurrentStage', () => {
  it('GP-182: khung 99% nhưng đóng gói đủ -> Đóng gói xong, chờ Kết thúc', () => {
    expect(pickCurrentStage({ status: 'PRODUCING', mfgStage: 'FRAME', purchasingPct: 45, parallel: par(99, 100, 100, 100) }))
      .toEqual({ kind: 'PACKED_WAIT_END', pct: 100 })
  })
  it('đang đan: khung xong 100%, đan 40% -> Đan 40%', () => {
    expect(pickCurrentStage({ status: 'PRODUCING', mfgStage: 'FRAME', purchasingPct: 100, parallel: par(100, 40, 0, 0) }))
      .toEqual({ kind: 'STAGE', stage: 'WEAVING', pct: 40 })
  })
  it('khung 99% nhưng chuyền kiểm đã làm 30% -> Chuyền kiểm 30%', () => {
    expect(pickCurrentStage({ status: 'PRODUCING', mfgStage: 'FRAME', purchasingPct: 100, parallel: par(99, 100, 30, 0) }))
      .toEqual({ kind: 'STAGE', stage: 'CHUYEN_KIEM', pct: 30 })
  })
  it('mới bắt đầu: chỉ Phôi có số -> Khung', () => {
    expect(pickCurrentStage({ status: 'PRODUCING', mfgStage: 'FRAME', purchasingPct: 80, parallel: par(7, 0, 0, 0) }))
      .toEqual({ kind: 'STAGE', stage: 'FRAME', pct: 7 })
  })
  it('chưa công đoạn nào có số -> Khung 0%', () => {
    expect(pickCurrentStage({ status: 'PRODUCING', mfgStage: 'FRAME', purchasingPct: 0, parallel: par(0, 0, 0, 0) }))
      .toEqual({ kind: 'STAGE', stage: 'FRAME', pct: 0 })
  })
  it('công đoạn không áp dụng bị bỏ qua', () => {
    const p = par(100, 0, 0, 0)
    p[1] = { key: 'WEAVING', pct: 100, na: true }
    expect(pickCurrentStage({ status: 'PRODUCING', mfgStage: 'FRAME', purchasingPct: 100, parallel: p }))
      .toEqual({ kind: 'STAGE', stage: 'FRAME', pct: 100 })
  })
  it('lệnh đã Kết thúc -> Hoàn thành', () => {
    expect(pickCurrentStage({ status: 'DONE', mfgStage: 'PACKAGING', purchasingPct: 100, parallel: par(100, 100, 100, 100) }))
      .toEqual({ kind: 'DONE', pct: 100 })
  })
  it('mfgStage = Mua hàng giữ nguyên như cũ', () => {
    expect(pickCurrentStage({ status: 'PRODUCING', mfgStage: 'PURCHASING', purchasingPct: 45, parallel: par(0, 0, 0, 0) }))
      .toEqual({ kind: 'STAGE', stage: 'PURCHASING', pct: 45 })
  })
})
