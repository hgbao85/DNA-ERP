'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeMode } from '../context/ThemeContext'

const META: Record<ThemeMode, { label: string; next: string; Icon: typeof Sun }> = {
  light: { label: 'Giao diện sáng', next: 'tối', Icon: Sun },
  dark:  { label: 'Giao diện tối', next: 'sáng', Icon: Moon },
}

/** Nút đổi giao diện Sáng ↔ Tối, đặt cạnh nút Đăng xuất ở header mỗi phân hệ. (Lựa chọn "Theo hệ
 *  thống" đã bỏ 2026-10-12 - xem ThemeContext.tsx.) */
export default function ThemeToggle({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  const { mode, cycleMode } = useTheme()
  const { label, next, Icon } = META[mode]
  return (
    <button
      type="button"
      onClick={cycleMode}
      title={`${label} (bấm để đổi sang ${next})`}
      aria-label={`Đổi giao diện — hiện tại: ${label}`}
      style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', ...style }}
    >
      <Icon size={size} color="var(--text3)" />
    </button>
  )
}
