import { useState, useEffect, useCallback } from 'react'
// @ts-ignore
import { SEED_CUSTOMERS, SEED_SETTINGS } from '../data/seed'
import { differenceInDays, addDays, parseISO, format, isToday } from 'date-fns'
import type { Customer, Settings, Notification } from '../types'

const LS_CUSTOMERS = 'scrm_customers'
const LS_SETTINGS  = 'scrm_settings'
const LS_NOTIFS    = 'scrm_notifs'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function save(key: string, val: any) {
  localStorage.setItem(key, JSON.stringify(val))
}

// Tính ngày liên hệ tiếp và trạng thái
export function calcStatus(customer: Customer, remindDaysBefore: number = 3) {
  let last: Date;
  if (!customer.lastContact) {
    // Nếu chưa từng liên hệ, đặt ngày cũ để tự động chuyển sang quá hạn
    last = new Date()
    last.setDate(last.getDate() - (customer.cycleDays || 30) - 1)
  } else {
    try {
      last = typeof customer.lastContact === 'string' ? parseISO(customer.lastContact) : new Date(customer.lastContact)
      if (isNaN(last.getTime())) {
        last = new Date()
        last.setDate(last.getDate() - (customer.cycleDays || 30) - 1)
      }
    } catch {
      last = new Date()
      last.setDate(last.getDate() - (customer.cycleDays || 30) - 1)
    }
  }

  const nextDate = addDays(last, customer.cycleDays || 30)
  const today = new Date()
  const daysLeft = differenceInDays(nextDate, today)

  let status: 'ok' | 'overdue' | 'today' | 'soon' = 'ok'
  if (daysLeft < 0)                          status = 'overdue'
  else if (isToday(nextDate))                status = 'today'
  else if (daysLeft <= remindDaysBefore)     status = 'soon'

  return { nextDate, daysLeft, status }
}

export function useStore() {
  const [customers, setCustomersRaw] = useState<Customer[]>(() => load(LS_CUSTOMERS, SEED_CUSTOMERS))
  const [settings, setSettingsRaw]   = useState<Settings>(() => load(LS_SETTINGS, SEED_SETTINGS))
  const [notifs, setNotifsRaw]       = useState<Notification[]>(() => load(LS_NOTIFS, []))

  const setCustomers = useCallback((val: Customer[]) => {
    setCustomersRaw(val)
    save(LS_CUSTOMERS, val)
  }, [])

  const setSettings = useCallback((val: Settings) => {
    setSettingsRaw(val)
    save(LS_SETTINGS, val)
  }, [])

  const setNotifs = useCallback((val: Notification[]) => {
    setNotifsRaw(val)
    save(LS_NOTIFS, val)
  }, [])

  // Thêm khách hàng mới
  const addCustomer = useCallback((data: Partial<Customer>) => {
    const newC = {
      ...data,
      id: 'KH' + Date.now(),
      history: [],
    } as Customer
    setCustomers([...customers, newC])
  }, [customers, setCustomers])

  // Cập nhật khách hàng
  const updateCustomer = useCallback((id: string, data: Partial<Customer>) => {
    setCustomers(customers.map(c => c.id === id ? { ...c, ...data } : c))
  }, [customers, setCustomers])

  // Xóa khách hàng
  const deleteCustomer = useCallback((id: string) => {
    setCustomers(customers.filter(c => c.id !== id))
  }, [customers, setCustomers])

  // Thêm lịch sử liên hệ + cập nhật lastContact
  const logContact = useCallback((id: string, note: string) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    setCustomers(customers.map(c => {
      if (c.id !== id) return c
      return {
        ...c,
        lastContact: today,
        history: [{ date: today, note }, ...(c.history || [])],
      }
    }))
  }, [customers, setCustomers])

  // Gửi thông báo (giả lập — lưu vào notifs log)
  const sendNotif = useCallback((customer: Customer) => {
    const msg = settings.messageTemplate
      .replace('[TÊN KH]', customer.name)
      .replace('[TÊN SALES]', customer.sales)
      .replace('[MÃ SP]', customer.products.join(', '))
      .replace('[NGÀY]', format(new Date(), 'dd/MM/yyyy'))

    const newNotif: Notification = {
      id: Date.now(),
      customerId: customer.id,
      customerName: customer.name,
      sales: customer.sales,
      channel: settings.notifyChannel,
      message: msg,
      sentAt: new Date().toISOString(),
    }
    setNotifs([newNotif, ...notifs])
    return newNotif
  }, [settings, notifs, setNotifs])

  // Import từ CSV/Excel (đã parse bởi PapaParse)
  const importCustomers = useCallback((rows: any[]) => {
    const imported: Customer[] = []
    const skipped: string[] = []

    rows.forEach(row => {
      const name = row['ten_khach_hang'] || row['Tên khách hàng'] || ''
      if (!name) return

      const existId = customers.find(c => c.name === name)?.id
      if (existId) { skipped.push(name); return }

      const products = (row['ma_san_pham'] || row['Mã sản phẩm'] || '')
        .split(',').map((s: string) => s.trim()).filter(Boolean)

      imported.push({
        id: 'KH' + Date.now() + Math.random().toString(36).slice(2, 6),
        name,
        city:        row['thanh_pho'] || row['Thành phố'] || '',
        phone:       row['so_dien_thoai'] || row['Số điện thoại'] || '',
        email:       row['email'] || row['Email'] || '',
        products,
        sales:       row['sales_phu_trach'] || row['Sales phụ trách'] || '',
        cycleDays:   parseInt(row['chu_ky_ngay'] || row['Chu kỳ (ngày)'] || '30', 10),
        lastContact: row['lan_lien_he_cuoi'] || row['Lần liên hệ cuối'] || format(new Date(), 'yyyy-MM-dd'),
        notes:       row['ghi_chu'] || row['Ghi chú'] || '',
        history:     [],
      })
    })

    setCustomers([...customers, ...imported])
    return { imported: imported.length, skipped: skipped.length }
  }, [customers, setCustomers])

  // Thống kê nhanh
  const stats = useCallback(() => {
    const rb = settings.remindDaysBefore
    let overdue = 0, today = 0, soon = 0, done = 0
    customers.forEach(c => {
      const { status } = calcStatus(c, rb)
      if (status === 'overdue') overdue++
      else if (status === 'today') today++
      else if (status === 'soon') soon++
      else done++
    })
    return { total: customers.length, overdue, today, soon, done }
  }, [customers, settings.remindDaysBefore])

  return {
    customers, settings, notifs,
    setSettings,
    addCustomer, updateCustomer, deleteCustomer,
    logContact, sendNotif, importCustomers,
    stats,
  }
}
