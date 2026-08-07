import type { User } from '../context/AuthContext'
import type { PurchaseProposal } from '../context/InspectionContext'

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
