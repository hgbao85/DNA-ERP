'use client'

/**
 * Màn hình KCS — công đoạn Hàn/Sơn (controlled, đọc/ghi production-batches/qc-reviews thật).
 * Dùng chung cho KcsHanPage & KcsSonPage — chỉ khác `cfg` + `stage`.
 *  - Công nhân báo sản lượng → lô AWAITING_QC → hiện ở đây (mỗi lô = 1 dòng duyệt).
 *  - KCS duyệt (Đạt/Không đạt) → reviewProductionBatch → lô sang QC_DONE (chỉ phần ĐẠT tính "đã
 *    hàn/đã sơn" bên Lệnh sản xuất).
 *
 * Đơn giản hoá 2026-09-08 lần 2 (xem changelog "Bù đủ dồn về bảng tổng"): bỏ hẳn phân loại "Sửa
 * được/Phế" + cơ chế "Bù đủ → KCS duyệt lại" (report-done/recheck) - "Lỗi" giờ là số lịch sử cộng
 * dồn hiện ở cột "Lỗi", Bù đủ chỉ là 1 lô HOÀN TOÀN MỚI gửi duyệt lại bình thường (không còn "Duyệt
 * lại"/`enableBuDu` riêng cho VTTP nữa - CHỈ VTTP mới có sub-row PieceStepBundle, đổi tên prop
 * `enableBuDu` → `showPieceSteps` cho đúng ý nghĩa còn lại).
 *
 * Regression đã biết so với mock san-luong.service.ts: DTO thật không giữ lại kcsFailedQty/kcsAt
 * sau khi duyệt (ProductionBatch.reportedQty bị ghi đè thành passed-qty ngay trong service) — lịch
 * sử mỗi lô chỉ còn đúng mốc "báo", mất mốc "duyệt: X lỗi". Không chặn gì (xem plan M3); có thể bổ
 * sung sau bằng cách join thêm GET /qc-reviews theo productionBatchId nếu cần.
 */

import { useMemo } from 'react'
import { KcsTwoTierScreen, type KcsRow, type KcsLine, type ReviewPayload } from '../../../components/sanxuat/kcsCore'
import { timeVN, type StageCfg } from '../../../components/sanxuat/core'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BePieceStepBundle, BeProductionBatch, ProductionBatchStage } from '../../../services/production-batches-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import LoadingState from '../../../components/LoadingState'

/** Đích của 1 dòng KCS - "chốt cuối" (ProductionBatch) hoặc "theo công đoạn" (PieceStepBundle,
 *  2026-09-07) - cần phân biệt để gọi ĐÚNG API duyệt (2 nhánh QcReview khác nhau, xem
 *  PieceStepBundle doc comment BE). */
type LineTarget = { kind: 'batch'; id: string } | { kind: 'step'; id: string }

export default function KcsStagePage({ cfg, stage, showPieceSteps }: {
  cfg: StageCfg; stage: ProductionBatchStage
  /** Hiện sub-row PieceStepBundle (theo công đoạn) gộp chung bảng với ProductionBatch (2026-09-07)
   *  - CHỈ VTTP có dữ liệu này (xem KcsVatTuThanhPhamPage.tsx), Hàn/Sơn không truyền prop này. */
  showPieceSteps?: boolean
}) {
  const { data: batches, isLoading, refetch } = useFetch<BeProductionBatch[]>(() => api.getProductionBatchesByStage(stage), [stage])
  // "Lỗi" ở cột bảng tổng là Σ QcReview.failedQty CỘNG DỒN LỊCH SỬ (2026-09-08 lần 2) - fetch cho
  // MỌI stage (không còn gate theo showPieceSteps như "Bù đủ" cũ, cột Lỗi hiện đồng nhất mọi nơi).
  const { data: reviews, refetch: refetchReviews } = useFetch(() => api.getQcReviewsForProductionBatches(), [])
  // Đợt gửi KCS theo TỪNG CÔNG ĐOẠN (2026-09-07, chỉ VTTP - showPieceSteps) - gộp CHUNG bảng với
  // ProductionBatch cùng PO, phân biệt bằng nhãn "· {Công đoạn}" ở cột Quy cách.
  const { data: bundles, refetch: refetchBundles } = useFetch<BePieceStepBundle[]>(
    () => showPieceSteps ? api.getPieceStepBundles() : Promise.resolve([]), [showPieceSteps],
  )

  // Gom lô theo PO (chỉ PO còn hàng chờ); mỗi lô = 1 dòng: chờ / đã duyệt. Gom theo
  // productionOrderId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode - nhiều
  // ProductionOrder có thể cùng chung 1 salesOrderCode (nhiều SKU/đơn), hoặc cùng null (SKU
  // không gắn đơn Sales nào) - gom theo mã hiển thị sẽ gộp nhầm các lô khác nhau vào 1 dòng.
  const { rows, map } = useMemo(() => {
    const map = new Map<number, LineTarget>()
    // Lô có thể có NHIỀU review qua các lần duyệt/bù đủ (mỗi lần bù đủ = 1 lô MỚI, mỗi lô ứng
    // ĐÚNG 1 review) - Σ failedQty của mọi lô thuộc cùng PO/mảnh mới là số "Lỗi" lịch sử hiển thị.
    const reviewByBatch = new Map<string, NonNullable<typeof reviews>[number]>()
    for (const r of reviews ?? []) {
      if (!r.productionBatchId) continue
      reviewByBatch.set(r.productionBatchId, r)
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
      // 2026-09-10 (theo yêu cầu người dùng): màn KCS LUÔN hiện mã PI (lệnh sản xuất nội bộ KCS
      // đang kiểm), KHÔNG hiện mã PO (đơn hàng Sales) - trước đây ưu tiên PO nếu có, dễ nhầm với
      // "PO" ở màn Mua hàng/Kho (2 mã khác nhau cùng gọi là "PO"). piCode luôn có giá trị thật
      // (ProductionOrder luôn sinh từ 1 ProductionInvoiceItem đã duyệt) - "—" chỉ là chốt an toàn.
      const po = batchList[0]?.piCode ?? bundleList[0]?.piCode ?? '—'
      const poHasWork =
        batchList.some(b => b.status === 'AWAITING_QC') || bundleList.some(bd => bd.status === 'AWAITING_QC')
      if (!poHasWork) continue   // chỉ PO còn việc

      const batchLines: KcsLine[] = batchList.map(b => {
        const lineId = seq++
        const pending = b.status === 'AWAITING_QC'
        map.set(lineId, { kind: 'batch', id: b.id })
        const review = reviewByBatch.get(b.id)
        // Đính kèm lý do + ảnh lỗi thật vào entry "kcs.approved" (2026-09-11, QA audit B4) - trước
        // đây review.photoUrl/reason bị bỏ qua hoàn toàn, ảnh KCS chụp lúc chấm "Không đạt" không
        // hiển thị lại được ở bất kỳ đâu.
        const doneNote = review?.reason
          ? `Duyệt: ${b.reportedQty} đạt · ${b.pieceName} · lý do không đạt: ${review.reason}`
          : `Duyệt: ${b.reportedQty} đạt · ${b.pieceName}`
        const history: AuditLogEntry[] = pending
          ? [{
            id: `${b.id}-rep`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.reported',
            actorName: `Tổ ${cfg.label}`, at: b.reportedAt, note: `Báo ${b.reportedQty} ${cfg.unit} · ${b.pieceName}`,
          }]
          : [{
            id: `${b.id}-done`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.approved',
            actorName: 'KCS', at: b.reportedAt, note: doneNote, photoUrl: review?.photoUrl ?? undefined,
          }]
        return {
          id: lineId, itemName: b.pieceName, spec: `${b.pieceCode} · lô ${timeVN(b.reportedAt)}`,
          needQty: b.reportedQty, doneQty: 0,
          pendingQty: pending ? b.reportedQty : 0,
          approvedQty: pending ? 0 : b.reportedQty,
          failedQty: review?.failedQty ?? 0,
          lastInputAt: b.reportedAt, history,
        }
      })

      const bundleLines: KcsLine[] = bundleList.map(bd => {
        const lineId = seq++
        const pending = bd.status === 'AWAITING_QC'
        map.set(lineId, { kind: 'step', id: bd.id })
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
          id: lineId, itemName: bd.pieceName, spec: `${bd.pieceCode} · ${stepLabel} · lô ${timeVN(bd.submittedAt)}`,
          needQty: bd.qty, doneQty: 0,
          pendingQty: pending ? bd.qty : 0,
          approvedQty: pending ? 0 : bd.qty,
          // Lỗi công đoạn hiện ở bảng tổng VatTuTpDetail.tsx (StepPanel), không cần lặp lại ở đây.
          failedQty: 0,
          lastInputAt: bd.submittedAt, history,
        }
      })

      const lines = [...batchLines, ...bundleLines]
      const baoLuc = [
        ...batchList.filter(b => b.status === 'AWAITING_QC').map(b => b.reportedAt),
        ...bundleList.filter(bd => bd.status === 'AWAITING_QC').map(bd => bd.submittedAt),
      ].sort()[0] ?? batchList[0]?.reportedAt ?? bundleList[0]?.submittedAt
      rows.push({
        // id PHẢI ổn định theo productionOrderId (KHÔNG dùng rows.length+1/vị trí mảng) - PI vừa
        // duyệt hết lô cuối sẽ bị lọc khỏi `order` (poHasWork=false) ở lần refetch kế tiếp, làm các
        // PI sau đó dịch chỉ số và "thừa hưởng" id cũ. selPoId ở KcsTwoTierScreen (kcsCore.tsx) giữ
        // nguyên id cũ đó qua refetch → sau khi duyệt xong 1 PI, tự "nhảy" sang xem nhầm PI khác vừa
        // chiếm đúng id đó (2026-09-10, người dùng phát hiện: duyệt xong PI-2026-024 tự nhảy vào
        // chi tiết PI-2026-022).
        id: Number(productionOrderId), poNumber: po, sku: po, productName: po,
        soLuong: lines.reduce((s, l) => s + l.pendingQty, 0), deadline: baoLuc, arrangedAt: baoLuc, lines,
      })
    }
    return { rows, map }
  }, [batches, reviews, bundles, cfg.label, cfg.unit])

  if (isLoading || !batches) return <LoadingState />

  // onReview giờ được KcsTwoTierScreen.review() (kcsCore.tsx) await ĐÚNG NGHĨA (2026-09-11, QA
  // audit sửa cùng lúc) - KHÔNG còn tự bắt lỗi/alert ở đây nữa, để lỗi ném thẳng lên tới
  // KcsReviewModal.submit() hiện inline + GIỮ NGUYÊN modal (không mất dữ liệu vừa nhập) thay vì
  // đóng modal ngay rồi alert() rời rạc vài trăm ms sau (hành vi cũ, dễ hiểu nhầm "đã duyệt" xong
  // dù backend vừa từ chối, vd PI chưa "Bắt đầu"/đã "Kết thúc", 2026-08-31).
  const onReview = async (_poId: number, lineId: number, p: ReviewPayload) => {
    const target = map.get(lineId)
    if (!target) return
    const dto = {
      failedQty: p.failedQty,
      reason: p.reviewNote,
      defectReasonId: p.defectReasonId ? String(p.defectReasonId) : undefined,
      photoUrl: p.defectPhotoUrl,
    }
    if (target.kind === 'batch') {
      await api.reviewProductionBatch(target.id, dto)
      refetch(); refetchReviews()
    } else {
      await api.reviewPieceStepQc(target.id, dto)
      refetchBundles()
    }
  }

  return <KcsTwoTierScreen cfg={cfg} rows={rows} onReview={onReview} />
}
