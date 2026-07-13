import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  Bitcoin, Copy, Check, Save, Loader2, QrCode, Wallet, ArrowDownToLine, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import QRCodeLib from 'qrcode';
import { CRYPTO_COINS } from './Settings';

interface Tx {
  id: string;
  client: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  created_at: string;
}

const CRYPTO_METHOD_HINTS = ['crypto', 'usdt', 'btc', 'eth', 'bnb'];

function isCryptoTx(tx: Tx): boolean {
  const pm = (tx.payment_method ?? '').toLowerCase();
  return CRYPTO_METHOD_HINTS.some(h => pm.includes(h));
}

export default function Crypto() {
  const { session } = useAuth();
  const [wallets, setWallets] = useState<Record<string, string>>({});
  const [savedWallets, setSavedWallets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrCoin, setQrCoin] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const authHeaders = useCallback((): Record<string, string> => (
    session ? { Authorization: `Bearer ${session.access_token}` } : {}
  ), [session]);

  // Load saved wallets
  useEffect(() => {
    if (!session) return;
    fetch('/api/gateways/crypto/status', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        const w = (d.wallets ?? {}) as Record<string, string>;
        setWallets(w);
        setSavedWallets(w);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, authHeaders]);

  // Load crypto transactions
  const fetchTxs = useCallback(() => {
    if (!session) return;
    setTxLoading(true);
    fetch('/api/transactions?limit=100', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setTxs(((d.data ?? []) as Tx[]).filter(isCryptoTx)))
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [session, authHeaders]);

  useEffect(() => { fetchTxs(); }, [fetchTxs]);

  // QR preview for a configured wallet
  useEffect(() => {
    if (!qrCoin) { setQrDataUrl(null); return; }
    const coin = CRYPTO_COINS.find(c => c.key === qrCoin);
    const address = wallets[qrCoin]?.trim();
    if (!coin || !address) { setQrDataUrl(null); return; }
    QRCodeLib.toDataURL(`${coin.qrPrefix}${address}`, { width: 220, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrCoin, wallets]);

  const dirty = JSON.stringify(wallets) !== JSON.stringify(savedWallets);
  const configuredCount = CRYPTO_COINS.filter(c => (savedWallets[c.key] ?? '').trim()).length;
  const totalVolume = txs.filter(t => t.status === 'Success').reduce((s, t) => s + Number(t.amount), 0);

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    try {
      const res = await fetch('/api/gateways/crypto/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ wallets }),
      });
      if (res.ok) {
        const d = await res.json();
        setSavedWallets(d.wallets ?? wallets);
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2500);
      } else {
        alert((await res.json().catch(() => ({}))).error ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCopy(key: string, address: string) {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Crypto Payments</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Wallet addresses shown on your invoices and payment links. Customers pay on-chain; you confirm receipt in your own wallet.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving} className="w-full sm:w-auto shadow-sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : savedMsg ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? 'Saving…' : savedMsg ? 'Saved' : 'Save Wallets'}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Wallets Configured</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{configuredCount} <span className="text-base font-medium text-slate-400">/ {CRYPTO_COINS.length}</span></span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Crypto Transactions</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{txLoading ? '—' : txs.length}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Confirmed Volume</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {txLoading ? '—' : totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Wallets */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="w-5 h-5 text-emerald-600" /> Wallet Addresses</CardTitle>
          <CardDescription>
            Leave a field blank to hide that coin from customers. Double-check every address — on-chain payments are irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {CRYPTO_COINS.map(coin => {
            const address = wallets[coin.key] ?? '';
            const hasAddress = address.trim().length > 0;
            return (
              <div key={coin.key} className={`border rounded-xl p-4 transition-colors ${hasAddress ? `${coin.border} ${coin.bg} dark:bg-transparent` : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-sm font-bold ${hasAddress ? coin.color : 'text-slate-500'}`}>{coin.label}</p>
                    <p className="text-[10px] text-slate-400">{coin.network}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasAddress && (
                      <>
                        <button onClick={() => handleCopy(coin.key, address)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Copy address">
                          {copied === coin.key ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setQrCoin(qrCoin === coin.key ? null : coin.key)} className={`p-1.5 rounded-md transition-colors ${qrCoin === coin.key ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`} title="Show QR">
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <Input
                  placeholder={`${coin.symbol} address`}
                  value={address}
                  onChange={e => setWallets(prev => ({ ...prev, [coin.key]: e.target.value }))}
                  className="font-mono text-xs bg-white dark:bg-slate-950"
                />
                {qrCoin === coin.key && qrDataUrl && (
                  <div className="mt-3 flex justify-center">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <img src={qrDataUrl} alt={`${coin.label} QR`} className="w-[180px] h-[180px]" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><ArrowDownToLine className="w-5 h-5 text-emerald-600" /> Crypto Transactions</CardTitle>
            <CardDescription>Payments recorded with a crypto payment method.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTxs} disabled={txLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${txLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="px-6">Client</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right px-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Bitcoin className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No crypto transactions yet</p>
                      <p className="text-xs mt-1">Payments made via the Crypto tab on your invoices and payment links will appear here.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                txs.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="px-6 font-medium text-slate-900 dark:text-slate-100">{tx.client}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-[11px]">{tx.payment_method}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={tx.status === 'Success'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{new Date(tx.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right px-6 font-semibold text-slate-900 dark:text-slate-100">
                      {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {tx.currency}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
