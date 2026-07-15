'use client'

/**
 * Màn hình KCS — công đoạn Hàn/Sơn (controlled, đọc/ghi san-luong.service thật).
 * Dùng chung cho KcsHanPage & KcsSonPage — chỉ khác `cfg` + `stage`.
 *  - Công nhân báo sản lượng → lô CHO_KCS → hiện ở đây (mỗi lô = 1 dòng duyệt).
 *  - KCS duyệt (đạt / sửa được / cấp lại) → kcsDuyetStage → lô sang DA_CAT
 *    (chỉ phần ĐẠT tính "đã hàn/đã sơn" bên Lệnh sản xuất).
 */

import { useMemo } from 'react'
import { KcsTwoTierScreen, type KcsRow, type KcsLine, type ReviewPayload } from '../../../components/sanxuat/kcsCore'
import type { StageCfg } from '../../../components/sanxuat/core'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { SanLuongBatch, SanLuongStage } from '../../../services/api'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import LoadingState from '../../../components/LoadingState'

export default function KcsStagePage({ cfg, stage }: { cfg: StageCfg; stage: SanLuongStage }) {
  const { data: batches, isLoading, refetch } = useFetch<SanLuongBatch[]>(() => api.getSanLuongByStage(stage), [stage])

  // Gom lô theo PO (chỉ PO còn hàng chờ); mỗi lô = 1 dòng: chờ / đã duyệt / lỗi.
  const { rows, map } = useMemo(() => {
    const map = new Map<number, string>()
    const byPo = new Map<string, SanLuongBatch[]>()
    const order: string[] = []
    for (const b of batches ?? []) {
      if (!byPo.has(b.poNumber)) { byPo.set(b.poNumber, []); order.push(b.poNumber) }
      byPo.get(b.poNumber)!.push(b)
    }
    let seq = 1
    const rows: KcsRow[] = []
    for (const po of order) {
      const list = byPo.get(po)!
      if (!list.some(b => b.status === 'CHO_KCS')) continue   // chỉ PO còn hàng chờ
      const lines: KcsLine[] = list.map(b => {
        const lineId = seq++
        const pending = b.status === 'CHO_KCS'
        if (pending) map.set(lineId, b.id)
        const failed = b.kcsFailedQty ?? 0
        const bao = b.qty + (b.status === 'DA_CAT' ? failed : 0)
        const history: AuditLogEntry[] = [{
          id: `${b.id}-rep`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.reported',
          actorName: `Tổ ${cfg.label}`, at: b.reportedAt, note: `Báo ${bao} ${cfg.unit} · ${b.itemName}`,
        }]
        if (b.status === 'DA_CAT' && b.kcsAt) history.push({
          id: `${b.id}-kcs`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.approved',
          actorName: 'KCS', at: b.kcsAt, note: `Duyệt: ${b.qty} đạt${failed > 0 ? ` · ${failed} lỗi` : ''}`,
        })
        return {
          id: lineId, itemName: b.itemName, spec: `${b.spec} · lô ${b.reportedAt}`,
          needQty: bao, doneQty: 0,
          pendingQty: pending ? b.qty : 0,
          approvedQty: b.status === 'DA_CAT' ? b.qty : 0,
          failedQty: b.status === 'DA_CAT' ? failed : 0,
          lastInputAt: b.reportedAt, history,
        }
      })
      const baoLuc = list.filter(b => b.status === 'CHO_KCS').map(b => b.reportedAt).sort()[0] ?? list[0].reportedAt
      rows.push({
        id: rows.length + 1, poNumber: po, sku: list[0].sku, productName: list[0].sku,
        soLuong: lines.reduce((s, l) => s + l.pendingQty, 0), deadline: baoLuc, arrangedAt: baoLuc, lines,
      })
    }
    return { rows, map }
  }, [batches])

  if (isLoading || !batches) return <LoadingState />

  const onReview = async (_poId: number, lineId: number, p: ReviewPayload) => {
    const id = map.get(lineId)
    if (!id) return
    await api.kcsDuyetStage(stage, id, { failedQty: p.failedQty, scrapQty: p.scrapQty, reason: p.reviewNote })
    refetch()
  }

  return <KcsTwoTierScreen cfg={cfg} rows={rows} onReview={onReview} showFailMode />
}
