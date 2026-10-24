import type { ManhChildGroup, SkuMaterialOption } from '../types/sku'

/**
 * Logic thuần cho "tick loại dây Sales được chọn" ở SpecSteelPage: tick xong thì mỗi mảnh tự có sẵn
 * 1 dòng Dây cho từng loại đã tick (số lượng để trống, người nhập chỉ điền số). Tách khỏi component
 * để test được, và dùng kiểu cấu trúc tối thiểu thay vì import ManChild (kiểu cục bộ của trang).
 */
interface RowLike {
  group: ManhChildGroup
  /** Giữ nguyên kiểu của trang: id BE là chuỗi nhưng khai `number` cho khớp interface cũ. */
  materialId: number | string
  soLuong: string
}
interface PieceLike<C extends RowLike = RowLike> {
  children: C[]
}

type WireRef = Pick<SkuMaterialOption, 'materialId' | 'materialCode'>

const isWireRowOf = (c: RowLike, wireId: string) => c.group === 'day' && String(c.materialId) === wireId
const hasQty = (soLuong: string) => Number(soLuong) > 0

/** Mảnh "có thể đan" = đã có Dây hoặc Đinh - mảnh Sắt thuần (không đan) không nên bị tự thêm dây. */
export const isWovenCandidate = (children: { group: ManhChildGroup }[]): boolean =>
  children.some((c) => c.group === 'day' || c.group === 'dinh')

/** Các loại dây đã tick mà mảnh này chưa có dòng - dùng cho nút "Thêm dây đã tick" ở từng mảnh. */
export function missingTickedWires<W extends WireRef>(piece: PieceLike, wires: W[]): W[] {
  return wires.filter((w) => !piece.children.some((c) => isWireRowOf(c, w.materialId)))
}

/**
 * Đồng bộ dòng Dây với danh sách tick mới: loại vừa tick thêm 1 dòng trống vào mọi mảnh "có thể đan"
 * chưa có loại đó; loại vừa bỏ tick bị xoá khỏi mọi mảnh. Mảnh không đổi giữ nguyên tham chiếu.
 * `buildRow` cấp id/trường cho dòng mới (id do component quản lý).
 */
export function syncTickedWireRows<C extends RowLike, M extends PieceLike<C>, W extends WireRef>(
  manhs: M[],
  prev: WireRef[],
  next: W[],
  buildRow: (wire: W) => C,
): M[] {
  const nextIds = new Set(next.map((w) => w.materialId))
  const prevIds = new Set(prev.map((w) => w.materialId))
  const removed = prev.filter((w) => !nextIds.has(w.materialId)).map((w) => w.materialId)
  const added = next.filter((w) => !prevIds.has(w.materialId))
  return manhs.map((m) => {
    let children = m.children
    if (removed.length > 0) {
      children = children.filter((c) => !(c.group === 'day' && removed.includes(String(c.materialId))))
    }
    if (added.length > 0 && isWovenCandidate(children)) {
      for (const w of added) {
        if (!children.some((c) => isWireRowOf(c, w.materialId))) children = [...children, buildRow(w)]
      }
    }
    return children === m.children ? m : { ...m, children }
  })
}

/** Số dòng đang có số lượng sẽ mất nếu bỏ tick các loại này - để hỏi xác nhận trước khi xoá. */
export function countRowsWithQty(manhs: PieceLike[], wireIds: string[]): number {
  let n = 0
  for (const m of manhs) {
    for (const c of m.children) {
      if (c.group === 'day' && wireIds.includes(String(c.materialId)) && hasQty(c.soLuong)) n += 1
    }
  }
  return n
}

/** Mã các loại dây đã tick nhưng chưa có số lượng > 0 ở mảnh nào - loại đó có trong danh sách Sales
 *  chọn nhưng định mức không có dòng nào, nên đơn chọn nó sẽ không mua/xuất được dây. Chặn gửi duyệt. */
export function tickedWiresWithoutQty(manhs: PieceLike[], wires: WireRef[]): string[] {
  return wires
    .filter((w) => !manhs.some((m) => m.children.some((c) => isWireRowOf(c, w.materialId) && hasQty(c.soLuong))))
    .map((w) => w.materialCode)
}

/** Bỏ các dòng của loại dây đã tick mà chưa nhập số lượng khỏi payload gửi lên - BE từ chối số lượng
 *  <= 0, và dòng trống nghĩa là "mảnh này không dùng loại dây đó". */
export function dropBlankTickedWireRows<C extends RowLike, M extends PieceLike<C>>(
  manhs: M[],
  wireIds: ReadonlySet<string>,
): M[] {
  return manhs.map((m) => {
    const children = m.children.filter((c) => !(c.group === 'day' && wireIds.has(String(c.materialId)) && !hasQty(c.soLuong)))
    return children.length === m.children.length ? m : { ...m, children }
  })
}
