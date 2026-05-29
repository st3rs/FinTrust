import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Copy, Check, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const openApiSpec = `
# FinTrust API Specification (OpenAPI 3.1)

Welcome to the FinTrust API. Our API allows you to programmatically manage your invoices,
process payments, and subscribe to real-time events via webhooks.

---

## Base URL

All API requests should be made to:
\`https://api.fintrust.com/v1\`

## Authentication

All API requests require an API key to be passed in the \`Authorization\` header as a Bearer token.

\`\`\`bash
Authorization: Bearer sk_test_your_secret_key
\`\`\`

---

## Endpoints

### 1. Invoices

Manage your invoices, including creation, retrieval, and status updates.

#### \`POST /invoices\`

Creates a new invoice.

**Request Body (application/json)**
\`\`\`json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "items": [
    {
      "description": "Web Development",
      "quantity": 1,
      "price": 1500.00
    }
  ],
  "currency": "USD",
  "dueDate": "2026-06-15"
}
\`\`\`

**Response (201 Created)**
\`\`\`json
{
  "id": "INV-12345",
  "status": "UNPAID",
  "amount": 1500.00,
  "url": "https://fintrust.com/pay/INV-12345",
  "createdAt": "2026-05-29T10:00:00Z"
}
\`\`\`

#### \`GET /invoices/:id\`

Retrieves an existing invoice by its ID.

**Response (200 OK)**
\`\`\`json
{
  "id": "INV-12345",
  "status": "PAID",
  "customerName": "John Doe",
  "amount": 1500.00,
  "currency": "USD"
}
\`\`\`

---

### 2. Payments

Process payments and manage transaction histories.

#### \`POST /payments/charge\`

Processes a one-time charge for an invoice.

**Request Body (application/json)**
\`\`\`json
{
  "invoiceId": "INV-12345",
  "paymentMethodId": "pm_1Hh123...",
  "amount": 1500.00
}
\`\`\`

**Response (200 OK)**
\`\`\`json
{
  "transactionId": "txn_89ABCDEF",
  "status": "SUCCEEDED",
  "chargedAt": "2026-05-30T14:22:00Z"
}
\`\`\`

---

### 3. Webhooks

Subscribe to events on your account.

#### \`POST /webhooks\`

Registers a new webhook endpoint.

**Request Body (application/json)**
\`\`\`json
{
  "url": "https://your-domain.com/webhooks/fintrust",
  "events": [
    "invoice.created",
    "invoice.paid",
    "payment.failed"
  ]
}
\`\`\`

**Response (201 Created)**
\`\`\`json
{
  "webhookId": "wh_XYZ123",
  "secret": "whsec_super_secret_signing_key_keep_safe"
}
\`\`\`

## Error Formatting

All errors follow a standard JSON layout.

\`\`\`json
{
  "error": {
    "code": "insufficient_funds",
    "message": "The provided payment method has insufficient funds.",
    "param": "paymentMethodId"
  }
}
\`\`\`
`;

const ENDPOINTS = [
  { id: 'get_invoice', method: 'GET', path: '/invoices/INV-12345', label: 'Get Invoice' },
  { id: 'post_invoice', method: 'POST', path: '/invoices', label: 'Create Invoice' },
  { id: 'post_charge', method: 'POST', path: '/payments/charge', label: 'Charge Payment' },
  { id: 'post_webhook', method: 'POST', path: '/webhooks', label: 'Register Webhook' }
];

const ENDPOINT_BODIES: Record<string, string> = {
  'post_invoice': JSON.stringify({
    customerName: "Jane Smith",
    customerEmail: "jane@example.com",
    items: [{ description: "Consulting", quantity: 2, price: 500.00 }],
    currency: "USD",
    dueDate: "2026-06-20"
  }, null, 2),
  'post_charge': JSON.stringify({
    invoiceId: "INV-12345",
    paymentMethodId: "pm_card_visa",
    amount: 1500.00
  }, null, 2),
  'post_webhook': JSON.stringify({
    url: "https://my-app.com/webhook",
    events: ["invoice.paid"]
  }, null, 2),
};

const MOCK_RESPONSES: Record<string, any> = {
  'get_invoice': {
    status: 200,
    data: {
      id: "INV-12345",
      status: "PAID",
      customerName: "John Doe",
      amount: 1500.00,
      currency: "USD"
    }
  },
  'post_invoice': {
    status: 201,
    data: {
      id: "INV-99999",
      status: "UNPAID",
      amount: 1000.00,
      url: "https://fintrust.com/pay/INV-99999",
      createdAt: new Date().toISOString()
    }
  },
  'post_charge': {
    status: 200,
    data: {
      transactionId: "txn_MOCK_SUCCESS",
      status: "SUCCEEDED",
      chargedAt: new Date().toISOString()
    }
  },
  'post_webhook': {
    status: 201,
    data: {
      webhookId: "wh_MOCK12345",
      secret: "whsec_mock_secret_key"
    }
  }
};

export default function ApiDocs() {
  const [apiKey, setApiKey] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0].id);
  const [requestBody, setRequestBody] = useState(ENDPOINT_BODIES[ENDPOINTS[0].id] || '');
  const [response, setResponse] = useState<{ status: number; data: any; time: number } | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const handleEndpointChange = (id: string) => {
    setSelectedEndpoint(id);
    setRequestBody(ENDPOINT_BODIES[id] || '');
    setResponse(null);
  };

  const handleTestRequest = () => {
    if (!apiKey.trim()) {
      setResponse({
        status: 401,
        data: {
          error: {
            code: "unauthorized",
            message: "You must provide a valid API key in the Authorization header."
          }
        },
        time: 45
      });
      return;
    }

    setIsRequesting(true);
    setResponse(null);
    
    // Simulate network latency
    setTimeout(() => {
      // Very basic request body JSON validation for POST requests
      if (selectedEndpoint !== 'get_invoice') {
        try {
          JSON.parse(requestBody);
        } catch (e) {
          setResponse({
            status: 400,
            data: { error: { code: "invalid_json", message: "The request body is not valid JSON." } },
            time: 30
          });
          setIsRequesting(false);
          return;
        }
      }

      const mockRes = MOCK_RESPONSES[selectedEndpoint];
      setResponse({
        status: mockRes.status,
        data: mockRes.data,
        time: Math.floor(Math.random() * 200) + 150 // fake ms
      });
      setIsRequesting(false);
    }, 600);
  };

  const copyResponse = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const endpointDetails = ENDPOINTS.find(e => e.id === selectedEndpoint) || ENDPOINTS[0];

  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">API Documentation</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Explore our OpenAPI 3.1 specification for integrating FinTrust into your platform.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left side: Docs Markdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm shadow-slate-200/50 rounded-xl p-8 flex-1 w-full max-h-[800px] overflow-y-auto"
        >
          <div className="prose prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-50 prose-pre:text-slate-900 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:bg-slate-950 dark:prose-pre:border-slate-800 dark:prose-pre:text-slate-300">
            <ReactMarkdown>{openApiSpec}</ReactMarkdown>
          </div>
        </motion.div>

        {/* Right side: Interactive API Tester */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-full lg:w-[450px] xl:w-[500px] shrink-0 sticky top-8 flex flex-col gap-6"
        >
          <div className="bg-slate-900 dark:bg-black rounded-xl border border-slate-800 overflow-hidden shadow-xl shadow-slate-900/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
                <Terminal className="w-4 h-4" />
                Test API
              </div>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Secret API Key</Label>
                <Input 
                  id="apiKey" 
                  type="password" 
                  placeholder="sk_test_..." 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Endpoint</Label>
                <Select value={selectedEndpoint} onValueChange={handleEndpointChange}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 focus:ring-indigo-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {ENDPOINTS.map(ep => (
                      <SelectItem key={ep.id} value={ep.id} className="focus:bg-slate-800 focus:text-white">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ep.method === 'GET' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {ep.method}
                          </span>
                          {ep.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-md p-3 font-mono text-xs text-slate-300 break-all">
                <span className={endpointDetails.method === 'GET' ? 'text-indigo-400' : 'text-emerald-400 font-bold'}>{endpointDetails.method}</span> https://api.fintrust.com/v1{endpointDetails.path}
              </div>

              {endpointDetails.method !== 'GET' && (
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Request Body</Label>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y min-h-[120px]"
                    spellCheck={false}
                  />
                </div>
              )}

              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                onClick={handleTestRequest}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Sending Request...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Play className="w-4 h-4 fill-current" />
                    Send Request
                  </span>
                )}
              </Button>
            </div>

            <AnimatePresence>
              {response && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="border-t border-slate-800 bg-[#0c1017]"
                >
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50">
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className={response.status >= 200 && response.status < 300 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {response.status}
                      </span>
                      <span className="text-slate-500">{response.time}ms</span>
                    </div>
                    <button 
                      onClick={copyResponse}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Copy Response"
                    >
                      {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="p-4 max-h-[300px] overflow-y-auto">
                    <pre className="text-xs font-mono text-slate-300 m-0">
                      <code>{JSON.stringify(response.data, null, 2)}</code>
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="text-xs text-slate-500 dark:text-slate-500 text-center px-4">
            Test mode is active. Requests made from this tester simulate interactions and do not affect live data.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
