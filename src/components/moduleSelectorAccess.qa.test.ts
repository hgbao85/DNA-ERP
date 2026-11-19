// QA (tester-unit) 19/11/2026 - AC2, AC3 của Q2: bảng đầy đủ vai x thẻ so với LUẬT CŨ (sao nguyên từ
// git show HEAD:src/components/ModuleSelector.tsx, trước khi tách hàm) + ca biên.
import { describe, it, expect } from 'vitest'
import { isModuleAccessible, isModuleImplemented, IMPLEMENTED_MODULE_IDS } from './moduleSelectorAccess'
import { isDirector } from '../utils/resolveDefaultModule'

type U = { role?: string | null; mfgRole?: string | null; isSale?: boolean; isPurchaser?: boolean; isProductPlanner?: boolean } | null | undefined

// Luật cũ, sao nguyên văn từ HEAD (chỉ đổi mod.id -> id, user giữ nguyên).
function legacyAccessible(id: string, user: U): boolean {
  const isImplemented = id === 'sales' || id === 'production' || id === 'purchasing' || id === 'inbound_warehouse' || id === 'production_plan'
  if (!isImplemented) return false
  if (id === 'sales') return (user?.role === 'BOSS' && !user?.mfgRole) || !!user?.isSale
  if (id === 'production') return user?.role === 'BOSS' || !!user?.mfgRole
  if (id === 'purchasing') return (user?.role === 'BOSS' && !user?.mfgRole) || !!user?.isPurchaser
  if (id === 'inbound_warehouse') {
    if (user?.mfgRole || user?.isProductPlanner || user?.isPurchaser || user?.isSale) return false
    return user?.role === 'WAREHOUSE_STAFF' || user?.role === 'BOSS'
  }
  if (id === 'production_plan') return (user?.role === 'BOSS' && !user?.mfgRole) || !!user?.isProductPlanner
  return false
}

// Id thẻ trong ALL_MODULES của ModuleSelector.tsx (thẻ boss là thẻ mới).
const OLD_CARD_IDS = ['sales', 'production_plan', 'purchasing', 'inbound_warehouse', 'qc', 'production', 'shipping', 'ap_accounting', 'ar_accounting']
const ALL_IDS = ['boss', ...OLD_CARD_IDS, 'khong_ton_tai']

// Sinh mọi tổ hợp role x mfgRole x 3 cờ.
const ROLES = ['BOSS', 'ADMIN', 'WAREHOUSE_STAFF', 'EMPLOYEE', undefined, null]
const MFG = [undefined, null, 'HAN', 'PRODUCTION_MANAGER']
const BOOL = [false, true]
const USERS: U[] = []
for (const role of ROLES) for (const mfgRole of MFG) for (const isSale of BOOL) for (const isPurchaser of BOOL) for (const isProductPlanner of BOOL) {
  USERS.push({ role, mfgRole, isSale, isPurchaser, isProductPlanner })
}

describe('QA AC3 - luật các thẻ cũ không đổi so với HEAD', () => {
  it(`bảng đầy đủ: ${USERS.length} tổ hợp user x ${OLD_CARD_IDS.length} thẻ cũ khớp luật cũ`, () => {
    const diffs: string[] = []
    for (const u of USERS) for (const id of OLD_CARD_IDS) {
      if (isModuleAccessible(id, u) !== legacyAccessible(id, u)) diffs.push(`${id} ${JSON.stringify(u)}`)
    }
    expect(diffs).toEqual([])
  })

  it('AC3 user null / undefined: mọi thẻ cũ đều false như luật cũ', () => {
    for (const id of OLD_CARD_IDS) {
      expect(isModuleAccessible(id, null)).toBe(false)
      expect(isModuleAccessible(id, undefined)).toBe(false)
      expect(legacyAccessible(id, null)).toBe(false)
    }
  })

  it('AC3 danh sách "đã làm" giữ 5 thẻ cũ, chỉ thêm boss', () => {
    expect([...IMPLEMENTED_MODULE_IDS].sort()).toEqual(['boss', 'inbound_warehouse', 'production', 'production_plan', 'purchasing', 'sales'])
    for (const id of ['qc', 'shipping', 'ap_accounting', 'ar_accounting', 'khong_ton_tai']) expect(isModuleImplemented(id)).toBe(false)
  })

  it('AC3 ADMIN không vào thẻ nghiệp vụ nào (kể cả boss)', () => {
    const admin = { role: 'ADMIN' }
    for (const id of ALL_IDS) expect(isModuleAccessible(id, admin)).toBe(false)
  })
})

describe('QA AC2 - thẻ boss chỉ bấm được khi isDirector', () => {
  it('khớp isDirector() với mọi tổ hợp user', () => {
    for (const u of USERS) {
      // isDirector nhận User đầy đủ; chỉ đọc role + mfgRole nên ép kiểu an toàn.
      expect(isModuleAccessible('boss', u)).toBe(isDirector(u as never))
    }
  })

  it('BOSS không mfgRole -> true; mfgRole có giá trị -> false; mfgRole rỗng/null -> true', () => {
    expect(isModuleAccessible('boss', { role: 'BOSS' })).toBe(true)
    expect(isModuleAccessible('boss', { role: 'BOSS', mfgRole: null })).toBe(true)
    expect(isModuleAccessible('boss', { role: 'BOSS', mfgRole: 'HAN' })).toBe(false)
  })

  it('thẻ boss: không ai ngoài BOSS vào được, dù có cờ sale/mua/KHSX', () => {
    for (const u of USERS) {
      if ((u as { role?: string | null }).role !== 'BOSS') expect(isModuleAccessible('boss', u)).toBe(false)
    }
    expect(isModuleAccessible('boss', null)).toBe(false)
    expect(isModuleAccessible('boss', undefined)).toBe(false)
    expect(isModuleAccessible('boss', { role: 'WAREHOUSE_STAFF' })).toBe(false)
  })
})
