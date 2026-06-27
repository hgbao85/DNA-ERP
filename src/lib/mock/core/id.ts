let seq = 1000;

export function nextId(): number {
  seq += 1;
  return seq;
}

export function nextCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
