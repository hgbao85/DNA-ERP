import type { User } from '../context/AuthContext'
import type { ProposalStatus, PurchaseProposal } from '../context/InspectionContext'

/** materialId (khớp `PurchaseProposalItem.materialId`) -> buyerId (khớp `User.id`, null nếu chưa gán). */
export type MaterialBuyerMap = Map<number, string | null>

export function buildBuyerByMaterialId(materials: { id: number; buyerId: string | null }[]): MaterialBuyerMap {
  return new Map(materials.map((m) => [m.id, m.buyerId]))
}

// Purchasing giờ được gán theo TỪNG VẬT TƯ (Material.buyerId, xem form "Thêm vật tư"), không
// còn theo cả kho (warehouseScope) như trước — 1 kho vật lý thường chứa nhiều loại vật tư do
// nhiều nhân viên mua hàng khác nhau phụ trách, gán theo kho là gộp nhầm 2 việc khác nhau.
// Đề xuất hiện với đúng người được gán mua ít nhất 1 dòng vật tư trong đó; dòng chưa gán ai
// (vật tư chưa có buyerId, hoặc item cũ chưa link materialId) vẫn hiện cho mọi nhân viên mua
// hàng để không "mồ côi" cho tới khi có người nhận.
export function canPurchaserSeeProposal(
  user: User | null,
  proposal: PurchaseProposal,
  buyerByMaterialId: MaterialBuyerMap,
): boolean {
  if (user?.role === 'BOSS') return true
  const userId = user?.id != null ? String(user.id) : null
  if (!userId) return false
  return proposal.items.some((item) => {
    if (item.materialId == null) return true
    const buyerId = buyerByMaterialId.get(item.materialId)
    return !buyerId || buyerId === userId
  })
}

export function visibleProposalsFor(
  user: User | null,
  proposals: PurchaseProposal[],
  buyerByMaterialId: MaterialBuyerMap,
): PurchaseProposal[] {
  return proposals.filter((p) => canPurchaserSeeProposal(user, p, buyerByMaterialId))
}

/** `item` có phải của đúng user này không (buyerId khớp, hoặc chưa gán ai). Cùng luật với
 *  `canPurchaserSeeProposal` nhưng soi TỪNG DÒNG thay vì "có ít nhất 1 dòng". */
export function isItemMine(
  user: User | null,
  materialId: number | null | undefined,
  buyerByMaterialId: MaterialBuyerMap,
): boolean {
  if (user?.role === 'BOSS') return true
  if (materialId == null) return true
  const buyerId = buyerByMaterialId.get(materialId)
  const userId = user?.id != null ? String(user.id) : null
  return !buyerId || buyerId === userId
}

// Chốt lại 2026-08-25 (đảo quyết định "Sếp chốt 2026-08-15" gộp chung): report thực tế
// PI-2026-012 cho thấy đề xuất gộp nhiều người mua khiến CẢ 3 người thấy/báo giá được y hệt
// nhau (Material.buyerId đã gán đúng nhưng UI hiển thị nguyên cả đề xuất, không lọc theo dòng).
// Từ đây mỗi người mua chỉ được xem/thao tác đúng phần vật tư gán cho mình trong 1 đề xuất -
// phần còn lại ("others") chỉ hiện để biết đề xuất còn thiếu gì, không báo giá hộ được (xem BE
// PurchaseProposalsService.assertActorMayQuoteItem - chặn addQuote hộ vật tư người khác).
export function splitItemsByOwner<T extends { materialId?: number }>(
  user: User | null,
  items: T[],
  buyerByMaterialId: MaterialBuyerMap,
): { mine: T[]; others: T[] } {
  const mine: T[] = []
  const others: T[] = []
  for (const item of items) {
    if (isItemMine(user, item.materialId, buyerByMaterialId)) mine.push(item)
    else others.push(item)
  }
  return { mine, others }
}

// Rollup trạng thái của 1 TẬP item bất kỳ (2026-08-25) - cùng thứ tự ưu tiên với BE
// (recomputeProposalStatus, purchase-proposals/purchase-proposal-status.util.ts), chỉ khác input
// là tập item nào được xét. Dùng chung cho "rollup của riêng phần tôi" (LenhMuaNCCPage) và "rollup
// của riêng 1 người mua trong đơn" (BossApp, khi Sếp tách xem từng người đề xuất) - tránh chép lại
// cùng 1 bảng ưu tiên ở nhiều nơi rồi lệch nhau dần theo thời gian.
export function rollupStatusOf(items: { status: ProposalStatus }[]): ProposalStatus {
  if (items.length === 0) return 'new'
  const statuses = items.map((i) => i.status)
  if (statuses.every((s) => s === 'purchased')) return 'purchased'
  if (statuses.every((s) => s === 'purchasing' || s === 'purchased')) return 'purchasing'
  if (statuses.some((s) => s === 'rejected')) return 'rejected'
  if (statuses.every((s) => s === 'submitted' || s === 'purchasing' || s === 'purchased')) return 'submitted'
  if (statuses.some((s) => s !== 'new')) return 'quoting'
  return 'new'
}

/** materialId (khớp `Material.id`) -> buyerId (`string | null`) đã suy ra CHO ĐÚNG DÒNG này -
 *  helper nhỏ dùng chung giữa `groupItemsByBuyer` và bất kỳ chỗ nào cần tra buyerId thô (không qua
 *  lăng kính "có phải của tôi không" như `isItemMine`). */
function buyerIdOf(materialId: number | null | undefined, buyerByMaterialId: MaterialBuyerMap): string | null {
  if (materialId == null) return null
  return buyerByMaterialId.get(materialId) ?? null
}

export const UNASSIGNED_BUYER = '__unassigned__'

export interface BuyerGroup<T> {
  /** `UNASSIGNED_BUYER` khi item chưa gán `Material.buyerId` (hoặc item cũ chưa link materialId) -
   *  KHÔNG dùng `null` trực tiếp để tránh lẫn với "chưa chọn nhóm nào" ở state chọn buyer của
   *  BossApp (`selectedBuyerId: string | null`, null = chưa vào xem người nào). */
  buyerId: string
  items: T[]
}

// Gộp item của 1 đơn (có thể gồm nhiều PurchaseProposal, xem groupByRequestId ở BossApp.tsx) theo
// NGƯỜI MUA phụ trách (Material.buyerId) - Sếp cần xem/duyệt riêng từng người đề xuất trong cùng 1
// đơn gộp (2026-08-25, "duyệt riêng từng người mua hàng" tiếp tục mở rộng: trước đó BE/FE đã tách
// được theo LƯỢT GỬI, nhưng nếu 2 người CÙNG lúc đang SUBMITTED thì màn "So sánh giá" vẫn gộp
// chung 1 danh sách phẳng - Sếp bấm Duyệt/Từ chối 1 lần là dính luôn cả 2 người). Giữ thứ tự xuất
// hiện đầu tiên của mỗi buyer trong `items` (ổn định qua re-render, không tự sắp xếp lại ngẫu nhiên).
export function groupItemsByBuyer<T extends { materialId?: number }>(
  items: T[],
  buyerByMaterialId: MaterialBuyerMap,
): BuyerGroup<T>[] {
  const order: string[] = []
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = buyerIdOf(item.materialId, buyerByMaterialId) ?? UNASSIGNED_BUYER
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(item)
  }
  return order.map((buyerId) => ({ buyerId, items: map.get(buyerId)! }))
}
