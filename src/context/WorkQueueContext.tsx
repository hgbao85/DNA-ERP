'use client'

/**
 * 1 Provider dùng CHUNG cho cả cây - mirror ĐÚNG NotificationsContext.tsx (cùng lý do: nhiều nơi
 * trong 1 app shell có thể đọc badge cùng lúc, ví dụ sidebar desktop + drawer di động, không nên
 * mỗi nơi tự poll riêng).
 */
import { createContext, useContext } from 'react'
import { useWorkQueueState, type WorkQueueState } from '../hooks/useWorkQueue'

const WorkQueueCtx = createContext<WorkQueueState | null>(null)

export function WorkQueueProvider({ children }: { children: React.ReactNode }) {
  const state = useWorkQueueState()
  return <WorkQueueCtx.Provider value={state}>{children}</WorkQueueCtx.Provider>
}

export function useWorkQueue(): WorkQueueState {
  const ctx = useContext(WorkQueueCtx)
  if (!ctx) throw new Error('useWorkQueue phải được sử dụng bên trong WorkQueueProvider')
  return ctx
}
