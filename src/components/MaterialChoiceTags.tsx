import type { MaterialChoice } from '../types/sku'
import ZoomableImage from './ZoomableImage'

/** Nhãn ngắn "Dây nâu SHT08 · Nệm màu be" (hiện TÊN vật tư, không hiện mã) - dùng khi cần ghép vào chuỗi (tên dòng,
 *  ô chọn...). Rỗng khi dòng không có lựa chọn nào (SKU không khai tick dây/nệm). */
export function describeMaterialChoices(
  x: { wireMaterial?: MaterialChoice | null; cushionMaterial?: MaterialChoice | null } | null | undefined,
): string {
  const parts: string[] = []
  if (x?.wireMaterial) parts.push(x.wireMaterial.materialName)
  if (x?.cushionMaterial) parts.push(x.cushionMaterial.materialName)
  return parts.join(' · ')
}

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
  borderRadius: 999, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)',
  whiteSpace: 'nowrap',
}

/** Loại dây/nệm đã chọn của 1 dòng đơn/lệnh sản xuất (hiện tên, không hiện mã) - hiện cạnh mã SKU để phân biệt các dòng cùng SKU
 *  khác dây/nệm. Không render gì khi không có lựa chọn. */
export default function MaterialChoiceTags({ wire, cushion }: { wire?: MaterialChoice | null; cushion?: MaterialChoice | null }) {
  if (!wire && !cushion) return null
  return (
    <>
      {wire && (
        <span style={chip} title={`Màu dây: ${wire.materialName}`}>
          {wire.imageUrl && <ZoomableImage url={wire.imageUrl} size={14} title={wire.materialName} />}
          {wire.materialName}
        </span>
      )}
      {cushion && (
        <span style={chip} title={`Màu nệm: ${cushion.materialName}`}>
          {cushion.imageUrl && <ZoomableImage url={cushion.imageUrl} size={14} title={cushion.materialName} />}
          {cushion.materialName}
        </span>
      )}
    </>
  )
}
