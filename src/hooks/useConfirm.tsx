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
  const actionRef = useRef<(() => void | Promise<void>) | null>(null)

  const ask = useCallback((opts: ConfirmOptions, action: () => void | Promise<void>) => {
    actionRef.current = action
    setOptions(opts)
  }, [])

  const handleCancel = useCallback(() => {
    if (busy) return
    actionRef.current = null
    setOptions(null)
  }, [busy])

  const handleConfirm = useCallback(async () => {
    const action = actionRef.current
    if (!action) return
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
      actionRef.current = null
      setOptions(null)
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
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { ask, confirmModal }
}
