/** Giả lập độ trễ mạng — mock-first, không gọi BE. */
export const mockDelay = (ms = 120) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
