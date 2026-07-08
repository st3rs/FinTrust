import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Invoice } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Wallet, QrCode, CheckCircle2, Loader2, AlertCircle, Bitcoin, Copy } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { supabase } from '../lib/supabase';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { loadScript } from '@paypal/paypal-js';
import { CRYPTO_COINS } from './Settings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatewayStatus {
  stripe: { connected: boolean; mode: string | null };
  paypal: { connected: boolean; environment: string | null };
  promptpay: { connected: boolean };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchInvoice(id: string): Promise<Invoice | null> {
  // Try Supabase client first (fastest)
  try {
    const { data } = await supabase.from('invoices').select('*').eq('id', id).single();
    if (data) {
      return {
        id: data.id,
        invoiceNumber: data.metadata?.invoiceNumber ?? data.id,
        amount: data.amount ?? 0,
        currency: data.metadata?.currency ?? 'USD',
        status: data.status ?? 'UNPAID',
        customerName: data.client ?? 'Client',
        customerEmail: data.metadata?.customerEmail ?? '',
        dueDate: data.due_date ?? data.date ?? new Date().toISOString(),
        createdAt: data.created_at ?? data.date ?? new Date().toISOString(),
        items: data.metadata?.items ?? [{ description: 'Services Rendered', quantity: 1, price: data.amount ?? 0 }],
      };
    }
  } catch { /* fall through */ }

  // Fallback to API
  try {
    const r = await fetch(`/api/invoices/${id}`);
    const d = await r.json();
    if (d.data) return d.data;
  } catch { /* fall through */ }

  return null;
}

// ─── Stripe checkout tab ─────────────────────────────────────────────────────

function StripeTab({
  invoice,
  stripeConnected,
}: {
  invoice: Invoice;
  stripeConnected: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStripeCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!stripeConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Stripe is not configured. The merchant needs to add their Stripe API keys.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground">
        You will be redirected to Stripe's secure checkout to complete your payment with a credit or debit card.
      </div>
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 text-sm p-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      <Button
        className="w-full"
        size="lg"
        disabled={loading}
        onClick={handleStripeCheckout}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting to Stripe…</>
        ) : (
          <><CreditCard className="w-4 h-4 mr-2" /> Pay {invoice.amount.toLocaleString()} {invoice.currency} with Card</>
        )}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        🔒 Secured by Stripe — PCI DSS compliant
      </p>
    </div>
  );
}

// ─── PayPal tab ───────────────────────────────────────────────────────────────

function PayPalTab({
  invoice,
  paypalConnected,
  onSuccess,
}: {
  invoice: Invoice;
  paypalConnected: boolean;
  onSuccess: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (!paypalConnected || !clientId) {
      setLoading(false);
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;

    loadScript({
      clientId,
      currency: (invoice.currency ?? 'USD').toUpperCase(),
      intent: 'capture',
    })
      .then((paypal) => {
        if (cancelled || !paypal || !containerRef.current) return;
        setLoading(false);

        paypal.Buttons!({
          style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
          createOrder: async () => {
            const res = await fetch('/api/public/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoiceId: invoice.id }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error ?? 'Failed to create order');
            return d.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            const res = await fetch(`/api/public/paypal/capture-order/${data.orderID}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            const d = await res.json();
            if (!res.ok || d.status !== 'COMPLETED') {
              setError('Payment capture failed. Please try again.');
              return;
            }
            onSuccess();
          },
          onError: (err: any) => {
            console.error('[PayPal]', err);
            setError('PayPal encountered an error. Please try a different payment method.');
          },
          onCancel: () => {
            setError(null); // Clear errors if user just cancelled
          },
        }).render(containerRef.current!);
      })
      .catch((err) => {
        if (!cancelled) {
          setError('Failed to load PayPal. Please refresh and try again.');
          setLoading(false);
          console.error('[PayPal loadScript]', err);
        }
      });

    return () => { cancelled = true; };
  }, [invoice.id, invoice.currency, clientId, paypalConnected, onSuccess]);

  if (!paypalConnected || !clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          PayPal is not configured. The merchant needs to add their PayPal credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 text-sm p-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading PayPal…
        </div>
      )}
      <div ref={containerRef} id="paypal-button-container" className={loading ? 'hidden' : ''} />
    </div>
  );
}

// ─── PromptPay tab ────────────────────────────────────────────────────────────

function PromptPayTab({
  invoice,
  onSuccess,
}: {
  invoice: Invoice;
  onSuccess: () => void;
}) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const promptPayId =
    typeof window !== 'undefined'
      ? localStorage.getItem('defaultPromptPayId') ?? ''
      : '';

  // Generate QR when ID or amount changes
  useEffect(() => {
    if (!promptPayId) return;
    const payload = generatePayload(promptPayId, {
      amount: invoice.amount > 0 ? invoice.amount : undefined,
    });
    QRCode.toDataURL(payload, {
      width: 200,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrSrc)
      .catch(console.error);
  }, [promptPayId, invoice.amount]);

  // Auto-poll payment status every 3s once QR is visible.
  // Stops when PAID is detected, after 5 min (100 attempts), or on unmount.
  useEffect(() => {
    if (!qrSrc || invoice.status === 'PAID') return;

    setPolling(true);
    const interval = setInterval(async () => {
      setPollCount((n) => n + 1);
      try {
        const res = await fetch(`/api/public/payment-status/${invoice.id}`);
        const { status } = await res.json();
        if (status === 'PAID') {
          clearInterval(interval);
          setPolling(false);
          onSuccess();
        }
      } catch { /* network hiccup — keep polling */ }
    }, 3_000);

    // Stop after 100 attempts (~5 min) to avoid polling forever
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 300_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setPolling(false);
    };
  }, [qrSrc, invoice.id, invoice.status, onSuccess]);

  return (
    <div className="space-y-5 flex flex-col items-center text-center">
      <div>
        <h4 className="font-medium text-sm">Scan with Thai Banking App</h4>
        <p className="text-xs text-muted-foreground mt-1">KBank, SCB, BBL, Krungsri, etc.</p>
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-[#113566]/20 relative">
        <div className="w-[196px] h-[196px] bg-[#113566]/5 flex items-center justify-center rounded-lg">
          {qrSrc ? (
            <img src={qrSrc} alt="PromptPay QR" className="w-full h-full object-contain rounded" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <QrCode className="w-10 h-10 opacity-30" />
              <span className="text-xs">{promptPayId ? 'Generating QR…' : 'PromptPay ID not set'}</span>
            </div>
          )}
        </div>
        {/* Live polling indicator */}
        {polling && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-white border rounded-full px-2 py-0.5 shadow-sm text-[10px] font-medium text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Waiting for payment
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Amount:{' '}
        <span className="font-semibold text-foreground">
          ฿{invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </p>

      <p className="text-[11px] text-muted-foreground">
        {polling
          ? 'Page will update automatically once payment is detected.'
          : 'Scan the QR above, then confirm below.'}
      </p>

      {/* Manual fallback — in case webhook fires but polling misses it */}
      <Button
        className="w-full"
        variant="ghost"
        size="sm"
        onClick={onSuccess}
      >
        I've already paid — confirm manually
      </Button>
    </div>
  );
}

// ─── Crypto tab ───────────────────────────────────────────────────────────────

function CryptoTab({
  invoice,
  onSuccess,
}: {
  invoice: Invoice;
  onSuccess: () => void;
}) {
  const [wallets, setWallets] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [activeCoin, setActiveCoin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch merchant wallets from server using the invoice ID
  useEffect(() => {
    fetch(`/api/public/crypto/wallets/${invoice.id}`)
      .then(r => r.json())
      .then(d => {
        const filled: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.wallets ?? {})) {
          if (typeof v === 'string' && v.trim()) filled[k] = v.trim();
        }
        setWallets(filled);
        const first = CRYPTO_COINS.find(c => filled[c.key]);
        if (first) setActiveCoin(first.key);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [invoice.id]);

  // Fetch live USD rates for BTC and ETH from CoinGecko (free, no key required)
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,tether&vs_currencies=usd')
      .then(r => r.json())
      .then(d => {
        setRates({
          btc: d.bitcoin?.usd ?? 0,
          eth: d.ethereum?.usd ?? 0,
          bnb_bsc: d.binancecoin?.usd ?? 0,
          usdt_trc20: d.tether?.usd ?? 1,
          usdt_erc20: d.tether?.usd ?? 1,
        });
      })
      .catch(() => {});
  }, []);

  // Build QR code data URLs whenever wallets or active coin changes
  useEffect(() => {
    const coin = CRYPTO_COINS.find(c => c.key === activeCoin);
    if (!coin || !wallets[coin.key]) return;
    const qrData = `${coin.qrPrefix}${wallets[coin.key]}`;
    QRCode.toDataURL(qrData, { width: 200, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => setQrCodes(prev => ({ ...prev, [coin.key]: url })))
      .catch(() => {});
  }, [activeCoin, wallets]);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cryptoAmount = (coinKey: string): string => {
    const rate = rates[coinKey];
    if (!rate || !invoice.amount) return '—';
    const amount = invoice.amount / rate;
    if (coinKey === 'btc') return amount.toFixed(6);
    if (coinKey === 'eth') return amount.toFixed(4);
    return amount.toFixed(2);
  };

  const activeCoinInfo = CRYPTO_COINS.find(c => c.key === activeCoin);
  const activeAddress = activeCoin ? wallets[activeCoin] : '';
  const activeQr = activeCoin ? qrCodes[activeCoin] : '';

  const availableCoins = CRYPTO_COINS.filter(c => wallets[c.key]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading wallets…
      </div>
    );
  }

  if (availableCoins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
        <Bitcoin className="w-8 h-8 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">
          Merchant has not configured any crypto wallet addresses yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Coin selector */}
      <div className="flex flex-wrap gap-2">
        {availableCoins.map(coin => (
          <button
            key={coin.key}
            onClick={() => setActiveCoin(coin.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeCoin === coin.key
                ? `${coin.border} ${coin.bg} ${coin.color}`
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {coin.label}
          </button>
        ))}
      </div>

      {activeCoinInfo && activeAddress && (
        <div className="flex flex-col items-center gap-4">
          {/* Amount in crypto */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Send exactly</p>
            <p className={`text-xl font-bold ${activeCoinInfo.color}`}>
              {cryptoAmount(activeCoin!)} {activeCoinInfo.symbol}
            </p>
            <p className="text-xs text-muted-foreground">
              ≈ {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {invoice.currency}
            </p>
          </div>

          {/* QR code */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            {activeQr ? (
              <img src={activeQr} alt={`${activeCoinInfo.label} QR`} className="w-[180px] h-[180px] rounded" />
            ) : (
              <div className="w-[180px] h-[180px] flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>

          {/* Address + copy */}
          <div className="w-full bg-slate-50 rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {activeCoinInfo.network} address
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono text-slate-700 break-all flex-1">{activeAddress}</p>
              <button
                onClick={() => handleCopy(activeAddress)}
                className={`shrink-0 p-2 rounded-lg transition-colors ${
                  copied
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title="Copy address"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center max-w-[260px]">
            Send the exact amount to this address. Notify the merchant after sending.
          </p>

          <Button variant="ghost" size="sm" className="w-full" onClick={onSuccess}>
            I've sent the payment — confirm manually
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PaymentPage() {
  const reduced = useReducedMotion();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);

  // ── Load invoice ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    fetchInvoice(id).then((inv) => {
      if (!active) return;
      setInvoice(inv);
      if (inv?.status === 'PAID') setPaymentSuccess(true);
      setLoading(false);
    });

    return () => { active = false; };
  }, [id]);

  // ── Handle Stripe redirect-back ─────────────────────────────────────────────
  // After Stripe checkout, the URL has ?stripe=success. Poll until DB reflects PAID.
  useEffect(() => {
    if (searchParams.get('stripe') !== 'success' || !id) return;

    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const inv = await fetchInvoice(id);
      if (inv?.status === 'PAID') {
        setInvoice(inv);
        setPaymentSuccess(true);
        clearInterval(poll);
      }
      if (attempts >= 10) clearInterval(poll); // Stop after ~10s
    }, 1000);

    return () => clearInterval(poll);
  }, [searchParams, id]);

  // ── Fetch gateway status ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gateways/status')
      .then((r) => r.json())
      .then(setGatewayStatus)
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Invoice not found.
      </div>
    );
  }

  const handleSuccess = () => {
    setInvoice({ ...invoice, status: 'PAID' });
    setPaymentSuccess(true);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-3xl flex flex-col lg:flex-row gap-8">

        {/* Left — Invoice summary */}
        <div className="w-full lg:w-1/2 flex flex-col space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">FinTrust Payment</h1>
            <p className="text-sm text-muted-foreground mt-1">Invoice from merchant</p>
          </div>

          <div>
            <span className="text-sm text-muted-foreground">Amount due</span>
            <div className="text-5xl font-extrabold tracking-tighter mt-1">
              {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-2xl text-muted-foreground ml-2">{invoice.currency}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Invoice details</p>
            <div className="space-y-2 text-sm">
              {[
                ['Invoice', invoice.invoiceNumber],
                ['Billed to', invoice.customerName],
                ['Email', invoice.customerEmail],
                ['Due', new Date(invoice.dueDate).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[180px] truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-3">Line items</p>
            {invoice.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.quantity} × {item.description}</span>
                <span>{(item.quantity * item.price).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Payment form */}
        <div className="w-full lg:w-1/2">
          <AnimatePresence mode="wait">
            {paymentSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduced ? 0.15 : 0.3 }}
              >
                <Card className="text-center border-emerald-100 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <CardContent className="pt-10 pb-8 flex flex-col items-center">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Payment Successful</h2>
                    <p className="text-muted-foreground mb-6 text-sm">
                      {invoice.customerEmail ? `A receipt will be sent to ${invoice.customerEmail}` : 'Thank you for your payment.'}
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => window.print()}>
                      Download Receipt
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : searchParams.get('stripe') === 'success' ? (
              // Stripe returned success but webhook not yet fired — show polling state
              <motion.div
                key="stripe-processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Card>
                  <CardContent className="pt-10 pb-8 flex flex-col items-center text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                    <h2 className="text-lg font-semibold mb-2">Confirming payment…</h2>
                    <p className="text-sm text-muted-foreground">
                      Your payment was received. Waiting for confirmation from Stripe.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: reduced ? 0 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reduced ? 0.15 : 0.3 }}
              >
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Select Payment Method</CardTitle>
                    <CardDescription>Secure, encrypted payment.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="card" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 mb-6">
                        <TabsTrigger value="card" className="gap-1 text-xs">
                          <CreditCard className="w-3.5 h-3.5" /> Card
                        </TabsTrigger>
                        <TabsTrigger value="paypal" className="gap-1 text-xs">
                          <Wallet className="w-3.5 h-3.5" /> PayPal
                        </TabsTrigger>
                        <TabsTrigger value="promptpay" className="gap-1 text-xs">
                          <QrCode className="w-3.5 h-3.5" /> PromptPay
                        </TabsTrigger>
                        <TabsTrigger value="crypto" className="gap-1 text-xs">
                          <Bitcoin className="w-3.5 h-3.5" /> Crypto
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="card">
                        <StripeTab
                          invoice={invoice}
                          stripeConnected={gatewayStatus?.stripe.connected ?? false}
                        />
                      </TabsContent>

                      <TabsContent value="paypal">
                        <PayPalTab
                          invoice={invoice}
                          paypalConnected={gatewayStatus?.paypal.connected ?? false}
                          onSuccess={handleSuccess}
                        />
                      </TabsContent>

                      <TabsContent value="promptpay">
                        <PromptPayTab
                          invoice={invoice}
                          onSuccess={handleSuccess}
                        />
                      </TabsContent>

                      <TabsContent value="crypto">
                        <CryptoTab
                          invoice={invoice}
                          onSuccess={handleSuccess}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                  <CardFooter className="justify-center text-xs text-muted-foreground border-t pt-4">
                    🔒 Payments secured by Stripe & PayPal infrastructure
                  </CardFooter>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
