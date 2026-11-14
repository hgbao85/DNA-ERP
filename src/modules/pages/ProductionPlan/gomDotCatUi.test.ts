import { describe, expect, it } from 'vitest'
import type { CuttingBatchFixMaterial, CuttingDefaults } from '../../../services/cutting-batch-api'
import {
  bestFixKey, buildBarStatus, buildBarSummary, buildMachineParams, buildRuleReason, collectMaterialsInTable, cutModesHelp, fmtBarMm,
  isBadStockLength, materialLabel, needDatesText, overThresholdText, pctColor, roundUp5cm, selectedFirst, splitFixMaterials,
  stdLabelFor, summarizeCodes, workshopText,
} from './gomDotCatUi'

describe('fmtBarMm', () => {
  it('làm tròn mm trước rồi ghi dạng "6.000 mm"', () => {
    expect(fmtBarMm(6000)).toBe('6.000 mm')
    expect(fmtBarMm(5849.6)).toBe('5.850 mm')
    expect(fmtBarMm(600)).toBe('600 mm')
  })
})

describe('summarizeCodes', () => {
  it('tối đa 3 mã, quá thì +N, title đủ', () => {
    expect(summarizeCodes(['A', 'B'])).toEqual({ text: 'A, B', full: 'A, B' })
    expect(summarizeCodes(['A', 'B', 'C', 'D', 'E'])).toEqual({ text: 'A, B, C +2', full: 'A, B, C, D, E' })
  })
  it('bỏ mã trùng và rỗng', () => {
    expect(summarizeCodes(['A', 'A', '', 'B']).text).toBe('A, B')
    expect(summarizeCodes([]).text).toBe('')
  })
})

describe('selectedFirst', () => {
  it('dòng chọn lên đầu, mỗi nhóm giữ thứ tự cũ', () => {
    const items = [1, 2, 3, 4, 5, 6]
    expect(selectedFirst(items, (n) => n === 5 || n === 2)).toEqual([2, 5, 1, 3, 4, 6])
  })
  it('không chọn gì thì giữ nguyên', () => {
    expect(selectedFirst([3, 1, 2], () => false)).toEqual([3, 1, 2])
  })
})

describe('workshopText', () => {
  it('không lặp chữ Xưởng', () => {
    expect(workshopText('Xưởng Phước An')).toBe('Xưởng Phước An')
    expect(workshopText('Phước An')).toBe('Xưởng Phước An')
  })
})

describe('buildBarSummary', () => {
  it('gọn một dòng', () => {
    expect(buildBarSummary({ count: 2, workshopName: 'Xưởng Phước An', machineLabel: 'MC Tự động', cutMode: 'AUTO' }))
      .toBe('2 SKU · Xưởng Phước An · MC Tự động · Bình thường')
  })
  it('chưa chọn xưởng thì bỏ phần xưởng; chế độ đơn gấp', () => {
    expect(buildBarSummary({ count: 1, workshopName: null, machineLabel: 'MC Laser', cutMode: 'ACCEPT_OVER' }))
      .toBe('1 SKU · MC Laser · Hao hụt cao hơn')
  })
})

describe('buildBarStatus', () => {
  const base = { workshopChosen: true, reasonMissing: false, ruleBlocked: false, overCount: 0, hasMatchingResult: false, hasOtherResult: false }
  it('thiếu xưởng là đỏ và ưu tiên cao nhất', () => {
    expect(buildBarStatus({ ...base, workshopChosen: false, ruleBlocked: true })).toMatchObject({ tone: 'red', text: 'Chọn xưởng trước khi tính', fixLink: false })
  })
  it('vượt luật gộp đỏ kèm nút xem cách xử lý', () => {
    expect(buildBarStatus({ ...base, ruleBlocked: true })).toMatchObject({ tone: 'red', fixLink: true })
  })
  it('ước tính vượt ngưỡng là vàng cam', () => {
    expect(buildBarStatus({ ...base, overCount: 2 })).toMatchObject({ tone: 'amber', fixLink: true })
  })
  it('không cảnh báo thì nói tình trạng kết quả', () => {
    expect(buildBarStatus(base).text).toBe('Chưa tính')
    expect(buildBarStatus({ ...base, hasMatchingResult: true }).text).toContain('Đã có kết quả')
    expect(buildBarStatus({ ...base, hasOtherResult: true }).text).toContain('máy/chế độ khác')
  })
})

describe('pctColor', () => {
  it('số bộ giải đã kiểm: vượt ngưỡng đỏ, đạt xanh', () => {
    expect(pctColor('checked', false)).toBe('var(--fg-b91c1c)')
    expect(pctColor('checked', true)).toBe('var(--fg-166534)')
  })
  it('số ước tính luôn vàng cam', () => {
    expect(pctColor('estimate', false)).toBe('var(--fg-b45309)')
    expect(pctColor('estimate', true)).toBe('var(--fg-b45309)')
  })
})

describe('overThresholdText', () => {
  it('nói rõ % là tổng thấp nhất của cả đợt', () => {
    expect(overThresholdText('1%', '16,75%')).toBe('có cây vượt 1%; chấp nhận các cây đó thì cả đợt hao thấp nhất 16,75%')
  })
})

describe('roundUp5cm / materialLabel / isBadStockLength', () => {
  it('làm tròn lên bội 50 mm', () => {
    expect(roundUp5cm(5830)).toBe(5850)
    expect(roundUp5cm(5850)).toBe(5850)
    expect(roundUp5cm(6000)).toBe(6000)
  })
  it('nhãn "Tên · Quy cách", thiếu tên thì rơi về mã', () => {
    expect(materialLabel('Sắt hộp', 'H13-26', 'SAT-1')).toBe('Sắt hộp · H13-26')
    expect(materialLabel(' ', null, 'SAT-1')).toBe('SAT-1')
  })
  it('ô chiều dài: rỗng không sai, ngoài khoảng 500-20000 hoặc không phải số thì sai', () => {
    expect(isBadStockLength('')).toBe(false)
    expect(isBadStockLength('5850')).toBe(false)
    expect(isBadStockLength('6')).toBe(true)
    expect(isBadStockLength('20001')).toBe(true)
    expect(isBadStockLength('abc')).toBe(true)
  })
})

describe('collectMaterialsInTable / stdLabelFor / needDatesText', () => {
  it('mỗi quy cách một dòng, sắp theo tên rồi quy cách', () => {
    const mat = (materialId: string, materialCode: string, materialName: string, materialSpec: string | null) =>
      ({ materialId, materialCode, materialName, materialSpec, stockLengthMm: null })
    const out = collectMaterialsInTable([
      { materials: [mat('2', 'B', 'Sắt vuông', 'V20'), mat('1', 'A', 'Sắt vuông', 'V15')] },
      { materials: [mat('1', 'A', 'Sắt vuông', 'V15')] },
    ])
    expect(out.map((m) => m.label)).toEqual(['Sắt vuông · V15', 'Sắt vuông · V20'])
  })
  it('nhãn cây chuẩn hay cây đã đổi', () => {
    expect(stdLabelFor(null, 6000)).toBe('cây chuẩn 6.000 mm')
    expect(stdLabelFor(6000, 6000)).toBe('cây chuẩn 6.000 mm')
    expect(stdLabelFor(5850, 6000)).toBe('cây 5.850 mm')
  })
  it('mốc cần sắt: không có, một ngày, một khoảng', () => {
    expect(needDatesText([])).toBe('· chưa có mốc cần sắt')
    expect(needDatesText(['2026-11-12T10:00:00'])).toBe('· mốc cần sắt 12/11')
    expect(needDatesText(['2026-11-12T01:00:00', '2026-11-12T20:00:00'])).toBe('· mốc cần sắt 12/11')
    expect(needDatesText(['2026-11-12T10:00:00', '2026-11-15T10:00:00'])).toBe('· mốc cần sắt 12/11 → 15/11')
  })
})

describe('buildRuleReason', () => {
  const base = { beReason: null, selectedCount: 2, mergeMax: 2, mergeWindow: 5, span: null }
  it('ưu tiên câu của BE', () => {
    expect(buildRuleReason({ ...base, beReason: 'BE nói không' })).toBe('BE nói không')
  })
  it('quá số SKU tối đa', () => {
    expect(buildRuleReason({ ...base, selectedCount: 3 })).toBe('Đợt gồm 3 SKU, tối đa 2 SKU mỗi đợt/lệnh gộp.')
  })
  it('mốc cách nhau quá khung thì nêu hai đầu, trong khung thì gộp được', () => {
    const span = (days: number) => ({
      days, earliest: { code: 'A', date: '2026-11-10' }, latest: { code: 'B', date: '2026-11-20' },
    })
    expect(buildRuleReason({ ...base, span: span(4) })).toBeNull()
    const msg = buildRuleReason({ ...base, span: span(5) })
    expect(msg).toContain('cách nhau 5 ngày')
    expect(msg).toContain('khung 5 ngày (chênh tối đa 4 ngày)')
  })
})

describe('bestFixKey / splitFixMaterials', () => {
  const mat = (p: Partial<CuttingBatchFixMaterial>): CuttingBatchFixMaterial => ({
    materialId: 'm', materialCode: 'M', thresholdPct: 1, stockLengthMm: null, status: 'over', wastePct: 3, bars: null,
    verifiedLengthSource: 'fixed', itemIds: [], addSuggestion: null, addReason: null, customLength: null, urgent: null, ...p,
  })
  const res = (wastePct: number) => ({ wastePct }) as never
  it('chọn cách đạt ngưỡng có hao hụt thấp nhất', () => {
    expect(bestFixKey(mat({}), false)).toBeNull()
    expect(bestFixKey(mat({ customLength: res(0.8), urgent: res(0.5) }), false)).toBe('urgent')
    expect(bestFixKey(mat({ customLength: res(0.4), urgent: res(0.5) }), false)).toBe('custom')
    expect(bestFixKey(mat({ addSuggestion: { meetsThreshold: true, wastePct: 0.2 } as never, urgent: res(0.5) }), false)).toBe('add')
  })
  it('xưởng có luật số cỡ thì không so cách đặt riêng', () => {
    expect(bestFixKey(mat({ customLength: res(0.4), urgent: res(0.9) }), true)).toBe('urgent')
  })
  it('cách vượt ngưỡng không được chọn', () => {
    expect(bestFixKey(mat({ urgent: res(2) }), false)).toBeNull()
  })
  it('chia theo trạng thái; chưa có gợi ý thì rỗng', () => {
    const fix = { materials: [mat({ status: 'over' }), mat({ status: 'ok' }), mat({ status: 'unknown' })] } as never
    const g = splitFixMaterials(fix)
    expect([g.over.length, g.ok.length, g.unknown.length]).toEqual([1, 1, 1])
    expect(splitFixMaterials(null).over).toEqual([])
  })
})

describe('buildMachineParams / cutModesHelp', () => {
  const d = {
    solverBundleFactors: [14, 16], solverMctdBladeWidthMm: 5, solverMctdTrimStartMm: 20, solverMaxManualCuts: 3,
    solverMaxSizesPerPattern: 4, solverBladeWidthMm: 2, solverTrimStartMm: 10, solverLaserMinTailMm: 100,
    solverStockLengths: [6000], solverMaxSurplus: 1, solverMergeWindowDays: 5,
    solverMaxSizesPerBarByWorkshop: { PA: 2 }, solverBundleFactorsBySpec: {},
  } as unknown as CuttingDefaults
  const labels = (p: { label: string }[] | null) => (p ?? []).map((x) => x.label)
  it('BE cũ chưa trả thông số thì không hiện', () => {
    expect(buildMachineParams(null, 'laser', () => undefined)).toBeNull()
    expect(buildMachineParams({} as CuttingDefaults, 'laser', () => undefined)).toBeNull()
  })
  it('MC Laser có đoạn cuối tối thiểu, không có số cây/bó', () => {
    const l = labels(buildMachineParams(d, 'laser', () => undefined))
    expect(l).toContain('Đoạn cuối tối thiểu')
    expect(l).not.toContain('Số cây mỗi bó')
  })
  it('MC Tự động có số cây mỗi bó khi bảng quy cách rỗng, theo bảng khi có dòng', () => {
    expect(labels(buildMachineParams(d, 'tu_dong', () => undefined))).toContain('Số cây mỗi bó')
    const withSpecs = { ...d, solverBundleFactorsBySpec: { V15: [14, 16] } } as unknown as CuttingDefaults
    const l = labels(buildMachineParams(withSpecs, 'tu_dong', () => undefined))
    expect(l).toContain('Số cây/bó')
    expect(l).toContain('Cắt lẻ (phần không đủ bó)')
  })
  it('luật theo xưởng ghi tên xưởng, thiếu tên thì dùng mã', () => {
    const p = buildMachineParams(d, 'laser', (c) => (c === 'PA' ? 'Phước An' : undefined))
    expect(p?.find((x) => x.label.startsWith('Cỡ đoạn tối đa/cây'))?.value).toBe('Phước An: 2')
    const q = buildMachineParams(d, 'laser', () => undefined)
    expect(q?.find((x) => x.label.startsWith('Cỡ đoạn tối đa/cây'))?.value).toBe('PA: 2')
  })
  it('giải thích chế độ cắt bỏ phần ngoặc ở nhãn', () => {
    const t = cutModesHelp(' | ')
    expect(t.startsWith('Bình thường: ')).toBe(true)
    expect(t).toContain(' | Chấp nhận hao hụt cao hơn: ')
  })
})
