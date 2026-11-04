/**
 * Phần A – Đợt 1 (YC9): khối "thùng & load cont" của 1 SKU. HỢP ĐỒNG với BE `src/common/dto/container-load.dto.ts`
 * (ContainerLoadDto) - đổi 2 bên cùng lúc. BE trả khối này trong response SKU (`/skus`), dòng đơn hàng (`/sales-orders`) và
 * dòng lệnh SX (`/production-invoices`), field tên `containerLoad`.
 */
export type ContainerLoadSource = 'MANUAL' | 'FORMULA'

export interface ContainerLoad {
  boxLengthCm: number | null
  boxWidthCm: number | null
  boxHeightCm: number | null
  /** Số thùng của 1 bộ, mặc định 1. */
  boxesPerSet: number
  /** Load cont nhập tay - có thì thắng công thức. */
  loadContManual: number | null
  /** Thể tích 1 thùng (m³, 4 số lẻ). */
  boxVolumeM3: number | null
  /** ⌊thể tích cont ÷ (thể tích thùng × số thùng/bộ)⌋. */
  loadContFormula: number | null
  /** Load cont hiệu lực = nhập tay ?? công thức. null = SKU chưa có load cont. */
  loadCont: number | null
  source: ContainerLoadSource | null
  updatedAt: string | null
}

/** Body `PATCH /skus/:id/container-load`: bỏ field = giữ nguyên, null = xoá. */
export interface UpdateContainerLoadBody {
  boxLengthCm?: number | null
  boxWidthCm?: number | null
  boxHeightCm?: number | null
  boxesPerSet?: number
  loadContManual?: number | null
}

/** `GET /system-config/planning-params` - thông số kế hoạch mọi người đăng nhập đều đọc được (Phần A). */
export interface PlanningParams {
  containerVolumeM3: number
  /** Phần A – Đợt 2: tiền tố số LSX Admin khai (vd ["MY","GP"]); rỗng = mọi tiền tố đúng dạng. BE cũ thiếu field. */
  lsxPrefixes?: string[]
}
