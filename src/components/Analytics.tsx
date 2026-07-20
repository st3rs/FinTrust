import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useTheme } from './theme-provider';
import {
  Loader2, TrendingUp, TrendingDown, Activity, Receipt, BarChart3, Landmark,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Chart palette ─────────────────────────────────────────────────────────
// Trend series matches the Dashboard jade primary. The categorical set for
// payment methods is CVD-validated per mode (dataviz six-checks): colors are
// assigned to the METHOD, never to its rank, so re-filtering never repaints.

const TREND_COLORS = {
  light: 'oklch(0.49 0.13 165)',
  dark: 'oklch(0.65 0.15 165)',
} as const;

type MethodKey = 'promptpay' | 'card' | 'paypal' | 'crypto' | 'other';

const METHOD_META: Record<MethodKey, { label: string; light: string; dark: string }> = {
  promptpay: { label: 'PromptPay', light: '#047857', dark: '#059669' },
  card:      { label: 'Card',      light: '#6d28d9', dark: '#8b5cf6' },
  crypto:    { label: 'Crypto',    light: '#b45309', dark: '#d97706' },
  paypal:    { label: 'PayPal',    light: '#0369a1', dark: '#0284c7' },
  other:     { label: 'Other',     light: '#be185d', dark: '#db2777' },
};

const CRYPTO_HINTS = ['crypto', 'usdt', 'btc', 'eth', 'bnb'];

function methodKeyOf(paymentMethod: string): MethodKey {
  const pm = (paymentMethod ?? '').toLowerCase();
  if (pm.includes('promptpay') || pm.includes('qr')) return 'promptpay';
  if (pm.includes('card') || pm.includes('stripe')) return 'card';
  if (pm.includes('paypal')) return 'paypal';
  if (CRYPTO_HINTS.some(h => pm.includes(h))) return 'crypto';
  return 'other';
}

function useResolvedTheme(): 'light' | 'dark' {
  const { theme } = useTheme();
  return useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [theme]);
}

// ─── Data types ────────────────────────────────────────────────────────────

interface Tx {
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  created_at: string;
}

interface Inv {
  status: string;
  amount: number;
}

type RangeKey = '7d' | '30d' | '90d' | '12m';

const RANGES: Record<RangeKey, { label: string; days: number; bucket: 'day' | 'week' | 'month' }> = {
  '7d':  { label: '7D',  days: 7,   bucket: 'day' },
  '30d': { label: '30D', days: 30,  bucket: 'day' },
  '90d': { label: '90D', days: 90,  bucket: 'week' },
  '12m': { label: '12M', days: 365, bucket: 'month' },
};

function bucketStart(d: Date, bucket: 'day' | 'week' | 'month'): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  if (bucket === 'week') out.setDate(out.getDate() - out.getDay());
  if (bucket === 'month') out.setDate(1);
  return out;
}

function bucketLabel(d: Date, bucket: 'day' | 'week' | 'month'): string {
  if (bucket === 'month') return d.toLocaleDateString(undefined, { month: 'short' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fmtAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function Analytics() {
  const { user } = useAuth();
  const resolvedTheme = useResolvedTheme();
  const [range, setRange] = useState<RangeKey>('30d');
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [priorTxs, setPriorTxs] = useState<Tx[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { days } = RANGES[range];
        const now = Date.now();
        const start = new Date(now - days * 86_400_000);
        const priorStart = new Date(now - 2 * days * 86_400_000);

        const [txRes, invRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('amount, currency, status, payment_method, created_at')
            .eq('user_id', user!.id)
            .gte('created_at', priorStart.toISOString())
            .order('created_at', { ascending: true }),
          supabase
            .from('invoices')
            .select('status, amount')
            .eq('user_id', user!.id),
        ]);
        if (cancelled) return;

        const all = (txRes.data ?? []) as Tx[];
        setTxs(all.filter(t => new Date(t.created_at).getTime() >= start.getTime()));
        setPriorTxs(all.filter(t => new Date(t.created_at).getTime() < start.getTime()));
        setInvoices((invRes.data ?? []) as Inv[]);
      } catch (err) {
        console.error('Error loading analytics:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, range]);

  // ── Aggregations ─────────────────────────────────────────────────────────

  const successTxs = useMemo(() => txs.filter(t => t.status === 'Success'), [txs]);
  const volume = useMemo(() => successTxs.reduce((s, t) => s + Number(t.amount), 0), [successTxs]);
  const priorVolume = useMemo(
    () => priorTxs.filter(t => t.status === 'Success').reduce((s, t) => s + Number(t.amount), 0),
    [priorTxs]
  );
  const volumeDelta = priorVolume > 0 ? ((volume - priorVolume) / priorVolume) * 100 : null;

  const settledTxs = useMemo(() => txs.filter(t => t.status !== 'Pending'), [txs]);
  const successRate = settledTxs.length > 0 ? (successTxs.length / settledTxs.length) * 100 : null;
  const avgTx = successTxs.length > 0 ? volume / successTxs.length : 0;

  const currencies = useMemo(() => [...new Set(successTxs.map(t => t.currency))], [successTxs]);
  const currencyNote = currencies.length === 1 ? currencies[0] : currencies.length > 1 ? 'mixed currencies' : '';

  const paidInvoices = invoices.filter(i => i.status === 'PAID').length;
  const nonDraft = invoices.filter(i => i.status !== 'DRAFT').length;
  const conversion = nonDraft > 0 ? (paidInvoices / nonDraft) * 100 : null;

  // Revenue trend — successful volume bucketed over the selected range
  const chartData = useMemo(() => {
    const { days, bucket } = RANGES[range];
    const start = bucketStart(new Date(Date.now() - days * 86_400_000), bucket);
    const buckets = new Map<number, number>();
    const cursor = new Date(start);
    const end = new Date();
    while (cursor.getTime() <= end.getTime()) {
      buckets.set(cursor.getTime(), 0);
      if (bucket === 'day') cursor.setDate(cursor.getDate() + 1);
      else if (bucket === 'week') cursor.setDate(cursor.getDate() + 7);
      else cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const t of successTxs) {
      const key = bucketStart(new Date(t.created_at), bucket).getTime();
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(t.amount));
    }
    return [...buckets.entries()].map(([ts, revenue]) => ({
      name: bucketLabel(new Date(ts), bucket),
      revenue,
    }));
  }, [successTxs, range]);

  // Per-method breakdown (fixed color per method — never re-ranked)
  const methodStats = useMemo(() => {
    const map = new Map<MethodKey, { volume: number; total: number; success: number; failed: number }>();
    for (const t of txs) {
      const key = methodKeyOf(t.payment_method);
      const cur = map.get(key) ?? { volume: 0, total: 0, success: 0, failed: 0 };
      cur.total += 1;
      if (t.status === 'Success') { cur.success += 1; cur.volume += Number(t.amount); }
      if (t.status === 'Failed' || t.status === 'Cancelled') cur.failed += 1;
      map.set(key, cur);
    }
    return (Object.keys(METHOD_META) as MethodKey[])
      .filter(k => map.has(k))
      .map(k => ({ key: k, ...METHOD_META[k], ...map.get(k)! }));
  }, [txs]);

  const maxMethodVolume = Math.max(1, ...methodStats.map(m => m.volume));
  const trendColor = TREND_COLORS[resolvedTheme];

  if (loading && txs.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-20">

      {/* Header + range filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Revenue, conversion, and gateway performance across your payment traffic.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 w-fit">
          {(Object.keys(RANGES) as RangeKey[]).map(k => (
            <Button
              key={k}
              variant={range === k ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs font-semibold"
              onClick={() => setRange(k)}
            >
              {RANGES[k].label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Volume ({RANGES[range].label})</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">{fmtAmount(volume)}</span>
            <span className="flex items-center gap-1 text-xs mt-1">
              {volumeDelta !== null ? (
                <>
                  {volumeDelta >= 0
                    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  <span className={volumeDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                    {volumeDelta >= 0 ? '+' : ''}{volumeDelta.toFixed(1)}%
                  </span>
                  <span className="text-slate-400">vs prior period</span>
                </>
              ) : (
                <span className="text-slate-400">{currencyNote || 'no prior data'}</span>
              )}
            </span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Transactions</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">{txs.length}</span>
            <span className="text-xs text-slate-400 mt-1">{successTxs.length} successful</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Success Rate</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">
              {successRate === null ? '—' : `${successRate.toFixed(1)}%`}
            </span>
            <span className="text-xs text-slate-400 mt-1">of settled transactions</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Avg Transaction</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white">{fmtAmount(avgTx)}</span>
            <span className="text-xs text-slate-400 mt-1">{currencyNote}</span>
          </CardContent>
        </Card>
      </div>

      {/* Revenue trend */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Activity className="w-5 h-5 text-emerald-600" /> Revenue Trend</CardTitle>
          <CardDescription>Successful payment volume per {RANGES[range].bucket}.</CardDescription>
        </CardHeader>
        <CardContent>
          {successTxs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No successful payments in this period</p>
              <p className="text-xs mt-1">Revenue appears here once payments start settling.</p>
            </div>
          ) : (
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="gradAnalyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={trendColor} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#1e293b' : '#e2e8f0'} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'ui-monospace, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  />
                  <Tooltip
                    cursor={{ stroke: '#64748b', strokeDasharray: '3 3' }}
                    contentStyle={{
                      background: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
                      border: `1px solid ${resolvedTheme === 'dark' ? '#1e293b' : '#e2e8f0'}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [fmtAmount(Number(value)), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={trendColor}
                    strokeWidth={2}
                    fill="url(#gradAnalyticsRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Payment method breakdown */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Landmark className="w-5 h-5 text-emerald-600" /> Payment Methods</CardTitle>
            <CardDescription>Successful volume by method in the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {methodStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                <Landmark className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No transactions yet</p>
              </div>
            ) : (
              methodStats.map(m => {
                const color = resolvedTheme === 'dark' ? m.dark : m.light;
                const share = volume > 0 ? (m.volume / volume) * 100 : 0;
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                        {m.label}
                      </span>
                      <span className="font-mono text-slate-500">
                        {fmtAmount(m.volume)} <span className="text-slate-400">({share.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${(m.volume / maxMethodVolume) * 100}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Gateway performance */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Receipt className="w-5 h-5 text-emerald-600" /> Gateway Performance</CardTitle>
            <CardDescription>
              Per-method delivery of your payment traffic.
              {conversion !== null && (
                <> Overall invoice conversion: <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{conversion.toFixed(1)}%</span> ({paidInvoices}/{nonDraft} invoices paid).</>
              )}
            </CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="px-6">Method</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Success Rate</TableHead>
                  <TableHead className="text-right px-6">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methodStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-500">
                      Gateway stats appear once transactions are recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  methodStats.map(m => {
                    const color = resolvedTheme === 'dark' ? m.dark : m.light;
                    const settled = m.success + m.failed;
                    const rate = settled > 0 ? (m.success / settled) * 100 : null;
                    return (
                      <TableRow key={m.key}>
                        <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                            {m.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{m.total}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">{m.success}</TableCell>
                        <TableCell className="text-right font-mono text-red-500 dark:text-red-400">{m.failed}</TableCell>
                        <TableCell className="text-right font-mono">{rate === null ? '—' : `${rate.toFixed(1)}%`}</TableCell>
                        <TableCell className="text-right px-6 font-mono font-semibold text-slate-900 dark:text-slate-100">{fmtAmount(m.volume)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
