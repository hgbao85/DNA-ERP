'use client'

/** Trạng thái tab Báo sản lượng: tải context của máy, chọn lệnh / sản phẩm, gửi số báo, nhận sắt. */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getScanContext, postScanReport, receiveSteelByScan, type BeScanContext, type BeSteelToReceive,
} from '../../../../services/floor-api'
import { useRetrySafeKey } from '../../../../hooks/useRetrySafeKey'
import { ApiError } from '../../../../services/core/apiError'
import { describeError, hhmm } from '../floorUi'
import { errText, soleStagePi } from './scanModel'

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

  /**
   * `afterReport`: sau khi báo, tải lại KHÔNG kèm lệnh trước (lệnh vừa báo đủ số có thể đã ẩn, kèm lệnh sẽ bị BE trả 409);
   * Hàn / Sơn chỉ giữ lệnh đang chọn nếu còn trong stagePis, Phôi (stagePis rỗng) giữ như cũ.
   */
  const load = useCallback(async (piId?: string | null, afterReport = false) => {
    try {
      let c: BeScanContext
      try {
        if (afterReport && piId) {
          c = await getScanContext(ws)
          const stillThere = (c.stagePis ?? []).length === 0 || (c.stagePis ?? []).some((x) => x.productionInvoiceId === piId)
          if (stillThere && c.pi?.productionInvoiceId !== piId) c = await getScanContext(ws, piId)
        } else {
          c = await getScanContext(ws, piId ?? undefined)
        }
      } catch (e) {
        // Lệnh đang chọn không còn làm được (vd vừa báo đủ số thì ẩn): tải lại không kèm lệnh, đừng vỡ cả màn.
        if (!piId || !(e instanceof ApiError) || e.statusCode < 400 || e.statusCode >= 500) throw e
        c = await getScanContext(ws)
      }
      // Hàn / Sơn chỉ có 1 lệnh làm được thì chọn sẵn (BE chưa trả `pi` thì xin lại kèm lệnh đó).
      const sole = !c.pi ? soleStagePi(c) : null
      if (sole) c = await getScanContext(ws, sole.productionInvoiceId)
      setCtx(c); setLoadErr(null)
      setSelectedPi(c.pi ? c.pi.productionInvoiceId : null)
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
      await load(selectedPi, true)
      return true
    } catch (e) {
      retryKey.settle(e)
      const result = fail(e)
      // P1: máy chủ chặn (4xx, vd báo vượt "tối đa N") thì tải lại dữ liệu máy để "còn báo được" đúng số mới; số đã nhập
      // nằm trong state của form nên không mất, băng đỏ vẫn giữ câu của máy chủ.
      if (e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500) void load(selectedPi, true)
      return result
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
