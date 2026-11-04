import { contEquivalent, fmtCont } from '../utils/containerLoad'
import type { ContainerLoad } from '../types/containerLoad'

/**
 * Dòng chữ nhỏ "Load cont 80 · ≈ 2,5 cont" dưới dòng SKU (đơn hàng, lệnh sản xuất). Chưa có load cont -> "Chưa có load cont"
 * (màu nhạt). `qty` = số bộ của dòng đó; bỏ qua thì chỉ hiện load cont.
 */
export default function ContainerLoadHint({ containerLoad, qty }: { containerLoad?: ContainerLoad | null; qty?: number | null }) {
  const load = containerLoad?.loadCont ?? null
  if (load == null) {
    return <span style={{ fontSize: 11, color: 'var(--text3)', opacity: 0.7 }}>Chưa có load cont</span>
  }
  const cont = qty != null && qty > 0 ? contEquivalent(qty, load) : null
  return (
    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
      Load cont {load}{cont !== null ? ` · ≈ ${fmtCont(cont)} cont` : ''}
    </span>
  )
}
