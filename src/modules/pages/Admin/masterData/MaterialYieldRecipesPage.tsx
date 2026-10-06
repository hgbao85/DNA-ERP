'use client'
import { Workflow } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import { useAuditLog } from '../../../../context/AuditLogContext'
import {
  getMaterialYieldRecipes, createMaterialYieldRecipe, updateMaterialYieldRecipe, deleteMaterialYieldRecipe,
  getMaterials,
} from '../../../../services/api'
import { PROCESS_STEPS, PROCESS_STEP_LABELS } from '../../../../constants/processSteps'
import type { ProcessStep } from '../../../../types/sku'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'

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
  const materials = materialsData ?? []
  const outputMaterialOptions = materials
    .filter(m => m.steelSubGroup === 'FINISHED_COMPONENT')
    .map(m => ({ value: String(m.id), label: `${m.code} — ${m.name}` }))
  const inputMaterialOptions = materials
    .map(m => ({ value: String(m.id), label: `${m.code} — ${m.name}` }))
  const materialLabel = (id: string) => materials.find(m => String(m.id) === id)
    ? `${materials.find(m => String(m.id) === id)!.code} — ${materials.find(m => String(m.id) === id)!.name}`
    : id

  const config: AdminEntityConfig<MaterialYieldRecipe> = {
    title: 'Định mức vật tư thành phẩm',
    icon: <Workflow size={18} color="var(--fg-3949ab)" />,
    searchFields: ['outputMaterialCode', 'outputMaterialName', 'inputMaterialCode', 'inputMaterialName'],
    searchPlaceholder: 'Tìm theo mã hoặc tên vật tư...',
    emptyMessage: 'Chưa có định mức nào — vào đây khai "1 vật tư vào cắt ra N vật tư ra" (vd thanh nhôm → chân nhôm)',
    addLabel: 'Thêm định mức',
    pageSize: 10,
    columns: [
      { key: 'outputMaterialCode', label: 'Vật tư ra', render: m => `${m.outputMaterialCode} — ${m.outputMaterialName}` },
      { key: 'inputMaterialCode', label: 'Vật tư vào', render: m => `${m.inputMaterialCode} — ${m.inputMaterialName}` },
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
        name: 'outputMaterialId', label: 'Vật tư ra (phải thuộc nhóm Sắt — Vật tư thành phẩm)', type: 'select',
        required: true, options: outputMaterialOptions,
      },
      {
        name: 'inputMaterialId', label: 'Vật tư vào (nguyên liệu mua)', type: 'select',
        required: true, options: inputMaterialOptions,
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
      message: `Xóa định mức "${materialLabel(m.outputMaterialId)}" ← "${materialLabel(m.inputMaterialId)}"? Hành động này không thể hoàn tác.`,
    }),
    guardSave: () => (materialsData == null ? 'Chưa tải được danh sách Vật tư - thử lại' : undefined),
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
