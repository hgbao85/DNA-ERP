import { describe, expect, it } from 'vitest'
import { scopePurchasingRows } from './purchaseScope'

const piRows = [
  { name: 'Sắt', qty: 3, materialId: 'S1' },
  { name: 'Đinh', qty: 150, materialId: 'N1' },
  { name: 'Dây 1', qty: 20, materialId: 'W1' },
  { name: 'Dây 2', qty: 15, materialId: 'W2' },
  { name: 'Nệm 1', qty: 10, materialId: 'C1' },
  { name: 'Nệm 2', qty: 5, materialId: 'C2' },
]

describe('scopePurchasingRows', () => {
  it('mỗi SKU chỉ thấy dây/nệm của loại mình chọn', () => {
    const a = scopePurchasingRows(piRows, ['W1', 'C1'], [['W2', 'C2']]).map(r => r.name)
    const b = scopePurchasingRows(piRows, ['W2', 'C2'], [['W1', 'C1']]).map(r => r.name)
    expect(a).toEqual(['Sắt', 'Đinh', 'Dây 1', 'Nệm 1'])
    expect(b).toEqual(['Sắt', 'Đinh', 'Dây 2', 'Nệm 2'])
  })

  it('sắt/đinh giữ số gộp cả PI và được đánh dấu mua chung; dây/nệm riêng thì không', () => {
    const rows = scopePurchasingRows(piRows, ['W1', 'C1'], [['W2', 'C2']])
    expect(rows.find(r => r.name === 'Sắt')).toMatchObject({ qty: 3, sharedPi: true })
    expect(rows.find(r => r.name === 'Đinh')).toMatchObject({ qty: 150, sharedPi: true })
    expect(rows.find(r => r.name === 'Dây 1')?.sharedPi).toBe(false)
    expect(rows.find(r => r.name === 'Nệm 1')?.sharedPi).toBe(false)
  })

  it('PI chỉ có 1 SKU: không ẩn gì và không ghi chú mua chung', () => {
    const rows = scopePurchasingRows(piRows, ['W1', 'C1'], [])
    expect(rows).toHaveLength(piRows.length)
    expect(rows.every(r => r.sharedPi === false)).toBe(true)
  })

  it('2 SKU cùng chọn 1 loại dây: số lượng là cộng dồn nên vẫn là mua chung', () => {
    const rows = scopePurchasingRows(piRows, ['W1'], [['W1']])
    expect(rows.find(r => r.name === 'Dây 1')?.sharedPi).toBe(true)
  })

  it('SKU không chọn dây/nệm (đơn cũ) thì ẩn loại của dòng khác, vật tư không rõ id coi là mua chung', () => {
    const withUnknown: { name: string; qty: number; materialId?: string }[] = [...piRows, { name: 'Lạ', qty: 1 }]
    const rows = scopePurchasingRows(withUnknown, [], [['W1', 'C1']])
    expect(rows.map(r => r.name)).toEqual(['Sắt', 'Đinh', 'Dây 2', 'Nệm 2', 'Lạ'])
    expect(rows.find(r => r.name === 'Lạ')?.sharedPi).toBe(true)
  })
})
