export type ShopType = 'cosmetics-provisions' | 'shisha';
export type UserRole = 'owner' | 'cashier';
export type PaymentMethod = 'cash' | 'momo';
export type SaleStatus = 'completed' | 'voided';
export type SyncStatus = 'pending' | 'synced' | 'failed';

/** Money is always represented as integer pesewas. Never use floating point for money. */
export type Money = number & { readonly __brand: 'MoneyPesewas' };

export interface ShopConfig {
  id: string;
  type: ShopType;
  name: string;
  currency: 'GHS';
  logoPath?: string;
  address?: string;
  phone?: string;
  receiptFooter?: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  pricePesewas: Money;
  quantityInStock: number;
  lowStockThreshold: number;
  active: boolean;
}

export interface SaleLineInput {
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  staffId: string;
  items: SaleLineInput[];
  paymentMethod: PaymentMethod;
  amountTenderedPesewas: Money;
  momoReference?: string;
}

export interface CheckoutResult {
  saleId: string;
  receiptNumber: string;
  totalPesewas: Money;
  changePesewas: Money;
}
