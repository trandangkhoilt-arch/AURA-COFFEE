import type { OrderStatus } from './types';

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + '₫';
}

export function normalizeOrderCode(value: string): string {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}-/.test(code) ? `AURA-${code.slice(4)}` : code;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang chuẩn bị hàng',
  shipped: 'Đang giao hàng',
  delivered: 'Đã giao thành công',
  cancelled: 'Đã hủy',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-300',
  confirmed: 'bg-blue-100 text-blue-900 border-blue-300',
  processing: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  shipped: 'bg-purple-100 text-purple-900 border-purple-300',
  delivered: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  cancelled: 'bg-red-100 text-red-900 border-red-300',
};

// Quy tắc chuyển trạng thái hợp lệ: không cho phép chuyển ngược từ trạng thái cuối (delivered, cancelled)
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function isValidOrderTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true;
  return VALID_ORDER_TRANSITIONS[current]?.includes(next) ?? false;
}

export const GRIND_OPTIONS = [
  'Nguyên hạt',
  'Xay pha Phin truyền thống',
  'Xay pha Máy (Espresso)',
  'Xay Pour Over / V60',
  'Xay Cold Brew / French Press',
] as const;

export const VIETNAMESE_PROVINCES = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Đắk Lắk',
  'Lâm Đồng',
  'Cần Thơ',
  'Hải Phòng',
  'Bình Dương',
  'Đồng Nai',
  'Khánh Hòa',
  'Gia Lai',
  'Đắk Nông',
  'Thừa Thiên Huế',
  'Bà Rịa - Vũng Tàu',
  'Quảng Ninh',
  'Nghệ An',
  'Thanh Hóa',
  'Bắc Ninh',
  'Tỉnh / Thành khác',
] as const;
