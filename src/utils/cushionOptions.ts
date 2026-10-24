import type { SkuMaterialOption } from '../types/sku'

/**
 * Logic thuần cho "tick loại nệm Sales được chọn" ở SpecDetailQuotaPage. Nệm là Phụ kiện (BomAccessoryItem,
 * phẳng theo SKU - không theo mảnh như Dây): tick xong tự có sẵn 1 dòng Phụ kiện cho từng loại nệm,
 * số lượng để trống cho người nhập điền. Cùng cách làm với wireOptions.ts nhưng đơn giản hơn vì
 * không có khái niệm mảnh.
 */
interface LineLike {
  group: 'daySon' | 'vatTuPhuKien' | 'baoBiDongGoi'
  /** Giữ nguyên kiểu của trang: id BE là chuỗi nhưng khai `number` cho khớp interface cũ. */
  materialId: number | string
  soLuong: string
}

type CushionRef = Pick<SkuMaterialOption, 'materialId' | 'materialCode'>

const isCushionLineOf = (l: LineLike, id: string) => l.group === 'vatTuPhuKien' && String(l.materialId) === id
const hasQty = (soLuong: string) => Number(soLuong) > 0

/** Loại nệm vừa tick thêm 1 dòng Phụ kiện trống (nếu chưa có); loại vừa bỏ tick bị xoá dòng tương ứng. */
export function syncTickedCushionLines<L extends LineLike, W extends CushionRef>(
  lines: L[],
  prev: CushionRef[],
  next: W[],
  buildLine: (cushion: W) => L,
): L[] {
  const nextIds = new Set(next.map((c) => c.materialId))
  const prevIds = new Set(prev.map((c) => c.materialId))
  const removed = prev.filter((c) => !nextIds.has(c.materialId)).map((c) => c.materialId)
  let result = lines
  if (removed.length > 0) {
    result = result.filter((l) => !(l.group === 'vatTuPhuKien' && removed.includes(String(l.materialId))))
  }
  for (const c of next) {
    if (prevIds.has(c.materialId)) continue
    if (!result.some((l) => isCushionLineOf(l, c.materialId))) result = [...result, buildLine(c)]
  }
  return result
}

/** Số dòng đang có số lượng sẽ mất nếu bỏ tick các loại này - để hỏi xác nhận trước khi xoá. */
export function countCushionLinesWithQty(lines: LineLike[], cushionIds: string[]): number {
  return lines.filter((l) => l.group === 'vatTuPhuKien' && cushionIds.includes(String(l.materialId)) && hasQty(l.soLuong)).length
}

/** Mã các loại nệm đã tick nhưng chưa có số lượng > 0 - Sales chọn được mà định mức không có số liệu
 *  nên mua thiếu nệm. Chặn gửi duyệt. */
export function tickedCushionsWithoutQty(lines: LineLike[], cushions: CushionRef[]): string[] {
  return cushions
    .filter((c) => !lines.some((l) => isCushionLineOf(l, c.materialId) && hasQty(l.soLuong)))
    .map((c) => c.materialCode)
}

/** Bỏ dòng của loại nệm đã tick mà chưa nhập số lượng khỏi payload gửi lên (BE từ chối số lượng <= 0). */
export function dropBlankTickedCushionLines<L extends LineLike>(lines: L[], cushionIds: ReadonlySet<string>): L[] {
  return lines.filter((l) => !(l.group === 'vatTuPhuKien' && cushionIds.has(String(l.materialId)) && !hasQty(l.soLuong)))
}
