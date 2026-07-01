/** Đảm bảo luôn trả về mảng, kể cả khi dữ liệu đầu vào là null/undefined (vd: trước khi useFetch tải xong). */
export const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])
