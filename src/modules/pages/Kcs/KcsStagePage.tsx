'use client'

/**
 * Màn hình KCS — công đoạn Hàn/Sơn (controlled, đọc/ghi production-batches/qc-reviews thật).
 * Dùng chung cho KcsHanPage & KcsSonPage — chỉ khác `cfg` + `stage`.
 *  - Công nhân báo sản lượng → lô ĐANG MỞ (P1, 18/11/2026: KCS tự thấy, không còn chờ QLSX "Gửi KCS") → KCS bấm "Chấm":
 *    màn chốt lô (AWAITING_QC) rồi mở hộp chấm.
 *  - KCS chấm (Đạt/Không đạt + Thực có) → reviewProductionBatch → lô sang QC_DONE (chỉ phần ĐẠT tính "đã
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
 *
 * P1 (18/11/2026):
 *  - Dòng ĐANG MỞ lấy từ GET /floor/review (pieceBatches; VTTP thêm pieceStepGroups = pat). Dòng ĐÃ CHỐT (AWAITING_QC) lấy từ
 *    danh sách chấm có sẵn (review KHÔNG trả đợt đã chốt).
 *  - Dòng xám + khoá Chấm: đợt mở theo `blockedReason`; đợt đã chốt theo `stoppedPis` (so theo mã PI - lô / pat chỉ có piCode).
 *  - Pat: số đạt thật = Σ báo - lỗi - thiếu của lần chấm (không lấy qty).
 */

import { focusKey } from '../../../utils/notificationLink'
import { useMemo } from 'react'
import { KcsTwoTierScreen, type KcsRow, type KcsLine, type ReviewPayload, type OpenReviewResult } from '../../../components/sanxuat/kcsCore'
import { type StageCfg } from '../../../components/sanxuat/core'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import {
  closePieceStepGroup, closeProductionBatch, getKcsFloorReview, isKcsFloorForbidden,
} from '../../../services/kcs-floor-api'
import type { BePieceStepBundle, BePieceStepBundleQcReview, BeProductionBatch, ProductionBatchStage } from '../../../services/production-batches-api'
import { PROCESS_STEP_LABELS } from '../../../constants/processSteps'
import type { ProcessStep } from '../../../types/sku'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { useLenhCodeLookup } from '../../../components/LenhCode'
import { MSG_FORBIDDEN, isPiStopped, pickRowState, sumPendingQty } from './kcsReviewModel'

/** Đích của 1 dòng KCS - "chốt cuối" (ProductionBatch) hoặc "theo công đoạn" (PieceStepBundle,
 *  2026-09-07) - cần phân biệt để gọi ĐÚNG API duyệt (2 nhánh QcReview khác nhau, xem
 *  PieceStepBundle doc comment BE). `patGroup` = nhóm pat ĐANG MỞ (chưa có bundle): bấm Chấm thì chốt thành `step`. */
type LineTarget =
  | { kind: 'batch'; id: string }
  | { kind: 'step'; id: string }
  | { kind: 'patGroup'; productionOrderId: string; pieceId: string; step: string }

const REALTIME_TOPICS = ['production-batches', 'qc-reviews', 'production-orders', 'floor']

export default function KcsStagePage({ cfg, stage, showPieceSteps }: {
  cfg: StageCfg; stage: ProductionBatchStage
  /** Hiện sub-row PieceStepBundle (theo công đoạn) gộp chung bảng với ProductionBatch (2026-09-07)
   *  - CHỈ VTTP có dữ liệu này (xem KcsVatTuThanhPhamPage.tsx), Hàn/Sơn không truyền prop này. */
  showPieceSteps?: boolean
}) {
  const { data: batches, isLoading, error, refetch } = useFetch<BeProductionBatch[]>(() => api.getProductionBatchesByStage(stage), [stage])
  // "Lỗi" ở cột bảng tổng là Σ QcReview.failedQty CỘNG DỒN LỊCH SỬ (2026-09-08 lần 2) - fetch cho
  // MỌI stage (không còn gate theo showPieceSteps như "Bù đủ" cũ, cột Lỗi hiện đồng nhất mọi nơi).
  const { data: reviews, refetch: refetchReviews } = useFetch(() => api.getQcReviewsForProductionBatches(), [])
  // Đợt gửi KCS theo TỪNG CÔNG ĐOẠN (2026-09-07, chỉ VTTP - showPieceSteps) - gộp CHUNG bảng với
  // ProductionBatch cùng PO, phân biệt bằng nhãn "· {Công đoạn}" ở cột Quy cách.
  const { data: bundles, refetch: refetchBundles } = useFetch<BePieceStepBundle[]>(
    () => showPieceSteps ? api.getPieceStepBundles() : Promise.resolve([]), [showPieceSteps],
  )
  const { data: bundleReviews, refetch: refetchBundleReviews } = useFetch<BePieceStepBundleQcReview[]>(
    () => showPieceSteps ? api.getQcReviewsForPieceStepBundles() : Promise.resolve([]), [showPieceSteps],
  )
  // P1: đợt ĐANG MỞ + stoppedPis. 403 trả { forbidden } (không ném, không console.error); lỗi khác không làm vỡ màn - hiện câu báo.
  const { data: floorReview, error: floorReviewError, refetch: refetchFloorReview } = useFetch(() => getKcsFloorReview(stage), [stage])
  const refetchAll = () => { void refetch(); void refetchReviews(); void refetchBundles(); void refetchBundleReviews(); void refetchFloorReview() }
  // Sự kiện dồn dập (công nhân báo liên tục) gom 3 giây thành 1 lần tải lại.
  useRealtimeRefetch(REALTIME_TOPICS, refetchAll, { debounceMs: 3000 })

  const forbidden = floorReview != null && isKcsFloorForbidden(floorReview)
  const review = floorReview != null && !isKcsFloorForbidden(floorReview) ? floorReview : null

  // Gom lô theo PO (chỉ PO còn hàng chờ); mỗi lô = 1 dòng: chờ / đã duyệt. Gom theo
  // productionOrderId (luôn duy nhất) chứ KHÔNG theo mã hiển thị salesOrderCode - nhiều
  // ProductionOrder có thể cùng chung 1 salesOrderCode (nhiều SKU/đơn), hoặc cùng null (SKU
  // không gắn đơn Sales nào) - gom theo mã hiển thị sẽ gộp nhầm các lô khác nhau vào 1 dòng.
  const lenhOf = useLenhCodeLookup([
    ...(batches ?? []).map(b => b.piCode), ...(bundles ?? []).map(b => b.piCode),
    ...(review?.pieceBatches ?? []).map(b => b.pi?.code), ...(review?.pieceStepGroups ?? []).map(g => g.pi?.code),
  ])
  const rows = useMemo(() => {
    // Lô có thể có NHIỀU review qua các lần duyệt/bù đủ (mỗi lần bù đủ = 1 lô MỚI, mỗi lô ứng
    // ĐÚNG 1 review) - Σ failedQty của mọi lô thuộc cùng PO/mảnh mới là số "Lỗi" lịch sử hiển thị.
    const reviewByBatch = new Map<string, NonNullable<typeof reviews>[number]>()
    for (const r of reviews ?? []) {
      if (!r.productionBatchId) continue
      reviewByBatch.set(r.productionBatchId, r)
    }
    const reviewByBundle = new Map<string, BePieceStepBundleQcReview>()
    for (const r of bundleReviews ?? []) {
      if (r.pieceStepBundleId) reviewByBundle.set(r.pieceStepBundleId, r)
    }
    const stoppedPis = review?.stoppedPis
    // Gom CẢ các nguồn (lô đã chốt + pat đã chốt + lô / pat ĐANG MỞ) vào CHUNG danh sách theo PO - KCS xem 1
    // bảng duy nhất/PO, không tách màn (mỗi công đoạn của cùng PO thường xong rải rác khác thời
    // điểm nhau từ khi bỏ ràng buộc thứ tự, xem PieceStepBundle doc comment BE).
    interface PoBucket {
      batches: BeProductionBatch[]; bundles: BePieceStepBundle[]
      openBatches: NonNullable<typeof review>['pieceBatches']; openPats: NonNullable<NonNullable<typeof review>['pieceStepGroups']>
      piCode: string | null
    }
    const byPo = new Map<string, PoBucket>()
    const order: string[] = []
    const ensurePo = (id: string) => {
      if (!byPo.has(id)) { byPo.set(id, { batches: [], bundles: [], openBatches: [], openPats: [], piCode: null }); order.push(id) }
      return byPo.get(id)!
    }
    // Lô OPEN trong danh sách chấm có sẵn là đợt đang mở - lấy từ GET /floor/review (đủ blockedReason), không lẫn vào "đã duyệt".
    for (const b of batches ?? []) {
      if (b.status === 'OPEN') continue
      const po = ensurePo(b.productionOrderId); po.batches.push(b); po.piCode ??= b.piCode
    }
    for (const bd of bundles ?? []) {
      const po = ensurePo(bd.productionOrderId); po.bundles.push(bd); po.piCode ??= bd.piCode
    }
    for (const ob of review?.pieceBatches ?? []) {
      if (!ob.order) continue
      const po = ensurePo(ob.order.productionOrderId); po.openBatches.push(ob); po.piCode ??= ob.pi?.code ?? null
    }
    for (const og of review?.pieceStepGroups ?? []) {
      const po = ensurePo(og.productionOrderId); po.openPats.push(og); po.piCode ??= og.pi?.code ?? null
    }

    let seq = 1
    const out: KcsRow[] = []
    // Câu 4 (anh Nhân 24/11/2026, đảo cách ẩn 23/11): KCS chấm nốt đợt của SKU đã huỷ - không xám theo lệnh dừng, gắn nhãn.
    const cancelled = new Set(review?.cancelledOrderIds ?? [])
    for (const productionOrderId of order) {
      const orderCancelled = cancelled.has(productionOrderId)
      const { batches: batchList, bundles: bundleList, openBatches, openPats, piCode } = byPo.get(productionOrderId)!
      // 2026-09-10 (theo yêu cầu người dùng): màn KCS LUÔN hiện mã PI (lệnh sản xuất nội bộ KCS
      // đang kiểm), KHÔNG hiện mã PO (đơn hàng Sales) - trước đây ưu tiên PO nếu có, dễ nhầm với
      // "PO" ở màn Mua hàng/Kho (2 mã khác nhau cùng gọi là "PO"). piCode luôn có giá trị thật
      // (ProductionOrder luôn sinh từ 1 ProductionInvoiceItem đã duyệt) - "—" chỉ là chốt an toàn.
      const po = (lenhOf(piCode) || '—') + (orderCancelled ? ' (SKU đã huỷ)' : '')
      const poHasWork =
        batchList.some(b => b.status === 'AWAITING_QC') || bundleList.some(bd => bd.status === 'AWAITING_QC') ||
        openBatches.length > 0 || openPats.length > 0
      if (!poHasWork) continue   // chỉ PO còn việc

      // ── Dòng ĐANG MỞ ─────────────────────────────────────────────────────────────
      const openBatchLines: KcsLine[] = openBatches.map(ob => {
        const st = pickRowState({ phase: 'OPEN', blockedReason: ob.blockedReason })
        const history: AuditLogEntry[] = [{
          id: `${ob.productionBatchId}-rep`, entityType: 'kcs-lo', entityId: ob.productionBatchId, action: 'kcs.reported',
          actorName: ob.openedByName ?? `Tổ ${cfg.label}`, at: ob.openedAt, note: `Báo ${ob.reportedQty} ${cfg.unit} · ${ob.piece.name}`,
        }]
        const ref: LineTarget = { kind: 'batch', id: ob.productionBatchId }
        return {
          id: seq++, focusKey: focusKey('PRODUCTION_BATCH', ob.productionBatchId), itemName: ob.piece.name,
          spec: ob.openedByName ? `${ob.piece.code} · ${ob.openedByName}` : ob.piece.code,
          needQty: ob.reportedQty, doneQty: 0, pendingQty: ob.reportedQty, approvedQty: 0, failedQty: 0,
          lastInputAt: ob.openedAt, history,
          open: true, blockedMessage: st.message, ref, timeLabel: 'Báo lúc', timeAt: ob.waitingSince,
        }
      })
      const openPatLines: KcsLine[] = openPats.map(og => {
        const st = pickRowState({ phase: 'OPEN', blockedReason: og.blockedReason })
        const stepLabel = PROCESS_STEP_LABELS[og.step as ProcessStep] ?? og.step
        const history: AuditLogEntry[] = [{
          id: `pat-${og.productionOrderId}-${og.pieceId}-${og.step}`, entityType: 'kcs-lo', entityId: og.pieceId, action: 'kcs.reported',
          actorName: `Tổ ${cfg.label}`, at: og.waitingSince, note: `Báo ${stepLabel}: ${og.qty} · ${og.piece.name}`,
        }]
        const ref: LineTarget = { kind: 'patGroup', productionOrderId: og.productionOrderId, pieceId: og.pieceId, step: og.step }
        return {
          id: seq++, itemName: og.piece.name, spec: `${og.piece.code} · ${stepLabel}`,
          needQty: og.qty, doneQty: 0, pendingQty: og.qty, approvedQty: 0, failedQty: 0,
          lastInputAt: og.waitingSince, history,
          open: true, blockedMessage: st.message, ref, timeLabel: 'Báo lúc', timeAt: og.waitingSince,
        }
      })

      // ── Dòng ĐÃ CHỐT (chờ chấm) / đã chấm ────────────────────────────────────────
      // Đợt đã chốt xám theo stoppedPis (so theo mã PI), không theo blockedReason.
      const awaitingState = pickRowState({ phase: 'AWAITING_QC', piStopped: !orderCancelled && isPiStopped(stoppedPis, { code: piCode }) })
      const batchLines: KcsLine[] = batchList.map(b => {
        const lineId = seq++
        const pending = b.status === 'AWAITING_QC'
        const target: LineTarget = { kind: 'batch', id: b.id }
        const rv = reviewByBatch.get(b.id)
        // Đính kèm lý do + ảnh lỗi thật vào entry "kcs.approved" (2026-09-11, QA audit B4) - trước
        // đây review.photoUrl/reason bị bỏ qua hoàn toàn, ảnh KCS chụp lúc chấm "Không đạt" không
        // hiển thị lại được ở bất kỳ đâu.
        const doneNote = rv?.reason
          ? `Duyệt: ${b.reportedQty} đạt · ${b.pieceName} · lý do không đạt: ${rv.reason}`
          : `Duyệt: ${b.reportedQty} đạt · ${b.pieceName}`
        const history: AuditLogEntry[] = pending
          ? [{
            id: `${b.id}-rep`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.reported',
            actorName: `Tổ ${cfg.label}`, at: b.reportedAt, note: `Báo ${b.reportedQty} ${cfg.unit} · ${b.pieceName}`,
          }]
          : [{
            id: `${b.id}-done`, entityType: 'kcs-lo', entityId: b.id, action: 'kcs.approved',
            actorName: 'KCS', at: b.reportedAt, note: doneNote, photoUrl: rv?.photoUrl ?? undefined,
            // qcReviewId (2026-09-11 lần 2) - CHỈ có tác dụng khi có photoUrl (xem
            // AuditLogTimeline.EditPhotoActions) - cho phép người đã chấm review này tự sửa/xóa lại
            // ảnh, không cần đợi Admin.
            qcReviewId: rv?.id,
          }]
        return {
          id: lineId, focusKey: focusKey('PRODUCTION_BATCH', b.id), itemName: b.pieceName, spec: b.pieceCode,
          needQty: b.reportedQty, doneQty: 0,
          pendingQty: pending ? b.reportedQty : 0,
          approvedQty: pending ? 0 : b.reportedQty,
          failedQty: rv?.failedQty ?? 0,
          lastInputAt: b.reportedAt, history,
          ref: target, blockedMessage: pending ? awaitingState.message : null,
          timeLabel: pending ? 'Chốt lúc' : 'Báo lúc', timeAt: b.reportedAt,
        }
      })

      const bundleLines: KcsLine[] = bundleList.map(bd => {
        const lineId = seq++
        const pending = bd.status === 'AWAITING_QC'
        const target: LineTarget = { kind: 'step', id: bd.id }
        const stepLabel = PROCESS_STEP_LABELS[bd.step]
        // Số đạt thật của pat = Σ báo - lỗi - thiếu của lần chấm (KHÔNG phải qty).
        const rv = reviewByBundle.get(bd.id)
        const failed = rv?.failedQty ?? 0
        const passed = Math.max(0, bd.qty - failed - (rv?.shortQty ?? 0))
        const history: AuditLogEntry[] = pending
          ? [{
            id: `${bd.id}-rep`, entityType: 'kcs-lo', entityId: bd.id, action: 'kcs.reported',
            actorName: `Tổ ${cfg.label}`, at: bd.submittedAt, note: `Báo ${stepLabel}: ${bd.qty} · ${bd.pieceName}`,
          }]
          : [{
            id: `${bd.id}-done`, entityType: 'kcs-lo', entityId: bd.id, action: 'kcs.approved',
            actorName: 'KCS', at: bd.submittedAt, note: `Duyệt ${stepLabel}: ${passed} đạt · ${bd.pieceName}`,
          }]
        return {
          id: lineId, itemName: bd.pieceName, spec: `${bd.pieceCode} · ${stepLabel}`,
          needQty: bd.qty, doneQty: 0,
          pendingQty: pending ? bd.qty : 0,
          approvedQty: pending ? 0 : passed,
          failedQty: failed,
          lastInputAt: bd.submittedAt, history,
          ref: target, blockedMessage: pending ? awaitingState.message : null,
          timeLabel: pending ? 'Chốt lúc' : 'Báo lúc', timeAt: bd.submittedAt,
        }
      })

      // Dòng đang mở lên đầu (việc mới nhất của công nhân), rồi đã chốt chờ chấm, rồi đã chấm.
      const lines = [...openBatchLines, ...openPatLines, ...batchLines, ...bundleLines]
      const waitingTimes = lines.filter(l => l.pendingQty > 0 && l.timeAt).map(l => l.timeAt as string).sort()
      const baoLuc = waitingTimes[0] ?? batchList[0]?.reportedAt ?? bundleList[0]?.submittedAt ?? new Date().toISOString()
      out.push({
        // id PHẢI ổn định theo productionOrderId (KHÔNG dùng rows.length+1/vị trí mảng) - PI vừa
        // duyệt hết lô cuối sẽ bị lọc khỏi `order` (poHasWork=false) ở lần refetch kế tiếp, làm các
        // PI sau đó dịch chỉ số và "thừa hưởng" id cũ. selPoId ở KcsTwoTierScreen (kcsCore.tsx) giữ
        // nguyên id cũ đó qua refetch → sau khi duyệt xong 1 PI, tự "nhảy" sang xem nhầm PI khác vừa
        // chiếm đúng id đó (2026-09-10, người dùng phát hiện: duyệt xong PI-2026-024 tự nhảy vào
        // chi tiết PI-2026-022).
        id: Number(productionOrderId), poNumber: po, sku: po, productName: po,
        soLuong: sumPendingQty(lines), deadline: baoLuc, arrangedAt: baoLuc, lines,
      })
    }
    return out
  }, [batches, reviews, bundles, bundleReviews, review, cfg.label, cfg.unit, lenhOf])

  if (isLoading) return <LoadingState />
  if (error || !batches) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  // Câu hiện phía trên danh sách: 403 (quyền mới chưa kịp cập nhật) hoặc không tải được các đợt đang mở. Không làm vỡ màn.
  const notice = forbidden
    ? <NoticeLine text={MSG_FORBIDDEN} />
    : floorReviewError
      ? <NoticeLine text={`Không tải được các đợt đang mở - ${floorReviewError}`} />
      : undefined

  // Bấm "Chấm" ở dòng ĐANG MỞ: chốt trước, rồi hộp chấm giữ đúng đợt vừa chốt (id + Đã báo do lệnh chốt trả về).
  // Lỗi 409 / 400 ném lên KcsVatTuReviewBoard hiện đúng câu BE + tải lại, không mở hộp.
  const onOpenReview = async (_poId: number, line: KcsLine): Promise<OpenReviewResult> => {
    const t = line.ref as LineTarget | undefined
    if (!t) throw new Error('Không tìm thấy đợt cần chốt - tải lại trang')
    if (t.kind === 'batch') {
      const r = await closeProductionBatch(t.id)
      refetchAll()
      return { reportedQty: r.reportedQty, ref: { kind: 'batch', id: r.id } satisfies LineTarget }
    }
    if (t.kind === 'patGroup') {
      const r = await closePieceStepGroup({ productionOrderId: t.productionOrderId, pieceId: t.pieceId, step: t.step })
      refetchAll()
      return { reportedQty: r.qty, ref: { kind: 'step', id: r.id } satisfies LineTarget }
    }
    // Đã chốt rồi (kind 'step') - không cần chốt lại.
    return { reportedQty: line.pendingQty, ref: t }
  }

  // onReview giờ được KcsTwoTierScreen await ĐÚNG NGHĨA (2026-09-11, QA audit sửa cùng lúc) - KHÔNG còn tự bắt lỗi/alert ở đây nữa, để lỗi ném
  // thẳng lên tới KcsReviewModal.submit() hiện inline + GIỮ NGUYÊN modal (không mất dữ liệu vừa nhập) thay vì
  // đóng modal ngay rồi alert() rời rạc vài trăm ms sau (hành vi cũ, dễ hiểu nhầm "đã duyệt" xong
  // dù backend vừa từ chối, vd PI chưa "Bắt đầu"/đã "Kết thúc", 2026-08-31).
  const onReview = async (_poId: number, line: KcsLine, p: ReviewPayload, ref: unknown) => {
    const target = (ref ?? line.ref) as LineTarget | undefined
    if (!target || target.kind === 'patGroup') throw new Error('Chưa chốt đợt này để chấm - bấm Chấm lại')
    const dto = {
      failedQty: p.failedQty,
      shortQty: p.shortQty,
      reason: p.reviewNote,
      defectReasonId: p.defectReasonId ? String(p.defectReasonId) : undefined,
      photoUrl: p.defectPhotoUrl,
    }
    if (target.kind === 'batch') {
      await api.reviewProductionBatch(target.id, dto)
    } else {
      await api.reviewPieceStepQc(target.id, dto)
    }
    refetchAll()
  }

  // Sửa/xóa ảnh lỗi của 1 review ĐÃ CHẤM (2026-09-11 lần 2, theo Sếp Trương Văn Nhân: "cho người
  // nhập được sửa luôn") - BE (QcReviewsService.updatePhoto()) tự kiểm actor có đúng người đã chấm
  // review này hay Admin không, ở đây không cần đoán trước. Lỗi (vd không phải người nhập) ném lên
  // cho AuditLogTimeline.EditPhotoActions tự alert - cùng idiom AttachmentsPage.tsx.
  const onEditPhoto = async (entry: AuditLogEntry, file: File) => {
    if (!entry.qcReviewId) return
    try {
      const url = await api.uploadImage(file)
      await api.updateQcReviewPhoto(entry.qcReviewId, url)
      refetchReviews()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không đổi được ảnh')
    }
  }
  const onDeletePhoto = async (entry: AuditLogEntry) => {
    if (!entry.qcReviewId) return
    try {
      await api.updateQcReviewPhoto(entry.qcReviewId, null)
      refetchReviews()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không xóa được ảnh')
    }
  }

  return (
    <KcsTwoTierScreen cfg={cfg} stageType={stage} rows={rows} notice={notice}
      onReview={onReview} onOpenReview={onOpenReview} onReload={refetchAll}
      onEditPhoto={onEditPhoto} onDeletePhoto={onDeletePhoto} />
  )
}

function NoticeLine({ text }: { text: string }) {
  return (
    <div role="status" style={{ padding: '10px 14px', margin: '14px 0 0', borderRadius: 'var(--radius)', background: 'var(--amber-bg, var(--surface2))', color: 'var(--fg-d97706)', fontSize: 13, wordBreak: 'break-word' }}>
      {text}
    </div>
  )
}
