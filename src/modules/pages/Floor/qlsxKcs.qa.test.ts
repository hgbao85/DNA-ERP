/**
 * UF3 (tester-unit #4, P1 "KCS tự chuyển"): màn QLSX "Sản lượng xưởng" - AC13 (không còn "Gửi KCS", có Hủy kèm câu nhắc),
 * AC16 (pill, số đỏ), AC51 (dòng thiếu sắt), "(+N cắt lại)", MS2 / AC48 (không còn chữ cũ trong chữ hiện cho người dùng).
 * Bổ sung cho piDetailModel.test.ts / progressModel.test.ts / qlsxUi.test.ts / QlsxQueue.test.ts của Dev, không lặp ca.
 * Phần "đọc mã nguồn" chỉ kiểm CHỮ hiện cho người dùng (đã bỏ chú thích code - AC48 nói chú thích không tính).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BeStageDetail } from '../../../services/floor-api'
import { openBatchesNote, PHOI_AUTO_ADVANCE_NOTE, SON_QUEUE_NOTE } from './QlsxQueue'
import { missingText, phoiMaterialsOf, shortMaterials } from './piDetailModel'
import { steelShortHint } from './progressModel'
import { staleTotal, summaryPillText } from './qlsxUi'

const here = (rel: string) => new URL(rel, import.meta.url)
/** Mã nguồn đã bỏ chú thích (khối và dòng) - chỉ còn phần chữ người dùng có thể thấy. */
function visibleSource(rel: string): string {
  return readFileSync(here(rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}
const read = (rel: string) => visibleSource(rel)

const seg = (cutLengthMm: number, s: { required: number; done: number; failed?: number; extraNeed?: number; shortQty?: number }) => ({
  segmentSpecId: String(cutLengthMm), cutLengthMm, failed: 0, openQty: 0, awaitingQcQty: 0, ...s, byOrder: [],
})
const detailWith = (steelBalance: unknown, segments: ReturnType<typeof seg>[]) => ({
  productionInvoiceId: '45', piCode: 'PI-45', stage: 'PHOI', progress: {}, orders: [], plans: {},
  phoi: [{ materialId: '1', materialCode: 'M', materialName: 'Sắt M', issuedBarCount: 3, steelBalance, segments, steps: [] }],
}) as unknown as BeStageDetail

describe('AC51 - dòng gợi ý thiếu sắt (chỉ đọc) trên thẻ lệnh của QLSX', () => {
  const thieu = { receivedBarCount: 3, usableMm: 0, reportedMm: 0, overMm: 0, remainingSegments: 10, recutSegments: 10, leftoverReceivedMm: 2000, issuableMm: 0, shortMm: 2800 }
  const hint = (b: unknown, segs = [seg(471, { required: 10, done: 0, extraNeed: 10 })]) => shortMaterials(phoiMaterialsOf(detailWith(b, segs), null))[0].steelHint

  it('dữ liệu DL-14: còn cắt 10 (gồm 10 cắt lại), sắt ước 2 m, thiếu 2,8 m -> đúng câu AC51', () => {
    expect(hint(thieu)).toBe('Còn phải cắt 10 đoạn (gồm 10 đoạn cắt lại) - sắt còn ước 2,0 m, thiếu khoảng 2,8 m')
  })
  it('đủ sắt (shortMm 0 hoặc âm) -> ẩn dòng', () => {
    expect(hint({ ...thieu, shortMm: 0 })).toBeNull()
    expect(hint({ ...thieu, shortMm: -500 })).toBeNull()
  })
  it('không còn đoạn nào phải cắt -> ẩn dòng dù shortMm > 0', () => {
    expect(hint({ ...thieu, remainingSegments: 0 })).toBeNull()
  })
  it('không biết chiều dài cây (issuableMm null) -> thêm "(chưa tính sắt kho còn xuất)"; biết thì không thêm', () => {
    expect(hint({ ...thieu, issuableMm: null })).toMatch(/thiếu khoảng 2,8 m \(chưa tính sắt kho còn xuất\)$/)
    expect(hint({ ...thieu, issuableMm: 0 })).not.toContain('chưa tính sắt kho')
    expect(hint({ ...thieu, issuableMm: 6000 })).not.toContain('chưa tính sắt kho')
  })
  it('chưa nhận sắt (steelBalance null) hoặc BE cũ chưa trả trường mới -> không có dòng', () => {
    expect(hint(null)).toBeNull()
    expect(hint({ receivedBarCount: 3, usableMm: 0, reportedMm: 0, overMm: 0 })).toBeNull()
  })
  it('làm tròn 1 chữ số thập phân kiểu vi-VN (dấu phẩy)', () => {
    const t = steelShortHint({ remainingSegments: 1, recutSegments: 0, leftoverReceivedMm: 1234, issuableMm: 0, shortMm: 56 })
    expect(t).toBe('Còn phải cắt 1 đoạn - sắt còn ước 1,2 m, thiếu khoảng 0,1 m')
  })
  it('chỉ đọc: chỗ hiện dòng thiếu sắt ở QlsxPiDetail không có nút / onClick', () => {
    const line = read('./QlsxPiDetail.tsx').split('\n').find((l) => l.includes('m.steelHint &&'))
    expect(line).toBeDefined()
    expect(line).not.toMatch(/<button|onClick/)
  })
})

describe('"(+N cắt lại)" ở cỡ đoạn (Phôi)', () => {
  it('extraNeed đi từ dữ liệu BE ra dòng còn thiếu; BE cũ không có thì 0', () => {
    const d = detailWith(null, [seg(355, { required: 1185, done: 1180, extraNeed: 5 }), seg(471, { required: 10, done: 0 })])
    const [m] = shortMaterials(phoiMaterialsOf(d, null))
    const by = Object.fromEntries(m.segments.map((s) => [s.cutLengthMm, s]))
    expect(by[355]).toMatchObject({ required: 1185, extraNeed: 5, remaining: 5 })
    expect(by[471].extraNeed).toBe(0)
  })
  it('chữ "(+N cắt lại)" chỉ in khi extraNeed > 0', () => {
    const src = read('./QlsxPiDetail.tsx')
    expect(src).toMatch(/s\.extraNeed > 0 \? ` \(\+\$\{fmt\(s\.extraNeed\)\} cắt lại\)` : ''/)
  })
})

describe('AC13 / AC16 - chữ màn QLSX', () => {
  it('pill của tab tổ: đúng thứ tự "N đang mở · K KCS đang chấm · M quá 4 giờ"', () => {
    expect(summaryPillText({ open: 3, awaitingKcs: 1, stale: 2 })).toBe('3 đang mở · 1 KCS đang chấm · 2 quá 4 giờ')
  })
  it('pill chỉ có "quá 4 giờ" (đợt đã chấm hết, còn trễ) vẫn hiện; số âm / NaN không làm hỏng chữ', () => {
    expect(summaryPillText({ open: 0, awaitingKcs: 0, stale: 5 })).toBe('5 quá 4 giờ')
    expect(summaryPillText({ open: -1, awaitingKcs: -2, stale: -3 })).toBe('')
  })
  it('pill không còn chữ "gửi"', () => {
    expect(summaryPillText({ open: 9, awaitingKcs: 9, stale: 9 })).not.toMatch(/gửi/i)
  })
  it('số đỏ menu = Σ stale 3 tổ; thiếu tổ / thiếu dữ liệu thì tính 0', () => {
    expect(staleTotal({ PHOI: { open: 0, stale: 2 }, HAN: undefined, SON: { open: 0, stale: 1 } } as never)).toBe(3)
    expect(staleTotal(null)).toBe(0)
    expect(staleTotal(undefined)).toBe(0)
  })
  it('"Còn N đợt đang mở." - N = 0 / âm thì rỗng, không có "gửi"', () => {
    expect(openBatchesNote(1)).toBe('Còn 1 đợt đang mở.')
    expect(openBatchesNote(0)).toBe('')
    expect(openBatchesNote(-2)).toBe('')
    expect(openBatchesNote(7)).not.toMatch(/gửi|chờ quản lý/i)
  })
  it('missingText: đợt đang mở chỉ ghi "N đợt đang mở", không "chờ gửi"', () => {
    const t = missingText({ lines: 0, materials: 1, materialsNotReceived: 0, pieces: 2 }, 3)
    expect(t).toBe('Còn thiếu 1 loại sắt · 2 mảnh · 3 đợt đang mở')
    expect(missingText({ lines: 4, materials: 0, materialsNotReceived: 0, pieces: 0 }, 0)).toBe('Còn thiếu 4 dòng')
    expect(t).not.toMatch(/gửi/i)
  })
  it('ghi chú tổ Phôi / Sơn không nhắc gửi KCS', () => {
    expect(PHOI_AUTO_ADVANCE_NOTE).not.toMatch(/gửi/i)
    expect(SON_QUEUE_NOTE).not.toMatch(/gửi/i)
  })
  it('AC13 khối "Đang chờ KCS chấm": có nút Hủy + câu nhắc "KCS bấm Chấm thì không hủy được nữa", không nút "Gửi KCS"', () => {
    const src = read('./QlsxReview.tsx')
    expect(src).toContain('KCS bấm Chấm thì không hủy được nữa')
    expect(src).toContain('Hủy lần báo')
    expect(src).not.toMatch(/Gửi KCS|gửi KCS/)
    expect(src).not.toMatch(/sendCutBundle|sendProductionBatch|sendStepGroup|send-kcs/)
  })
  it('AC13 QlsxFloorPage: tab "Sản lượng & hàng đợi", không còn "Sản lượng & gửi KCS"', () => {
    const src = read('./QlsxFloorPage.tsx')
    expect(src).toContain("label: 'Sản lượng & hàng đợi'")
    expect(src).not.toMatch(/Sản lượng & gửi KCS/i)
  })
})

describe('MS2 / AC48 - không còn chữ cũ trong chữ hiện cho người dùng (FE)', () => {
  // Cụm của AC48 + 2 cụm Q4 thêm vào; "QLSX kiểm" loại vì là câu đúng nghĩa ở Sổ báo vượt đoạn (Q4: warehouse.ts:298, SoBaoVuotDoanPage.tsx:81).
  const OLD = [/kiểm rồi gửi KCS/i, /Chờ gửi KCS/i, /chờ quản lý kiểm/i, /Sản lượng & gửi KCS/i, /gửi KCS quá/i, /QLSX chưa gửi KCS/i, /kiểm và gửi/i, /chưa gửi KCS/i]
  const FILES = [
    './QlsxQueue.tsx', './QlsxReview.tsx', './QlsxPiDetail.tsx', './QlsxFloorPage.tsx', './qlsxUi.tsx', './floorStats.ts', './progressModel.ts',
    './piDetailModel.ts', '../Kcs/KcsPhoiPage.tsx', '../Kcs/KcsStagePage.tsx', '../Kcs/KcsChanNhomSection.tsx', '../Kcs/kcsReviewModel.ts',
    '../../../components/sanxuat/PhoiMaterialBoard.tsx', '../../../components/sanxuat/kcsCore.tsx', './scan/scanModel.ts',
  ]
  for (const f of FILES) {
    it(`${f}: không có cụm chữ cũ`, () => {
      const src = read(f)
      for (const re of OLD) expect(src, `${f} ${re}`).not.toMatch(re)
    })
  }
  it('MS2: PhoiMaterialBoard không còn nhãn "Chưa gửi"', () => {
    expect(read('../../../components/sanxuat/PhoiMaterialBoard.tsx')).not.toMatch(/Chưa gửi/)
  })
})
