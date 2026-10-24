import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Ảnh nhỏ bấm để phóng to trong khung giữa màn hình (bấm ra ngoài hoặc nút X để đóng). Dùng cho ảnh mẫu
 * vật tư (dây/nệm) - người dùng cần nhìn rõ hoa văn để chọn đúng loại.
 *
 * Khung phóng to render qua PORTAL vào document.body: ảnh thường nằm trong <label>/hàng bảng/ô chọn,
 * nếu khung nằm lồng trong đó thì bấm vào khung sẽ kích hoạt luôn label (tick nhầm checkbox) hoặc
 * hàng cha. onClick cũng chặn nổi bọt (stopPropagation) vì sự kiện React vẫn nổi bọt qua portal.
 */
export default function ZoomableImage({ url, alt = '', title, size, height, style }: {
  url?: string | null
  alt?: string
  /** Tên hiển thị dưới ảnh phóng to (vd "DAY-012 — Dây xám bông SHT01"). */
  title?: string
  /** Hình vuông size x size. Không truyền thì dùng `height` (rộng tự theo tỉ lệ). */
  size?: number
  height?: number
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }
  return (
    <>
      <button
        type="button"
        onClick={(e) => { stop(e); setOpen(true) }}
        title="Bấm để xem ảnh lớn"
        aria-label={`Phóng to ảnh ${title ?? alt}`}
        style={{ display: 'inline-flex', padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', flexShrink: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL Cloudinary/blob động (ảnh mẫu vật tư), không hợp với tối ưu tĩnh của next/image */}
        <img
          src={url} alt={alt}
          style={{
            display: 'block', borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)',
            ...(size != null ? { width: size, height: size } : { height }),
            ...style,
          }}
        />
      </button>
      {open && createPortal(
        <div
          onClick={(e) => { stop(e); setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px, 4vw, 32px)', cursor: 'zoom-out' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'default' }}>
            <button
              type="button"
              onClick={(e) => { stop(e); setOpen(false) }}
              aria-label="Đóng ảnh"
              style={{ position: 'absolute', top: -12, right: -12, display: 'flex', padding: 6, borderRadius: 999, border: 'none', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
            >
              <X size={16} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL Cloudinary/blob động, xem chú thích ở ảnh nhỏ */}
            <img src={url} alt={alt} style={{ maxWidth: 'min(92vw, 900px)', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, background: 'var(--surface)' }} />
            {title && <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{title}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
