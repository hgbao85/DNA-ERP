import ZoomableImage from './ZoomableImage'

/** Ảnh sản phẩm của SKU (Sku.imageUrl, KHSX chọn lúc tạo SKU) — bấm để phóng to ngay trong trang
 *  (trước đây mở ảnh gốc ở tab mới). Không có ảnh thì không render gì, layout giữ nguyên như SKU cũ. */
export default function SkuImageThumb({ url, size = 72 }: { url?: string | null; size?: number }) {
  if (!url) return null
  return (
    <ZoomableImage
      url={url}
      alt="Ảnh SKU"
      title="Ảnh SKU"
      size={size}
      style={{ borderRadius: 6, background: 'var(--surface)' }}
    />
  )
}
