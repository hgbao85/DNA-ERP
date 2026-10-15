import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newUuid } from './uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newUuid', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('dùng crypto.randomUUID khi có (HTTPS / localhost)', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
    expect(newUuid()).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('trang http://IP-LAN: không có randomUUID thì vẫn ra UUID v4 hợp lệ, không trùng', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => {
        for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256)
        return a
      },
    })
    const ids = new Set(Array.from({ length: 200 }, () => newUuid()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(V4)
  })

  it('không có cả crypto thì vẫn ra UUID v4 hợp lệ', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newUuid()).toMatch(V4)
  })
})

/**
 * Chặn lỗi đã gặp ở bước 0: ai đó viết lại `crypto.randomUUID()` thẳng trong code app thì trên điện thoại mở app qua
 * http://IP (không phải secure context) nút Lưu sẽ chết. Mọi nơi phải đi qua newUuid().
 */
describe('không gọi crypto.randomUUID() trực tiếp', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.endsWith(join('core', 'uuid.ts'))) files.push(p)
    }
  }
  walk(root)

  it('trong src (trừ uuid.ts)', () => {
    const bad = files.filter((f) => /\bcrypto\.randomUUID\b/.test(readFileSync(f, 'utf8')))
    expect(bad.map((f) => f.slice(root.length))).toEqual([])
  })
})
