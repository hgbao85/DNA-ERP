/**
 * Câu hỏi lại ở "Máy & tem QR" (QLSX, 2026-11-18): tắt máy, đổi xưởng, đổi loại máy cắt. Hàm thuần để test; QlsxSetup chỉ
 * gọi ask() với câu dựng ở đây. Máy cắt tắt / đổi xưởng thì BE xoá các dòng đã chia cho máy (về "Chưa chia").
 */

import type { SolverMachine } from '../../../types/admin'
import { MACHINE_LABEL } from '../../../utils/cutMachine'

/** Máy đủ để gọi tên trong câu hỏi. */
export interface WorkstationRef { code: string; name: string }

export interface ConfirmText { title: string; message: string; confirmLabel: string }

/** 21/11/2026: màn chỉ còn mã máy (bỏ tên gọi). */
const nameOf = (w: WorkstationRef) => w.code
const UNASSIGNED = 'chưa gán xưởng'
/** Máy cắt đã cắt dở: phần đó cũng về "Chưa chia" - chia lại cho máy khác thì cây đã cắt không tự trừ. */
const CUT_PARTIAL_NOTE = 'Phần máy đã cắt dở cũng về “Chưa chia”. Khi chia lại cho máy khác, phải bớt số cây đã cắt hoặc báo tổ không cắt lại.'
const typeLabel = (t: SolverMachine | null | undefined) => (t ? MACHINE_LABEL[t] ?? t : 'chưa chọn loại')

/** Tắt máy: máy cắt thì các dòng đã chia cho máy về "Chưa chia"; công nhân quét tem nhận câu "Máy này đang tắt". */
export function offMessage(w: WorkstationRef, isCut: boolean): ConfirmText {
  const lines = [`Tắt ${nameOf(w)}?`]
  if (isCut) lines.push('Chưa chia: mọi dòng đã chia cho máy này sẽ bị xoá khỏi máy và về mục “Chưa chia” - phần việc đã chia của máy mất, phải chia lại ở “Chia máy cắt”.')
  if (isCut) lines.push(CUT_PARTIAL_NOTE)
  lines.push('Máy này đang tắt: công nhân quét tem sẽ thấy “Máy này đang tắt - báo QLSX bật lại”. Bật lại máy thì tem cũ dùng được tiếp.')
  return { title: 'Tắt máy', message: lines.join('\n'), confirmLabel: 'Tắt máy' }
}

/** Đổi xưởng của máy: nêu xưởng cũ → mới; máy cắt thì dòng chia về "Chưa chia". */
export function workshopChangeMessage(w: WorkstationRef, fromName: string | null | undefined, toName: string | null | undefined, isCut = false): ConfirmText {
  const from = fromName || UNASSIGNED
  const to = toName || UNASSIGNED
  const lines = [`Đổi xưởng của ${nameOf(w)}: ${from} → ${to}?`]
  if (isCut) lines.push('Chưa chia: mọi dòng đã chia cho máy này sẽ bị xoá khỏi máy và về mục “Chưa chia” - phần việc đã chia của máy mất, phải chia lại ở “Chia máy cắt”.')
  if (isCut) lines.push(CUT_PARTIAL_NOTE)
  lines.push(`Công nhân quét tem máy này sẽ thấy lệnh của ${to}.`)
  return { title: 'Đổi xưởng của máy', message: lines.join('\n'), confirmLabel: 'Đổi xưởng' }
}

/** Đổi loại máy cắt: nêu loại cũ → mới. */
export function cutTypeChangeMessage(w: WorkstationRef, from: SolverMachine | null | undefined, to: SolverMachine): ConfirmText {
  return {
    title: 'Đổi loại máy cắt',
    message: `Đổi loại máy cắt của ${nameOf(w)}: ${typeLabel(from)} → ${typeLabel(to)}?\nSau khi đổi, xem lại bảng ở “Chia máy cắt”.`,
    confirmLabel: 'Đổi loại',
  }
}

/** Mã ngắn mới hợp lệ để lưu ở hộp "Đổi mã" (21/11/2026): bỏ khoảng trắng, viết hoa như BE; 2-32 ký tự chỉ gồm chữ, số, dấu
 *  chấm, gạch dưới, gạch ngang (cùng luật BE); trùng mã cũ thì trả null (nút Lưu khoá). */
export function codeValue(current: string, typed: string): string | null {
  const next = typed.trim().toUpperCase()
  if (next.length < 2 || next.length > 32 || !/^[A-Z0-9_.-]+$/.test(next) || next === current.trim().toUpperCase()) return null
  return next
}
