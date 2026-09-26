'use client'

/**
 * Đồng bộ 1 giá trị với query string (?key=value) - để URL luôn phản ánh màn đang mở, cho
 * F5/nút Back/link từ thông báo mở đúng chỗ thay vì chỉ có trong state React (xem changelog
 * notification 2026-09-25, mục 6.2 "Điều hướng theo link"). `router.replace` (không phải push) khi
 * đổi giá trị trong lúc thao tác bình thường - đổi tab không nên đẻ thêm 1 bước Back cho mỗi lần
 * bấm; nơi cần push thật (mở hẳn 1 bản ghi từ thông báo, muốn Back quay lại được) tự gọi
 * `router.push` riêng, hook này chỉ lo phần đọc/ghi query string.
 *
 * Component gọi hook này phải nằm trong 1 <Suspense> boundary (useSearchParams đòi hỏi của
 * Next.js App Router) - xem app/page.tsx.
 */
import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function useUrlState(
  key: string,
): [string | null, (value: string | null) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const value = searchParams.get(key)

  const setValue = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === null) params.delete(key)
      else params.set(key, next)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [key, pathname, router, searchParams],
  )

  return [value, setValue]
}

/** Đọc 1 param KHÔNG đồng bộ ngược - dùng cho "gợi ý mở gì lúc vào trang" (vd proposalId đi kèm
 *  `p` trong link thông báo) chứ không đại diện cho 1 state UI đổi qua lại. */
export function useUrlParamValue(key: string): string | null {
  const searchParams = useSearchParams()
  return searchParams.get(key)
}
