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
  createdAt: string;
  items: InvoiceItem[];
}
