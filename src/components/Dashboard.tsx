import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  FileText, Activity, Link as LinkIcon, Users, QrCode, Bitcoin,
  TrendingUp, TrendingDown, CheckCircle2, Clock, XCircle,
  AlertTriangle, DollarSign
} from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { useTheme } from './theme-provider';
import { useDashboardMetrics } from '../lib/use-dashboard-metrics';

// ─── Chart palette (matches new jade primary) ──────────────────────────────

const CHART_COLORS = {
  light: {
    primary: 'oklch(0.49 0.13 165)',
    secondary: 'oklch(0.55 0.16 200)',
  },
  dark: {
    primary: 'oklch(0.65 0.15 165)',
    secondary: 'oklch(0.67 0.15 200)',
  },
} as const;

function useResolvedTheme(): 'light' | 'dark' {
  const { theme } = useTheme();
  return useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [theme]);
}

// ─── Motion variants ───────────────────────────────────────────────────────

function useVariants(prefersReducedMotion: boolean | null) {
  return useMemo(() => ({
    container: {
      show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.07 } },
    },
    item: {
      hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.28, ease: 'easeOut' as const },
      },
    },
  }), [prefersReducedMotion]);
}

// ─── Skeleton loading ──────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="h-8 w-40 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-80 bg-muted animate-pulse rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="h-20 bg-muted animate-pulse rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-80 bg-muted animate-pulse rounded-lg" />
        <div className="h-80 bg-muted animate-pulse rounded-lg" />
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

// ─── Quick actions ─────────────────────────────────────────────────────────

const QUICK_ACTIONS: Array<{
  to: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}> = [
  { to: '/invoice/new', icon: FileText, label: 'New Invoice', primary: true },
  { to: '/payment-links', icon: LinkIcon, label: 'Payment Link' },
  { to: '/promptpay', icon: QrCode, label: 'PromptPay QR' },
  { to: '/crypto', icon: Bitcoin, label: 'Crypto Pay' },
  { to: '/clients', icon: Users, label: 'Add Customer' },
];

function QuickActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground mr-0.5 shrink-0">
        Actions
      </span>
      {QUICK_ACTIONS.map(({ to, icon: Icon, label, primary }) => (
        <Link
          key={to}
          to={to}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
            'border transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            primary
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'bg-background text-foreground border-border hover:bg-muted',
          ].join(' ')}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  trend?: string;
  isPositive?: boolean;
  icon: React.ElementType;
  iconClass?: string;
}

function KPICard({ label, value, trend, isPositive, icon: Icon, iconClass }: KPICardProps) {
  const showTrend = trend !== undefined && isPositive !== undefined;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-amber-600 dark:text-amber-400';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClass ?? 'text-muted-foreground'}`} aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight tabular-nums">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 mt-1.5">
            {showTrend && (
              <TrendIcon className={`w-3.5 h-3.5 shrink-0 ${trendColor}`} aria-hidden />
            )}
            <span className={`text-xs font-medium ${showTrend ? trendColor : 'text-muted-foreground'}`}>
              {trend}
            </span>
            {showTrend && (
              <span className="text-xs text-muted-foreground">vs last period</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Secondary metric cell ────────────────────────────────────────────────

function MetricCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ElementType; label: string; cls: string }> = {
    succeeded: {
      icon: CheckCircle2,
      label: 'Paid',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40',
    },
    pending: {
      icon: Clock,
      label: 'Pending',
      cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
    },
    failed: {
      icon: XCircle,
      label: 'Failed',
      cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/40',
    },
  };
  const { icon: Icon, label, cls } = map[status] ?? map.pending;
  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}

// ─── Method badge ──────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const map: Record<string, string> = {
    promptpay: 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/15',
    crypto: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
  };
  const cls = map[method.toLowerCase()] ?? 'text-muted-foreground border-border';
  return (
    <Badge variant="outline" className={`capitalize ${cls}`}>
      {method}
    </Badge>
  );
}

// ─── Gateway health ───────────────────────────────────────────────────────

const GATEWAYS = [
  { name: 'Stripe', latency: '45ms', status: 'operational' as const },
  { name: 'PayPal', latency: '120ms', status: 'operational' as const },
  { name: 'PromptPay', latency: '85ms', status: 'operational' as const },
  { name: 'Crypto Pay', latency: 'High Load', status: 'degraded' as const },
];

function GatewayHealth() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Gateway Health
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 flex-1">
        {GATEWAYS.map(({ name, latency, status }) => (
          <div key={name} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden
                className={[
                  'w-2 h-2 rounded-full shrink-0',
                  status === 'operational'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500 animate-pulse',
                ].join(' ')}
              />
              <span className="text-sm font-medium">{name}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">{latency}</span>
              <span
                className={`text-xs font-medium block ${
                  status === 'operational'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {status === 'operational' ? 'Operational' : 'Degraded'}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const resolvedTheme = useResolvedTheme();
  const colors = CHART_COLORS[resolvedTheme];
  const prefersReducedMotion = useReducedMotion();
  const variants = useVariants(prefersReducedMotion);

  const {
    loading,
    monthlyVolume,
    totalRevenue,
    outstandingBalance,
    successRate,
    collectionRate,
    activeCustomers,
    activeLinks,
    chartData,
    recentTransactions,
  } = useDashboardMetrics();

  if (loading) return <DashboardSkeleton />;

  const kpiCards: KPICardProps[] = [
    {
      label: 'Monthly Volume',
      value: monthlyVolume.value,
      trend: monthlyVolume.percentage,
      isPositive: monthlyVolume.isPositive,
      icon: Activity,
    },
    {
      label: 'Total Revenue',
      value: totalRevenue.value,
      trend: totalRevenue.percentage,
      isPositive: totalRevenue.isPositive,
      icon: DollarSign,
      iconClass: 'text-emerald-500',
    },
    {
      label: 'Outstanding',
      value: outstandingBalance.value,
      trend: outstandingBalance.percentage,
      icon: AlertTriangle,
      iconClass: 'text-amber-500',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20">
      <motion.div
        variants={variants.container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Header + Quick Actions */}
        <motion.div
          variants={variants.item}
          className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Payment activity and platform metrics
            </p>
          </div>
          <QuickActions />
        </motion.div>

        {/* KPI Grid */}
        <motion.div
          variants={variants.container}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5"
        >
          {kpiCards.map((card, i) => (
            <motion.div
              key={card.label}
              variants={variants.item}
              className={i === 2 ? 'sm:col-span-2 lg:col-span-1' : ''}
            >
              <KPICard {...card} />
            </motion.div>
          ))}
        </motion.div>

        {/* Secondary metrics — single card with dividers, not 4 repeated cards */}
        <motion.div variants={variants.item}>
          <Card>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
              <MetricCell label="Success Rate" value={successRate} />
              <MetricCell label="Collection Rate" value={collectionRate} />
              <MetricCell label="Active Customers" value={activeCustomers} />
              <MetricCell label="Active Links" value={activeLinks} />
            </div>
          </Card>
        </motion.div>

        {/* Chart + Gateway Health */}
        <motion.div
          variants={variants.item}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        >
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">Revenue & Volume</CardTitle>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                    aria-hidden
                  />
                  <span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg
                    width="16"
                    height="8"
                    viewBox="0 0 16 8"
                    fill="none"
                    className="shrink-0"
                    aria-hidden
                  >
                    <line
                      x1="0" y1="4" x2="16" y2="4"
                      stroke={colors.secondary}
                      strokeWidth="2"
                      strokeDasharray="5 3"
                    />
                  </svg>
                  <span className="text-xs text-muted-foreground">Invoice volume</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 h-[280px] min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 4, right: 32, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={
                      resolvedTheme === 'dark'
                        ? 'rgba(255,255,255,0.07)'
                        : 'oklch(0.918 0.004 165)'
                    }
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(v) => `$${v / 1000}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: `1px solid ${
                        resolvedTheme === 'dark'
                          ? 'rgba(255,255,255,0.1)'
                          : 'oklch(0.918 0.004 165)'
                      }`,
                      boxShadow: '0 8px 24px -4px rgb(0 0 0 / 0.12)',
                      backgroundColor:
                        resolvedTheme === 'dark' ? 'oklch(0.205 0 0)' : 'white',
                      fontSize: '13px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'revenue')
                        return [`$${value.toLocaleString()}`, 'Revenue'];
                      return [value, 'Invoices'];
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke={colors.primary}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#gradRevenue)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="volume"
                    stroke={colors.secondary}
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="lg:col-span-1">
            <GatewayHealth />
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={variants.item}>
          <Card className="overflow-hidden">
            <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
              <Link to="/transactions">
                <Button variant="outline" size="sm" className="hidden sm:flex">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentTransactions.length === 0 ? (
                <div className="py-12 text-center px-6">
                  <p className="text-sm text-muted-foreground">
                    No transactions yet. Create your first invoice to get started.
                  </p>
                  <Link to="/invoice/new">
                    <Button size="sm" className="mt-4">
                      Create Invoice
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="font-semibold px-4 sm:px-6 w-28">
                          Status
                        </TableHead>
                        <TableHead className="font-semibold">Customer</TableHead>
                        <TableHead className="font-semibold">Method</TableHead>
                        <TableHead className="font-semibold text-muted-foreground font-medium">
                          Date
                        </TableHead>
                        <TableHead className="font-semibold text-right px-4 sm:px-6">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((tx) => (
                        <TableRow key={tx.id} className="cursor-pointer transition-colors">
                          <TableCell className="px-4 sm:px-6">
                            <StatusBadge status={tx.status} />
                          </TableCell>
                          <TableCell className="font-medium">{tx.customer}</TableCell>
                          <TableCell>
                            <MethodBadge method={tx.method} />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm tabular-nums">
                            {new Date(tx.date).toLocaleDateString()}
                            {' '}
                            <span className="text-xs opacity-60">
                              {new Date(tx.date).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right px-4 sm:px-6 font-semibold tabular-nums">
                            $
                            {tx.amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="p-4 border-t sm:hidden">
                <Link to="/transactions" className="block w-full">
                  <Button variant="outline" className="w-full">
                    View All Transactions
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
