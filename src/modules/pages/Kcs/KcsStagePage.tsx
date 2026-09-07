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
import type { BePieceStepBundle, BeProductionBatch, ProductionBatchStage } from '../../../services/production-batches-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import LoadingState from '../../../components/LoadingState'
import { errMsg } from '../../../utils/errors'

/** Đích của 1 dòng KCS - "chốt cuối" (ProductionBatch) hoặc "theo công đoạn" (PieceStepBundle,
 *  2026-09-07) - cần phân biệt để gọi ĐÚNG API duyệt/recheck (2 nhánh QcReview khác nhau, xem
 *  PieceStepBundle doc comment BE). */
type LineTarget = { kind: 'batch'; id: string } | { kind: 'step'; id: string }

export default function KcsStagePage({ cfg, stage, enableBuDu }: { cfg: StageCfg; stage: ProductionBatchStage; enableBuDu?: boolean }) {
  const { data: batches, isLoading, refetch } = useFetch<BeProductionBatch[]>(() => api.getProductionBatchesByStage(stage), [stage])
  // "Bù đủ" (2026-09-07) chỉ nhánh productionBatchId - xem QcReview.resolvedQty doc BE. Chỉ fetch
  // khi enableBuDu bật (VTTP) - Hàn/Sơn không cần, tránh gọi API thừa.
  const { data: reviews, refetch: refetchReviews } = useFetch(() => enableBuDu ? api.getQcReviewsForProductionBatches() : Promise.resolve([]), [enableBuDu])
  // Đợt gửi KCS theo TỪNG CÔNG ĐOẠN (2026-09-07, chỉ VTTP - enableBuDu) - gộp CHUNG bảng với
  // ProductionBatch cùng PO, phân biệt bằng nhãn "· {Công đoạn}" ở cột Quy cách.
  const { data: bundles, refetch: refetchBundles } = useFetch<BePieceStepBundle[]>(
    () => enableBuDu ? api.getPieceStepBundles() : Promise.resolve([]), [enableBuDu],
  )
  const { data: bundleReviews, refetch: refetchBundleReviews } = useFetch(
    () => enableBuDu ? api.getQcReviewsForPieceStepBundles() : Promise.resolve([]), [enableBuDu],
  )

  // Gom lô theo PO (chỉ PO còn hàng chờ); mỗi lô = 1 dòng: chờ / đã duyệt. Gom theo
  // productionOrderId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode - nhiều
  // ProductionOrder có thể cùng chung 1 salesOrderCode (nhiều SKU/đơn), hoặc cùng null (SKU
  // không gắn đơn Sales nào) - gom theo mã hiển thị sẽ gộp nhầm các lô khác nhau vào 1 dòng.
  const { rows, map } = useMemo(() => {
    const map = new Map<number, LineTarget>()
    // Lô có thể có NHIỀU review qua các lần duyệt/bù đủ - lấy bản MỚI NHẤT theo reviewedAt (khớp
    // findAll() BE orderBy reviewedAt desc, nhưng sort lại cho chắc vì đây fetch limit=100 chung).
    const reviewByBatch = new Map<string, NonNullable<typeof reviews>[number]>()
    for (const r of reviews ?? []) {
      if (!r.productionBatchId) continue
      const cur = reviewByBatch.get(r.productionBatchId)
      if (!cur || r.reviewedAt > cur.reviewedAt) reviewByBatch.set(r.productionBatchId, r)
    }
    const reviewByBundle = new Map<string, NonNullable<typeof bundleReviews>[number]>()
    for (const r of bundleReviews ?? []) {
      if (!r.pieceStepBundleId) continue
      const cur = reviewByBundle.get(r.pieceStepBundleId)
      if (!cur || r.reviewedAt > cur.reviewedAt) reviewByBundle.set(r.pieceStepBundleId, r)
    }

    // Gom CẢ 2 nguồn (ProductionBatch + PieceStepBundle) vào CHUNG danh sách theo PO - KCS xem 1
    // bảng duy nhất/PO, không tách 2 màn (mỗi công đoạn của cùng PO thường xong rải rác khác thời
    // điểm nhau từ khi bỏ ràng buộc thứ tự, xem PieceStepBundle doc comment BE).
    const byPo = new Map<string, { batches: BeProductionBatch[]; bundles: BePieceStepBundle[] }>()
    const order: string[] = []
    const ensurePo = (id: string) => {
      if (!byPo.has(id)) { byPo.set(id, { batches: [], bundles: [] }); order.push(id) }
      return byPo.get(id)!
    }
    for (const b of batches ?? []) ensurePo(b.productionOrderId).batches.push(b)
    for (const bd of bundles ?? []) ensurePo(bd.productionOrderId).bundles.push(bd)

    let seq = 1
    const rows: KcsRow[] = []
    for (const productionOrderId of order) {
      const { batches: batchList, bundles: bundleList } = byPo.get(productionOrderId)!
      const po = batchList[0]?.salesOrderCode ?? bundleList[0]?.salesOrderCode ?? '—'
      const hasOutstanding = (rv: { failedQty: number; scrapQty: number | null; resolvedQty: number } | undefined) =>
        !!rv && rv.failedQty - (rv.scrapQty ?? 0) - rv.resolvedQty > 0
      const poHasWork =
        batchList.some(b => b.status === 'AWAITING_QC' || hasOutstanding(reviewByBatch.get(b.id)))
        || bundleList.some(bd => bd.status === 'AWAITING_QC' || hasOutstanding(reviewByBundle.get(bd.id)))
      if (!poHasWork) continue   // chỉ PO còn việc

      const batchLines: KcsLine[] = batchList.map(b => {
        const lineId = seq++
        const pending = b.status === 'AWAITING_QC'
        map.set(lineId, { kind: 'batch', id: b.id })   // luôn map, kể cả QC_DONE - cần cho "Duyệt lại"
        const review = reviewByBatch.get(b.id)
        const outstandingQty = review ? Math.max(0, review.failedQty - (review.scrapQty ?? 0) - review.resolvedQty) : 0
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
          failedQty: review?.failedQty ?? 0,
          outstandingQty, phoiReportedAt: review?.phoiReportedAt ?? null, phoiReportedQty: review?.phoiReportedQty ?? null,
          lastInputAt: b.reportedAt, history,
        }
      })

      const bundleLines: KcsLine[] = bundleList.map(bd => {
        const lineId = seq++
        const pending = bd.status === 'AWAITING_QC'
        map.set(lineId, { kind: 'step', id: bd.id })
        const review = reviewByBundle.get(bd.id)
        const outstandingQty = review ? Math.max(0, review.failedQty - (review.scrapQty ?? 0) - review.resolvedQty) : 0
        const stepLabel = PROCESS_STEP_LABELS[bd.step]
        const history: AuditLogEntry[] = pending
          ? [{
            id: `${bd.id}-rep`, entityType: 'kcs-lo', entityId: bd.id, action: 'kcs.reported',
            actorName: `Tổ ${cfg.label}`, at: bd.submittedAt, note: `Gửi KCS ${stepLabel}: ${bd.qty} · ${bd.pieceName}`,
          }]
          : [{
            id: `${bd.id}-done`, entityType: 'kcs-lo', entityId: bd.id, action: 'kcs.approved',
            actorName: 'KCS', at: bd.submittedAt, note: `Duyệt ${stepLabel}: ${bd.qty} đạt · ${bd.pieceName}`,
          }]
        return {
          id: lineId, itemName: bd.pieceName, spec: `${bd.pieceCode} · ${stepLabel} · lô ${bd.submittedAt}`,
          needQty: bd.qty, doneQty: 0,
          pendingQty: pending ? bd.qty : 0,
          approvedQty: pending ? 0 : bd.qty,
          failedQty: review?.failedQty ?? 0,
          outstandingQty, phoiReportedAt: review?.phoiReportedAt ?? null, phoiReportedQty: review?.phoiReportedQty ?? null,
          lastInputAt: bd.submittedAt, history,
          // Mirror Phôi/Sắt (2026-09-07, Sếp Trương Văn Nhân): CHỈ Đạt/Không đạt, không tách sửa
          // được/phế - xem KcsLine.showFailMode doc comment (kcsCore.tsx).
          showFailMode: false,
        }
      })

      const lines = [...batchLines, ...bundleLines]
      const baoLuc = [
        ...batchList.filter(b => b.status === 'AWAITING_QC').map(b => b.reportedAt),
        ...bundleList.filter(bd => bd.status === 'AWAITING_QC').map(bd => bd.submittedAt),
      ].sort()[0] ?? batchList[0]?.reportedAt ?? bundleList[0]?.submittedAt
      rows.push({
        id: rows.length + 1, poNumber: po, sku: po, productName: po,
        soLuong: lines.reduce((s, l) => s + l.pendingQty, 0), deadline: baoLuc, arrangedAt: baoLuc, lines,
      })
    }
    return { rows, map }
  }, [batches, reviews, bundles, bundleReviews, cfg.label, cfg.unit])

  if (isLoading || !batches) return <LoadingState />

  // onReview truyền qua KcsTwoTierScreen (kcsCore.tsx) không await/catch promise trả về (fire-and-
  // forget) - phải tự bắt lỗi ở đây, nếu không lỗi backend (vd PI chưa "Bắt đầu"/đã "Kết thúc",
  // 2026-08-31) sẽ rớt thành unhandled rejection, KCS bấm duyệt không thấy phản hồi gì cả.
  const onReview = async (_poId: number, lineId: number, p: ReviewPayload) => {
    const target = map.get(lineId)
    if (!target) return
    const dto = {
      failedQty: p.failedQty,
      scrapQty: p.scrapQty,
      reason: p.reviewNote,
      defectReasonId: p.defectReasonId ? String(p.defectReasonId) : undefined,
      photoUrl: p.defectPhotoUrl,
    }
    try {
      if (target.kind === 'batch') {
        await api.reviewProductionBatch(target.id, dto)
        refetch(); refetchReviews()
      } else {
        await api.reviewPieceStepQc(target.id, dto)
        refetchBundles(); refetchBundleReviews()
      }
    } catch (e) {
      alert(errMsg(e, 'Không duyệt được'))
    }
  }

  const onRecheck = async (_poId: number, lineId: number, remainingFailedQty: number) => {
    const target = map.get(lineId)
    if (!target) return
    try {
      if (target.kind === 'batch') {
        await api.recheckProductionBatchQc(target.id, remainingFailedQty)
        refetch(); refetchReviews()
      } else {
        await api.recheckPieceStepQc(target.id, remainingFailedQty)
        refetchBundles(); refetchBundleReviews()
      }
    } catch (e) {
      alert(errMsg(e, 'Không duyệt lại được'))
    }
  }

  return (
    <KcsTwoTierScreen
      cfg={cfg} rows={rows} onReview={onReview} showFailMode
      enableBuDu={enableBuDu} onRecheck={enableBuDu ? onRecheck : undefined}
    />
  )
}
