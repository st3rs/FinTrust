import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Users, DollarSign, TrendingUp, Activity,
  FileText, CheckCircle2, AlertCircle, Clock,
  Zap, Globe, Bitcoin, QrCode,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalMerchants: number;
  activeMerchants: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalTransactions: number;
  totalInvoices: number;
  paidInvoices: number;
  gatewayBreakdown: Record<string, number>;
}

interface Gateway {
  id: string;
  name: string;
  status: 'active' | 'not_configured' | 'development';
  merchantCount: number;
  environment: string | null;
}

interface GatewayData {
  gateways: Gateway[];
  sseClients: number;
  recentLogCount: number;
}

interface RecentTransaction {
  id: string;
  client: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── Skeletons ──────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-3 animate-pulse">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-7 w-20 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}

function KpiCard({ label, value, sub, icon: Icon, accent = 'text-primary' }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className={`p-2 rounded-md bg-muted ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Gateway Status Badge ───────────────────────────────────────────────────

const GATEWAY_STATUS: Record<string, { label: string; className: string; dot: string }> = {
  active:          { label: 'Active',        className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dot: 'bg-emerald-500' },
  not_configured:  { label: 'Not configured', className: 'bg-muted text-muted-foreground border-border',           dot: 'bg-muted-foreground' },
  development:     { label: 'In development', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',     dot: 'bg-amber-500' },
};

const GATEWAY_ICONS: Record<string, React.ElementType> = {
  stripe: Zap,
  paypal: Globe,
  promptpay: QrCode,
  crypto: Bitcoin,
};

function GatewayCard({ gw }: { gw: Gateway }) {
  const s = GATEWAY_STATUS[gw.status];
  const Icon = GATEWAY_ICONS[gw.id] ?? Activity;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{gw.name}</p>
        <p className="text-xs text-muted-foreground">
          {gw.merchantCount > 0 ? `${gw.merchantCount} merchant${gw.merchantCount !== 1 ? 's' : ''}` : 'Platform-wide'}
        </p>
      </div>
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${s.className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    </div>
  );
}

// ── Transaction Status Badge ───────────────────────────────────────────────

function TxnStatus({ status }: { status: string }) {
  const map: Record<string, { icon: React.ElementType; cls: string }> = {
    Success:   { icon: CheckCircle2, cls: 'text-emerald-500' },
    Pending:   { icon: Clock,        cls: 'text-amber-500' },
    Failed:    { icon: AlertCircle,  cls: 'text-destructive' },
    Cancelled: { icon: AlertCircle,  cls: 'text-muted-foreground' },
  };
  const m = map[status] ?? map.Pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { session } = useAuth();
  const prefersReduced = useReducedMotion();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [gateways, setGateways] = useState<GatewayData | null>(null);
  const [recentTxns, setRecentTxns] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    Promise.all([
      fetch('/api/admin/stats', { headers }).then((r) => r.json()),
      fetch('/api/admin/gateways', { headers }).then((r) => r.json()),
      fetch('/api/admin/transactions?limit=8', { headers }).then((r) => r.json()),
    ])
      .then(([s, g, t]) => {
        setStats(s);
        setGateways(g);
        setRecentTxns(t.data ?? []);
      })
      .catch(() => setError('Failed to load platform data.'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const itemVariants = {
    hidden: prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.26, ease: 'easeOut' as const } },
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <KpiSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-72 bg-muted rounded-lg animate-pulse" />
          <div className="h-72 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const collectionRate = stats && stats.totalInvoices > 0
    ? Math.round((stats.paidInvoices / stats.totalInvoices) * 100)
    : 0;

  return (
    <motion.div
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: prefersReduced ? 0 : 0.07 } } }}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Platform Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregate metrics across all merchants
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {gateways?.sseClients ?? 0} live connections
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Merchants"
          value={String(stats?.totalMerchants ?? 0)}
          sub={`${stats?.activeMerchants ?? 0} active`}
          icon={Users}
        />
        <KpiCard
          label="Platform Revenue"
          value={fmt(stats?.totalRevenue ?? 0)}
          sub={`${stats?.totalTransactions ?? 0} transactions`}
          icon={DollarSign}
          accent="text-emerald-500"
        />
        <KpiCard
          label="Monthly Volume"
          value={fmt(stats?.monthlyRevenue ?? 0)}
          sub="Current month"
          icon={TrendingUp}
          accent="text-blue-500"
        />
        <KpiCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          sub={`${stats?.paidInvoices ?? 0} / ${stats?.totalInvoices ?? 0} invoices paid`}
          icon={FileText}
          accent="text-violet-500"
        />
      </motion.div>

      {/* Lower grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Transactions</h2>
            <span className="text-xs text-muted-foreground">All merchants</span>
          </div>
          {recentTxns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
              <Activity className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Client</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Method</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTxns.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground truncate max-w-[140px]">{t.client}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {t.currency === 'THB' ? '฿' : '$'}{Number(t.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{t.payment_method}</td>
                      <td className="px-4 py-3"><TxnStatus status={t.status} /></td>
                      <td className="px-5 py-3 text-right text-muted-foreground hidden md:table-cell">{fmtDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Gateway Status */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Gateway Health</h2>
          </div>
          <div className="p-4 space-y-2.5">
            {(gateways?.gateways ?? []).map((gw) => (
              <GatewayCard key={gw.id} gw={gw} />
            ))}
            <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border mt-2">
              <span>SSE connections</span>
              <span className="font-mono font-medium text-foreground">{gateways?.sseClients ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Activity log entries</span>
              <span className="font-mono font-medium text-foreground">{gateways?.recentLogCount ?? 0}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
