import { useCallback, useRef, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actionRef = useRef<(() => void | Promise<void>) | null>(null)

  const ask = useCallback((opts: ConfirmOptions, action: () => void | Promise<void>) => {
    actionRef.current = action
    setError(null)
    setOptions(opts)
  }, [])

  const handleCancel = useCallback(() => {
    if (busy) return
    actionRef.current = null
    setError(null)
    setOptions(null)
  }, [busy])

  const handleConfirm = useCallback(async () => {
    const action = actionRef.current
    if (!action) return
    setBusy(true)
    setError(null)
    try {
      await action()
      actionRef.current = null
      setOptions(null)
    } catch (e) {
      // Giữ modal mở + hiện lỗi thật (vd BE từ chối xóa vì ràng buộc dữ liệu) thay vì đóng
      // modal như đã thành công rồi để lỗi rơi vào unhandled rejection.
      console.error('Confirm action error:', e)
      setError(e instanceof Error ? e.message : 'Không thể thực hiện thao tác')
    } finally {
      setBusy(false)
    }
  }, [])

  const confirmModal = (
    <ConfirmModal
      open={!!options}
      title={options?.title}
      message={options?.message ?? ''}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      danger={options?.danger}
      busy={busy}
      error={error}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { ask, confirmModal }
}
