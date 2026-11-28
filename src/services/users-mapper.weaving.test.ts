import { describe, expect, it } from 'vitest'
import type { BeUserProfile } from '../types/auth'
import { deriveRoleIds, mapBeToFe } from './users-mapper'

/** Điều phối đan (28/11/2026): Admin gán được chức năng văn phòng "Điều phối đan" -> vai BE WEAVING_COORDINATOR. */
describe('users-mapper - Điều phối đan', () => {
  const roleId = { WAREHOUSE_STAFF: 'r-wh', WEAVING_COORDINATOR: 'r-wc', PURCHASER: 'r-pu' }

  it('cờ isWeavingCoordinator -> gửi kèm vai WEAVING_COORDINATOR', () => {
    expect(deriveRoleIds({ role: 'WAREHOUSE_STAFF', isWeavingCoordinator: true }, roleId)).toEqual(['r-wh', 'r-wc'])
    expect(deriveRoleIds({ role: 'WAREHOUSE_STAFF', isPurchaser: true }, roleId)).toEqual(['r-wh', 'r-pu'])
  })

  it('DB chưa có vai (chưa chạy migration) -> không gửi id rỗng', () => {
    expect(deriveRoleIds({ role: 'WAREHOUSE_STAFF', isWeavingCoordinator: true }, { WAREHOUSE_STAFF: 'r-wh' })).toEqual(['r-wh'])
  })

  it('đọc vai từ BE ra cờ để form sửa chọn đúng chức năng', () => {
    const u = { id: 'u1', username: 'dpd', firstName: 'Đan', lastName: 'Điều phối', email: null, roles: ['WAREHOUSE_STAFF', 'WEAVING_COORDINATOR'] } as unknown as BeUserProfile
    expect(mapBeToFe(u).isWeavingCoordinator).toBe(true)
    expect(mapBeToFe({ ...u, roles: ['WAREHOUSE_STAFF'] } as BeUserProfile).isWeavingCoordinator).toBe(false)
  })
})
