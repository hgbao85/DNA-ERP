/** Ảnh sản phẩm của SKU (Sku.imageUrl, KHSX chọn lúc tạo SKU) — bấm để mở ảnh gốc ở tab mới.
 *  Không có ảnh thì không render gì, layout giữ nguyên như SKU cũ. */
export default function SkuImageThumb({ url, size = 72 }: { url?: string | null; size?: number }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Xem ảnh gốc" style={{ display: 'block', flexShrink: 0 }}>
      <img src={url} alt="Ảnh SKU" style={{ display: 'block', width: size, height: size, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }} />
    </a>
  )
}
