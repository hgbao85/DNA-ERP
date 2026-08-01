import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { PlanForm } from '../../../types/plan-form'

// ─── Gộp 2 trang "Danh sách vật tư" (Phụ kiện + Bao bì) — cùng cấu trúc dữ liệu,
// chỉ khác group key trong MaterialType. Tab để chuyển giữa 2 nhóm, không đổi route/menu riêng.
//
// Việc 2: catalog nay là Material thật (kind=ACCESSORY/PACKAGING, quản lý ở Admin > Vật tư) thay
// vì quét lịch sử PlanForm — trang này chỉ còn vai trò xem nhanh đã lọc sẵn theo loại, tiện tra
// cứu khi nhập định mức ở SpecAccessoryPage/SpecPackagingPage.
type Group = 'vatTuPhuKien' | 'baoBiDongGoi'

const GROUP_LABELS: Record<Group, { tab: string; hint: string; kind: string; maHeader: string; searchPlaceholder: string }> = {
  vatTuPhuKien: {
    tab: 'Phụ kiện',
    hint: 'Vật tư thật (Admin > Vật tư, kind=ACCESSORY) — dùng để chọn khi nhập định mức',
    kind: 'ACCESSORY',
    maHeader: 'Mã phụ kiện',
    searchPlaceholder: 'Tìm theo mã hoặc tên phụ kiện…',
  },
  baoBiDongGoi: {
    tab: 'Bao bì',
    hint: 'Vật tư thật (Admin > Vật tư, kind=PACKAGING) — dùng để chọn khi nhập định mức',
    kind: 'PACKAGING',
    maHeader: 'Mã bao bì',
    searchPlaceholder: 'Tìm theo mã hoặc tên bao bì…',
  },
}

export default function SpecAccessoryCatalogPage() {
  const { data: planFormsData } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])
  const planForms = (planFormsData ?? []).filter(pf => pf.status !== 'DRAFT')
  const { data: materialsData } = useFetch(() => api.getMaterials(), [])
  const materials = materialsData ?? []

  const [group, setGroup] = useState<Group>('vatTuPhuKien')
  const [catalogSearch, setCatalogSearch] = useState('')

  const itemsOf = (pf: PlanForm, g: Group) => pf.quotaManagement?.materialType?.[g] ?? []
  const reviewOf = (pf: PlanForm, g: Group) => pf.quotaManagement?.reviewStatus?.[g]

  const labels = GROUP_LABELS[group]
  const catalog = materials.filter(m => m.kind === labels.kind)

  const rejectedGroups = planForms
    .filter(pf => reviewOf(pf, group)?.status === 'REJECTED')
    .map(pf => ({
      ten: `${pf.mfgProduct?.factoryCode ?? ''} — ${pf.mfgProduct?.name ?? ''}`.replace(/^— | —$/g, ''),
      items: itemsOf(pf, group),
      reason: reviewOf(pf, group)?.reason,
    }))

  const filtered = catalog.filter(c => {
    const q = catalogSearch.toLowerCase()
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  })

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách vật tư</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>{labels.hint}</p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(Object.keys(GROUP_LABELS) as Group[]).map(g => (
          <button
            key={g}
            onClick={() => { setGroup(g); setCatalogSearch('') }}
            style={{
              padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: group === g ? '#e65100' : 'var(--text3)',
              borderBottom: group === g ? '2px solid #e65100' : '2px solid transparent',
              marginBottom: -1,
            }}
          >{GROUP_LABELS[g].tab}</button>
        ))}
      </div>

      {rejectedGroups.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#c62828', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#ffebee', color: '#c62828', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>✕ Từ chối</span>
            <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>{rejectedGroups.length} SKU</span>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid #ffcdd2', borderLeft: '4px solid #c62828', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#ffebee', borderBottom: '1px solid #ffcdd2' }}>
                  {['SKU', labels.maHeader, 'Số lượng', 'Lý do từ chối'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#b71c1c', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rejectedGroups.flatMap((g, gi) => g.items.map((it, i) => (
                  <tr key={`${gi}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)' }}>{g.ten}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{it.name}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{it.quantity ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#c62828', fontSize: 13 }}>{g.reason || '—'}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          value={catalogSearch}
          onChange={e => setCatalogSearch(e.target.value)}
          placeholder={labels.searchPlaceholder}
          style={{ maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
        />
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {[labels.maHeader, 'Tên vật tư', 'ĐVT'].map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i, arr) => (
              <tr key={item.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.code}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>{item.name}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.unit || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                  {catalogSearch ? 'Không tìm thấy kết quả.' : `Chưa có vật tư kind=${labels.kind} nào — thêm ở Admin > Vật tư.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
