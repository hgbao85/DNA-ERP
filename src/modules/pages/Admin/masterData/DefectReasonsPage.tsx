'use client'
import { AlertTriangle } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getDefectReasons, createDefectReason, updateDefectReason, deleteDefectReason } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface DefectReason {
  id: number
  label: string
  stageType?: string
}

const STAGE_LABEL: Record<string, string> = {
  PHOI: 'Phôi',
  HAN: 'Hàn',
  SON: 'Sơn',
}

export default function DefectReasonsPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<DefectReason> = {
    title: 'Lý do lỗi',
    icon: <AlertTriangle size={18} color="#3949ab" />,
    searchFields: ['label'],
    searchPlaceholder: 'Tìm theo nội dung lỗi...',
    emptyMessage: 'Chưa có lý do lỗi nào',
    addLabel: 'Thêm lý do lỗi',
    pageSize: 10,
    columns: [
      { key: 'label', label: 'Nội dung lỗi' },
      { key: 'stageType', label: 'Công đoạn', render: (d) => d.stageType ? (STAGE_LABEL[d.stageType] ?? d.stageType) : '—' },
    ],
    filters: [
      { key: 'PHOI', label: 'Phôi', predicate: (d) => d.stageType === 'PHOI' },
      { key: 'HAN', label: 'Hàn', predicate: (d) => d.stageType === 'HAN' },
      { key: 'SON', label: 'Sơn', predicate: (d) => d.stageType === 'SON' },
    ],
    formFields: [
      { name: 'label', label: 'Nội dung lỗi', type: 'text', required: true },
      {
        name: 'stageType', label: 'Công đoạn', type: 'select', required: true,
        options: [{ value: 'PHOI', label: 'Phôi' }, { value: 'HAN', label: 'Hàn' }, { value: 'SON', label: 'Sơn' }],
      },
    ],
    deleteConfirm: (d) => ({
      title: 'Xóa lý do lỗi',
      message: `Xóa lý do lỗi "${d.label}"? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, d) => {
      if (action === 'create') logAction('defect-reason', String(d.id), 'masterdata.created', d.label)
      else if (action === 'update') logAction('defect-reason', String(d.id), 'masterdata.updated', d.label)
      else logAction('defect-reason', String(d.id), 'masterdata.deleted', d.label)
    },
    api: {
      list: () => getDefectReasons() as Promise<DefectReason[]>,
      create: (data) => createDefectReason(data) as Promise<DefectReason>,
      update: (id, data) => updateDefectReason(id, data) as Promise<DefectReason | undefined>,
      remove: (id) => deleteDefectReason(id),
    },
  }

  return <AdminEntityPage config={config} />
}
