import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "crypto";

// --- EVENT BUS & SSE ---
export interface ActivityLog {
  id: string;
  type: 'api_request' | 'payment_confirmation' | 'webhook' | 'system';
  message: string;
  metadata?: any;
  timestamp: string;
}

const db = {
  invoices: [
    {
      id: 'inv_1001',
      invoiceNumber: 'INV-2026-0001',
      amount: 1540.00,
      currency: 'USD',
      status: 'UNPAID',
      customerName: 'Acme Corp',
      customerEmail: 'billing@acme.com',
      dueDate: '2026-06-15T00:00:00.000Z',
      createdAt: '2026-05-29T10:00:00.000Z',
      items: [
        { description: 'SaaS Platform Setup', quantity: 1, price: 1000 },
        { description: 'Premium Support (Q2)', quantity: 3, price: 180 }
      ]
    },
    {
      id: 'inv_1002',
      invoiceNumber: 'INV-2026-0002',
      amount: 7500.00,
      currency: 'THB',
      status: 'PAID',
      customerName: 'Sabai Digital',
      customerEmail: 'hello@sabaidigital.th',
      dueDate: '2026-05-28T00:00:00.000Z',
      createdAt: '2026-05-21T10:00:00.000Z',
      items: [
        { description: 'SEO Optimization', quantity: 1, price: 7500 }
      ]
    },
    {
      id: 'inv_1003',
      invoiceNumber: 'INV-2026-0003',
      amount: 320.00,
      currency: 'USD',
      status: 'UNPAID',
      customerName: 'Global Corp',
      customerEmail: 'accounts@global.corp',
      dueDate: '2026-05-10T00:00:00.000Z',
      expiresAt: '2026-05-15T00:00:00.000Z',
      createdAt: '2026-05-01T10:00:00.000Z',
      items: [
        { description: 'Server Maintenance', quantity: 2, price: 160 }
      ]
    }
  ],
  logs: [] as ActivityLog[]
};

let clients: express.Response[] = [];

function addLog(type: ActivityLog['type'], message: string, metadata?: any) {
  const log: ActivityLog = {
    id: randomUUID(),
    type,
    message,
    metadata,
    timestamp: new Date().toISOString()
  };
  
  db.logs.unshift(log);
  if (db.logs.length > 100) db.logs.pop(); // Keep only last 100 logs
  
  // Broadcast to SSE clients
  clients.forEach(client => client.write(`data: ${JSON.stringify(log)}\n\n`));
}

// Add some initial logs
addLog('system', 'System started');
addLog('webhook', 'Webhook endpoint ready', { status: 'success' });
addLog('webhook', 'Webhook failed: Invoice INV-2026-0001', { status: 'failed', eventId: 'evt_987654321', invoiceId: 'inv_1001' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- LOGGING MIDDLEWARE ---
  app.use((req, res, next) => {
    if (req.method !== 'GET' && !req.path.startsWith('/api/logs')) {
      addLog('api_request', `${req.method} ${req.path}`, { body: req.body });
    }
    next();
  });

  // --- API ROUTES ---

  // SSE endpoint for live feed
  app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial history
    res.write(`data: ${JSON.stringify({ type: 'history', logs: db.logs })}\n\n`);

    clients.push(res);

    req.on('close', () => {
      clients = clients.filter(client => client !== res);
    });
  });

  // Get all logs (fallback)
  app.get("/api/logs", (req, res) => {
    res.json({ data: db.logs });
  });

  // Retry webhook endpoint
  app.post("/api/webhooks/retry/:eventId", (req, res) => {
    const { eventId } = req.params;
    addLog('system', `Manual retry initiated for webhook ${eventId}`);
    
    // Simulate successful processing
    setTimeout(() => {
      addLog('webhook', `Webhook retried successfully for ${eventId}`, { status: 'success', eventId });
    }, 1500);

    res.json({ message: "Retry initiated", eventId });
  });

  // Get all invoices
  app.get("/api/invoices", (req, res) => {
    res.json({ data: db.invoices });
  });

  // Get single invoice
  app.get("/api/invoices/:id", (req, res) => {
    const inv = db.invoices.find(i => i.id === req.params.id || i.invoiceNumber === req.params.id);
    if (inv) {
      res.json({ data: inv });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Create invoice
  app.post("/api/invoices", (req, res) => {
    const nextId = db.invoices.length + 1;
    const newInvoice = {
      id: `inv_100${nextId}`,
      invoiceNumber: `INV-2026-000${nextId}`,
      amount: req.body.amount || 0,
      currency: req.body.currency || 'USD',
      status: 'UNPAID' as const,
      customerName: req.body.customerName || 'Unknown',
      customerEmail: req.body.customerEmail || '',
      dueDate: req.body.dueDate || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      items: req.body.items || []
    };
    db.invoices.unshift(newInvoice);
    res.json({ data: newInvoice });
  });

  // Pay invoice (Mock Webhook / Action)
  app.post("/api/payments/:id/process", (req, res) => {
    const inv = db.invoices.find(i => i.id === req.params.id || i.invoiceNumber === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    
    // In a real app, this creates a Stripe/PayPal intent or returns crypto QR
    inv.status = 'PAID';
    
    addLog('payment_confirmation', `Payment received for ${inv.invoiceNumber}`, { 
      amount: inv.amount, 
      currency: inv.currency,
      invoiceId: inv.id,
      gateway: req.body.gateway || 'Unknown'
    });
    
    res.json({ data: inv, message: `Payment processed via ${req.body.gateway || 'Unknown'}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
