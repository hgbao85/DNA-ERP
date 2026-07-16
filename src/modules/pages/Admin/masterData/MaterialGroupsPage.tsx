'use client'
import { Layers } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getMaterialGroups, createMaterialGroup, updateMaterialGroup, deleteMaterialGroup } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface MaterialGroup {
  id: number
  name: string
}

export default function MaterialGroupsPage() {
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<MaterialGroup> = {
    title: 'Nhóm vật tư',
    icon: <Layers size={18} color="#3949ab" />,
    searchFields: ['name'],
    searchPlaceholder: 'Tìm theo tên nhóm...',
    emptyMessage: 'Chưa có nhóm vật tư nào',
    addLabel: 'Thêm nhóm vật tư',
    pageSize: 10,
    columns: [
      { key: 'name', label: 'Tên nhóm vật tư' },
    ],
    formFields: [
      { name: 'name', label: 'Tên nhóm vật tư', type: 'text', required: true },
    ],
    deleteConfirm: (g) => ({
      title: 'Xóa nhóm vật tư',
      message: `Xóa nhóm vật tư "${g.name}"? Các vật tư đang thuộc nhóm này sẽ không còn nhóm. Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, g) => {
      if (action === 'create') logAction('material-group', String(g.id), 'masterdata.created', g.name)
      else if (action === 'update') logAction('material-group', String(g.id), 'masterdata.updated', g.name)
      else logAction('material-group', String(g.id), 'masterdata.deleted', g.name)
    },
    api: {
      list: getMaterialGroups,
      create: (data) => createMaterialGroup(String(data.name ?? '')),
      update: (id, data) => updateMaterialGroup(Number(id), data),
      remove: (id) => deleteMaterialGroup(Number(id)),
    },
  }

  return <AdminEntityPage config={config} />
}
