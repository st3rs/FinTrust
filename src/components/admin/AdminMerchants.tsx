import React, { useEffect, useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Search, Users, Crown, UserCheck, UserX,
  MoreHorizontal, ChevronUp, ChevronDown, AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '../../lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────

interface Merchant {
  id: string;
  email: string;
  companyName: string;
  plan: 'free' | 'pro';
  isSuspended: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastSignIn: string | null;
  totalBilled: number;
  invoiceCount: number;
  paidCount: number;
}

type SortKey = 'companyName' | 'plan' | 'totalBilled' | 'invoiceCount' | 'lastSignIn';
type SortDir = 'asc' | 'desc';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ── Plan Badge ─────────────────────────────────────────────────────────────

function PlanBadge({ plan, isAdmin }: { plan: string; isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25">
        <Crown className="w-3 h-3" />
        Admin
      </span>
    );
  }
  if (plan === 'pro') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
        Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      Free
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-border">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
          <div className="h-5 w-12 bg-muted rounded-full hidden sm:block" />
          <div className="h-4 w-16 bg-muted rounded hidden md:block" />
          <div className="h-4 w-20 bg-muted rounded hidden lg:block" />
        </div>
      ))}
    </div>
  );
}

// ── SortHeader ─────────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey;
  current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={[
        'flex items-center gap-1 text-xs font-medium transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {label}
      {active
        ? dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        : <ChevronDown className="w-3 h-3 opacity-30" />}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminMerchants() {
  const { session } = useAuth();
  const prefersReduced = useReducedMotion();

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('totalBilled');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  }), [session?.access_token]);

  const load = () => {
    if (!session?.access_token) return;
    fetch('/api/admin/merchants', { headers })
      .then((r) => r.json())
      .then((d) => setMerchants(d.data ?? []))
      .catch(() => setError('Failed to load merchants.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [session?.access_token]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleAction = async (merchantId: string, action: 'upgrade' | 'downgrade' | 'suspend' | 'unsuspend') => {
    setActionLoading(merchantId);
    try {
      if (action === 'upgrade' || action === 'downgrade') {
        await fetch(`/api/admin/merchants/${merchantId}/plan`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ plan: action === 'upgrade' ? 'pro' : 'free' }),
        });
      } else {
        await fetch(`/api/admin/merchants/${merchantId}/status`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action }),
        });
      }
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = useMemo(() => {
    let list = merchants;
    if (planFilter !== 'all') list = list.filter((m) => m.plan === planFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        m.email.toLowerCase().includes(q) ||
        m.companyName.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let av: number | string = a[sortKey] as string;
      let bv: number | string = b[sortKey] as string;
      if (sortKey === 'lastSignIn') {
        av = a.lastSignIn ? new Date(a.lastSignIn).getTime() : 0;
        bv = b.lastSignIn ? new Date(b.lastSignIn).getTime() : 0;
      }
      if (sortKey === 'totalBilled' || sortKey === 'invoiceCount') {
        av = Number(av); bv = Number(bv);
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [merchants, search, planFilter, sortKey, sortDir]);

  const totalPro = merchants.filter((m) => m.plan === 'pro').length;

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
          <h1 className="text-xl font-bold text-foreground">Merchants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {merchants.length} registered &middot; {totalPro} Pro &middot; {merchants.length - totalPro} Free
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by company or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="flex gap-1.5 rounded-lg border border-border bg-background p-1 shrink-0">
          {(['all', 'pro', 'free'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPlanFilter(f)}
              className={[
                'px-3 py-1 rounded-md text-xs font-medium capitalize transition-all',
                planFilter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-6 py-3">
                  <SortHeader label="Company / Email" sortKey="companyName" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-left px-4 py-3">
                  <SortHeader label="Plan" sortKey="plan" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-right px-4 py-3 hidden md:table-cell">
                  <SortHeader label="Revenue" sortKey="totalBilled" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-right px-4 py-3 hidden lg:table-cell">
                  <SortHeader label="Invoices" sortKey="invoiceCount" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">
                  <SortHeader label="Last Active" sortKey="lastSignIn" current={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-6 py-3 text-right">
                  <span className="text-xs font-medium text-muted-foreground">Actions</span>
                </th>
              </tr>
            </thead>

            {loading ? (
              <tbody><tr><td colSpan={6}><TableSkeleton /></td></tr></tbody>
            ) : error ? (
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
                      <AlertTriangle className="w-8 h-8 text-destructive" />
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
                      <Users className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No merchants match your filters.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-border">
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className={[
                      'transition-colors hover:bg-muted/20',
                      m.isSuspended ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    {/* Identity */}
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 select-none">
                          {(m.companyName || m.email)[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {m.companyName || <span className="text-muted-foreground italic">Unnamed</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                        {m.isSuspended && (
                          <span className="text-xs text-destructive font-medium shrink-0">Suspended</span>
                        )}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <PlanBadge plan={m.plan} isAdmin={m.isAdmin} />
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-3 text-right font-mono text-foreground hidden md:table-cell">
                      {fmt(m.totalBilled)}
                    </td>

                    {/* Invoices */}
                    <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                      {m.paidCount}/{m.invoiceCount}
                    </td>

                    {/* Last active */}
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                      {timeAgo(m.lastSignIn)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-3 text-right">
                      {m.isAdmin ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <button
                              aria-label={`Actions for ${m.companyName || m.email}`}
                              disabled={actionLoading === m.id}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                            >
                              {actionLoading === m.id
                                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                                : <MoreHorizontal className="w-4 h-4" />}
                            </button>
                          } />
                          <DropdownMenuContent align="end" className="w-44">
                            {m.plan === 'free' ? (
                              <DropdownMenuItem
                                onClick={() => handleAction(m.id, 'upgrade')}
                                className="cursor-pointer gap-2"
                              >
                                <Crown className="w-3.5 h-3.5 text-primary" />
                                Upgrade to Pro
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleAction(m.id, 'downgrade')}
                                className="cursor-pointer gap-2"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                Downgrade to Free
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {m.isSuspended ? (
                              <DropdownMenuItem
                                onClick={() => handleAction(m.id, 'unsuspend')}
                                className="cursor-pointer gap-2"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                Unsuspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleAction(m.id, 'suspend')}
                                className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {!loading && !error && (
          <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {merchants.length} merchants
          </div>
        )}
      </div>
    </motion.div>
  );
}
