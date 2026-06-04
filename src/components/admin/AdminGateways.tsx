import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Zap, Globe, QrCode, Bitcoin,
  CheckCircle2, AlertCircle, Clock,
  Activity, Radio, Server,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Configs ────────────────────────────────────────────────────────────────

const GATEWAY_META: Record<string, {
  icon: React.ElementType;
  description: string;
  docs: string;
}> = {
  stripe: {
    icon: Zap,
    description: 'International card payments. Each merchant connects their own Stripe keys via Settings.',
    docs: 'https://stripe.com/docs',
  },
  paypal: {
    icon: Globe,
    description: 'PayPal and credit card checkout. Platform-level credentials set via PAYPAL_CLIENT_ID env var.',
    docs: 'https://developer.paypal.com/docs',
  },
  promptpay: {
    icon: QrCode,
    description: 'Thai PromptPay QR generation runs fully client-side using the promptpay-qr package. No server credentials needed.',
    docs: 'https://promptpay.io',
  },
  crypto: {
    icon: Bitcoin,
    description: 'USDT TRC-20 and other crypto payment settlement. Module is currently under development.',
    docs: '#',
  },
};

const STATUS_CONFIG: Record<Gateway['status'], {
  label: string;
  icon: React.ElementType;
  badgeCls: string;
  borderCls: string;
  dotCls: string;
}> = {
  active: {
    label: 'Active',
    icon: CheckCircle2,
    badgeCls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25',
    borderCls: 'border-emerald-500/20',
    dotCls: 'bg-emerald-500',
  },
  not_configured: {
    label: 'Not configured',
    icon: AlertCircle,
    badgeCls: 'bg-muted text-muted-foreground border-border',
    borderCls: 'border-border',
    dotCls: 'bg-muted-foreground',
  },
  development: {
    label: 'In development',
    icon: Clock,
    badgeCls: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
    borderCls: 'border-amber-500/20',
    dotCls: 'bg-amber-500',
  },
};

// ── Gateway Card ───────────────────────────────────────────────────────────

function GatewayCard({ gw }: { gw: Gateway }) {
  const meta = GATEWAY_META[gw.id];
  const s = STATUS_CONFIG[gw.status];
  const Icon = meta?.icon ?? Activity;
  const StatusIcon = s.icon;

  return (
    <div className={`bg-card border rounded-xl p-6 flex flex-col gap-5 transition-all ${s.borderCls}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-muted text-foreground">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{gw.name}</h3>
            {gw.environment && (
              <p className="text-xs text-muted-foreground capitalize">{gw.environment}</p>
            )}
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${s.badgeCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dotCls} ${gw.status === 'active' ? 'animate-pulse' : ''}`} />
          {s.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {meta?.description}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-1 border-t border-border">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-0.5">Merchants connected</p>
          <p className="text-lg font-bold text-foreground">
            {gw.id === 'promptpay' || gw.id === 'crypto'
              ? 'All'
              : gw.merchantCount}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusIcon className={`w-3.5 h-3.5 ${s.badgeCls.split(' ')[1]}`} />
          <span>
            {gw.status === 'active' ? 'Operational' :
             gw.status === 'development' ? 'Coming soon' : 'Setup required'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── System Health Row ──────────────────────────────────────────────────────

function SystemStat({ label, value, icon: Icon, note }: {
  label: string; value: string | number;
  icon: React.ElementType; note?: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border">
      <div className="p-2.5 rounded-md bg-background border border-border text-muted-foreground shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminGateways() {
  const { session } = useAuth();
  const prefersReduced = useReducedMotion();

  const [data, setData] = useState<GatewayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/admin/gateways', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('Failed to load gateway data.'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const activeCount = data?.gateways.filter((g) => g.status === 'active').length ?? 0;
  const totalCount = data?.gateways.length ?? 0;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="h-7 w-40 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-52 bg-muted rounded-xl animate-pulse" />
          ))}
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

  return (
    <motion.div
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8"
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gateway Monitor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} of {totalCount} gateways operational
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {activeCount === totalCount ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Partial service
            </>
          )}
        </div>
      </div>

      {/* Gateway cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        variants={{ show: { transition: { staggerChildren: prefersReduced ? 0 : 0.08 } } }}
        initial="hidden"
        animate="show"
      >
        {(data?.gateways ?? []).map((gw) => (
          <motion.div
            key={gw.id}
            variants={{
              hidden: prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: 'easeOut' } },
            }}
          >
            <GatewayCard gw={gw} />
          </motion.div>
        ))}
      </motion.div>

      {/* System health */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">System Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SystemStat
            label="Active SSE connections"
            value={data?.sseClients ?? 0}
            icon={Radio}
            note="Live feeds"
          />
          <SystemStat
            label="Activity log entries"
            value={data?.recentLogCount ?? 0}
            icon={Activity}
            note="In-memory ring buffer"
          />
          <SystemStat
            label="Platform uptime"
            value="Online"
            icon={Server}
            note="/api/health"
          />
        </div>
      </div>
    </motion.div>
  );
}
