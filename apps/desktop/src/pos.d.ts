type PosProduct = {
  id: string;
  name: string;
  barcode: string | null;
  pricePesewas: number;
  quantityInStock: number;
  lowStockThreshold: number;
  active: number;
  categoryId: string | null;
  category: string | null;
};

type PosUser = { id: string; name: string; username: string; role: 'owner' | 'cashier' };
type PosShift = { id: string; staffId: string; openedAt: string; openingCashPesewas: number; status: 'open' | 'closed' };

declare global {
  interface Window {
    pos: {
      version: string;
      session: { login(input: { username: string; pin: string }): Promise<PosUser | null> };
      catalog: {
        products(): Promise<PosProduct[]>;
        categories(): Promise<{ id: string; name: string }[]>;
        lowStock(): Promise<PosProduct[]>;
        createProduct(input: { name: string; barcode?: string; categoryId?: string; pricePesewas: number; quantityInStock: number; lowStockThreshold: number; actorId: string }): Promise<PosProduct>;
      };
      inventory: { adjustStock(input: { productId: string; quantityDelta: number; reason: string; actorId: string }): Promise<unknown> };
      sales: {
        checkout(input: { staffId: string; shiftId?: string; items: { productId: string; quantity: number }[]; paymentMethod: 'cash' | 'momo'; amountTenderedPesewas: number; momoReference?: string }): Promise<{ saleId: string; receiptNumber: string; totalPesewas: number; changePesewas: number }>;
        list(filters?: Record<string, unknown>): Promise<unknown[]>;
        get(saleId: string): Promise<unknown>;
      };
      shift: {
        open(input: { staffId: string; openingCashPesewas: number }): Promise<PosShift | null>;
        current(staffId: string): Promise<PosShift | null>;
        close(input: { staffId: string; closingCashPesewas: number }): Promise<{ shiftId: string; closingCashPesewas: number; expectedCashPesewas: number; differencePesewas: number }>;
      };
      receipt: {
        preview(input: { saleId: string; options?: { shopName?: string; address?: string; phone?: string; footer?: string; width?: number }}): Promise<string>;
        printNetwork(input: { saleId: string; host: string; port?: number; options?: { shopName?: string; address?: string; phone?: string; footer?: string; width?: number }}): Promise<{ ok: boolean }>;
      };
      health(): Promise<{ database: string; online: boolean; pendingSync: number }>;
    };
  }
}

export {};
