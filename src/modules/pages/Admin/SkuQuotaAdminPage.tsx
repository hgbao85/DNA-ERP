'use client'

/**
 * "Sửa định mức SKU đã duyệt" (2026-10-15) - cửa riêng cho ADMIN ghi đè trực tiếp định mức mảnh/
 * chi tiết của 1 SKU dù đã qua KHSX/Sếp duyệt (BomRevision đã ACTIVE), không cần quay lại luồng
 * duyệt. Backend đã chặn mọi role khác bằng BomRevisionsService/SkusService.
 * resolveNonDraftOrAdminOverride (ghi đè + mở escape hatch DB + ghi AuditLog tay, xem
 * SkusService.writeAdminOverrideAudit) - trang này chỉ là lối vào UI, tái dùng NGUYÊN
 * SpecSteelPage/SpecDetailQuotaPage (đã tự có nhánh `isAdmin` cho đúng việc này) thay vì viết lại
 * form nhập mảnh/chi tiết phức tạp. Đặt trong AdminApp vì ADMIN không vào được giao diện Sản xuất
 * (mfgRole null - xem resolveDefaultModule.ts), cùng lý do PhoiSkuAdminPage.tsx.
 */
import { useState } from 'react'
import { Layers, PaintBucket } from 'lucide-react'
import SpecSteelPage from '../Manufacturing/SpecSteelPage'
import SpecDetailQuotaPage from '../Manufacturing/SpecDetailQuotaPage'
import { pageTitle } from '../../../styles/typography'

type Section = 'manh' | 'detail'

export default function SkuQuotaAdminPage() {
  const [section, setSection] = useState<Section>('manh')

  return (
    <div>
      <h2 style={{ ...pageTitle, margin: 0 }}>Sửa định mức SKU</h2>
      <p style={{ margin: 'var(--space-2) 0 var(--space-5)', fontSize: 13, color: 'var(--text3)', maxWidth: 760 }}>
        Chỉ Quản trị viên mới sửa được định mức của 1 SKU sau khi đã duyệt (sửa = ghi đè trực tiếp, không cần KHSX/Sếp duyệt lại).
        SKU chưa duyệt vẫn nhập/sửa bình thường như tài khoản Sắt/Chi tiết chuyên trách.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-5)' }}>
        <button
          onClick={() => setSection('manh')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: section === 'manh' ? 'var(--bg-e8eaf6)' : 'var(--surface)',
            color: section === 'manh' ? 'var(--fg-3949ab)' : 'var(--text2)',
          }}
        ><Layers size={14} /> Định mức mảnh</button>
        <button
          onClick={() => setSection('detail')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: section === 'detail' ? 'var(--bg-e8eaf6)' : 'var(--surface)',
            color: section === 'detail' ? 'var(--fg-3949ab)' : 'var(--text2)',
          }}
        ><PaintBucket size={14} /> Định mức chi tiết</button>
      </div>

      {/* subTab cố định 'dinh-muc' - tab 'catalog' (danh mục vật tư) đã có riêng ở Admin > Danh
          mục hệ thống, không cần lặp lại ở đây. */}
      {section === 'manh'
        ? <SpecSteelPage subTab="dinh-muc" onSubTabChange={() => {}} />
        : <SpecDetailQuotaPage subTab="dinh-muc" onSubTabChange={() => {}} />}
    </div>
  )
}
