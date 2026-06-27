import { useState, useCallback } from 'react'
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
function save(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val))
}

// Tính ngày liên hệ tiếp và trạng thái
export function calcStatus(customer: Customer, remindDaysBefore: number = 3) {
  let last: Date;
  if (!customer.lastContact) {
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
  if (daysLeft < 0)                      status = 'overdue'
  else if (isToday(nextDate))            status = 'today'
  else if (daysLeft <= remindDaysBefore) status = 'soon'

  return { nextDate, daysLeft, status }
}

export function useStore() {
  const [customers, setCustomersRaw] = useState<Customer[]>(() => load(LS_CUSTOMERS, SEED_CUSTOMERS))
  const [settings, setSettingsRaw]   = useState<Settings>(() => load(LS_SETTINGS, SEED_SETTINGS))
  const [notifs, setNotifsRaw]       = useState<Notification[]>(() => load(LS_NOTIFS, []))

  // Wrapper gộp setState + persist — dùng functional update để luôn có giá trị mới nhất
  const setCustomers = useCallback((updater: (prev: Customer[]) => Customer[]) => {
    setCustomersRaw(prev => {
      const next = updater(prev)
      save(LS_CUSTOMERS, next)
      return next
    })
  }, [])

  const setSettings = useCallback((val: Settings) => {
    setSettingsRaw(val)
    save(LS_SETTINGS, val)
  }, [])

  const setNotifs = useCallback((updater: (prev: Notification[]) => Notification[]) => {
    setNotifsRaw(prev => {
      const next = updater(prev)
      save(LS_NOTIFS, next)
      return next
    })
  }, [])

  // Dùng functional update → không cần customers/notifs trong deps → callbacks ổn định
  const addCustomer = useCallback((data: Partial<Customer>) => {
    const newC = { ...data, id: 'KH' + Date.now(), history: [] } as Customer
    setCustomers(prev => [...prev, newC])
  }, [setCustomers])

  const updateCustomer = useCallback((id: string, data: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }, [setCustomers])

  const deleteCustomer = useCallback((id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id))
  }, [setCustomers])

  const logContact = useCallback((id: string, note: string) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c
      return { ...c, lastContact: today, history: [{ date: today, note }, ...(c.history || [])] }
    }))
  }, [setCustomers])

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
    setNotifs(prev => [newNotif, ...prev])
    return newNotif
  }, [settings, setNotifs])

  // importCustomers cần đọc customers hiện tại để kiểm tra duplicate
  // → dùng customers trong closure (vẫn fresh vì customers là dep)
  // → functional update cho phần mutation để đảm bảo không mất dữ liệu đồng thời
  const importCustomers = useCallback((rows: Record<string, string>[]) => {
    const toImport: Customer[] = []
    const skipped: string[] = []

    rows.forEach(row => {
      const name = row['ten_khach_hang'] || row['Tên khách hàng'] || ''
      if (!name) return
      if (customers.find(c => c.name === name)) { skipped.push(name); return }

      const products = (row['ma_san_pham'] || row['Mã sản phẩm'] || '')
        .split(',').map((s: string) => s.trim()).filter(Boolean)

      toImport.push({
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

    if (toImport.length > 0) setCustomers(prev => [...prev, ...toImport])
    return { imported: toImport.length, skipped: skipped.length }
  }, [customers, setCustomers])

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
