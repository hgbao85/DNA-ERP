import { useFetch } from './useFetch'
import {
  buildProductionOrderInfoByMfgProduct,
  lookupProductionOrderInfo,
  type ProductionOrderInfo,
} from '../services/production-invoice-item'
import type { Sku } from '../types/sku'

/**
 * QLSX kiểm soát toàn chuỗi qua nút "Bắt đầu"/"Kết thúc" ở Bảng thống kê (2026-08-31) - dùng chung
 * cho các trang "Phân phối nội bộ"/kho (KhoChuyenKiemPage/KhoDongGoiPage/KhoNhapDanPage/
 * KhoXuatDanPage/XuatSatPage/XuatVatTuTieuHaoPage), trước đây nhân bản y hệt ở từng file (fetch
 * poInfoByProduct + activePiIds). Chỉ là lớp UI ẩn khớp theo - backend
 * (assertPiHasActiveFloor/assertItemPiHasActiveFloor, xem common/utils/floor-gate.util.ts) mới là
 * nơi chặn cứng thật.
 */
export function usePoInfoFloorGate() {
  const { data: poInfoByProduct, isLoading } = useFetch(() => buildProductionOrderInfoByMfgProduct(), [])
  const poInfoFor = (pf: Sku): ProductionOrderInfo | undefined =>
    poInfoByProduct ? lookupProductionOrderInfo(poInfoByProduct, pf) : undefined
  const activePiIds = new Set(
    [...(poInfoByProduct?.values() ?? [])]
      .filter(info => info.floorStage === 'ACTIVE')
      .map(info => info.productionInvoiceId),
  )
  return { poInfoByProduct, poInfoFor, activePiIds, isLoading }
}
