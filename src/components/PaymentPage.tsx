import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Invoice } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Wallet, QrCode, CheckCircle2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PaymentPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setInvoice(data.data);
          if (data.data.status === 'PAID') {
            setPaymentSuccess(true);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handlePay = (gateway: string) => {
    setProcessing(true);
    setTimeout(() => {
      fetch(`/api/payments/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway })
      })
      .then(res => res.json())
      .then(() => {
        setProcessing(false);
        setPaymentSuccess(true);
      });
    }, 1500); // simulate delay
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">Loading...</div>;
  }

  if (!invoice) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">Invoice not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-3xl flex flex-col lg:flex-row gap-8">
        
        {/* Left Side: Invoice Summary */}
        <div className="w-full lg:w-1/2 flex flex-col space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 placeholder:">BK Invoice Gateway</h1>
            <p className="text-sm text-gray-500 mt-1">Payment to the merchant</p>
          </div>
          
          <div className="flex flex-col">
            <span className="text-sm text-gray-500 mb-1">Amount due</span>
            <span className="text-5xl font-extrabold tracking-tighter">
              {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-2xl text-gray-400">{invoice.currency}</span>
            </span>
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-4">
              <CardTitle className="text-base text-gray-700 dark:text-gray-300">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invoice number</span>
                <span className="font-medium font-mono">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Billed to</span>
                <span className="font-medium text-right">{invoice.customerName}<br/><span className="text-gray-400">{invoice.customerEmail}</span></span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date due</span>
                <span className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <Separator />
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium mb-3">Line items</h3>
            {invoice.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>{item.quantity} x {item.description}</span>
                <span>{(item.quantity * item.price).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Payment Form */}
        <div className="w-full lg:w-1/2">
          <AnimatePresence mode="wait">
            {paymentSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex items-center justify-center"
              >
                <Card className="w-full text-center border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10 shadow-sm">
                  <CardContent className="pt-10 pb-8 flex flex-col items-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Payment Successful</h2>
                    <p className="text-gray-500 mb-6">A receipt has been sent to {invoice.customerEmail}</p>
                    <Button variant="outline" className="w-full" onClick={() => window.print()}>Download Receipt</Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="shadow-lg border-gray-200/50 dark:border-gray-800">
                  <CardHeader>
                    <CardTitle>Select Payment Method</CardTitle>
                    <CardDescription>Secure, encrypted payment powered by multi-gateway architecture.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="card" className="w-full">
                      <TabsList className="flex flex-col sm:grid sm:w-full sm:grid-cols-3 mb-6 h-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1">
                        <TabsTrigger value="card" className="flex items-center justify-center gap-2 w-full"><CreditCard className="w-4 h-4"/> Card</TabsTrigger>
                        <TabsTrigger value="crypto" className="flex items-center justify-center gap-2 w-full"><Wallet className="w-4 h-4"/> Crypto</TabsTrigger>
                        <TabsTrigger value="promptpay" className="flex items-center justify-center gap-2 w-full"><QrCode className="w-4 h-4"/> PromptPay</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="card" className="space-y-4">
                        <div className="space-y-2">
                          <Label>Card Information</Label>
                          <div className="relative">
                            <Input placeholder="1234 5678 1234 5678" className="pl-10 font-mono w-full" />
                            <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Expiry</Label>
                            <Input placeholder="MM/YY" className="font-mono w-full" />
                          </div>
                          <div className="space-y-2">
                            <Label>CVC</Label>
                            <Input placeholder="123" className="font-mono w-full" type="password" />
                          </div>
                        </div>
                        <div className="space-y-2 pt-2">
                          <Label>Cardholder Name</Label>
                          <Input placeholder="John Doe" className="w-full" />
                        </div>
                        <Button className="w-full mt-4" size="lg" disabled={processing} onClick={() => handlePay('stripe')}>
                          {processing ? 'Processing...' : `Pay ${invoice.amount.toLocaleString()} ${invoice.currency}`}
                        </Button>
                      </TabsContent>

                      <TabsContent value="crypto" className="space-y-6 flex flex-col items-center text-center">
                        <div>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Send USDT (TRC-20)</h4>
                          <p className="text-xs text-muted-foreground mt-1">Send exact amount to avoid delays</p>
                        </div>
                        
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                          {/* Placeholder QR */}
                          <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
                             <QrCode className="text-gray-400 w-12 h-12" />
                          </div>
                        </div>
                        
                        <div className="w-full space-y-2">
                          <Label className="text-left block text-xs">Wallet Address</Label>
                          <div className="flex gap-2">
                            <Input readOnly value="TY8z..." className="font-mono bg-muted text-center" />
                            <Button variant="outline" size="icon"><Copy className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        
                         <Button className="w-full mt-2" size="lg" variant="secondary" disabled={processing} onClick={() => handlePay('crypto')}>
                          {processing ? 'Verifying...' : `I have sent the payment`}
                        </Button>
                      </TabsContent>

                      <TabsContent value="promptpay" className="space-y-6 flex flex-col items-center text-center">
                        <div>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">Scan with Thai Banking App</h4>
                           <p className="text-xs text-muted-foreground mt-1">Supported by KBank, SCB, BBL, Krungsri, etc.</p>
                        </div>
                         <div className="bg-white p-4 rounded-xl shadow-sm border border-[#113566]">
                           {/* Placeholder PromptPay QR */}
                           <div className="w-48 h-48 bg-[#113566]/5 relative flex items-center justify-center rounded-lg border border-[#113566]/20">
                             <img src="https://upload.wikimedia.org/wikipedia/commons/e/e4/PromptPay-logo.png" className="absolute top-2 w-20 opacity-30" alt="PromptPay" />
                             <QrCode className="text-[#113566] w-24 h-24" />
                           </div>
                         </div>
                         <Button className="w-full mt-2" size="lg" variant="outline" disabled={processing} onClick={() => handlePay('promptpay')}>
                           {processing ? 'Confirming...' : `Simulate QR Scan`}
                         </Button>
                      </TabsContent>

                    </Tabs>
                  </CardContent>
                  <CardFooter className="flex flex-col items-center justify-center text-xs text-muted-foreground border-t pt-4">
                    <p className="flex items-center gap-1">🔒 Secured by BK Gateway Infrastructure</p>
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
