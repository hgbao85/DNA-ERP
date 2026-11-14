/** Câu giải thích cho khung "Cài đặt đợt tính": hiện ở dấu "?" (rê chuột) và nút "Giải thích" (chạm). */
import { MACHINE_LABEL } from '../../../../utils/cutMachine'

export const HELP_WASTE = 'Mức chung của công ty, áp cho mọi lượt tính (không sửa tại đây). '
  + 'Đợt gấp cần hao hụt cao hơn: chọn “Chấp nhận hao hụt cao hơn” ở ô Chế độ cắt — Sếp duyệt riêng cho đợt đó.'

export const HELP_MACHINE = `${MACHINE_LABEL.laser} cắt từng cây. ${MACHINE_LABEL.tu_dong} cắt theo bó nhiều cây một lần, `
  + 'phần lẻ cắt từng cây (cắt tay) — thông số bó do Admin cấu hình. Chọn máy nào thì số ước tính, số đã xác minh và '
  + 'kết quả tính theo máy đó; hai chế độ cắt áp cho cả hai máy.'

export const HELP_LENGTH = 'Cây chuẩn của công ty; bấm Đổi để đặt chiều dài khác cho từng loại sắt. Đổi chiều dài thì tính lại cả bảng.'

/** Giải thích ô Xưởng: có luật số cỡ đoạn/cây của xưởng thì nêu luật, không thì câu chung. */
export function helpWorkshop(workshopName: string | undefined, maxSizes: number | undefined): string {
  if (workshopName && maxSizes != null) {
    return `${workshopName}: tối đa ${maxSizes} cỡ đoạn/cây; giữ cây chuẩn (và chiều dài đang có trong kho) trước, nới số cỡ nếu cần, `
      + 'chỉ khi vẫn không đạt mới dò cây đặt riêng — có ghi lý do. Ước tính trên bảng chưa áp luật này; kết quả Tính mới áp.'
  }
  return 'Chọn xưởng sẽ làm lệnh. Xưởng đi kèm lượt tính: hệ thống áp luật cắt của xưởng (nếu có) và lệnh tạo ra mang sẵn xưởng này.'
}

/** Ghi chú MC Tự động: số ước tính ở bảng chưa tính ràng buộc cắt theo bó. */
export const TU_DONG_NOTE = 'Số ước tính ở bảng chưa tính ràng buộc cắt theo bó — số chính thức có sau khi bấm Tính.'
