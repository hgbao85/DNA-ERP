/**
 * Facade API. Mặc định trỏ mock; các module đã cắt sang BE thật được GHI ĐÈ bên dưới.
 * Giữ nguyên import path `services/api` cho mọi page hiện có.
 *
 * ĐÃ NỐI BE THẬT: users (getUsers/createUser/updateUser/deleteUser) — xem services/users-api.ts.
 * Các hàm khác vẫn chạy mock cho tới khi module tương ứng được cắt.
 */
export * from '../lib/mock/services';

// Ghi đè users bằng API BE thật. Explicit named export thắng `export *` khi trùng tên.
export { getUsers, createUser, updateUser, deleteUser } from './users-api';

// Ghi đè auth: login bằng username → BE, getProfile → GET /auth/me, logoutUser → thu hồi refresh token.
export { loginUser, getProfile, logoutUser } from './auth-api';
