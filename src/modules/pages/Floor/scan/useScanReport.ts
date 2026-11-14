'use client'

/** Trạng thái tab Báo sản lượng: tải context của máy, chọn lệnh / sản phẩm, gửi số báo, nhận sắt. */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getScanContext, postScanReport, receiveSteelByScan, type BeScanContext, type BeSteelToReceive,
} from '../../../../services/floor-api'
import { useRetrySafeKey } from '../../../../hooks/useRetrySafeKey'
import { describeError, hhmm } from '../floorUi'
import { errText } from './scanModel'

export type Flash = { tone: 'ok' | 'err' | 'warn'; text: string; alert?: boolean }

export function useScanReport(ws: string) {
  const [ctx, setCtx] = useState<BeScanContext | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [selectedPi, setSelectedPi] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const retryKey = useRetrySafeKey()

  const load = useCallback(async (piId?: string | null) => {
    try {
      const c = await getScanContext(ws, piId ?? undefined)
      setCtx(c); setLoadErr(null)
      if (c.pi) setSelectedPi(c.pi.productionInvoiceId)
    } catch (e) { setLoadErr(errText(e)) }
  }, [ws])

  // Tải dữ liệu máy khi mở màn (đồng bộ với BE) - setState chỉ xảy ra sau khi request trả về.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  // Banner kết quả nằm đầu trang; công nhân bấm Lưu ở thanh dưới khi đang kéo xuống thì không thấy -> cuộn tới.
  useEffect(() => { flashRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [flash])

  const selectPi = (id: string) => { setSelectedPi(id); setOrderId(null); setFlash(null); void load(id) }
  // "Báo cho lệnh này" ở khối Việc của máy: chọn lệnh (gọi lại context) rồi cuộn xuống phần báo.
  const pickPi = (id: string) => {
    if (id !== selectedPi) selectPi(id)
    reportRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const fail = (e: unknown) => {
    const info = describeError(e, true)
    setFlash({ tone: info.tone, text: info.text, alert: true })
    return false
  }

  const send = async (payload: Parameters<typeof postScanReport>[1], summary: string) => {
    setFlash(null)
    try {
      await postScanReport(ws, payload, retryKey.take(payload))
      retryKey.settle()
      setFlash({ tone: 'ok', text: `Đã lưu ${summary} · ${hhmm()}` })
      await load(selectedPi)
      return true
    } catch (e) {
      retryKey.settle(e)
      return fail(e)
    }
  }

  const receive = async (issue: BeSteelToReceive, count: number) => {
    setFlash(null)
    try {
      await receiveSteelByScan(ws, issue.steelIssueId, count)
      setFlash({ tone: 'ok', text: `Đã nhận ${count}/${issue.barCount} cây ${issue.materialName} · ${hhmm()}` })
      await load()
      return true
    } catch (e) { return fail(e) }
  }

  return { ctx, loadErr, selectedPi, orderId, setOrderId, flash, flashRef, reportRef, selectPi, pickPi, send, receive }
}
