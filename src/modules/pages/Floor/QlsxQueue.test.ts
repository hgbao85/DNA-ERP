import { describe, expect, it } from 'vitest'
import { queueActorText } from './QlsxQueue'

describe('queueActorText', () => {
  it('có tên người bấm thì ghi tên', () => expect(queueActorText('PHOI', 'Nguyễn A', '2026-11-14T01:00:00Z')).toBe(' · Nguyễn A'))
  it('tổ Phôi không ai bấm (hệ thống tự đóng / tự chạy lệnh kế) thì ghi rõ', () =>
    expect(queueActorText('PHOI', null, '2026-11-14T01:00:00Z')).toBe(' · hệ thống tự chuyển'))
  it('tổ Phôi chưa có giờ thì không ghi gì', () => expect(queueActorText('PHOI', null, null)).toBe(''))
  it('tổ Hàn / Sơn vẫn do QLSX bấm - thiếu tên thì không đoán', () => expect(queueActorText('HAN', null, '2026-11-14T01:00:00Z')).toBe(''))
})
