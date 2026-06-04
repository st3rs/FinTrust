import React, { useEffect, useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Search, ArrowRightLeft, CheckCircle2, Clock,
  XCircle, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  client: string;
  amount: number;
  currency: string;
  status: 'Success' | 'Pending' | 'Failed' | 'Cancelled';
  payment_method: string;
  user_id: string;
  created_at: string;
}

const STATUS_CONFIG = {
  Success:   { icon: CheckCircle2, cls: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  Pending:   { icon: Clock,        cls: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  Failed:    { icon: XCircle,      cls: 'text-destructive', bg: 'bg-destructive/10' },
  Cancelled: { icon: AlertCircle,  cls: 'text-muted-foreground', bg: 'bg-muted'    },
} as const;

const METHOD_LABELS: Record<string, string> = {
  PromptPay: 'PromptPay',
  USDT:      'Crypto',
  Card:      'Card',
  PayPal:    'PayPal',
  Stripe:    'Stripe',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtAmount(amount: number, currency: string) {
  const symbol = currency === 'THB' ? '฿' : '$';
  return `${symbol}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Transaction['status'] }) {
  const { icon: Icon, cls, bg } = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${bg} ${cls}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

// ── Method Pill ────────────────────────────────────────────────────────────

function MethodPill({ method }: { method: string }) {
  return (
    <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
      {METHOD_LABELS[method] ?? method}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-border">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded ml-auto" />
          <div className="h-5 w-16 bg-muted rounded-full hidden sm:block" />
          <div className="h-5 w-14 bg-muted rounded-md hidden md:block" />
          <div className="h-4 w-24 bg-muted rounded hidden lg:block" />
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 20;

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminTransactions() {
  const { session } = useAuth();
  const prefersReduced = useReducedMotion();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Transaction['status']>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | string>('all');

  const headers = useMemo(() => ({
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  }), [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    fetch(`/api/admin/transactions?${params}`, { headers })
      .then((r) => r.json())
      .then((d) => { setTransactions(d.data ?? []); setTotal(d.total ?? 0); })
      .catch(() => setError('Failed to load transactions.'))
      .finally(() => setLoading(false));
  }, [session?.access_token, page]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
    if (methodFilter !== 'all') list = list.filter((t) => t.payment_method === methodFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.client.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
    }
    return list;
  }, [transactions, statusFilter, methodFilter, search]);

  const methods = useMemo(() => {
    const set = new Set(transactions.map((t) => t.payment_method));
    return Array.from(set).filter(Boolean);
  }, [transactions]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const successVol = useMemo(() =>
    transactions
      .filter((t) => t.status === 'Success')
      .reduce((s, t) => s + (t.amount ?? 0), 0),
    [transactions]
  );

  return (
    <motion.div
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6"
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">All Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString()} total &middot; ${successVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} volume this page
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by client or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 rounded-lg border border-border bg-background p-1 shrink-0 flex-wrap">
          {(['all', 'Success', 'Pending', 'Failed', 'Cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all whitespace-nowrap',
                statusFilter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Method filter */}
        {methods.length > 0 && (
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shrink-0"
          >
            <option value="all">All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m] ?? m}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground">Client</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Method</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Merchant</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground hidden xl:table-cell">Date</th>
              </tr>
            </thead>

            {loading ? (
              <tbody><tr><td colSpan={6}><RowSkeleton /></td></tr></tbody>
            ) : error ? (
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center h-48 gap-2">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                      <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : filtered.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
                      <ArrowRightLeft className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-border">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-medium text-foreground">{t.client}</p>
                      <p className="text-xs text-muted-foreground font-mono">{t.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                      {fmtAmount(t.amount, t.currency)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><MethodPill method={t.payment_method} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden lg:table-cell">
                      {t.user_id.slice(0, 8)}…
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-muted-foreground hidden xl:table-cell">
                      {fmtDate(t.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages} &middot; {total.toLocaleString()} total
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs text-foreground font-medium">{page + 1}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
