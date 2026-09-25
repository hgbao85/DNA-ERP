'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeMode } from '../context/ThemeContext'

const META: Record<ThemeMode, { label: string; Icon: typeof Sun }> = {
  light:  { label: 'Giao diện sáng', Icon: Sun },
  dark:   { label: 'Giao diện tối', Icon: Moon },
  system: { label: 'Theo hệ thống', Icon: Monitor },
}

/** Nút đổi giao diện Sáng → Tối → Theo hệ thống, đặt cạnh nút Đăng xuất ở header mỗi phân hệ. */
export default function ThemeToggle({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  const { mode, cycleMode } = useTheme()
  const { label, Icon } = META[mode]
  return (
    <button
      type="button"
      onClick={cycleMode}
      title={`${label} (bấm để đổi)`}
      aria-label={`Đổi giao diện — hiện tại: ${label}`}
      style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', ...style }}
    >
      <Icon size={size} color="var(--text3)" />
    </button>
  )
}
