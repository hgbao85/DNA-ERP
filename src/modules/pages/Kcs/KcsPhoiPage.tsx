'use client'

/**
 * Màn hình KCS — Công đoạn PHÔI (2 tầng: PO → các đợt chờ kiểm).
 *
 * ĐỌC DATA THẬT từ phoi-sat.service (dùng chung với Phôi):
 *  - Phôi "Xác nhận sản lượng" → đợt chuyển sang CHO_KCS → hiện ở đây.
 *  - KCS duyệt (đạt / sửa được / cấp lại sắt) → gọi kcsDuyetPhoi → đợt sang DA_CAT
 *    (chỉ phần ĐẠT mới tính "đã cắt" bên Lệnh sản xuất & chảy xuống Hàn).
 * Mỗi ĐỢT chờ kiểm = 1 dòng để KCS duyệt độc lập.
 */

import { useMemo } from 'react'
import { Wrench } from 'lucide-react'
import { KcsTwoTierScreen, type KcsRow, type KcsLine, type ReviewPayload } from '../../../components/sanxuat/kcsCore'
import type { StageCfg } from '../../../components/sanxuat/core'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { SatIssueView } from '../../../services/api'
import type { AuditLogEntry } from '../../../context/AuditLogContext'
import LoadingState from '../../../components/LoadingState'

const CFG: StageCfg = { label: 'Phôi', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Loại sắt', unit: 'cây', Icon: Wrench }

export default function KcsPhoiPage() {
  const { data: issues, isLoading, refetch } = useFetch<SatIssueView[]>(() => api.getKcsIssues(), [])

  // Gom lô theo PO (chỉ PO còn hàng chờ); mỗi đợt = 1 dòng: chờ / đã duyệt / lỗi.
  // map: id dòng (số) → id đợt (chuỗi) — chỉ lô CHO_KCS mới duyệt được.
  const { rows, map } = useMemo(() => {
    const map = new Map<number, string>()
    const byPo = new Map<string, SatIssueView[]>()
    const order: string[] = []
    for (const i of issues ?? []) {
      if (!byPo.has(i.poNumber)) { byPo.set(i.poNumber, []); order.push(i.poNumber) }
      byPo.get(i.poNumber)!.push(i)
    }
    let seq = 1
    const rows: KcsRow[] = []
    for (const po of order) {
      const list = byPo.get(po)!
      if (!list.some(i => i.status === 'CHO_KCS')) continue   // chỉ PO còn hàng chờ
      const lines: KcsLine[] = list.map(i => {
        const lineId = seq++
        const pending = i.status === 'CHO_KCS'
        if (pending) map.set(lineId, i.id)
        const qty = i.soCayThuc ?? i.soCay          // CHO_KCS: báo · DA_CAT: đạt
        const failed = i.kcsFailedQty ?? 0
        const baoCat = qty + (i.status === 'DA_CAT' ? failed : 0)
        const history: AuditLogEntry[] = [{
          id: `${i.id}-iss`, entityType: 'kcs-lo', entityId: i.id, action: 'kcs.issued',
          actorName: i.nguoiXuat, at: i.dotThoiGian,
          note: i.reworkOf ? `Tạo lại do KCS bắt làm lại · ${i.soCay} cây` : `Kho xuất ${i.soCay} cây ${i.loaiSat} ${i.quyCach}`,
        }]
        if (i.hoanThanhAt) history.push({
          id: `${i.id}-rep`, entityType: 'kcs-lo', entityId: i.id, action: 'kcs.reported',
          actorName: 'Tổ Phôi', at: i.hoanThanhAt, note: `Xác nhận cắt xong ${baoCat} cây`,
        })
        if (i.status === 'DA_CAT' && i.kcsAt) history.push({
          id: `${i.id}-kcs`, entityType: 'kcs-lo', entityId: i.id, action: 'kcs.approved',
          actorName: 'KCS', at: i.kcsAt, note: `Duyệt: ${qty} đạt${failed > 0 ? ` · ${failed} lỗi` : ''}`,
        })
        return {
          id: lineId,
          itemName: `${i.loaiSat} ${i.quyCach}`,
          spec: `đợt ${i.hoanThanhAt ?? i.dotThoiGian} · ${i.barLen.toLocaleString('vi-VN')}mm`,
          needQty: baoCat, doneQty: 0,
          pendingQty: pending ? qty : 0,
          approvedQty: i.status === 'DA_CAT' ? qty : 0,
          failedQty: i.status === 'DA_CAT' ? failed : 0,
          lastInputAt: i.hoanThanhAt ?? i.dotThoiGian, history,
        }
      })
      const pendList = list.filter(i => i.status === 'CHO_KCS')
      const baoLuc = pendList.map(i => i.hoanThanhAt ?? i.dotThoiGian).sort()[0] ?? list[0].dotThoiGian
      rows.push({
        id: rows.length + 1, poNumber: po, sku: list[0].sku, productName: list[0].sku,
        soLuong: lines.reduce((s, l) => s + l.pendingQty, 0), deadline: baoLuc, arrangedAt: baoLuc, lines,
      })
    }
    return { rows, map }
  }, [issues])

  if (isLoading || !issues) return <LoadingState />

  const onReview = async (_poId: number, lineId: number, p: ReviewPayload) => {
    const issueId = map.get(lineId)
    if (!issueId) return
    await api.kcsDuyetPhoi(issueId, {
      failedQty: p.failedQty,
      scrapQty: p.scrapQty,
      reason: p.reviewNote,
      photoUrl: p.defectPhotoUrl,
    })
    refetch()
  }

  return <KcsTwoTierScreen cfg={CFG} rows={rows} onReview={onReview} showFailMode />
}
