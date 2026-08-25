'use client'

/**
 * Nút "In" gộp chung — bấm ra menu 2 lựa chọn (Excel / Xem trước & In PDF) thay vì 2 nút rời
 * (2026-08-25, theo yêu cầu Sếp: gộp lại cho gọn UI). Không tự đóng khi click ra ngoài - cùng quy
 * ước đơn giản với NotifBell.tsx (component dropdown duy nhất sẵn có trong codebase), không thêm
 * click-outside handler cho 1 nút dùng ít lần/phiên.
 */
import { useState } from 'react'
import { Printer, FileSpreadsheet, ChevronDown } from 'lucide-react'

export default function PrintExportButton({ label, color, variant = 'outline', onExcel, onPdf }: {
  label: string
  /** Màu accent của module đang đứng (Phôi dùng cam, Admin dùng chàm...) - không hardcode 1 màu
   *  chung để giữ đúng theme từng trang. */
  color: string
  /** 'solid' cho nút chính (vd "Xuất tất cả"), 'outline' cho nút phụ trong từng dòng vật tư. */
  variant?: 'solid' | 'outline'
  onExcel: () => void
  onPdf: () => void
}) {
  const [open, setOpen] = useState(false)
  const solid = variant === 'solid'
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600,
          borderRadius: 8, cursor: 'pointer',
          border: solid ? 'none' : `1px solid ${color}`,
          background: solid ? color : 'var(--surface)',
          color: solid ? '#fff' : color,
        }}>
        <Printer size={14} /> {label} <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 170, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,.15)', zIndex: 50, overflow: 'hidden' }}>
          <button onClick={() => { setOpen(false); onExcel() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', fontSize: 12.5, fontWeight: 500, border: 'none', background: 'none', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
            <FileSpreadsheet size={14} /> Xuất Excel
          </button>
          <button onClick={() => { setOpen(false); onPdf() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', fontSize: 12.5, fontWeight: 500, border: 'none', borderTop: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
            <Printer size={14} /> Xem trước &amp; In (PDF)
          </button>
        </div>
      )}
    </div>
  )
}
