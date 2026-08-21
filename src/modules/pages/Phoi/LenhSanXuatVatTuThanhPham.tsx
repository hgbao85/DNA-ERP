'use client'

/**
 * Báo sản lượng — "Vật tư thành phẩm" (2 tầng: PO → Mảnh needsHan=false, vd chân nhôm — mua thanh
 * nhôm về cắt là xong, không qua Hàn). Nối BE thật ngay từ đầu (21/08/2026): TwoTierScreen tự fetch
 * PO/Piece qua production-batches-api.ts với stage="PHOI" — cùng hạ tầng ProductionBatch/QcReview
 * đã dùng cho Hàn/Sơn (LenhSanXuatHan.tsx/LenhSanXuatSon.tsx), chỉ khác điều kiện needsHan ở BE
 * (ProductionBatchesService.stageNeedsFilter/assertPieceInBom) và permission (PHOI_STAFF).
 *
 * Trước đây needsHan=false hoàn toàn không có cách nào báo/chuyển kho ra khỏi Phôi-Sơn-Hàn (xem
 * WarehouseTransfersService.getPieceTransferPlan() — nhánh này chỉ `continue` bỏ qua). Trang này
 * là nguồn dữ liệu "đã sẵn sàng" mới cho đúng nhánh đó.
 */

import { TwoTierScreen, VAT_TU_TP_CFG } from '../../../components/sanxuat/core'

export default function LenhSanXuatVatTuThanhPham({ readOnly = false }: { readOnly?: boolean }) {
  return <TwoTierScreen cfg={VAT_TU_TP_CFG} readOnly={readOnly} stage="PHOI" />
}
