'use client'

import { useEffect } from 'react'
import { useUrlState } from '../hooks/useUrlState'

/**
 * Mở thẳng đúng MỤC từ thông báo (changelog notification mục 29.3): URL có `?focus=<entityType>:<entityId>`
 * -> tìm phần tử `[data-focus-id="<cùng khoá>"]` (rải bằng `focusAttr()` ở dòng/thẻ danh sách), cuộn tới giữa
 * màn và nháy sáng vài lần. Danh sách thường tải SAU khi màn mở nên dùng MutationObserver chờ tối đa
 * `WAIT_MS`; không thấy (đối tượng đã xoá/lọc ẩn) thì thôi - người dùng vẫn ở đúng màn. Xong thì bỏ
 * `focus` khỏi URL (replace, không thêm nấc lịch sử) để F5/chia sẻ link không nháy lại.
 */
const WAIT_MS = 8000
const FLASH_MS = 4000

export default function NotificationFocus() {
  const [focus, setFocus] = useUrlState('focus')

  useEffect(() => {
    if (!focus) return
    const selector = `[data-focus-id~="${CSS.escape(focus)}"]`
    let finished = false
    let flashTimer: ReturnType<typeof setTimeout> | undefined
    let giveUpTimer: ReturnType<typeof setTimeout> | undefined
    let observer: MutationObserver | undefined

    const finish = () => {
      finished = true
      observer?.disconnect()
      if (giveUpTimer) clearTimeout(giveUpTimer)
      setFocus(null)
    }

    const tryFocus = (): boolean => {
      const el = document.querySelector<HTMLElement>(selector)
      if (!el) return false
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('notif-focus-flash')
      flashTimer = setTimeout(() => el.classList.remove('notif-focus-flash'), FLASH_MS)
      finish()
      return true
    }

    if (!tryFocus()) {
      observer = new MutationObserver(() => {
        if (!finished) tryFocus()
      })
      observer.observe(document.body, { childList: true, subtree: true })
      giveUpTimer = setTimeout(() => {
        if (!finished) finish()
      }, WAIT_MS)
    }

    return () => {
      observer?.disconnect()
      if (giveUpTimer) clearTimeout(giveUpTimer)
      if (flashTimer) clearTimeout(flashTimer)
    }
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps -- setFocus ổn định theo URL, không đưa vào deps

  return null
}
