import { describe, expect, it } from 'vitest'
import { fmtNum } from '../../../utils/numberFormat'
import type { BeCutAllocationLogEntry, BeCutAllocationMachine, BeCutAllocationRow } from '../../../services/floor-api'
import {
  buildCutSheetsDocument, buildMachineSheetHtml, cutPatternText, escapeHtml, explainLines, fmtDayMonth, groupAdjacentRows,
  groupRowsByMachine, isValidBarCount, loadBarSegments, loadPercent, machineAcceptsRow, maxMachineBars, moveRowIds, pieceNamesOf,
  priorityChips, progressText, punchedText, BUNDLE_SPLIT_HINT, canConfirmBundleMove, canSplitRow, defaultLogRange, isValidLogRange,
  logActionLabel, logBarsText, logMachineText, logTimeText, ordersWithMoves, barsPercent, barsProgressText, isRowDone,
  machineStatusBadge, openRowsFirst, rowBarsText, barsLeftText, IDLE_NOTICE, reasonLabel, reasonPayload, rowStepLabels, sortMachineRows,
  wastePerBarText, addAnywayMessage, APPROX_NOTE, deleteMessage, editToggleLabel, heldElsewhereText, loadBarText, logDetailText,
  logWhenWhoText, machineOptionLabel, machineProgressTitle, moveHint, rowAcceptsMachine, rowNotes, staleText, rowClassLabel, sheetTitle,
  stepBadges, stepsCellText, surplusText, workshopHasLaser, workshopLabel,
} from './cutAllocationModel'

const machine = (id: string, over: Partial<BeCutAllocationMachine> = {}): BeCutAllocationMachine => ({
  id, code: `M${id}`, name: `Máy ${id}`, cutMachineType: 'laser', totalBars: 0, rowCount: 0, plannedSegments: 0, reportedSegments: 0,
  barsDoneEst: 0, barsLeftEst: 0, status: 'EMPTY', ...over,
})

const row = (id: string, workstationId: string, seq: number, over: Partial<BeCutAllocationRow> = {}): BeCutAllocationRow => ({
  id, workstationId, seq, isManual: false, productionInvoiceId: '1', piCode: 'PI-001',
  priority: { phoiStart: null, bookingDue: null, deadline: null },
  cuttingProposalId: '1', patternId: '1', patternIndex: 1, patternBarCount: 10,
  materialId: '5', materialCode: 'S1', materialLabel: 'Sắt hộp · 20x20', barLengthMm: 6000, lineMachine: 'laser', machineClass: 'LASER',
  barCount: 10, barsDoneEst: 0,
  segments: [
    { cutLengthMm: 425, countPerBar: 3, steps: ['UON', 'DUC_LO'], pieceNames: ['Chân bàn'] },
    { cutLengthMm: 590, countPerBar: 2, steps: [], pieceNames: ['Chân bàn', 'Thanh ngang'] },
  ],
  punchedSegments: null, bundles: null, wastePerBarMm: 5, lineSurplus: [], hasBend: true, isBundle: false, ...over,
})

describe('cutAllocationModel', () => {
  it('dòng có đoạn dập chỉ sang máy laze khi xưởng có laze; Phước An (khoá máy tự động) máy nào cũng nhận', () => {
    const laser = machine('1')
    const auto = machine('2', { cutMachineType: 'tu_dong' })
    const both = [laser, auto]
    expect(machineAcceptsRow(auto, { machineClass: 'LASER' }, both, true)).toBe(false)
    expect(machineAcceptsRow(laser, { machineClass: 'LASER' }, both, true)).toBe(true)
    expect(machineAcceptsRow(auto, { machineClass: 'TU_DONG' }, both, true)).toBe(true)
    expect(machineAcceptsRow(auto, { machineClass: 'LASER' }, both, false)).toBe(true)
    expect(machineAcceptsRow(auto, { machineClass: 'LASER' }, [auto], true)).toBe(true)
  })

  it('nhãn xưởng không lặp chữ "Xưởng"', () => {
    expect(workshopLabel('Xưởng Phú An')).toBe('Xưởng Phú An')
    expect(workshopLabel('Phước An')).toBe('Xưởng Phước An')
    expect(workshopLabel(null)).toBe('Xưởng')
  })

  it('gom dòng theo máy, đúng thứ tự máy của BE và sắp theo seq', () => {
    const groups = groupRowsByMachine({
      machines: [machine('2'), machine('1')],
      rows: [row('10', '1', 2), row('11', '2', 1), row('12', '1', 1)],
    })
    expect(groups.map((g) => g.machine.id)).toEqual(['2', '1'])
    expect(groups[1].rows.map((r) => r.id)).toEqual(['12', '10'])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['11'])
  })

  it('số kiểu Việt và ngày dd/mm', () => {
    expect(fmtNum(6000)).toBe('6.000')
    expect(fmtNum(425)).toBe('425')
    expect(fmtNum(427.5)).toBe('427,5')
    expect(fmtDayMonth('2026-11-13')).toBe('13/11')
    expect(fmtDayMonth(null)).toBeNull()
  })

  it('chip ưu tiên chỉ hiện cái nào có', () => {
    const chips = priorityChips({ phoiStart: '2026-11-13', bookingDue: null, deadline: '2026-11-20' })
    expect(chips.map((c) => c.text)).toEqual(['N1 13/11', 'Hạn 20/11'])
    expect(priorityChips({ phoiStart: null, bookingDue: null, deadline: null })).toEqual([])
  })

  it('chữ kiểu cắt, bước, đoạn dập, đoạn dư', () => {
    expect(cutPatternText(row('1', '1', 1).segments)).toBe('425×3 + 590×2')
    expect(stepBadges(['TAN', 'DUC_LO', 'UON', 'DAP'])).toEqual(['Uốn', 'Dập', 'Khoan', 'Tán'])
    expect(punchedText([{ cutLengthMm: 590, countPerBar: 2 }])).toBe('590×2')
    expect(punchedText(null)).toBe('')
    expect(surplusText([{ cutLengthMm: 425, surplus: 3 }, { cutLengthMm: 590, surplus: 0 }])).toBe('425×3')
  })

  it('tiến độ ghi rõ xấp xỉ', () => {
    expect(progressText({ reportedSegments: 12, plannedSegments: 1200 })).toBe('Đã báo ≈12/1.200 đoạn')
  })

  it('chi tiết ra gộp tên, bỏ trùng', () => {
    expect(pieceNamesOf(row('1', '1', 1).segments)).toEqual(['Chân bàn', 'Thanh ngang'])
  })

  it('lên/xuống: đổi chỗ 1 bậc, đầu/cuối thì null', () => {
    expect(moveRowIds(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(moveRowIds(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b'])
    expect(moveRowIds(['a', 'b', 'c'], 'a', 'up')).toBeNull()
    expect(moveRowIds(['a', 'b', 'c'], 'c', 'down')).toBeNull()
    expect(moveRowIds(['a'], 'x', 'down')).toBeNull()
  })

  it('số cây hợp lệ là số nguyên >= 1', () => {
    expect(isValidBarCount(1)).toBe(true)
    expect(isValidBarCount(0)).toBe(false)
    expect(isValidBarCount(2.5)).toBe(false)
    expect(isValidBarCount(Number.NaN)).toBe(false)
  })

  it('ô Khoan/Dập/Uốn của phiếu', () => {
    expect(stepsCellText(row('1', '1', 1).segments)).toBe('Uốn 425; Khoan 425')
    expect(stepsCellText([{ cutLengthMm: 100, countPerBar: 1, steps: [], pieceNames: [] }])).toBe('')
  })

  it('phiếu in: tiêu đề, cột, escape HTML', () => {
    const m = machine('1', { code: 'L-01', name: 'Máy <1>', totalBars: 10 })
    const html = buildMachineSheetHtml(
      { machine: m, rows: [row('10', '1', 1, { piCode: 'PI<&>', lineSurplus: [{ cutLengthMm: 425, surplus: 3 }] })] },
      'Phú An', '13/11/2026', false,
    )
    expect(html).toContain('PHIẾU CẮT · L-01 · Máy &lt;1&gt; · Phú An · 13/11/2026')
    expect(html).toContain('PI&lt;&amp;&gt;')
    expect(html).toContain('425×3 + 590×2')
    expect(html).toContain('6.000')
    expect(html).toContain('Uốn 425; Khoan 425')
    expect(html).toContain('425×3</td></tr>')
    expect(html).not.toContain('page-break-before')
    // Căn cột: số căn phải (STT, Cây (mm), Số cây), chữ căn trái.
    expect(html).toContain('<th class="num">STT</th><th>Lệnh</th><th>Loại sắt</th><th class="num">Cây (mm)</th>')
    expect(html).toContain('<td class="num">1</td><td>PI&lt;&amp;&gt;</td><td>Sắt hộp · 20x20</td><td class="num">6.000</td>')
    expect(buildCutSheetsDocument([], 'Phú An', '13/11/2026')).toContain('td.num { text-align: right; }')
    expect(buildCutSheetsDocument([], 'Phú An', '13/11/2026')).toContain('text-align: left')
    expect(sheetTitle(m, 'Phú An', '13/11/2026')).toBe('PHIẾU CẮT · L-01 · Máy <1> · Phú An · 13/11/2026')
    expect(escapeHtml('a"b')).toBe('a&quot;b')
  })

  it('in tất cả: mỗi máy 1 trang, bỏ máy trống khi skipEmpty', () => {
    const groups = [
      { machine: machine('1'), rows: [row('1', '1', 1)] },
      { machine: machine('2'), rows: [] },
      { machine: machine('3'), rows: [row('2', '3', 1)] },
    ]
    const all = buildCutSheetsDocument(groups, 'Phú An', '13/11/2026', true)
    expect(all.match(/page-break-before: always/g)?.length).toBe(1)
    expect(all).not.toContain('M2 · Máy 2')
    expect(buildCutSheetsDocument(groups, 'Phú An', '13/11/2026', false).match(/page-break-before: always/g)?.length).toBe(2)
  })

  it('nhãn lớp máy: chỉ hiện khi có điều cần lưu ý', () => {
    expect(rowClassLabel('LASER', 'laser', true)).toBeNull()
    expect(rowClassLabel('TU_DONG', 'laser', true)).toEqual({ text: 'Cắt được máy tự động', tone: 'gray' })
    expect(rowClassLabel('TU_DONG', 'tu_dong', true)).toBeNull()
    expect(rowClassLabel('LASER', 'tu_dong', false)).toEqual({ text: 'Lỗ làm tay', tone: 'amber' })
    expect(rowClassLabel('TU_DONG', 'tu_dong', false)).toBeNull()
    expect(rowClassLabel('LASER', 'tu_dong', true)).toEqual({ text: 'Cây có đoạn dập – nên cắt laze', tone: 'red' })
  })

  it('xưởng có laze cần cho phép laze và có máy laze; luật chia chỉ nói đúng xưởng đang xem', () => {
    const laser = machine('1')
    const auto = machine('2', { cutMachineType: 'tu_dong' })
    expect(workshopHasLaser(true, [laser, auto])).toBe(true)
    expect(workshopHasLaser(true, [auto])).toBe(false)
    expect(workshopHasLaser(false, [laser])).toBe(false)
    const withLaser = explainLines(true).join(' ')
    const noLaser = explainLines(false).join(' ')
    expect(withLaser).toContain('máy laze')
    expect(noLaser).not.toContain('laze')
    expect(noLaser).toContain('lỗ tay')
    expect(withLaser).not.toContain('Phước An')
    expect(withLaser).toContain('số cây còn phải cắt')
    expect(noLaser).toContain('tự kéo lệnh kế tiếp')
  })

  it('cách hệ thống chia: danh sách câu ngắn, không câu trống, không trùng', () => {
    const lines = explainLines(true)
    expect(lines.length).toBeGreaterThanOrEqual(5)
    expect(new Set(lines).size).toBe(lines.length)
    for (const l of lines) {
      expect(l.trim()).not.toBe('')
      expect(l.length).toBeLessThanOrEqual(140)
    }
  })

  it('gom dòng: chỉ gom dòng kề nhau cùng lệnh + loại sắt + chiều dài cây, giữ nguyên thứ tự', () => {
    const rows = [
      row('1', '1', 1, { productionInvoiceId: 'A' }),
      row('2', '1', 2, { productionInvoiceId: 'A' }),
      row('3', '1', 3, { productionInvoiceId: 'B' }),
      row('4', '1', 4, { productionInvoiceId: 'A' }),
      row('5', '1', 5, { productionInvoiceId: 'A', barLengthMm: 5030 }),
      row('6', '1', 6, { productionInvoiceId: 'A', barLengthMm: 5030, materialId: '9' }),
    ]
    const runs = groupAdjacentRows(rows)
    expect(runs.map((r) => r.rows.map((x) => x.id))).toEqual([['1', '2'], ['3'], ['4'], ['5'], ['6']])
    expect(runs.flatMap((r) => r.rows.map((x) => x.id))).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(groupAdjacentRows([])).toEqual([])
  })

  it('thanh tải: cây của máy chia cây của máy nhiều nhất', () => {
    const ms = [machine('1', { totalBars: 20 }), machine('2', { totalBars: 5 }), machine('3', { totalBars: 0 })]
    const mx = maxMachineBars(ms)
    expect(mx).toBe(20)
    expect(ms.map((m) => loadPercent(m.totalBars, mx))).toEqual([100, 25, 0])
    expect(loadPercent(5, 0)).toBe(0)
    expect(maxMachineBars([])).toBe(0)
  })

  it('một thanh cho tải + tiến độ: phần tô màu = tải, xanh lá = phần đã cắt của tải đó', () => {
    expect(loadBarSegments(28, 28, 8)).toEqual({ donePct: 28.6, leftPct: 71.4 })
    expect(loadBarSegments(3, 28, 3)).toEqual({ donePct: 11, leftPct: 0 })
    expect(loadBarSegments(2, 28, 0)).toEqual({ donePct: 0, leftPct: 7 })
    expect(loadBarSegments(0, 28, 0)).toEqual({ donePct: 0, leftPct: 0 })
    expect(loadBarSegments(10, 10, 15)).toEqual({ donePct: 100, leftPct: 0 })
  })

  it('dòng theo bó: không tách được, dòng thường từ 2 cây mới tách được', () => {
    expect(canSplitRow(row('1', '1', 1, { isBundle: true, barCount: 10 }))).toBe(false)
    expect(canSplitRow(row('1', '1', 1, { barCount: 10 }))).toBe(true)
    expect(canSplitRow(row('1', '1', 1, { barCount: 1 }))).toBe(false)
    expect(BUNDLE_SPLIT_HINT).toContain('không tách')
  })

  it('đổi máy dòng theo bó chỉ xác nhận được khi chọn Máy hư', () => {
    expect(canConfirmBundleMove('')).toBe(false)
    expect(canConfirmBundleMove('OTHER')).toBe(false)
    expect(canConfirmBundleMove('MACHINE_BROKEN')).toBe(true)
  })

  it('lý do + ghi chú gửi BE: bỏ ghi chú rỗng, cắt 300 ký tự, chưa chọn lý do thì không gửi reason', () => {
    expect(reasonPayload('', '  ')).toEqual({})
    expect(reasonPayload('MACHINE_BROKEN', ' Hỏng dao ')).toEqual({ reason: 'MACHINE_BROKEN', note: 'Hỏng dao' })
    expect(reasonPayload('OTHER', 'x'.repeat(400)).note).toHaveLength(300)
    expect(reasonLabel('MACHINE_BROKEN')).toBe('Máy hư')
    expect(reasonLabel('OTHER')).toBe('Khác')
    expect(reasonLabel(null)).toBe('')
  })

  const entry = (over: Partial<BeCutAllocationLogEntry> = {}): BeCutAllocationLogEntry => ({
    id: '1', createdAt: '2026-11-13T08:10:00', action: 'MOVE', reason: null, note: null, isBundle: false, barCount: 8,
    previousBarCount: null,
    productionInvoiceId: '1', piCode: 'PI-001', materialLabel: null,
    fromMachine: { id: '1', name: 'Máy 1' }, toMachine: { id: '2', name: 'Máy 2' },
    createdByName: null, ...over,
  })

  it('nhật ký: nhãn thao tác, máy từ → sang, số cây cũ → mới', () => {
    expect(['ADD', 'SPLIT', 'MOVE', 'BARS', 'REMOVE'].map((a) => logActionLabel(a as BeCutAllocationLogEntry['action'])))
      .toEqual(['Thêm', 'Tách', 'Đổi máy', 'Đổi số cây', 'Xoá'])
    expect(logMachineText(entry())).toBe('Máy 1 → Máy 2')
    expect(logMachineText(entry({ fromMachine: null }))).toBe('— → Máy 2')
    expect(logBarsText(entry({ action: 'BARS', previousBarCount: 10, barCount: 8 }))).toBe('10 → 8 cây')
    expect(logBarsText(entry())).toBe('8 cây')
    expect(logTimeText('2026-11-13T08:10:00')).toBe('13/11 08:10')
    expect(logTimeText('hỏng')).toBe('')
  })

  it('khoảng ngày mặc định 30 ngày; từ phải <= đến', () => {
    expect(defaultLogRange(new Date(2026, 10, 14))).toEqual({ from: '2026-10-16', to: '2026-11-14' })
    expect(isValidLogRange('2026-10-16', '2026-11-14')).toBe(true)
    expect(isValidLogRange('2026-11-15', '2026-11-14')).toBe(false)
    expect(isValidLogRange('', '2026-11-14')).toBe(false)
  })

  it('lệnh có điều chuyển: bỏ lệnh không đổi gì, nhiều lần lên trước', () => {
    const out = ordersWithMoves([
      { productionInvoiceId: '1', piCode: 'A', moves: 0, splits: 0, machineBrokenMoves: 0 },
      { productionInvoiceId: '2', piCode: 'B', moves: 1, splits: 0, machineBrokenMoves: 0 },
      { productionInvoiceId: '3', piCode: 'C', moves: 2, splits: 1, machineBrokenMoves: 1 },
    ])
    expect(out.map((o) => o.piCode)).toEqual(['C', 'B'])
  })

  it('việc của máy trên màn quét: nhãn bước, dư mỗi cây, thứ tự cắt', () => {
    expect(rowStepLabels(row('1', '1', 1))).toEqual(['Uốn', 'Khoan'])
    const punched = [{ cutLengthMm: 590, countPerBar: 2 }]
    expect(rowStepLabels(row('1', '1', 1, { hasBend: false, punchedSegments: punched }))).toEqual(['Uốn', 'Dập', 'Khoan'])
    expect(rowStepLabels(row('1', '1', 1, { hasBend: false, segments: [] }))).toEqual([])
    expect(wastePerBarText(25)).toBe('25 mm')
    expect(wastePerBarText(0)).toBe('')
    expect(wastePerBarText(null)).toBe('')
    expect(sortMachineRows([row('2', '1', 2), row('1', '1', 1)]).map((r) => r.id)).toEqual(['1', '2'])
  })

  it('ước số cây: chữ thẻ máy, trạng thái, dòng xong', () => {
    expect(barsProgressText({ barsDoneEst: 12, barsLeftEst: 28, totalBars: 40 })).toBe('Đã cắt ≈ 12/40 cây · còn ≈ 28 cây')
    expect(barsLeftText(28)).toBe('Còn ≈ 28 cây')
    expect(barsPercent(12, 40)).toBe(30)
    expect(barsPercent(50, 40)).toBe(100)
    expect(barsPercent(0, 0)).toBe(0)
    expect(machineStatusBadge('IDLE')).toEqual({ text: 'Máy rảnh', tone: 'red' })
    expect(machineStatusBadge('LOW')).toEqual({ text: 'Sắp hết việc', tone: 'amber' })
    expect(machineStatusBadge('EMPTY')).toEqual({ text: 'Chưa có việc', tone: 'gray' })
    expect(machineStatusBadge('BUSY')).toBeNull()
    expect(IDLE_NOTICE).toBe('Máy đã cắt hết việc được chia - báo QLSX chia thêm.')
    expect(rowBarsText(row('1', '1', 1, { barsDoneEst: 3 }))).toBe('≈ đã cắt 3/10 cây')
    expect(isRowDone(row('1', '1', 1, { barsDoneEst: 10 }))).toBe(true)
    expect(isRowDone(row('1', '1', 1, { barsDoneEst: 9 }))).toBe(false)
  })

  it('màn quét: dòng còn việc lên trước, dòng đã xong xuống cuối (giữ thứ tự trong từng nhóm)', () => {
    const rows = [
      row('1', '1', 1, { barsDoneEst: 10 }),
      row('2', '1', 2, { barsDoneEst: 10 }),
      row('3', '1', 3, { barsDoneEst: 0 }),
      row('4', '1', 4, { barsDoneEst: 4 }),
    ]
    expect(openRowsFirst(rows).map((r) => r.id)).toEqual(['3', '4', '1', '2'])
    expect(openRowsFirst([])).toEqual([])
  })

  it('ô chọn máy: ưu tiên danh sách máy BE cho phép, thiếu thì dùng luật dự phòng', () => {
    const laser = machine('1')
    const auto = machine('2', { cutMachineType: 'tu_dong' })
    const both = [laser, auto]
    const limited = row('1', '1', 1, { allowedMachineIds: ['2'] })
    expect(rowAcceptsMachine(limited, auto, both, true)).toBe(true)
    expect(rowAcceptsMachine(limited, laser, both, true)).toBe(false)
    // BE cho phép rỗng = không máy nào nhận (không rơi về luật dự phòng).
    expect(rowAcceptsMachine(row('1', '1', 1, { allowedMachineIds: [] }), laser, both, true)).toBe(false)
    // BE cũ chưa trả trường: dùng luật dự phòng (dòng LASER không sang máy tự động).
    const legacy = row('1', '1', 1)
    expect(rowAcceptsMachine(legacy, laser, both, true)).toBe(true)
    expect(rowAcceptsMachine(legacy, auto, both, true)).toBe(false)
  })

  it('nhãn ô chọn máy: máy bị khoá ghi rõ lý do', () => {
    expect(machineOptionLabel({ code: 'M1', name: 'Máy 1' }, true)).toBe('M1 · Máy 1')
    expect(machineOptionLabel({ code: 'M1', name: 'Máy 1' }, false)).toBe('M1 · Máy 1 - máy này không nhận dòng này')
  })

  it('cây còn giữ ở kho xưởng khác: chỉ ghi khi > 0', () => {
    expect(heldElsewhereText(12)).toBe('12 cây còn giữ ở kho xưởng khác, chờ chuyển kho')
    expect(heldElsewhereText(0)).toBe('')
    expect(heldElsewhereText(undefined)).toBe('')
    expect(heldElsewhereText(null)).toBe('')
    expect(heldElsewhereText(1200)).toContain('1.200')
  })

  it('ghi chú dưới dòng: theo bó, đoạn dập; dòng thường không có gì', () => {
    expect(rowNotes(row('1', '1', 1))).toEqual([])
    const bundle = rowNotes(row('1', '1', 1, { isBundle: true, bundles: { '10': 2 } }))
    expect(bundle).toHaveLength(2)
    expect(bundle[0]).toContain('Cắt theo bó: 10 cây × 2 bó')
    expect(bundle[1]).toContain(BUNDLE_SPLIT_HINT)
    const punched = rowNotes(row('1', '1', 1, { punchedSegments: [{ cutLengthMm: 590, countPerBar: 2 }] }))
    expect(punched).toEqual(['Đoạn dập trên cây: 590×2'])
  })

  it('tiến độ thẻ máy: title có số đoạn đã báo và chú thích ≈', () => {
    const m = { reportedSegments: 12, plannedSegments: 40 }
    expect(machineProgressTitle(m)).toBe(`Đã báo ≈12/40 đoạn. ${APPROX_NOTE}`)
    expect(machineProgressTitle({ reportedSegments: 0, plannedSegments: 0 })).toBe(APPROX_NOTE)
    expect(APPROX_NOTE).toBe('≈ là số ước từ số đoạn công nhân đã báo')
  })

  it('chữ đọc của thanh tải', () => {
    const m = { barsDoneEst: 12, barsLeftEst: 28, totalBars: 40 }
    expect(loadBarText(m, 80)).toBe('Đã cắt ≈ 12/40 cây · còn ≈ 28 cây; tải 50% so với máy nhiều việc nhất')
  })

  it('chữ phụ của khối sửa, dòng cũ, xác nhận, nhật ký', () => {
    expect(editToggleLabel(false, { code: 'M1', name: 'Máy 1' })).toBe('Sửa máy M1 · Máy 1')
    expect(editToggleLabel(true, { code: 'M1', name: 'Máy 1' })).toBe('Xong sửa máy M1 · Máy 1')
    expect(moveHint(true)).toContain('Máy hư')
    expect(moveHint(false)).toContain('Ghi lý do')
    expect(staleText(0)).toBe('')
    expect(staleText(3)).toContain('3 dòng cũ')
    expect(deleteMessage({ piCode: 'PI-1', materialLabel: 'Sắt hộp', barCount: 4 })).toContain('PI-1 · Sắt hộp (4 cây)')
    expect(addAnywayMessage('PI-1 · Sắt')).toContain('PI-1 · Sắt')
    expect(logDetailText({ reason: 'MACHINE_BROKEN', note: 'Hỏng lưỡi' })).toBe('Máy hư · Hỏng lưỡi')
    expect(logDetailText({ reason: null, note: null })).toBe('')
    const base = { createdAt: 'sai', createdByName: null, action: 'MOVE' as const }
    expect(logWhenWhoText(base)).toBe('')
    expect(logWhenWhoText({ ...base, createdByName: 'Lan' })).toBe(' · Lan')
  })
})
