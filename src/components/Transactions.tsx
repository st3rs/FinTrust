import React, { useState, useEffect } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Download,
  Filter,
  Search,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { usePagination } from '@/src/lib/use-pagination';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const pagination = usePagination(20);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setIsLoading(true);

    (async () => {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1);

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      const { data, count, error } = await query;
      if (!active) return;
      if (!error && data) {
        setTransactions(data);
        setTotal(count ?? 0);
      }
      setIsLoading(false);
    })();

    return () => { active = false; };
  }, [user, pagination.page, pagination.limit, statusFilter]);

  // Client-side search within the current page
  const filtered = transactions.filter(tx => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (tx.id ?? '').toLowerCase().includes(term) ||
      (tx.client ?? tx.customer ?? '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Transactions</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Monitor all incoming payments, refunds, and failures.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden sm:flex bg-white dark:bg-slate-900">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search by ID or customer..." 
            className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap w-full sm:w-auto items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-20 px-4 sm:px-6">Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method/Gateway</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right px-4 sm:px-6">Net</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(tx => (
                <TableRow key={tx.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="px-4 sm:px-6">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'refund' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-indigo-50 dark:bg-indigo-900/30'}`}>
                      {tx.type === 'refund' ? <ArrowDownIcon className="w-4 h-4 text-slate-500" /> : <ArrowUpIcon className="w-4 h-4 text-indigo-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-500 uppercase">{tx.currency}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">{tx.id.slice(0, 14)}...</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                       {tx.status === 'succeeded' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                        tx.status === 'pending' ? <RotateCcw className="w-4 h-4 text-amber-500" /> :
                        tx.status === 'refunded' ? <ArrowDownIcon className="w-4 h-4 text-blue-500" /> :
                        <AlertCircle className="w-4 h-4 text-red-500" />
                       }
                       <span className="font-medium capitalize text-slate-700 dark:text-slate-300 text-sm">
                         {tx.status}
                       </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-slate-700 dark:text-slate-200 text-sm">{tx.customer}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize text-slate-500 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-normal shadow-sm">
                        {tx.method}
                      </Badge>
                      <span className="text-xs text-slate-400 capitalize hidden sm:inline-block">via {tx.gateway}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {new Date(tx.date).toLocaleDateString()}
                    <span className="block text-xs mt-0.5">{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </TableCell>
                  <TableCell className="text-right px-4 sm:px-6">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {tx.net > 0 ? '+' : ''}{tx.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Fee: {tx.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 sm:pr-6">
                     <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View details</DropdownMenuItem>
                          <DropdownMenuItem>Copy transaction ID</DropdownMenuItem>
                          <DropdownMenuItem>Download receipt</DropdownMenuItem>
                          {tx.status === 'succeeded' && <DropdownMenuItem className="text-red-600">Refund</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-slate-500">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 sm:px-6 border-t">
          <PaginationControls
            page={pagination.page}
            total={total}
            limit={pagination.limit}
            onPage={pagination.goTo}
          />
        </div>
      </Card>
    </div>
  );
}
