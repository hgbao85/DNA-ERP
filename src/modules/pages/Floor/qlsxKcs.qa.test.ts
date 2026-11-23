/**
 * UF3 (tester-unit #4, P1 "KCS tự chuyển"): màn QLSX "Sản lượng xưởng" - AC51 (dòng thiếu sắt), "(+N cắt lại)", MS2 / AC48 (không còn chữ cũ trong chữ hiện cho người dùng).
 * Bổ sung cho piDetailModel.test.ts / progressModel.test.ts / qlsxUi.test.ts của Dev, không lặp ca.
 * Phần "đọc mã nguồn" chỉ kiểm CHỮ hiện cho người dùng (đã bỏ chú thích code - AC48 nói chú thích không tính).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BeStageDetail } from '../../../services/floor-api'
import { missingText, phoiMaterialsOf, shortMaterials } from './piDetailModel'
import { FLOOR_PAGE_NOTE, FLOOR_TABS } from './QlsxFloorPage'
import { steelShortHint } from './progressModel'

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

describe('AC31 - chữ màn QLSX (bỏ hàng đợi 23/11/2026)', () => {
  it('missingText: đợt đang mở chỉ ghi "N đợt đang mở", không "chờ gửi"', () => {
    const t = missingText({ lines: 0, materials: 1, materialsNotReceived: 0, pieces: 2 }, 3)
    expect(t).toBe('Còn thiếu 1 loại sắt · 2 mảnh · 3 đợt đang mở')
    expect(missingText({ lines: 4, materials: 0, materialsNotReceived: 0, pieces: 0 }, 0)).toBe('Còn thiếu 4 dòng')
    expect(t).not.toMatch(/gửi/i)
  })
  it('AC31: không còn tab "Sản lượng & hàng đợi"; tab mở sẵn là Chia máy cắt', () => {
    expect(FLOOR_TABS.map((t) => t.label)).toEqual(['Chia máy cắt', 'Báo cáo', 'Máy & tem QR', 'Công nhân'])
    expect(FLOOR_TABS[0].id).toBe('cut')
  })
  it('AC31: câu mô tả đầu màn không còn "hủy lần báo sai" / "xếp lệnh" / "hàng đợi"', () => {
    expect(FLOOR_PAGE_NOTE).not.toMatch(/hủy|xếp lệnh|hàng đợi/i)
  })
})

describe('MS2 / AC48 - không còn chữ cũ trong chữ hiện cho người dùng (FE)', () => {
  // Cụm của AC48 + 2 cụm Q4 thêm vào; "QLSX kiểm" loại vì là câu đúng nghĩa ở Sổ báo vượt đoạn (Q4: warehouse.ts:298, SoBaoVuotDoanPage.tsx:81).
  const OLD = [/kiểm rồi gửi KCS/i, /Chờ gửi KCS/i, /chờ quản lý kiểm/i, /Sản lượng & gửi KCS/i, /gửi KCS quá/i, /QLSX chưa gửi KCS/i, /kiểm và gửi/i, /chưa gửi KCS/i]
  const FILES = [
    './QlsxPiDetail.tsx', './QlsxFloorPage.tsx', './qlsxUi.tsx', './floorStats.ts', './progressModel.ts',
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
