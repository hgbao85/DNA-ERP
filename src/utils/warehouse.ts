export function mockStock(name: string, required: number | null): number {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const base = required ?? 10
  return hash % 5 === 0 ? Math.floor(base * 0.6) : Math.ceil(base * (1.1 + (hash % 4) * 0.25))
}
