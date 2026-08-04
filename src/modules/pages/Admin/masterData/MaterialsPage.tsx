'use client'
import { Package } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getMaterials, createMaterial, updateMaterial, deleteMaterial, getMaterialGroups } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface Material {
  id: number
  code: string
  name: string
  unit: string
  materialGroupId?: number | null
  khoUnitFactor?: number | null
}

interface MaterialGroup {
  id: number
  name: string
}

export default function MaterialsPage() {
  const { logAction } = useAuditLog()
  const { data: groups } = useFetch<MaterialGroup[]>(getMaterialGroups)
  const groupList = groups ?? []
  const groupName = (id?: number | null) => groupList.find((g) => g.id === id)?.name ?? '—'

  const config: AdminEntityConfig<Material> = {
    title: 'Vật tư',
    icon: <Package size={18} color="#3949ab" />,
    searchFields: ['code', 'name'],
    searchPlaceholder: 'Tìm theo mã hoặc tên vật tư...',
    emptyMessage: 'Chưa có vật tư nào',
    addLabel: 'Thêm vật tư',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã vật tư' },
      { key: 'name', label: 'Tên vật tư' },
      { key: 'unit', label: 'Đơn vị' },
      { key: 'materialGroupId', label: 'Nhóm vật tư', render: (m) => groupName(m.materialGroupId) },
      { key: 'khoUnitFactor', label: 'Hệ số quy đổi kho', align: 'right' },
    ],
    filters: groupList.map((g) => ({ key: String(g.id), label: g.name, predicate: (m: Material) => m.materialGroupId === g.id })),
    // Không validate gì ở form này (theo yêu cầu) - kể cả Mã/Tên/Đơn vị cũng không bắt buộc
    // nữa. Nhóm vật tư để trống thì vật tư đó sẽ vô hình ở mọi picker Spec cho đến khi được
    // gán nhóm sau (ở đây hoặc lúc nhập định mức - xem skus.service.ts bên BE).
    formFields: [
      { name: 'code', label: 'Mã vật tư', type: 'text' },
      { name: 'name', label: 'Tên vật tư', type: 'text' },
      { name: 'unit', label: 'Đơn vị tính', type: 'text' },
      {
        name: 'materialGroupId', label: 'Nhóm vật tư', type: 'select',
        options: groupList.map((g) => ({ value: String(g.id), label: g.name })),
      },
      { name: 'khoUnitFactor', label: 'Hệ số quy đổi kho', type: 'number', placeholder: 'VD: 600' },
    ],
    deleteConfirm: (m) => ({
      title: 'Xóa vật tư',
      message: `Xóa vật tư "${m.name}" (${m.code})? Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, m) => {
      const label = `${m.code} — ${m.name}`
      if (action === 'create') logAction('material', String(m.id), 'masterdata.created', label)
      else if (action === 'update') logAction('material', String(m.id), 'masterdata.updated', label)
      else logAction('material', String(m.id), 'masterdata.deleted', label)
    },
    api: {
      list: getMaterials,
      create: (data) => createMaterial(data),
      update: (id, data) => updateMaterial(id, data),
      remove: (id) => deleteMaterial(id),
    },
  }

  return <AdminEntityPage config={config} />
}
