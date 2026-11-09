import { PIECE_SYNC_COUNT_MODE, type PieceSyncLine, type PieceSyncRow } from '../../../services/piece-sync-board-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'

// Hàm thuần cho màn "Đồng bộ Phôi – Hàn" (2026-11-04): lọc, nhóm PI → SKU, tóm tắt nhóm, chọn dòng sắt nghẽn.

export type SyncFilter = 'ALL' | 'PHOI_THIEU' | 'HAN_VUOT' | 'CON_CHO_HAN'

export interface SyncGroupSummary {
  /** Số bộ Phôi đủ = min ⌊phoiSyncedQty / qtyPerUnit⌋ qua các mảnh có số; null khi không mảnh nào có. */
  phoiSets: number | null
  /** Tên mảnh cho min ở trên (mảnh nghẽn); null khi không có số Phôi. */
  phoiBottleneckPieceName: string | null
  /** Số bộ Hàn đủ = min ⌊hanDoneQty / qtyPerUnit⌋ qua mọi mảnh; null khi nhóm không có mảnh. */
  hanSets: number | null
}

export interface SyncGroup {
  key: string
  productionInvoiceId: string
  piCode: string
  skuCode: string
  skuName: string | null
  orderQuantity: number
  /** Chỉ các dòng qua bộ lọc/ô tìm, giữ thứ tự BE. */
  rows: PieceSyncRow[]
  /** Tóm tắt tính trên TẤT CẢ mảnh của nhóm (không bị bộ lọc làm lệch). */
  summary: SyncGroupSummary
}

/** Bỏ dấu + thường để tìm "han" ra "Hàn", "đế" ra "de". */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

export function matchesFilter(r: PieceSyncRow, filter: SyncFilter): boolean {
  switch (filter) {
    case 'PHOI_THIEU': return r.syncPercent !== null && r.syncPercent < 100
    case 'HAN_VUOT': return r.hanAheadOfPhoi
    case 'CON_CHO_HAN': return r.notWeldedQty !== null && r.notWeldedQty > 0
    default: return true
  }
}

export function matchesSearch(r: PieceSyncRow, query: string): boolean {
  const q = foldText(query.trim())
  if (!q) return true
  return foldText(`${r.piCode} ${r.skuCode} ${r.skuName ?? ''} ${r.pieceCode} ${r.pieceName}`).includes(q)
}

export function summarizeRows(rows: PieceSyncRow[]): SyncGroupSummary {
  let phoiSets: number | null = null
  let phoiBottleneckPieceName: string | null = null
  let hanSets: number | null = null
  for (const r of rows) {
    if (!(r.qtyPerUnit > 0)) continue
    if (r.phoiSyncedQty !== null) {
      const sets = Math.floor(r.phoiSyncedQty / r.qtyPerUnit)
      if (phoiSets === null || sets < phoiSets) { phoiSets = sets; phoiBottleneckPieceName = r.pieceName }
    }
    const han = Math.floor(r.hanDoneQty / r.qtyPerUnit)
    if (hanSets === null || han < hanSets) hanSets = han
  }
  return { phoiSets, phoiBottleneckPieceName, hanSets }
}

/** Nhóm theo PI → SKU (1 lệnh SX = 1 nhóm), giữ thứ tự BE; nhóm hết dòng sau khi lọc thì bỏ. */
export function buildGroups(all: PieceSyncRow[], search: string, filter: SyncFilter): SyncGroup[] {
  const byKey = new Map<string, PieceSyncRow[]>()
  for (const r of all) {
    const key = `${r.productionInvoiceId}|${r.productionOrderId}`
    const list = byKey.get(key)
    if (list) list.push(r)
    else byKey.set(key, [r])
  }
  const groups: SyncGroup[] = []
  for (const [key, rows] of byKey) {
    const shown = rows.filter(r => matchesFilter(r, filter) && matchesSearch(r, search))
    if (shown.length === 0) continue
    const first = rows[0]
    groups.push({
      key,
      productionInvoiceId: first.productionInvoiceId,
      piCode: first.piCode,
      skuCode: first.skuCode,
      skuName: first.skuName,
      orderQuantity: first.orderQuantity,
      rows: shown,
      summary: summarizeRows(rows),
    })
  }
  return groups
}

/** Dòng sắt nghẽn của 1 mảnh: dòng có makeablePieces nhỏ nhất (đầu tiên nếu hoà), chỉ khi nhỏ hơn số mảnh cần. */
export function bottleneckLine(row: PieceSyncRow): PieceSyncLine | null {
  let min: PieceSyncLine | null = null
  for (const l of row.lines) {
    if (min === null || l.makeablePieces < min.makeablePieces) min = l
  }
  return min && min.makeablePieces < row.requiredQty ? min : null
}

/** Công đoạn của 1 dòng sắt, vd "Cắt → Uốn → Dập". */
export function stepsText(steps: PieceSyncLine['steps']): string {
  return steps.map(s => PROCESS_STEP_LABELS[s] ?? s).join(' → ')
}

/** "nghẽn ở Dập" khi dòng còn thiếu và BE chỉ ra công đoạn ít đoạn nhất; ngược lại null. */
export function limitingText(line: Pick<PieceSyncLine, 'limitingStep'>): string | null {
  return line.limitingStep ? `nghẽn ở ${PROCESS_STEP_LABELS[line.limitingStep] ?? line.limitingStep}` : null
}

/** Cột "Chưa qua KCS": null/undefined (BE cũ chưa trả) → null để hiện "—". */
export function pendingQcValue(r: Pick<PieceSyncRow, 'phoiPendingQcQty'>): number | null {
  return r.phoiPendingQcQty ?? null
}

/** Dòng giải thích trên bảng, đổi theo cách BE đếm. */
export function syncExplainText(mode: 'PASSED_QC' | 'REPORTED' = PIECE_SYNC_COUNT_MODE): string {
  return mode === 'PASSED_QC'
    ? 'Mảnh đồng bộ = mảnh đã có đủ đoạn, mỗi đoạn đã qua mọi công đoạn của nó (cắt, uốn, dập…) và đã đạt KCS. "Chưa qua KCS" = số mảnh sẽ có thêm khi KCS chấm đạt phần đã báo.'
    : 'Mảnh đồng bộ = mảnh đã có đủ đoạn, mỗi đoạn đã báo xong mọi công đoạn của nó (cắt, uốn, dập…), trừ đoạn KCS chấm lỗi.'
}
