/**
 * Facade API. Mặc định trỏ mock; các module đã cắt sang BE thật được export ở đây.
 * Giữ nguyên import path `services/api` cho mọi page hiện có.
 *
 * ĐÃ NỐI BE THẬT: auth (loginUser/getProfile/logoutUser — services/auth-api.ts) và
 * users (getUsers/createUser/updateUser/deleteUser — services/users-api.ts). Mock tương ứng
 * (auth.service.ts, users.service.ts) đã bị xoá hẳn, không còn export trùng tên để "ghi đè".
 * Các module khác vẫn chạy mock cho tới khi module tương ứng được cắt sang BE.
 */
export * from '../lib/mock/services';
export { getUsers, createUser, updateUser, deleteUser } from './users-api';
export { loginUser, getProfile, logoutUser } from './auth-api';
