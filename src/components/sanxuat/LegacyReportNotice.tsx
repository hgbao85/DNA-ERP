'use client'

/** Dòng thông báo: số lượng làm xong nay báo bằng quét mã QR tại máy, màn này chỉ để xem. */
export default function LegacyReportNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" style={{
      padding: '9px 14px', marginBottom: 14, borderRadius: 10, fontSize: 13, lineHeight: 1.4,
      background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)',
    }}>
      {children}
    </div>
  )
}
