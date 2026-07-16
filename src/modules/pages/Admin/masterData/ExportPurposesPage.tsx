'use client'
import { Flag } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getExportPurposes, createExportPurpose, updateExportPurpose, deleteExportPurpose } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface ExportPurpose {
  id: number
  label: string
}

export default function ExportPurposesPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<ExportPurpose> = {
    title: 'Mục đích xuất',
    icon: <Flag size={18} color="#3949ab" />,
    searchFields: ['label'],
    searchPlaceholder: 'Tìm theo mục đích...',
    emptyMessage: 'Chưa có mục đích xuất nào',
    addLabel: 'Thêm mục đích xuất',
    pageSize: 10,
    columns: [
      { key: 'label', label: 'Mục đích xuất' },
    ],
    formFields: [
      { name: 'label', label: 'Mục đích xuất', type: 'text', required: true },
    ],
    deleteConfirm: (p) => ({
      title: 'Xóa mục đích xuất',
      message: `Xóa mục đích xuất "${p.label}"? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, p) => {
      if (action === 'create') logAction('export-purpose', String(p.id), 'masterdata.created', p.label)
      else if (action === 'update') logAction('export-purpose', String(p.id), 'masterdata.updated', p.label)
      else logAction('export-purpose', String(p.id), 'masterdata.deleted', p.label)
    },
    api: {
      list: getExportPurposes,
      create: (data) => createExportPurpose(String(data.label ?? '')),
      update: (id, data) => updateExportPurpose(Number(id), data) as Promise<ExportPurpose | undefined>,
      remove: (id) => deleteExportPurpose(Number(id)),
    },
  }

  return <AdminEntityPage config={config} />
}
