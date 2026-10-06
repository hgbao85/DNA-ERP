'use client'
import { useMemo, useState } from 'react'
import { Percent } from 'lucide-react'
import Modal from '../../../../components/Modal'
import SearchInput from '../../../../components/SearchInput'
import { bulkUpdateMaterialWaste } from '../../../../services/api'
import { MATERIAL_GROUP_SYSTEM_KEYS } from '../../../../constants/materialGroupSystemKeys'
import { btnSecondary } from '../../../../styles/buttons'

interface MaterialLite {
  id: number
  code: string
  name: string
  materialGroupId?: number | null
  steelSubGroup?: 'SOFTWARE' | 'SELF_CALC' | 'FINISHED_COMPONENT' | null
}
interface GroupLite {
  id: number
  name: string
  systemKey: string | null
}

type Mode = 'materials' | 'group'

/**
 * Sửa % hao hụt hàng loạt (Admin > Vật tư) - chọn tay từng vật tư (có thể khác nhóm nhau) hoặc
 * chọn nguyên 1 nhóm vật tư, áp 1 giá trị % cho tất cả cùng lúc. Field thật sự bị ghi
 * (maxCuttingWastePercentage cho nhóm Sắt / purchaseWastePercentage cho mọi nhóm khác) do BE tự
 * suy theo nhóm của TỪNG vật tư (xem MaterialsService.bulkUpdateWaste) - modal này không cần biết,
 * chỉ hiện gợi ý field nào áp dụng để tránh Admin tưởng nhầm % vừa nhập không có tác dụng.
 * Component tự quản lý toàn bộ state/luồng riêng - AdminEntityPage chỉ cho 1 chỗ trong toolbar
 * (config.toolbarExtra) và không biết gì về nội dung bên trong.
 */
export default function MaterialsBulkWasteModal({
  materials, groups, onDone,
}: {
  materials: MaterialLite[]
  groups: GroupLite[]
  /** Gọi sau khi lưu thành công (đóng modal xong) - trang cha tự refetch + ghi audit log. */
  onDone: (summary: { count: number; value: number | null; scope: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('materials')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [groupId, setGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [valueStr, setValueStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupName = (id?: number | null) => groups.find(g => g.id === id)?.name ?? '—'
  const isSteelGroup = (id: number | null) => groups.find(g => g.id === id)?.systemKey === MATERIAL_GROUP_SYSTEM_KEYS.STEEL_BAR
  // 2026-10-01: Sắt giờ có 3 nhóm con (xem MaterialsPage.tsx) - CHỈ "Phần mềm" (mặc định khi
  // chưa chọn) không có % hao hụt để sửa, mirror MaterialsService.resolveWasteFields's
  // isSoftwareSteel (BE). Tự tính/Vật tư thành phẩm vẫn sửa được như nhóm thường.
  const isSoftwareSteel = (m: { materialGroupId?: number | null; steelSubGroup?: string | null }) =>
    isSteelGroup(m.materialGroupId ?? null) && (m.steelSubGroup ?? 'SOFTWARE') === 'SOFTWARE'

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi')
    const editable = materials.filter(m => !isSoftwareSteel(m))
    if (!q) return editable
    return editable.filter(m => `${m.code} ${m.name}`.toLocaleLowerCase('vi').includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isSoftwareSteel chỉ đọc `groups`
  }, [materials, search, groups])

  const selectedGroup = groups.find(g => String(g.id) === groupId)
  const materialsInGroup = groupId ? materials.filter(m => String(m.materialGroupId) === groupId) : []

  const reset = () => {
    setMode('materials'); setSelectedIds(new Set()); setGroupId(''); setSearch(''); setValueStr('')
    setError(null); setSaving(false)
  }

  const close = () => { if (saving) return; setOpen(false); reset() }

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => setSelectedIds(new Set(filteredMaterials.map(m => m.id)))
  const clearSelection = () => setSelectedIds(new Set())

  // Nhiều vật tư chọn tay có thể trải nhiều nhóm khác nhau -> không có đúng 1 field cố định để
  // gợi ý, chỉ gợi ý được khi đúng 1 nhóm duy nhất xuất hiện trong lựa chọn hiện tại.
  const singleGroupIdOfSelection = useMemo(() => {
    if (mode !== 'materials' || selectedIds.size === 0) return undefined
    const ids = new Set(materials.filter(m => selectedIds.has(m.id)).map(m => m.materialGroupId ?? null))
    return ids.size === 1 ? [...ids][0] : null // null = nhiều nhóm khác nhau
  }, [mode, selectedIds, materials])

  // Sắt đã bị loại khỏi lựa chọn nên chỉ còn 1 loại field: % dự trù hao hụt khi mua.
  const fieldHint = mode === 'group' && !selectedGroup ? null : '% dự trù hao hụt khi mua'

  const count = mode === 'group' ? materialsInGroup.length : selectedIds.size
  const selectedSteelGroup = mode === 'group' && !!selectedGroup && isSteelGroup(selectedGroup.id)
  const canSubmit = count > 0 && !saving && !selectedSteelGroup

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    const value = valueStr.trim() === '' ? null : Number(valueStr)
    try {
      const result = mode === 'group'
        ? await bulkUpdateMaterialWaste({ materialGroupId: groupId, value })
        : await bulkUpdateMaterialWaste({ materialIds: [...selectedIds].map(String), value })
      const scope = mode === 'group' ? `nhóm "${selectedGroup?.name}"` : `${selectedIds.size} vật tư đã chọn`
      setOpen(false)
      reset()
      onDone({ count: result.updated, value, scope })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        <Percent size={14} /> Sửa hao hụt hàng loạt
      </button>

      <Modal open={open} onClose={close} maxWidth={620}>
        <h3 style={{ margin: '0 0 var(--space-5)', fontSize: 17, fontWeight: 700 }}>Sửa % hao hụt hàng loạt</h3>
        <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, lineHeight: 1.5 }}>
          Nhóm <b>Sắt</b> không có % hao hụt để sửa ở đây — ngưỡng hao hụt khi cắt do <b>KHSX</b> quyết định ở màn
          “Tối ưu cắt sắt”. Nhóm <b>Sắt tự tính</b> và các nhóm khác vẫn sửa được (% dự trù hao hụt khi mua).
        </div>

        {/* Segmented control - 2 nút chia đều chiều rộng, rõ ràng hơn 2 pill trôi nổi bên trái. */}
        <div style={{ display: 'flex', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 3, background: 'var(--surface2)' }}>
          {(['materials', 'group'] as Mode[]).map(m => (
            <button key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: 'none', transition: 'background .1s, color .1s',
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? 'var(--fg-3949ab)' : 'var(--text3)',
                boxShadow: mode === m ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.08))' : 'none',
              }}
            >{m === 'materials' ? 'Theo từng vật tư' : 'Theo cả nhóm vật tư'}</button>
          ))}
        </div>

        {mode === 'group' ? (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Nhóm vật tư</label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
            >
              <option value="">— Chọn nhóm —</option>
              {groups.map(g => (
                <option key={g.id} value={String(g.id)} disabled={isSteelGroup(g.id)}>
                  {g.name}{isSteelGroup(g.id) ? ' (KHSX quyết định)' : ''}
                </option>
              ))}
            </select>
            {groupId && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--fg-3949ab)', background: 'var(--bg-e3f2fd)', borderRadius: 20, padding: '4px 12px' }}>
                {materialsInGroup.length} vật tư trong nhóm này
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã hoặc tên vật tư..." width={9999} />
              </div>
              <button onClick={selectAllFiltered} style={{ flexShrink: 0, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: 'var(--fg-3949ab)', background: 'var(--bg-e3f2fd)', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>Chọn tất cả</button>
              <button onClick={clearSelection} style={{ flexShrink: 0, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>Bỏ chọn</button>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--border)', borderRadius: 8 }}>
              {filteredMaterials.length === 0 ? (
                <div style={{ padding: 20, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>Không tìm thấy vật tư nào</div>
              ) : filteredMaterials.map((m, i) => {
                const checked = selectedIds.has(m.id)
                return (
                  <label key={m.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                      background: checked ? 'var(--bg-e3f2fd)' : 'transparent',
                    }}
                  >
                    {/* globals.css ép `input { width: 100% }` cho mọi input kể cả checkbox - không
                        override width/height tường minh thì checkbox nuốt gần hết chiều rộng dòng
                        (thành 1 khối ~530px), đẩy toàn bộ chữ code/tên/nhóm ra ngoài vùng nhìn
                        thấy (D.hao-hut-hang-loat, phát hiện qua QA thực tế trên trình duyệt). */}
                    <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                    {/* 1 dòng duy nhất, cắt gọn bằng "..." thay vì để trình duyệt bóp chữ vỡ từng
                        ký tự khi khung hẹp (minWidth:0 bắt buộc để flex-basis không giữ nguyên độ
                        rộng tự nhiên của text, whiteSpace:nowrap + ellipsis mới có tác dụng). */}
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{m.code}</span>
                      <span style={{ color: 'var(--text2)' }}> — {m.name}</span>
                    </span>
                    <span style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                      background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20,
                      padding: '2px 9px', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{groupName(m.materialGroupId)}</span>
                  </label>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{selectedIds.size} vật tư đã chọn</div>
          </div>
        )}

        <div style={{ marginBottom: 6 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>% hao hụt mới</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number" min={0} max={100} step="any"
              value={valueStr}
              onChange={e => setValueStr(e.target.value)}
              placeholder="Để trống để xoá % hao hụt hiện có"
              style={{ width: '100%', padding: '8px 32px 8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
            />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13, pointerEvents: 'none' }}>%</span>
          </div>
          {fieldHint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Sẽ ghi vào: <strong style={{ color: 'var(--text2)' }}>{fieldHint}</strong></div>}
        </div>

        {error && <div style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{count > 0 ? `Áp dụng cho ${count} vật tư` : 'Chưa chọn vật tư nào'}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={close} disabled={saving} style={btnSecondary}>Hủy</button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--bg-3949ab)', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6 }}
            >
              {saving ? 'Đang lưu...' : 'Áp dụng'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
