import { createContext, useContext } from 'react'

/** Mở khung quét QR trong app từ bất kỳ chỗ nào của màn công nhân (24/11/2026). null = màn không hỗ trợ (vd trong test). */
export const ScannerContext = createContext<(() => void) | null>(null)

export function useOpenScanner(): (() => void) | null {
  return useContext(ScannerContext)
}
