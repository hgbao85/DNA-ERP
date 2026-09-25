'use client'
import type { ReactNode } from 'react'
import { tabBtn } from '../../../../styles/buttons'
import { useIsMobile } from '../../../../hooks/useMediaQuery'

/**
 * Thanh tab gạch chân dùng chung cho các trang Admin nhiều tab con (Danh mục, Module nghiệp vụ, Tệp đính kèm).
 * Điện thoại: 6-7 tab xuống dòng thành 3-4 hàng, gạch chân active lẫn vào đường kẻ các hàng khác - nên giữ 1 hàng,
 * cuộn ngang. marginBottom 0 (thay -1) vì khung cuộn cắt mất 1px gạch chân nằm đè lên viền dưới.
 */
export default function AdminTabs<K extends string>({ tabs, active, onChange, accent }: {
  tabs: { id: K; label: string; icon: ReactNode }[]
  active: K
  onChange: (id: K) => void
  accent: string
}) {
  const isMobile = useIsMobile()
  return (
    <div style={{
      display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 18,
      ...(isMobile ? { flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' } : { flexWrap: 'wrap' }),
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            ...tabBtn(active === t.id, accent), display: 'inline-flex', alignItems: 'center', gap: 6,
            ...(isMobile && { flexShrink: 0, whiteSpace: 'nowrap', padding: '8px 12px', marginBottom: 0 }),
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}
