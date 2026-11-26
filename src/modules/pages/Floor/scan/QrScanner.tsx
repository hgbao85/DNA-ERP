'use client'

/**
 * Khung quét tem QR bằng camera ngay trong app (24/11/2026). Đọc ảnh camera ~6 lần/giây bằng jsQR (chạy được cả iPhone,
 * không phụ thuộc BarcodeDetector). Đọc được tem hợp lệ (tem máy, hoặc tem pallet Sơn khi `accept` cho phép) thì gọi onScanned(kết
 * quả) và đóng; mã lạ thì báo, quét tiếp.
 * Camera chỉ mở được trên trang https (hoặc localhost) - không mở được thì báo và gợi ý dùng app camera như cũ.
 */
import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { cameraErrorText, parseWorkstationQr, wrongKindText, type FloorQr } from './qrScan'
import { Banner } from './ScanParts'
import { btn } from './scanUi'

const SCAN_INTERVAL_MS = 160
/** Cạnh dài tối đa của ảnh đưa vào jsQR - ảnh camera lớn đọc chậm trên máy yếu. */
const MAX_SIDE = 640

const ALL_KINDS: readonly FloorQr['kind'][] = ['ws', 'pallet']

/** `accept`: loại tem nhận (mặc định cả tem máy và tem pallet). Tem khác loại thì báo như mã lạ. */
export default function QrScanner({ onScanned, onClose, accept = ALL_KINDS, title = 'Đưa tem QR của máy / khu nhận sắt / pallet vào khung' }: {
  onScanned: (qr: FloorQr) => void
  onClose: () => void
  accept?: readonly FloorQr['kind'][]
  title?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [notTem, setNotTem] = useState<string | null>(null)
  const doneRef = useRef(false)
  // Đọc qua ref: đổi `accept` / `onScanned` (vd hàm tạo lại mỗi lần vẽ) không mở lại camera.
  const acceptRef = useRef(accept)
  useEffect(() => { acceptRef.current = accept }, [accept])
  const onScannedRef = useRef(onScanned)
  useEffect(() => { onScannedRef.current = onScanned }, [onScanned])

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const tick = () => {
      if (cancelled || doneRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
        const w = Math.round(video.videoWidth * scale)
        const h = Math.round(video.videoHeight * scale)
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h)
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
          if (code?.data) {
            const parsed = parseWorkstationQr(code.data)
            if (parsed.ok && acceptRef.current.includes(parsed.kind)) {
              doneRef.current = true
              if (navigator.vibrate) navigator.vibrate(80)
              onScannedRef.current(parsed)
              return
            }
            setNotTem(parsed.ok ? wrongKindText(parsed.kind, acceptRef.current) : parsed.error)
          }
        }
      }
      timer = setTimeout(tick, SCAN_INTERVAL_MS)
    }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(cameraErrorText('NO_MEDIA'))
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play().catch(() => undefined)
        tick()
      } catch (e) {
        setError(cameraErrorText((e as { name?: string })?.name))
      }
    }
    void start()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-label="Quét mã QR" style={{
      position: 'fixed', inset: 0, zIndex: 50, background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px', color: '#fff', fontSize: 17, fontWeight: 600, textAlign: 'center' }}>
        {title}
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {!error && (
          <div aria-hidden style={{
            position: 'absolute', top: '50%', left: '50%', width: '70vmin', height: '70vmin', transform: 'translate(-50%, -50%)',
            border: '3px solid #fff', borderRadius: 16, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.45)',
          }} />
        )}
        <canvas ref={canvasRef} hidden />
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
        {error && <Banner tone="err">{error}</Banner>}
        {!error && notTem && <Banner tone="warn">{notTem} Quét đúng tem dán ở máy / khu làm việc / pallet.</Banner>}
        <button type="button" onClick={onClose} style={btn(false)}>Đóng</button>
      </div>
    </div>
  )
}
