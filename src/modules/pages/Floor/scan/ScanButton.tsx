import { ScanLine } from 'lucide-react'
import { isQrScanEnabled } from '../../../../constants/featureFlags'
import { btn } from './scanUi'

/** Nút quét tem trong app - to, dễ bấm khi đeo găng. Công tắc NEXT_PUBLIC_QR_SCAN_ENABLED tắt thì không hiện gì. */
export default function ScanButton({ onClick, label = 'Quét mã QR' }: { onClick: () => void; label?: string }) {
  if (!isQrScanEnabled()) return null
  return (
    <button type="button" onClick={onClick} style={{ ...btn(true), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <ScanLine size={22} aria-hidden /> {label}
    </button>
  )
}
