import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Invoice } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Wallet, QrCode, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { supabase } from '../lib/supabase';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { loadScript } from '@paypal/paypal-js';

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
  const [processing, setProcessing] = useState(false);

  // Load operator's PromptPay ID from their profile
  const promptPayId =
    typeof window !== 'undefined'
      ? localStorage.getItem('defaultPromptPayId') ?? ''
      : '';

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

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      await supabase.from('invoices').update({ status: 'PAID' }).eq('id', invoice.id);
    } catch { /* offline fallback */ }
    onSuccess();
  };

  return (
    <div className="space-y-5 flex flex-col items-center text-center">
      <div>
        <h4 className="font-medium text-sm">Scan with Thai Banking App</h4>
        <p className="text-xs text-muted-foreground mt-1">KBank, SCB, BBL, Krungsri, etc.</p>
      </div>
      <div className="bg-white p-3 rounded-xl shadow-sm border border-[#113566]/20">
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
      </div>
      <p className="text-xs text-muted-foreground">
        Amount: <span className="font-semibold text-foreground">
          ฿{invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </p>
      <Button
        className="w-full"
        variant="outline"
        size="lg"
        disabled={processing}
        onClick={handleConfirm}
      >
        {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming…</> : 'I have completed the transfer'}
      </Button>
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
                      <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="card" className="gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" /> Card
                        </TabsTrigger>
                        <TabsTrigger value="paypal" className="gap-1.5">
                          <Wallet className="w-3.5 h-3.5" /> PayPal
                        </TabsTrigger>
                        <TabsTrigger value="promptpay" className="gap-1.5">
                          <QrCode className="w-3.5 h-3.5" /> PromptPay
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
