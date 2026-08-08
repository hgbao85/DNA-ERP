/**
 * Upload ảnh dùng chung cho mọi form (BE lưu qua Cloudinary, xem UploadsModule bên BE).
 * Không set Content-Type thủ công — axios cần thấy body là FormData "trần" (không bọc trong
 * Content-Type: application/json mặc định của client) để tự nhường trình duyệt gắn boundary
 * multipart đúng chuẩn, xem services/core/http.ts.
 */
import { http } from './core/http';

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const { imageUrl } = await http.post<{ imageUrl: string }>('/uploads/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return imageUrl;
}
