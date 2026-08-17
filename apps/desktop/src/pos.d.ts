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

declare global {
  interface Window {
    pos: {
      version: string;
      session: { login(input: { username: string; pin: string }): Promise<{ id: string; name: string; username: string; role: 'owner' | 'cashier' } | null> };
      catalog: { products(): Promise<PosProduct[]>; categories(): Promise<{ id: string; name: string }[]> };
      sales: { checkout(input: { staffId: string; items: { productId: string; quantity: number }[]; paymentMethod: 'cash' | 'momo'; amountTenderedPesewas: number; momoReference?: string }): Promise<{ saleId: string; receiptNumber: string; totalPesewas: number; changePesewas: number }> };
      health(): Promise<{ database: string; online: boolean; pendingSync: number }>;
    };
  }
}

export {};
