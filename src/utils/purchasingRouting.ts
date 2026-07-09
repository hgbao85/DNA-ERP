import type { User } from '../context/AuthContext'
import type { PurchaseProposal } from '../context/InspectionContext'

// Purchasing bị giới hạn theo warehouseScope, cùng idiom với thủ kho (xem
// InboundWarehouseApp.tsx). null/undefined = tài khoản tổng, thấy tất cả các kho.
// Thêm kho mới chỉ cần gán warehouseScope tương ứng cho account/đề xuất — không cần
// sửa hàm này.
export function canPurchaserSeeProposal(user: User | null, proposal: PurchaseProposal): boolean {
  if (user?.role === 'BOSS') return true
  const scope = user?.warehouseScope ?? null
  return scope === null || scope === proposal.warehouseScope
}

export function visibleProposalsFor(user: User | null, proposals: PurchaseProposal[]): PurchaseProposal[] {
  return proposals.filter(p => canPurchaserSeeProposal(user, p))
}
