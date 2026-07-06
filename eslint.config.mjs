import nextConfig from 'eslint-config-next'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Chỉ thêm rule cảnh báo (warn) cho lỗi hay gặp — không bật rule mới sẽ
 * làm fail build ngay vì codebase hiện tại chưa từng chạy qua lint.
 * Plugin phải khai báo lại trong cùng object với rule dùng nó (yêu cầu của flat config).
 */
export default [
  ...nextConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      // Hạ về warn: rule mới (hướng React Compiler) phân tích tĩnh chưa phân biệt được
      // code chạy lúc render với code trong closure của event handler → nhiều false positive
      // trên pattern hợp lệ (Date.now() trong onClick, đồng bộ state từ dữ liệu ngoài trong effect).
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]
