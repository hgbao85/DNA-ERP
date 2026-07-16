'use client'
import { Bell } from 'lucide-react'
import { useAuditLog } from '../../../context/AuditLogContext'
import { useAuth } from '../../../context/AuthContext'
import { getNotifications, createNotification, updateNotification, deleteNotification } from '../../../services/api'
import type { Notification } from '../../../types/admin'
import AdminEntityPage, { type AdminEntityConfig } from './shared/AdminEntityPage'

const AUDIENCE_LABEL: Record<Notification['audience'], string> = {
  all: 'Tất cả',
  boss: 'Giám đốc',
  warehouse_staff: 'Nhân viên',
}

export default function NotificationsPage() {
  const { logAction } = useAuditLog()
  const { user } = useAuth()

  const config: AdminEntityConfig<Notification> = {
    title: 'Thông báo',
    icon: <Bell size={18} color="#3949ab" />,
    searchFields: ['title', 'message'],
    searchPlaceholder: 'Tìm theo tiêu đề hoặc nội dung...',
    emptyMessage: 'Chưa có thông báo nào',
    addLabel: 'Tạo thông báo',
    pageSize: 10,
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'message', label: 'Nội dung' },
      { key: 'audience', label: 'Đối tượng', render: (n) => AUDIENCE_LABEL[n.audience] ?? n.audience },
      { key: 'createdAt', label: 'Thời gian', render: (n) => new Date(n.createdAt).toLocaleString('vi-VN') },
    ],
    filters: [
      { key: 'audience-all', label: 'Tất cả người dùng', predicate: (n) => n.audience === 'all' },
      { key: 'boss', label: 'Giám đốc', predicate: (n) => n.audience === 'boss' },
      { key: 'warehouse_staff', label: 'Nhân viên', predicate: (n) => n.audience === 'warehouse_staff' },
    ],
    formFields: [
      { name: 'title', label: 'Tiêu đề', type: 'text', required: true },
      { name: 'message', label: 'Nội dung', type: 'text', required: true },
      {
        name: 'audience', label: 'Đối tượng nhận', type: 'select', required: true, defaultValue: 'all',
        options: [
          { value: 'all', label: 'Tất cả' },
          { value: 'boss', label: 'Giám đốc' },
          { value: 'warehouse_staff', label: 'Nhân viên' },
        ],
      },
    ],
    deleteConfirm: (n) => ({
      title: 'Xóa thông báo',
      message: `Xóa thông báo "${n.title}"? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, n) => {
      if (action === 'create') logAction('notification', String(n.id), 'notification.created', n.title)
      else if (action === 'update') logAction('notification', String(n.id), 'notification.updated', n.title)
      else logAction('notification', String(n.id), 'notification.deleted', n.title)
    },
    api: {
      list: getNotifications,
      create: (data) => createNotification({ ...data, createdBy: user?.name }),
      update: (id, data) => updateNotification(id, data),
      remove: (id) => deleteNotification(id),
    },
  }

  return <AdminEntityPage config={config} />
}
