import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Giữ ngưỡng tương phản của màn công nhân (/floor): đọc thẳng token trong globals.css, nếu ai đổi màu làm
 * chữ phụ/nút xuống dưới 4.5:1 (chuẩn WCAG AA chữ thường) thì test này đỏ. Ngoài xưởng ánh sáng gắt nên không
 * nới ngưỡng. Token chung --text3 (≈2.6:1) KHÔNG dùng được ở /floor - màn này dùng --floor-hint.
 */
const css = readFileSync(fileURLToPath(new URL('../../../app/globals.css', import.meta.url)), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {')
  if (start < 0) throw new Error(`Không thấy khối CSS ${selector}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const lum = (hex: string) => {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** Giá trị token, nếu là var(--x) thì lần theo sang token gốc của cùng theme. */
const resolve = (tokens: Record<string, string>, v: string): string => {
  const m = /^var\(--([\w-]+)\)$/.exec(v)
  return m ? resolve(tokens, tokens[m[1]]) : v
}

const light = block(':root')
const dark = { ...light, ...block(':root[data-theme="dark"]') }
const floorLight = block('.floor-root')
const floorDark = block(':root[data-theme="dark"] .floor-root')

describe('màn công nhân - tương phản tối thiểu 4.5:1', () => {
  for (const [name, base, floor] of [
    ['giao diện sáng', light, floorLight],
    ['giao diện tối', dark, floorDark],
  ] as const) {
    describe(name, () => {
      const t = (k: string) => resolve({ ...base, ...floor }, base[k] !== undefined && floor[k] === undefined ? base[k] : (floor[k] ?? base[k]))
      const hint = () => resolve({ ...base, ...floor }, floor['floor-hint'] ?? floorLight['floor-hint'])

      it('chữ gợi ý (--floor-hint) đọc được trên nền, thẻ và nút khoá', () => {
        for (const bg of ['bg', 'surface', 'surface2']) {
          expect(ratio(hint(), t(bg)), `hint/${bg}`).toBeGreaterThanOrEqual(4.5)
        }
      })

      it('nút chính: chữ trắng trên --floor-primary', () => {
        const primary = resolve({ ...base, ...floor }, floor['floor-primary'] ?? floorLight['floor-primary'])
        expect(ratio('#ffffff', primary)).toBeGreaterThanOrEqual(4.5)
      })

      it('tab đang chọn đọc được trên thẻ', () => {
        const active = resolve({ ...base, ...floor }, floor['floor-tab-active'] ?? floorLight['floor-tab-active'])
        expect(ratio(active, t('surface'))).toBeGreaterThanOrEqual(4.5)
      })

      it('chữ phụ --text2 và các màu trạng thái trên nền của chúng', () => {
        expect(ratio(t('text2'), t('surface'))).toBeGreaterThanOrEqual(4.5)
        for (const [fg, bg] of [['red', 'red-bg'], ['amber', 'amber-bg'], ['green', 'green-bg'], ['blue-text', 'blue-bg']]) {
          expect(ratio(t(fg), t(bg)), `${fg}/${bg}`).toBeGreaterThanOrEqual(4.5)
        }
      })
    })
  }

  it('token chung --text3 đúng là KHÔNG đạt (lý do tồn tại của --floor-hint) - nếu test này đỏ, nghĩa là đã sửa token chung, có thể bỏ --floor-hint', () => {
    expect(ratio(light['text3'], light['surface'])).toBeLessThan(4.5)
  })
})
