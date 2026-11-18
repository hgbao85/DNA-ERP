import { describe, expect, it } from 'vitest'
import { cutTypeChangeMessage, offMessage, workshopChangeMessage } from './workstationConfirm'

const w = { code: 'LASER-01', name: 'Máy laser số 1' }

describe('offMessage', () => {
  it('máy cắt: có "Chưa chia" và "Máy này đang tắt"', () => {
    const t = offMessage(w, true)
    expect(t.message).toContain('Chưa chia')
    expect(t.message).toContain('Máy này đang tắt')
    expect(t.message).toContain('LASER-01')
  })
  it('máy không phải máy cắt: không có "Chưa chia", vẫn có "Máy này đang tắt"', () => {
    const t = offMessage({ code: 'HAN-01', name: 'Điểm Hàn' }, false)
    expect(t.message).not.toContain('Chưa chia')
    expect(t.message).toContain('Máy này đang tắt')
  })
})

describe('máy cắt đã cắt dở', () => {
  it('tắt máy cắt: nhắc phần đã cắt dở cũng về Chưa chia, chia lại phải bớt số cây đã cắt', () => {
    const m = offMessage(w, true).message
    expect(m).toContain('đã cắt dở')
    expect(m).toContain('bớt số cây đã cắt')
    expect(m).toContain('không cắt lại')
  })
  it('đổi xưởng máy cắt: cùng ý; máy khác thì không nhắc', () => {
    expect(workshopChangeMessage(w, 'A', 'B', true).message).toContain('bớt số cây đã cắt')
    expect(workshopChangeMessage(w, 'A', 'B', false).message).not.toContain('đã cắt dở')
    expect(offMessage(w, false).message).not.toContain('đã cắt dở')
  })
})

describe('workshopChangeMessage', () => {
  it('ghi xưởng cũ → xưởng mới', () => {
    const t = workshopChangeMessage(w, 'Xưởng A', 'Xưởng B')
    expect(t.message).toContain('Xưởng A → Xưởng B')
  })
  it('máy cắt: dòng chia về Chưa chia; máy khác thì không nhắc', () => {
    expect(workshopChangeMessage(w, 'Xưởng A', 'Xưởng B', true).message).toContain('Chưa chia')
    expect(workshopChangeMessage(w, 'Xưởng A', 'Xưởng B', false).message).not.toContain('Chưa chia')
  })
  it('chưa gán xưởng thì ghi "chưa gán xưởng"', () => {
    expect(workshopChangeMessage(w, null, 'Xưởng B').message).toContain('chưa gán xưởng → Xưởng B')
  })
})

describe('cutTypeChangeMessage', () => {
  it('ghi loại cũ → loại mới', () => {
    const t = cutTypeChangeMessage(w, 'laser', 'tu_dong')
    expect(t.message).toContain('MC Laser → MC Tự động')
  })
  it('chưa có loại cũ', () => {
    expect(cutTypeChangeMessage(w, null, 'laser').message).toContain('chưa chọn loại → MC Laser')
  })
})
