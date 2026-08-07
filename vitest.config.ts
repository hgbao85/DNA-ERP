import { defineConfig } from 'vitest/config';

// Unit test tầng service (pure TS, mock `http`) — chạy môi trường node, không cần DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
