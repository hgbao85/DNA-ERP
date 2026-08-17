'use client'

/**
 * Màn hình KCS — công đoạn Hàn/Sơn (controlled, đọc/ghi production-batches/qc-reviews thật).
 * Dùng chung cho KcsHanPage & KcsSonPage — chỉ khác `cfg` + `stage`.
 *  - Công nhân báo sản lượng → lô AWAITING_QC → hiện ở đây (mỗi lô = 1 dòng duyệt).
 *  - KCS duyệt (đạt / sửa được / cấp lại) → reviewProductionBatch → lô sang QC_DONE
 *    (chỉ phần ĐẠT tính "đã hàn/đã sơn" bên Lệnh sản xuất).
 *
 * Regression đã biết so với mock san-luong.service.ts: DTO thật không giữ lại kcsFailedQty/kcsAt
 * sau khi duyệt (ProductionBatch.reportedQty bị ghi đè thành passed-qty ngay trong service) — lịch
 * sử mỗi lô chỉ còn đúng mốc "báo", mất mốc "duyệt: X lỗi". Không chặn gì (xem plan M3); có thể bổ
 * sung sau bằng cách join thêm GET /qc-reviews theo productionBatchId nếu cần.
 */

import { useMemo } from 'react'
import { KcsTwoTierScreen, type KcsRow, type KcsLine, type ReviewPayload } from '../../../components/sanxuat/kcsCore'
import type { StageCfg } from '../../../components/sanxuat/core'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeProductionBatch, ProductionBatchStage } from '../../../services/production-batches-api'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import LoadingState from '../../../components/LoadingState'

export default function KcsStagePage({ cfg, stage }: { cfg: StageCfg; stage: ProductionBatchStage }) {
  const { data: batches, isLoading, refetch } = useFetch<BeProductionBatch[]>(() => api.getProductionBatchesByStage(stage), [stage])

  // Gom lô theo PO (chỉ PO còn hàng chờ); mỗi lô = 1 dòng: chờ / đã duyệt.
  const { rows, map } = useMemo(() => {
    const map = new Map<number, string>()
    const byPo = new Map<string, BeProductionBatch[]>()
    const order: string[] = []
    for (const b of batches ?? []) {
      if (!byPo.has(b.poNumber)) { byPo.set(b.poNumber, []); order.push(b.poNumber) }
      byPo.get(b.poNumber)!.push(b)
    }
    let seq = 1
    const rows: KcsRow[] = []
    for (const po of order) {
      const list = byPo.get(po)!
      if (!list.some(b => b.status === 'AWAITING_QC')) continue   // chỉ PO còn hàng chờ
      const lines: KcsLine[] = list.map(b => {
        const lineId = seq++
        const pending = b.status === 'AWAITING_QC'
        if (pending) map.set(lineId, b.id)
        const history: AuditLogEntry[] = pending
          ? [{
            id: `${b.id}-rep`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.reported',
            actorName: `Tổ ${cfg.label}`, at: b.reportedAt, note: `Báo ${b.reportedQty} ${cfg.unit} · ${b.pieceName}`,
          }]
          : [{
            id: `${b.id}-done`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.approved',
            actorName: 'KCS', at: b.reportedAt, note: `Duyệt: ${b.reportedQty} đạt · ${b.pieceName}`,
          }]
        return {
          id: lineId, itemName: b.pieceName, spec: `${b.pieceCode} · lô ${b.reportedAt}`,
          needQty: b.reportedQty, doneQty: 0,
          pendingQty: pending ? b.reportedQty : 0,
          approvedQty: pending ? 0 : b.reportedQty,
          failedQty: 0,
          lastInputAt: b.reportedAt, history,
        }
      })
      const baoLuc = list.filter(b => b.status === 'AWAITING_QC').map(b => b.reportedAt).sort()[0] ?? list[0].reportedAt
      rows.push({
        id: rows.length + 1, poNumber: po, sku: po, productName: po,
        soLuong: lines.reduce((s, l) => s + l.pendingQty, 0), deadline: baoLuc, arrangedAt: baoLuc, lines,
      })
    }
    return { rows, map }
  }, [batches, cfg.label, cfg.unit])

  if (isLoading || !batches) return <LoadingState />

  const onReview = async (_poId: number, lineId: number, p: ReviewPayload) => {
    const id = map.get(lineId)
    if (!id) return
    await api.reviewProductionBatch(id, {
      failedQty: p.failedQty,
      scrapQty: p.scrapQty,
      reason: p.reviewNote,
      defectReasonId: p.defectReasonId ? String(p.defectReasonId) : undefined,
      photoUrl: p.defectPhotoUrl,
    })
    refetch()
  }

  return <KcsTwoTierScreen cfg={cfg} rows={rows} onReview={onReview} showFailMode />
}
