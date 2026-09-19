import { useFetch } from './useFetch'
import { getWarehouses } from '../services/api'

/**
 * Tên kho thật theo mã kho - phân biệt "Kho thành phẩm" / "Kho thành phẩm 2" (khoLabel của
 * PurchaseProposalItem chỉ có tên theo họ kho). Chưa tải xong/lỗi/không tìm thấy thì rơi về `fallback`.
 */
export function useWarehouseName(): (code: string | undefined, fallback: string) => string {
  const { data: warehouses } = useFetch(getWarehouses)
  const nameByCode = new Map((warehouses ?? []).map(w => [w.code, w.name]))
  return (code, fallback) => (code ? nameByCode.get(code) : undefined) ?? (fallback || '—')
}
