// core/http.ts chuẩn hoá MỌI lỗi request thành ApiError (Error thật, .message = câu tiếng Việt
// BE trả về, đã join sẵn nếu là mảng validation) trước khi tới đây - không có field `.response`
// nào để đọc. Ưu tiên thẳng `e.message`; fallback chỉ dùng khi throw không phải Error (hiếm).
export const errMsg = (e: unknown, fallback = 'Lỗi xử lý'): string =>
  (e instanceof Error && e.message) || fallback
