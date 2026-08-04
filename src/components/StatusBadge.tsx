interface StatusBadgeProps {
  label: string
  color: string
  bg: string
}

/**
 * Badge trạng thái thuần hiển thị — không biết gì về domain (Sku, PurchaseOrder, Quotation...).
 * Nơi gọi tự tra cứu {label, color, bg} từ status map của domain mình rồi truyền vào.
 */
export default function StatusBadge({ label, color, bg }: StatusBadgeProps) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      color, background: bg, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
