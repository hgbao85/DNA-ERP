export interface Product {
  id: string;
  name: string;
  image?: string;
  materials?: string;
  size?: string;
  weight?: string;
  color?: string;
  price: number;
  category?: string;
  setCount?: number;
  cushionColor?: string;
  packagingSize?: string;
  netWeight?: number;
  grossWeight?: number;
}

export interface AgencyWarehouseSummary {
  id: string;
  name: string;
  region: string;
}

export interface SalesUserSummary {
  id: number;
  name: string;
  email: string;
  salesType?: string;
}

export interface CareHistoryItem {
  id: number;
  note: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  date: string;
  details: string;
  quantity: number;
  total: number;
  paymentPercent: number;
  status: string;
  orderType: string;
  address?: string;
  deliveryDate?: string;
  platform?: string;
  paymentMethod?: string;
  quotationUrl?: string;
  deliveryProofUrl?: string;
}

export interface RetailCustomer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  region?: string;
  debt: number;
  note?: string;
  createdAt: string;
  agencyWarehouseId: string;
  agencyWarehouse?: AgencyWarehouseSummary;
  assignedSalesId?: number;
  assignedSales?: SalesUserSummary;
  orders?: Order[];
  careHistory?: CareHistoryItem[];
  orderCount?: number;
  totalRevenue?: number;
}

export interface CareReminder {
  id: number;
  dueDate: string;
  isCompleted: boolean;
  completedAt?: string | null;
  note?: string | null;
  retailCustomerId: number;
  retailCustomer?: { id: number; name: string };
  createdAt: string;
}

export interface WholesaleCareReminder {
  id: number;
  dueDate: string;
  isCompleted: boolean;
  completedAt?: string | null;
  note?: string | null;
  wholesaleCustomerId: number;
  wholesaleCustomer?: { id: number; businessName: string };
  createdAt: string;
}

export interface Promotion {
  id: number;
  name: string;
  description: string;
  orderType: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface WholesaleCareHistoryItem {
  id: number;
  note: string;
  createdAt: string;
}

export interface WholesaleCustomer {
  id: number;
  businessName: string;
  taxCode?: string;
  businessLicense?: string;
  representativeName: string;
  phone: string;
  email?: string;
  address: string;
  region?: string;
  debt: number;
  note?: string;
  createdAt: string;
  orders?: Order[];
  careHistory?: WholesaleCareHistoryItem[];
  orderCount?: number;
  totalRevenue?: number;
  assignedSalesId?: number;
  assignedSales?: { id: number; name: string; salesType?: string };
}

export interface QuotationItem {
  id: number
  productId: string
  product: { id: string; name: string }
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface Quotation {
  id: number
  code: string
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  orderType: 'RETAIL' | 'WHOLESALE'
  customerName: string
  customerPhone: string
  customerAddress: string
  quotationDate: string
  expiryDate?: string
  items: QuotationItem[]
  discountPercent: number
  discountAmount: number
  totalAmount: number
  promotionId?: number
  promotion?: { id: number; name: string }
  createdById: number
  createdBy: { id: number; name: string }
  reviewedById?: number
  rejectReason?: string
  orderId?: string
  retailCustomerId?: number
  retailCustomer?: { id: number; name: string }
  wholesaleCustomerId?: number
  wholesaleCustomer?: { id: number; businessName: string }
  createdAt: string
}

export interface CustomerHistory {
  date: string;
  note: string;
}

export interface Customer {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  products: string[];
  sales: string;
  cycleDays: number;
  lastContact: string;
  notes: string;
  history: CustomerHistory[];
}

export interface Notification {
  id: number;
  customerId: string;
  customerName: string;
  sales: string;
  channel: string;
  message: string;
  sentAt: string;
}

export interface Settings {
  remindDaysBefore: number;
  notifyChannel: string;
  messageTemplate: string;
}
