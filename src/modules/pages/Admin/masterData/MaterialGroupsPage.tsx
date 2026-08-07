'use client'
import { useEffect, useRef } from 'react'
import { Layers } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getMaterialGroups, createMaterialGroup, updateMaterialGroup, deleteMaterialGroup } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

interface MaterialGroup {
  id: number
  name: string
  codePrefix?: string
}

// Bỏ dấu tiếng Việt + viết hoa - chỉ dùng để GỢI Ý, giá trị cuối cùng vẫn do BE validate lại
// (2-8 ký tự A-Z/0-9, unique) và admin có thể sửa tay trước khi lưu.
const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

function suggestPrefix(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  return ascii.slice(0, 3)
}

// Tự điền "Tiền tố mã" theo tên nhóm đang gõ, cho tới khi admin tự tay sửa field này (touched) -
// sau đó ngừng ghi đè để không phá giá trị admin vừa chỉnh.
function CodePrefixField({ values, setField }: { value: unknown; values: Partial<MaterialGroup>; setField: (name: string, value: unknown) => void }) {
  const touched = useRef(!!values.codePrefix) // sửa nhóm có sẵn -> coi như đã "touched", không tự ghi đè

  useEffect(() => {
    if (touched.current) return
    setField('codePrefix', suggestPrefix(values.name ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.name])

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
        Tiền tố mã vật tư<span style={{ color: '#c62828' }}> *</span>
      </label>
      <input
        value={values.codePrefix ?? ''}
        onChange={e => { touched.current = true; setField('codePrefix', e.target.value.toUpperCase()) }}
        placeholder="Tự gợi ý theo tên, có thể sửa"
        style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
      />
      <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
        Dùng để tự sinh mã vật tư trong nhóm này (vd &quot;{values.codePrefix || 'SAT'}-001&quot;) - 2-8 ký tự IN HOA, không trùng nhóm khác.
      </span>
    </div>
  )
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
      { key: 'codePrefix', label: 'Tiền tố mã', render: (g) => g.codePrefix || '—' },
    ],
    formFields: [
      { name: 'name', label: 'Tên nhóm vật tư', type: 'text', required: true },
      {
        name: 'codePrefix', label: 'Tiền tố mã vật tư', type: 'custom',
        Render: CodePrefixField,
        validate: (_v, all) => {
          const p = String(all.codePrefix ?? '')
          if (!/^[A-Z0-9]{2,8}$/.test(p)) return 'Tiền tố mã phải 2-8 ký tự, chỉ chữ IN HOA A-Z và số'
          return undefined
        },
      },
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
      create: (data) => createMaterialGroup(String(data.name ?? ''), String(data.codePrefix ?? '')),
      update: (id, data) => updateMaterialGroup(id, data),
      remove: (id) => deleteMaterialGroup(id),
    },
  }

  return <AdminEntityPage config={config} />
}
