// Định mức chi tiết theo role chuyên trách (Sắt / Dây-Sơn / Phụ kiện / Bao bì).
// Dùng chung 1 shape cho cả 4 role — tránh lặp lại kiểu dữ liệu gần giống nhau ở mỗi trang Spec*Page.

export type SpecRole = 'SPEC_STEEL' | 'SPEC_WIRE_PAINT' | 'SPEC_ACCESSORY' | 'SPEC_PACKAGING'

export interface SpecBom {
  id: number
  ten: string
  thoiGian: string
}

export interface SpecLine {
  uid: number
  code: string
  unit: string
  qty?: string
  specifications: string
  imageUrl?: string
  chieuDai?: string
}

export interface SpecPendingReq {
  uid: number
  bomId: number
  lines: SpecLine[]
  submittedAt: string
}

export interface SpecRejectedLine extends SpecLine {
  submittedAt: string
  lyDo: string
}

export interface SpecRoleState {
  approvedBomIds: number[]
  pendingReqs: SpecPendingReq[]
  draftsByBom: Record<number, SpecLine[]>
  rejectedLines: Record<number, SpecRejectedLine[]>
  catalog: SpecLine[]
  reqUid: number
  draftUid: number
}

export type SpecBomStatus = 'approved' | 'pending' | 'rejected' | 'canInput'
