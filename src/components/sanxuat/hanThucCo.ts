// Cột "Thực có" của màn Hàn (2026-11-04): lấy từ API "Đồng bộ Phôi – Hàn" (piece-sync-board).
// CHỈ HIỂN THỊ - không dùng để chặn/khống chế việc Hàn báo sản lượng.
import type { PieceSyncBoard, PieceSyncRow } from '../../services/piece-sync-board-api'
import type { ProcPart } from './core'
import { PROCESS_STEP_LABELS } from '../../constants/processSteps'

export interface HanThucCo {
  thucCoQty?: number
  parts?: ProcPart[]
}

export const hanThucCoKey = (productionOrderId: string, pieceId: string) => `${productionOrderId}:${pieceId}`

function mapRow(row: PieceSyncRow): HanThucCo {
  const out: HanThucCo = {}
  if (row.notWeldedQty != null) out.thucCoQty = row.notWeldedQty
  if (row.lines.length > 0) {
    // Đoạn còn trong tay = đoạn đã chia cho mảnh − đoạn đã nằm trong mảnh đã hàn, để dòng "Đủ ráp" của phần xổ
    // khớp cột "Thực có" (mảnh) thay vì ra tổng luỹ kế.
    out.parts = row.lines.map(l => ({
      // 2026-11-06: đoạn đủ công đoạn (cắt + uốn/dập… + đạt KCS); nghenO = công đoạn ít đoạn nhất khi dòng còn thiếu.
      // 2026-11-04: bảng ghi "quy cách · dài mm", quy cách xưởng gọi (15, 10x20) hoặc mã vật tư nếu chưa khai.
      loaiSat: l.materialName,
      quyCach: l.materialSpec ?? l.materialCode,
      len: l.cutLengthMm,
      perChiTiet: l.qtyPerPiece,
      thucCo: Math.max(0, l.usableQty - row.hanDoneQty * l.qtyPerPiece),
      ...(l.limitingStep ? { nghenO: PROCESS_STEP_LABELS[l.limitingStep] ?? l.limitingStep } : {}),
    }))
  }
  return out
}

/** Map theo khoá `${productionOrderId}:${pieceId}`. */
export function buildHanThucCoMap(board: Pick<PieceSyncBoard, 'rows'>): Map<string, HanThucCo> {
  const m = new Map<string, HanThucCo>()
  for (const r of board.rows) m.set(hanThucCoKey(r.productionOrderId, r.pieceId), mapRow(r))
  return m
}

/** Lỗi bất kỳ (403, mạng, BE chưa có API) → map rỗng, màn Hàn chạy như cũ (cột hiện "—"). */
export async function loadHanThucCo(
  productionInvoiceIds: string[],
  fetcher: (ids: string[]) => Promise<Pick<PieceSyncBoard, 'rows'>>,
): Promise<Map<string, HanThucCo>> {
  const ids = [...new Set(productionInvoiceIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  try { return buildHanThucCoMap(await fetcher(ids)) }
  catch { return new Map() }
}
