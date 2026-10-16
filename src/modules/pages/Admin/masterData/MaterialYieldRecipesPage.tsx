'use client'
import { Workflow } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import { useAuditLog } from '../../../../context/AuditLogContext'
import {
  getMaterialYieldRecipes, createMaterialYieldRecipe, updateMaterialYieldRecipe, deleteMaterialYieldRecipe,
  getMaterials, getMaterialGroups,
} from '../../../../services/api'
import { MATERIAL_GROUP_SYSTEM_KEYS } from '../../../../constants/materialGroupSystemKeys'
import { PROCESS_STEPS, PROCESS_STEP_LABELS } from '../../../../constants/processSteps'
import type { ProcessStep } from '../../../../types/sku'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'
import SearchableSelect from '../../../../components/SearchableSelect'

interface MaterialYieldRecipe {
  id: number
  outputMaterialId: string
  outputMaterialCode: string
  outputMaterialName: string
  inputMaterialId: string
  inputMaterialCode: string
  inputMaterialName: string
  piecesPerBar: number
  processSteps: ProcessStep[]
  isActive: boolean
}

/**
 * Admin > Danh mục hệ thống > Định mức vật tư thành phẩm (2026-10-01) — CRUD MaterialYieldRecipe
 * ("1 vật tư vào cắt ra N vật tư ra", vd thanh nhôm → chân nhôm). Vật tư ra PHẢI thuộc nhóm Sắt +
 * nhóm con "Vật tư thành phẩm" (steelSubGroup=FINISHED_COMPONENT, xem MaterialsPage.tsx field
 * "Nhóm con Sắt") - BE tự validate lại (MaterialYieldRecipesService.assertFinishedComponentSteel),
 * ở đây chỉ lọc picker cho đỡ chọn nhầm.
 *
 * `canManageActive` (2026-10-01, theo yêu cầu người dùng "để an toàn hơn") - cờ "Hoạt động" (ẩn/
 * hiện định mức khỏi màn tính nhu cầu bên Thủ kho/Phôi) chỉ Admin được thấy/sửa. NV Định mức mảnh
 * (SPEC_STEEL, dùng chung CHÍNH component này qua MfgApp.tsx) không thấy cột lẫn ô này trong form -
 * vẫn sửa được mọi field khác bình thường, giá trị isActive hiện có giữ nguyên khi họ lưu (xem
 * AdminEntityPage.openEdit() copy nguyên row vào values, không phụ thuộc field nào đang hiện).
 */
export default function MaterialYieldRecipesPage({ canManageActive = true }: { canManageActive?: boolean } = {}) {
  const { logAction } = useAuditLog()
  const { data: materialsData } = useFetch(() => getMaterials(), [])
  const { data: groupsData } = useFetch(() => getMaterialGroups(), [])
  const materials = materialsData ?? []
  const groups = groupsData ?? []
  const steelGroupId = groups.find(g => g.systemKey === MATERIAL_GROUP_SYSTEM_KEYS.STEEL_BAR)?.id
  const materialDisplayLabel = (m: { name: string; spec?: string | null }) => m.spec ? `${m.name} — ${m.spec}` : m.name
  const outputMaterials = materials.filter(m => m.steelSubGroup === 'FINISHED_COMPONENT')
  const inputMaterials = materials.filter(m => m.materialGroupId === steelGroupId)
  const materialLabel = (id: string, fallback?: string) => {
    const m = materials.find(m => String(m.id) === id)
    return m ? materialDisplayLabel(m) : (fallback ?? id)
  }

  const config: AdminEntityConfig<MaterialYieldRecipe> = {
    title: 'Định mức vật tư thành phẩm',
    icon: <Workflow size={18} color="var(--fg-3949ab)" />,
    searchFields: ['outputMaterialCode', 'outputMaterialName', 'inputMaterialCode', 'inputMaterialName'],
    searchPlaceholder: 'Tìm theo mã hoặc tên vật tư...',
    emptyMessage: 'Chưa có định mức nào — vào đây khai "1 vật tư vào cắt ra N vật tư ra" (vd thanh nhôm → chân nhôm)',
    addLabel: 'Thêm định mức VTTP',
    pageSize: 10,
    columns: [
      { key: 'outputMaterialCode', label: 'Vật tư ra', render: m => materialLabel(m.outputMaterialId, m.outputMaterialName) },
      { key: 'inputMaterialCode', label: 'Vật tư vào', render: m => materialLabel(m.inputMaterialId, m.inputMaterialName) },
      { key: 'piecesPerBar', label: 'Số vật tư ra / 1 đơn vị vào', align: 'right' },
      {
        key: 'processSteps', label: 'Công đoạn',
        render: m => m.processSteps.length ? m.processSteps.map(s => PROCESS_STEP_LABELS[s]).join(', ') : '—',
      },
      ...(canManageActive
        ? [{ key: 'isActive' as const, label: 'Hoạt động', render: (m: MaterialYieldRecipe) => m.isActive ? 'Có' : 'Không' }]
        : []),
    ],
    formFields: [
      {
        name: 'outputMaterialId', label: 'Vật tư ra (phải thuộc nhóm Sắt — Vật tư thành phẩm)', type: 'custom',
        required: true,
        Render: ({ value, setField }) => {
          const selected = outputMaterials.find(m => String(m.id) === String(value ?? ''))
          return (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                Vật tư ra (phải thuộc nhóm Sắt — Vật tư thành phẩm) <span style={{ color: 'var(--fg-c62828)' }}>*</span>
              </div>
              <SearchableSelect
                displayValue={selected ? materialDisplayLabel(selected) : ''}
                options={outputMaterials}
                getKey={m => String(m.id)}
                getSearchText={m => `${m.name} ${m.spec ?? ''}`}
                renderOption={m => <span>{materialDisplayLabel(m)}</span>}
                onSelect={m => setField('outputMaterialId', String(m.id))}
                placeholder="Nhập để tìm hoặc chọn…"
                emptyText="Không tìm thấy — vật tư phải thuộc nhóm Sắt, nhóm con Vật tư thành phẩm"
              />
            </div>
          )
        },
      },
      {
        name: 'inputMaterialId', label: 'Vật tư vào (nguyên liệu mua)', type: 'custom',
        required: true,
        Render: ({ value, setField }) => {
          const selected = inputMaterials.find(m => String(m.id) === String(value ?? ''))
          return (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                Vật tư vào (nguyên liệu mua) <span style={{ color: 'var(--fg-c62828)' }}>*</span>
              </div>
              <SearchableSelect
                displayValue={selected ? materialDisplayLabel(selected) : ''}
                options={inputMaterials}
                getKey={m => String(m.id)}
                getSearchText={m => `${m.name} ${m.spec ?? ''}`}
                renderOption={m => <span>{materialDisplayLabel(m)}</span>}
                onSelect={m => setField('inputMaterialId', String(m.id))}
                placeholder="Nhập để tìm hoặc chọn…"
                emptyText="Không tìm thấy — vật tư phải thuộc nhóm Sắt"
              />
            </div>
          )
        },
      },
      {
        name: 'piecesPerBar', label: 'Số vật tư ra / 1 đơn vị vào', type: 'number', required: true,
        placeholder: 'VD: 12 = 1 thanh nhôm cắt được 12 chân',
      },
      {
        // Tick sẵn "Cắt" khi tạo mới (2026-10-01, theo yêu cầu người dùng) - mọi vật tư thành phẩm
        // gia công từ nguyên liệu mua đều phải qua Phôi cắt trước, đỡ phải tự bấm mỗi lần.
        name: 'processSteps', label: 'Công đoạn', type: 'custom', excludeFromPayload: false,
        defaultValue: ['CAT'],
        Render: ({ value, setField }) => {
          const steps = (value as ProcessStep[] | undefined) ?? []
          const toggle = (step: ProcessStep) => {
            setField('processSteps', steps.includes(step) ? steps.filter(s => s !== step) : [...steps, step])
          }
          return (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' }}>Công đoạn</div>
              <div style={{ display: 'flex', gap: 10, rowGap: 6, flexWrap: 'wrap' }}>
                {PROCESS_STEPS.map(step => (
                  <label key={step} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={steps.includes(step)} onChange={() => toggle(step)} />
                    {PROCESS_STEP_LABELS[step]}
                  </label>
                ))}
              </div>
            </div>
          )
        },
      },
      ...(canManageActive
        ? [{ name: 'isActive' as const, label: 'Hoạt động', type: 'checkbox' as const, defaultValue: true }]
        : []),
    ],
    deleteConfirm: m => ({
      title: 'Xóa định mức',
      message: `Xóa định mức "${materialLabel(m.outputMaterialId, m.outputMaterialName)}" ← "${materialLabel(m.inputMaterialId, m.inputMaterialName)}"? Hành động này không thể hoàn tác.`,
    }),
    guardSave: () => (materialsData == null || groupsData == null ? 'Chưa tải được danh sách Vật tư - thử lại' : undefined),
    onMutate: (action, m) => {
      const label = `${m.outputMaterialCode} ← ${m.inputMaterialCode}`
      if (action === 'create') logAction('material-yield-recipe', String(m.id), 'masterdata.created', label)
      else if (action === 'update') logAction('material-yield-recipe', String(m.id), 'masterdata.updated', label)
      else logAction('material-yield-recipe', String(m.id), 'masterdata.deleted', label)
    },
    api: {
      list: getMaterialYieldRecipes,
      create: (data) => createMaterialYieldRecipe(data),
      update: (id, data) => updateMaterialYieldRecipe(id, data),
      remove: (id) => deleteMaterialYieldRecipe(id),
    },
  }

  return <AdminEntityPage config={config} />
}
