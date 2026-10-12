'use client'
import { adminGroup } from '../Guide/content/admin'
import EmbeddedGuide from '../Guide/EmbeddedGuide'

// Hướng dẫn quản trị (2026-10-12, theo yêu cầu) - phần hướng dẫn của Admin tách hẳn khỏi trang
// /guide công khai và đặt trong chính phân hệ Quản trị, nơi chỉ tài khoản ADMIN vào được. Nội dung
// ở Guide/content/admin.ts (import THẲNG file đó, không qua Guide/content/index.ts - xem ghi chú ở
// index.ts về việc không để nội dung quản trị lọt vào gói JS của /guide).
const linkFor = (id: string) => `/?m=admin&p=guide&a=${id}`

export default function AdminGuidePage() {
  return (
    <EmbeddedGuide
      group={adminGroup}
      title="Hướng dẫn quản trị"
      note="Phần này chỉ tài khoản Quản trị xem được. Hướng dẫn của các vai trò khác nằm ở trang hướng dẫn chung (/guide)."
      linkFor={linkFor}
      accent="var(--fg-3949ab)"
    />
  )
}
