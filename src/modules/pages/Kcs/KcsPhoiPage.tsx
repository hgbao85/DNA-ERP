'use client'

/**
 * Màn hình KCS — Công đoạn PHÔI (2 tầng: PO → các đợt chờ kiểm).
 *
 * Đã nối BE thật (M3, 2026-08-12 — "Xuất sắt Phôi", trước đó bị hoãn): module `steel-issues`/
 * `qc-reviews`, thay `phoi-sat.service.ts` mock (key theo `lineId` giả). Cùng cấu trúc
 * KcsStagePage.tsx (Hàn/Sơn) — controlled KcsTwoTierScreen, chỉ khác nguồn dữ liệu.
 *
 * SteelIssue KHÔNG tự ghi đè số liệu duyệt sau qc-review (khác ProductionBatch.reportedQty) nên
 * phải join thêm GET /qc-reviews (getQcReviewsForSteelIssues) để dựng lại "đạt/lỗi" cho các đợt
 * QC_PASSED — xem comment steel-issues-api.ts.
 */

import { useMemo } from 'react'
import { Wrench } from 'lucide-react'
import { KcsTwoTierScreen, type KcsRow, type KcsLine, type ReviewPayload } from '../../../components/sanxuat/kcsCore'
import type { StageCfg } from '../../../components/sanxuat/core'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue, BeQcReview } from '../../../services/steel-issues-api'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import LoadingState from '../../../components/LoadingState'

const CFG: StageCfg = { label: 'Phôi', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Loại sắt', unit: 'cây', Icon: Wrench }

export default function KcsPhoiPage() {
  const { data: issues, isLoading, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const { data: reviews } = useFetch<BeQcReview[]>(() => api.getQcReviewsForSteelIssues(), [])

  // Gom lô theo PO (chỉ PO còn hàng chờ); mỗi đợt = 1 dòng: chờ / đã duyệt.
  // map: id dòng (số) → id đợt (chuỗi) — chỉ lô AWAITING_QC mới duyệt được.
  const { rows, map } = useMemo(() => {
    const reviewByIssue = new Map<string, BeQcReview>()
    for (const r of reviews ?? []) if (r.steelIssueId) reviewByIssue.set(r.steelIssueId, r)

    const map = new Map<number, string>()
    // Gom theo productionOrderId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode -
    // nhiều lệnh SX có thể cùng chung 1 mã Sales (nhiều SKU/đơn) hoặc cùng null.
    const byPo = new Map<string, BeSteelIssue[]>()
    const order: string[] = []
    for (const i of issues ?? []) {
      if (i.status !== 'AWAITING_QC' && i.status !== 'QC_PASSED') continue // Phôi chưa cắt xong → chưa liên quan KCS
      if (!byPo.has(i.productionOrderId)) { byPo.set(i.productionOrderId, []); order.push(i.productionOrderId) }
      byPo.get(i.productionOrderId)!.push(i)
    }
    let seq = 1
    const rows: KcsRow[] = []
    for (const productionOrderId of order) {
      const list = byPo.get(productionOrderId)!
      const po = list[0].salesOrderCode ?? '—'
      if (!list.some(i => i.status === 'AWAITING_QC')) continue   // chỉ PO còn hàng chờ
      const lines: KcsLine[] = list.map(i => {
        const lineId = seq++
        const pending = i.status === 'AWAITING_QC'
        if (pending) map.set(lineId, i.id)
        const baoCat = i.actualBarCount ?? i.barCount
        const review = reviewByIssue.get(i.id)
        const failed = review?.failedQty ?? 0
        const passed = baoCat - failed
        const history: AuditLogEntry[] = [{
          id: `${i.id}-iss`, entityType: 'kcs-lo', entityId: i.id, action: 'kcs.issued',
          actorName: i.issuedById, at: i.issuedAt,
          note: i.reworkOfId ? `Tạo lại do KCS bắt làm lại · ${i.barCount} cây` : `Kho xuất ${i.barCount} cây ${i.materialName}`,
        }]
        if (i.completedAt) history.push({
          id: `${i.id}-rep`, entityType: 'kcs-lo', entityId: i.id, action: 'kcs.reported',
          actorName: 'Tổ Phôi', at: i.completedAt, note: `Xác nhận cắt xong ${baoCat} cây`,
        })
        if (i.status === 'QC_PASSED' && review) history.push({
          id: `${i.id}-kcs`, entityType: 'kcs-lo', entityId: i.id, action: 'kcs.approved',
          actorName: 'KCS', at: review.reviewedAt, note: `Duyệt: ${passed} đạt${failed > 0 ? ` · ${failed} lỗi` : ''}`,
        })
        return {
          id: lineId,
          itemName: `${i.materialName}`,
          spec: `đợt ${i.completedAt ?? i.issuedAt} · ${i.barLengthMm.toLocaleString('vi-VN')}mm`,
          needQty: baoCat, doneQty: 0,
          pendingQty: pending ? baoCat : 0,
          approvedQty: i.status === 'QC_PASSED' ? passed : 0,
          failedQty: i.status === 'QC_PASSED' ? failed : 0,
          lastInputAt: i.completedAt ?? i.issuedAt, history,
        }
      })
      const pendList = list.filter(i => i.status === 'AWAITING_QC')
      const baoLuc = pendList.map(i => i.completedAt ?? i.issuedAt).sort()[0] ?? list[0].issuedAt
      rows.push({
        id: rows.length + 1, poNumber: po, sku: po, productName: po,
        soLuong: lines.reduce((s, l) => s + l.pendingQty, 0), deadline: baoLuc, arrangedAt: baoLuc, lines,
      })
    }
    return { rows, map }
  }, [issues, reviews])

  if (isLoading || !issues) return <LoadingState />

  const onReview = async (_poId: number, lineId: number, p: ReviewPayload) => {
    const issueId = map.get(lineId)
    if (!issueId) return
    await api.reviewSteelIssueQc(issueId, {
      failedQty: p.failedQty,
      scrapQty: p.scrapQty,
      defectReasonId: p.defectReasonId ? String(p.defectReasonId) : undefined,
      reason: p.reviewNote,
      photoUrl: p.defectPhotoUrl,
    })
    refetch()
  }

  return <KcsTwoTierScreen cfg={CFG} rows={rows} onReview={onReview} showFailMode />
}
