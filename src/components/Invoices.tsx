import React, { useState } from 'react';
import { Download, Search, PlusCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const INITIAL_INVOICES = [
  { id: 'INV-2023-0042', client: 'Acme Corp', amount: 3500.00, date: '2026-05-15', status: 'PAID', dueDate: '2026-05-30' },
  { id: 'INV-2023-0043', client: 'Global Tech', amount: 8400.00, date: '2026-05-18', status: 'PAID', dueDate: '2026-06-02' },
  { id: 'INV-2023-0044', client: 'Nexus Industries', amount: 1250.00, date: '2026-05-20', status: 'UNPAID', dueDate: '2026-06-04' },
  { id: 'INV-2023-0045', client: 'Stark Enterprises', amount: 45000.00, date: '2026-05-22', status: 'UNPAID', dueDate: '2026-06-06' },
  { id: 'INV-2023-0046', client: 'Wayne Corp', amount: 15000.00, date: '2026-05-25', status: 'VOID', dueDate: '2026-06-09' },
];

export default function Invoices() {
  const [invoices] = useState(INITIAL_INVOICES);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Invoices</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and track your invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/invoice/new">
            <Button className="shadow-sm">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4 justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search invoices by number or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <Select value={statusFilter} onValueChange={setStatusFilter}>
               <SelectTrigger className="w-[140px] bg-white dark:bg-slate-950">
                 <SelectValue placeholder="All Status" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="ALL">All Status</SelectItem>
                 <SelectItem value="PAID">Paid</SelectItem>
                 <SelectItem value="UNPAID">Unpaid</SelectItem>
                 <SelectItem value="VOID">Void</SelectItem>
               </SelectContent>
             </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-medium text-slate-900 dark:text-white">
                      {invoice.id}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {invoice.client}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-200">
                      ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {new Date(invoice.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                          invoice.status === 'UNPAID' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                          'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500 dark:text-slate-400">
                    No invoices found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
