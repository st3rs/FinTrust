export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'DRAFT' | 'UNPAID' | 'PAID' | 'VOID';
  customerName: string;
  customerEmail: string;
  dueDate: string;
  expiresAt?: string;
  createdAt: string;
  items: InvoiceItem[];
  promptPayId?: string;
  paymentMethods?: {
    stripe?: boolean;
    paypal?: boolean;
    promptpay?: boolean;
    crypto?: boolean;
  };
  gatewayStatus?: {
    stripe: { connected: boolean; mode: string | null };
    paypal: { connected: boolean; environment: string | null };
    promptpay: { connected: boolean };
  };
}
