'use client'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { http } from '../services/core/http'
import LenhCodeText from './LenhCodeText'

/**
 * Hiện MÃ LỆNH (số LSX nhà máy, lệnh gộp "MY-313 + GP-176") thay cho mã PI (2026-11-05: ẩn mã PI khỏi
 * giao diện - mã PI chỉ còn là khoá nội bộ, ô tìm kiếm vẫn tìm được theo nó). Dùng ở mọi màn đang có
 * sẵn mã PI trong dữ liệu: component tự gom mã PI của cả màn vào 1 lần gọi GET /lenh-codes, nhớ kết
 * quả vài phút. Lệnh chưa có số LSX (lệnh cũ) hoặc chuỗi không phải mã PI thì hiện nguyên chuỗi đưa vào.
 */

const PI_CODE = /^PI-\d{4}-\d+$/
const TTL_MS = 2 * 60 * 1000
const BATCH = 200

const cache = new Map<string, { display: string; at: number }>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let version = 0
let timer: ReturnType<typeof setTimeout> | null = null

function notify() {
  version++
  listeners.forEach(l => l())
}

async function flush() {
  timer = null
  const codes = [...pending]
  pending.clear()
  for (let i = 0; i < codes.length; i += BATCH) {
    const chunk = codes.slice(i, i + BATCH)
    try {
      const map = await http.get<Record<string, string>>(`/lenh-codes?codes=${encodeURIComponent(chunk.join(','))}`)
      const now = Date.now()
      for (const c of chunk) cache.set(c, { display: map[c] ?? c, at: now })
    } catch {
      // Lỗi mạng: hiện tạm mã PI, lần hiển thị sau tự hỏi lại (không ghi cache).
    }
  }
  notify()
}

function request(code: string) {
  const hit = cache.get(code)
  if ((hit && Date.now() - hit.at < TTL_MS) || pending.has(code)) return
  pending.add(code)
  if (!timer) timer = setTimeout(() => void flush(), 30)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Mã lệnh hiển thị của 1 mã PI (đang tải / không phải mã PI thì trả lại chính chuỗi đó). */
export function useLenhCode(piCode: string | null | undefined): string | null {
  useSyncExternalStore(subscribe, () => version, () => version)
  const code = piCode?.trim() || null
  const isPi = !!code && PI_CODE.test(code)
  useEffect(() => {
    if (isPi) request(code!)
  }, [code, isPi])
  if (!code) return null
  return isPi ? (cache.get(code)?.display ?? code) : code
}

/**
 * Đổi HÀNG LOẠT mã PI -> mã lệnh cho chỗ cần CHUỖI (tiêu đề, <option>, câu xác nhận, dữ liệu dựng sẵn
 * trong useMemo). Trả hàm dịch; hàm đổi danh tính mỗi khi có kết quả mới, nên đưa vào deps của useMemo.
 * Chuỗi không phải mã PI (vd mã đơn khách) đi qua nguyên vẹn.
 */
export function useLenhCodeLookup(codes: readonly (string | null | undefined)[]): (code: string | null | undefined) => string {
  const v = useSyncExternalStore(subscribe, () => version, () => version)
  const key = [...new Set(codes.filter((c): c is string => !!c && PI_CODE.test(c.trim())).map(c => c.trim()))].sort().join(',')
  useEffect(() => {
    if (key) key.split(',').forEach(request)
  }, [key])
  return useMemo(() => translatorFor(v), [v])
}

// Hàm dịch gắn với 1 "phiên bản" cache - đổi phiên bản (có kết quả mới) thì ra hàm mới, nơi gọi tính lại.
function translatorFor(cacheVersion: number): (code: string | null | undefined) => string {
  void cacheVersion
  return (code) => {
    const c = code?.trim() ?? ''
    return PI_CODE.test(c) ? (cache.get(c)?.display ?? c) : c
  }
}

/** Mã lệnh của 1 chuỗi mã PI; `fallback` khi rỗng. Chuỗi nhiều mã nối ", " được đổi từng mã. */
export default function LenhCode({ piCode, fallback = '—' }: { piCode: string | null | undefined; fallback?: string }) {
  const parts = (piCode ?? '').split(', ').filter(Boolean)
  if (parts.length > 1) {
    return <>{parts.map((p, i) => <span key={p}>{i > 0 && ', '}<LenhCode piCode={p} /></span>)}</>
  }
  return <Single piCode={parts[0]} fallback={fallback} />
}

function Single({ piCode, fallback }: { piCode: string | undefined; fallback: string }) {
  const display = useLenhCode(piCode)
  return display ? <LenhCodeText code={display} /> : <>{fallback}</>
}
