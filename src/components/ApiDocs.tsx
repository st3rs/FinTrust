import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Terminal, Copy, Check, Play, ChevronRight, Globe, Key,
  FileText, QrCode, Activity, AlertTriangle, BookOpen, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'th';
type HttpMethod = 'GET' | 'POST';

interface Field {
  name: string;
  type: string;
  required?: boolean;
  desc: { en: string; th: string };
  default?: string;
}

interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  title: { en: string; th: string };
  desc: { en: string; th: string };
  auth: boolean;
  requestFields?: Field[];
  responseFields: Field[];
  exampleRequest?: object;
  exampleResponse: object;
  statusCode: number;
}

interface Section {
  id: string;
  icon: React.ReactNode;
  label: { en: string; th: string };
  endpoints?: Endpoint[];
}

// ── Content Data ──────────────────────────────────────────────────────────────

const ENDPOINTS: Record<string, Endpoint> = {
  health: {
    id: 'health',
    method: 'GET',
    path: '/health',
    title: { en: 'Health Check', th: 'ตรวจสอบสถานะ Service' },
    desc: {
      en: 'Returns the service status and current server timestamp. No authentication required. Use this to verify the docgen service is reachable before making authenticated requests.',
      th: 'คืนสถานะของ service และเวลาปัจจุบันของเซิร์ฟเวอร์ ไม่ต้องใช้ API key เหมาะสำหรับตรวจสอบว่า docgen service ทำงานอยู่หรือไม่ก่อนส่ง request จริง'
    },
    auth: false,
    responseFields: [
      { name: 'status', type: 'string', desc: { en: 'Always "ok" when healthy', th: 'จะเป็น "ok" เสมอเมื่อ service ปกติ' } },
      { name: 'ts', type: 'string (ISO 8601)', desc: { en: 'Current server UTC timestamp', th: 'เวลาปัจจุบันของเซิร์ฟเวอร์ (UTC, รูปแบบ ISO 8601)' } },
    ],
    exampleResponse: { status: 'ok', ts: '2026-06-18T10:00:00.000Z' },
    statusCode: 200,
  },

  render: {
    id: 'render',
    method: 'POST',
    path: '/v1/render',
    title: { en: 'Render Document', th: 'Render เอกสาร PDF' },
    desc: {
      en: 'Renders an invoice or custom template to PDF using Gotenberg. The generated PDF is stored permanently in Supabase Storage. Returns a signed download URL (valid for 1 hour) and a SHA-256 hash for integrity verification. Always call GET /v1/documents/:id to get a fresh URL before sharing with clients.',
      th: 'Render invoice หรือ template ที่กำหนดเองเป็นไฟล์ PDF ผ่าน Gotenberg PDF ที่ได้จะถูกเก็บถาวรใน Supabase Storage คืน signed URL สำหรับดาวน์โหลด (ใช้ได้ 1 ชั่วโมง) และ SHA-256 hash สำหรับยืนยันความถูกต้อง ควรเรียก GET /v1/documents/:id เพื่อรับ URL ใหม่ก่อนส่งให้ลูกค้าเสมอ'
    },
    auth: true,
    requestFields: [
      { name: 'templateId', type: 'string', required: true, desc: { en: 'Built-in template ID ("invoice-default") or your custom template UUID from the database', th: 'ID ของ template — ใช้ "invoice-default" สำหรับใบแจ้งหนี้ไทยมาตรฐาน หรือ UUID ของ template ที่สร้างเองในฐานข้อมูล' } },
      { name: 'data', type: 'object', required: true, desc: { en: 'Template variable values. For invoice-default, see the InvoiceTemplateData shape below.', th: 'ค่าตัวแปรสำหรับ template ถ้าใช้ invoice-default ดู shape InvoiceTemplateData ด้านล่าง' } },
      { name: 'format', type: '"pdf" | "html"', required: false, default: '"pdf"', desc: { en: 'Output format. Use "html" for preview/debugging without storing a file.', th: 'รูปแบบ output ใช้ "html" สำหรับ preview/debug โดยไม่บันทึกไฟล์' } },
      { name: 'options.landscape', type: 'boolean', required: false, default: 'false', desc: { en: 'Print in landscape orientation', th: 'พิมพ์แนวนอน' } },
      { name: 'options.paperSize', type: '"A4" | "Letter"', required: false, default: '"A4"', desc: { en: 'Paper size', th: 'ขนาดกระดาษ (A4 เป็น default สำหรับไทย)' } },
      { name: 'options.marginTop / Bottom / Left / Right', type: 'string', required: false, default: '"15mm"', desc: { en: 'Page margins (e.g. "20mm", "1in")', th: 'ระยะขอบหน้ากระดาษ เช่น "20mm" หรือ "1in"' } },
      { name: 'options.scale', type: 'number (0.1–2)', required: false, default: '1', desc: { en: 'Zoom scale applied before rendering', th: 'ขนาด zoom ก่อน render (ปกติ 1)' } },
    ],
    responseFields: [
      { name: 'documentId', type: 'string (UUID)', desc: { en: 'Permanent document ID — use this to fetch a fresh signed URL later', th: 'UUID ถาวรของเอกสาร ใช้เรียก GET /v1/documents/:id เพื่อรับ URL ใหม่' } },
      { name: 'signedUrl', type: 'string (URL)', desc: { en: 'Temporary signed download URL — valid for 1 hour', th: 'Signed URL สำหรับดาวน์โหลด — หมดอายุใน 1 ชั่วโมง' } },
      { name: 'sha256', type: 'string (hex)', desc: { en: 'SHA-256 hash of the PDF bytes for integrity verification', th: 'SHA-256 hash ของไฟล์ PDF สำหรับตรวจสอบความถูกต้อง' } },
      { name: 'byteSize', type: 'number', desc: { en: 'File size in bytes', th: 'ขนาดไฟล์เป็น bytes' } },
      { name: 'expiresAt', type: 'string (ISO 8601)', desc: { en: 'When the signedUrl expires', th: 'เวลาหมดอายุของ signedUrl' } },
    ],
    exampleRequest: {
      templateId: 'invoice-default',
      data: {
        invoice: { number: 'INV-2026-0042', date: '2026-06-18', dueDate: '2026-07-18', currency: 'THB' },
        seller: { name: 'Panach Studio Co., Ltd.', taxId: '0105567012345', phone: '02-XXX-XXXX' },
        client: { name: 'ลูกค้า ABC จำกัด', email: 'billing@abc.co.th' },
        items: [{ description: 'Web Development', quantity: 1, unitPrice: 50000, total: 50000 }],
        subtotal: 50000,
        vatRate: 7,
        vatAmount: 3500,
        total: 53500,
        promptpayQr: '0812345678',
      },
      format: 'pdf',
    },
    exampleResponse: {
      documentId: 'e4c2a8f0-1234-5678-abcd-ef0123456789',
      signedUrl: 'https://xxx.supabase.co/storage/v1/object/sign/documents/...',
      sha256: 'a3f5c2b1d9e87f4a...',
      byteSize: 102400,
      expiresAt: '2026-06-18T11:00:00.000Z',
    },
    statusCode: 201,
  },

  documents: {
    id: 'documents',
    method: 'GET',
    path: '/v1/documents/:id',
    title: { en: 'Get Document', th: 'ดึงข้อมูลเอกสาร' },
    desc: {
      en: 'Fetches document metadata and mints a fresh signed download URL on demand. The URL is valid for 1 hour from the time of this call. Use this endpoint whenever you need to share a link with a client — never cache the original URL from POST /v1/render.',
      th: 'ดึง metadata ของเอกสารและสร้าง signed URL ใหม่แบบ on-demand URL ที่ได้จะใช้งานได้ 1 ชั่วโมงนับจากเวลาที่เรียก ควรใช้ endpoint นี้ทุกครั้งที่ต้องการแชร์ลิงก์ให้ลูกค้า อย่า cache URL จาก POST /v1/render'
    },
    auth: true,
    requestFields: [
      { name: ':id', type: 'string (UUID)', required: true, desc: { en: 'The documentId returned by POST /v1/render', th: 'documentId ที่ได้จาก POST /v1/render' } },
    ],
    responseFields: [
      { name: 'id', type: 'string (UUID)', desc: { en: 'Document ID', th: 'ID ของเอกสาร' } },
      { name: 'accountId', type: 'string (UUID)', desc: { en: 'Account that owns the document', th: 'Account เจ้าของเอกสาร' } },
      { name: 'templateId', type: 'string | null', desc: { en: 'Template used (null for built-in templates)', th: 'Template ที่ใช้ (null ถ้าเป็น built-in)' } },
      { name: 'invoiceId', type: 'string | null', desc: { en: 'Linked invoice ID if provided in render data', th: 'Invoice ที่เชื่อมโยง (ถ้ามี)' } },
      { name: 'sha256', type: 'string (hex)', desc: { en: 'SHA-256 hash of the stored PDF', th: 'SHA-256 hash ของ PDF ที่เก็บไว้' } },
      { name: 'byteSize', type: 'number', desc: { en: 'File size in bytes', th: 'ขนาดไฟล์เป็น bytes' } },
      { name: 'createdAt', type: 'string (ISO 8601)', desc: { en: 'When the document was first created', th: 'เวลาที่สร้างเอกสาร' } },
      { name: 'signedUrl', type: 'string (URL)', desc: { en: 'Fresh signed download URL (1 hour TTL)', th: 'Signed URL ใหม่ใช้ได้ 1 ชั่วโมง' } },
      { name: 'expiresAt', type: 'string (ISO 8601)', desc: { en: 'When the signedUrl expires', th: 'เวลาหมดอายุของ signedUrl' } },
    ],
    exampleResponse: {
      id: 'e4c2a8f0-1234-5678-abcd-ef0123456789',
      accountId: 'usr_abc123',
      templateId: null,
      invoiceId: 'inv_xyz456',
      sha256: 'a3f5c2b1d9e87f4a...',
      byteSize: 102400,
      createdAt: '2026-06-18T10:00:00.000Z',
      signedUrl: 'https://xxx.supabase.co/storage/v1/object/sign/documents/...',
      expiresAt: '2026-06-18T11:00:00.000Z',
    },
    statusCode: 200,
  },

  qr: {
    id: 'qr',
    method: 'POST',
    path: '/v1/qr/promptpay',
    title: { en: 'Generate PromptPay QR', th: 'สร้าง QR Code พร้อมเพย์' },
    desc: {
      en: 'Generates a PromptPay QR code compliant with the BOT / EMVCo QR Code Standard. Returns both the raw EMVCo payload string and a base64-encoded PNG data URL ready to embed in an <img> tag. No library installation required on the caller\'s side.',
      th: 'สร้าง QR Code พร้อมเพย์ตามมาตรฐาน BOT / EMVCo คืน payload string (EMVCo format) และรูป QR Code เป็น base64 PNG สามารถนำ qrDataUrl ไปใส่ใน <img src="..."> ได้เลย โดยไม่ต้องติดตั้ง library เพิ่ม'
    },
    auth: true,
    requestFields: [
      { name: 'promptpayId', type: 'string', required: true, desc: { en: 'PromptPay ID — 10 digits (mobile phone) or 13 digits (national ID)', th: 'หมายเลขพร้อมเพย์ — 10 หลัก (เบอร์โทรศัพท์) หรือ 13 หลัก (เลขบัตรประชาชน)' } },
      { name: 'amount', type: 'number', required: false, desc: { en: 'Payment amount in THB. Omit for open-amount (customer enters amount when scanning).', th: 'จำนวนเงิน (บาท) ถ้าไม่ระบุจะเป็น open-amount ให้ผู้โอนกรอกจำนวนเองเมื่อสแกน' } },
      { name: 'reference', type: 'string (max 25)', required: false, desc: { en: 'Optional reference string for your own tracking (not embedded in QR)', th: 'Reference สำหรับ tracking ของคุณ (ไม่ได้ฝังใน QR)' } },
      { name: 'width', type: 'number (100–1000)', required: false, default: '400', desc: { en: 'QR image width in pixels', th: 'ความกว้างของรูป QR Code (pixels)' } },
    ],
    responseFields: [
      { name: 'payload', type: 'string', desc: { en: 'Raw EMVCo QR payload string — can be rendered by any QR library', th: 'String ของ EMVCo QR payload สำหรับนำไป render ด้วย QR library อื่น' } },
      { name: 'qrDataUrl', type: 'string (data URL)', desc: { en: 'Base64-encoded PNG: use directly as <img src={qrDataUrl} />', th: 'รูป QR Code เป็น base64 PNG ใช้ได้ทันทีใน <img src={qrDataUrl} />' } },
      { name: 'promptpayId', type: 'string', desc: { en: 'Echo of the PromptPay ID used', th: 'ยืนยัน promptpayId ที่ใช้สร้าง QR' } },
      { name: 'amount', type: 'number (optional)', desc: { en: 'Echo of the amount, if provided', th: 'จำนวนเงินที่ระบุ (ถ้ามี)' } },
    ],
    exampleRequest: {
      promptpayId: '0812345678',
      amount: 1500.00,
      reference: 'INV-2026-0042',
      width: 400,
    },
    exampleResponse: {
      payload: '00020101021229370016A000000677010111011300668123456785303764540615005802TH6304ABCD',
      qrDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...',
      promptpayId: '0812345678',
      amount: 1500,
    },
    statusCode: 200,
  },
};

const SECTIONS: Section[] = [
  {
    id: 'overview',
    icon: <BookOpen className="w-4 h-4" />,
    label: { en: 'Overview', th: 'ภาพรวม' },
  },
  {
    id: 'auth',
    icon: <Key className="w-4 h-4" />,
    label: { en: 'Authentication', th: 'การยืนยันตัวตน' },
  },
  {
    id: 'health',
    icon: <Activity className="w-4 h-4" />,
    label: { en: 'Health Check', th: 'ตรวจสอบสถานะ' },
    endpoints: [ENDPOINTS.health],
  },
  {
    id: 'render',
    icon: <FileText className="w-4 h-4" />,
    label: { en: 'Render PDF', th: 'Render PDF' },
    endpoints: [ENDPOINTS.render],
  },
  {
    id: 'documents',
    icon: <FileText className="w-4 h-4" />,
    label: { en: 'Documents', th: 'เอกสาร' },
    endpoints: [ENDPOINTS.documents],
  },
  {
    id: 'qr',
    icon: <QrCode className="w-4 h-4" />,
    label: { en: 'PromptPay QR', th: 'QR พร้อมเพย์' },
    endpoints: [ENDPOINTS.qr],
  },
  {
    id: 'errors',
    icon: <AlertTriangle className="w-4 h-4" />,
    label: { en: 'Error Reference', th: 'ตาราง Error' },
  },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  POST: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const TESTER_ENDPOINTS = [
  { id: 'health', label: 'GET /health', method: 'GET' as HttpMethod, path: '/health', body: null },
  { id: 'render', label: 'POST /v1/render', method: 'POST' as HttpMethod, path: '/v1/render', body: ENDPOINTS.render.exampleRequest },
  { id: 'qr', label: 'POST /v1/qr/promptpay', method: 'POST' as HttpMethod, path: '/v1/qr/promptpay', body: ENDPOINTS.qr.exampleRequest },
];

const MOCK_RESPONSES: Record<string, { status: number; data: object }> = {
  health: { status: 200, data: ENDPOINTS.health.exampleResponse },
  render: { status: 201, data: ENDPOINTS.render.exampleResponse },
  qr: { status: 200, data: ENDPOINTS.qr.exampleResponse },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${METHOD_COLORS[method]}`}>
      {method}
    </span>
  );
}

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors p-1 ${size === 'xs' ? 'p-0.5' : 'p-1'}`}
      title="Copy"
    >
      {copied
        ? <Check className={size === 'xs' ? 'w-3 h-3 text-emerald-400' : 'w-3.5 h-3.5 text-emerald-400'} />
        : <Copy className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
    </button>
  );
}

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  return (
    <div className="relative group rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed m-0">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FieldTable({ fields, lang }: { fields: Field[]; lang: Lang }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-40">
              {lang === 'en' ? 'Field' : 'ฟิลด์'}
            </th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-36">
              {lang === 'en' ? 'Type' : 'ประเภท'}
            </th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
              {lang === 'en' ? 'Description' : 'คำอธิบาย'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {fields.map(f => (
            <tr key={f.name} className="bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 align-top">
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{f.name}</code>
                {f.required && <span className="ml-1.5 text-[9px] text-red-500 font-bold uppercase">required</span>}
              </td>
              <td className="px-4 py-3 align-top">
                <code className="text-xs font-mono text-slate-500 dark:text-slate-400">{f.type}</code>
                {f.default !== undefined && (
                  <div className="text-[10px] text-slate-400 mt-0.5">default: {f.default}</div>
                )}
              </td>
              <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {f.desc[lang]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointSection({ ep, lang }: { ep: Endpoint; lang: Lang }) {
  const curlExample = ep.exampleRequest
    ? `curl -X ${ep.method} https://your-docgen.com${ep.path} \\
  -H "Authorization: Bearer ft_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(ep.exampleRequest, null, 2)}'`
    : `curl https://your-docgen.com${ep.path}`;

  const jsExample = ep.exampleRequest
    ? `const res = await fetch('https://your-docgen.com${ep.path}', {
  method: '${ep.method}',
  headers: {
    'Authorization': 'Bearer ft_your_api_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(${JSON.stringify(ep.exampleRequest, null, 4)}),
});
const data = await res.json();`
    : `const res = await fetch('https://your-docgen.com${ep.path}', {
  headers: { 'Authorization': 'Bearer ft_your_api_key' },
});
const data = await res.json();`;

  const [tab, setTab] = useState<'curl' | 'js' | 'response'>('curl');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <MethodBadge method={ep.method} />
        <code className="text-base font-mono font-semibold text-slate-800 dark:text-slate-100">{ep.path}</code>
        {!ep.auth && (
          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300 dark:border-slate-700">
            {lang === 'en' ? 'No auth required' : 'ไม่ต้อง auth'}
          </Badge>
        )}
      </div>

      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{ep.desc[lang]}</p>

      {/* Request fields */}
      {ep.requestFields && ep.requestFields.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            {lang === 'en' ? 'Request Parameters' : 'พารามิเตอร์ Request'}
          </h4>
          <FieldTable fields={ep.requestFields} lang={lang} />
        </div>
      )}

      {/* Response fields */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          {lang === 'en' ? `Response (${ep.statusCode})` : `Response (${ep.statusCode})`}
        </h4>
        <FieldTable fields={ep.responseFields} lang={lang} />
      </div>

      {/* Code examples */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          {lang === 'en' ? 'Code Examples' : 'ตัวอย่างโค้ด'}
        </h4>
        <div className="flex gap-1 mb-2">
          {(['curl', 'js', 'response'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t
                  ? 'bg-slate-900 text-white dark:bg-slate-700'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t === 'curl' ? 'cURL' : t === 'js' ? 'JavaScript' : lang === 'en' ? 'Response' : 'Response ตัวอย่าง'}
            </button>
          ))}
        </div>
        {tab === 'curl' && <CodeBlock code={curlExample} lang="bash" />}
        {tab === 'js' && <CodeBlock code={jsExample} lang="javascript" />}
        {tab === 'response' && (
          <CodeBlock code={JSON.stringify(ep.exampleResponse, null, 2)} lang="json" />
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ApiDocs() {
  const reduced = useReducedMotion();
  const [lang, setLang] = useState<Lang>('th');
  const [activeSection, setActiveSection] = useState('overview');
  const [testerEndpoint, setTesterEndpoint] = useState(TESTER_ENDPOINTS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [requestBody, setRequestBody] = useState(
    JSON.stringify(TESTER_ENDPOINTS[0].body ?? {}, null, 2)
  );
  const [response, setResponse] = useState<{ status: number; data: object; ms: number } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const handleTesterEndpointChange = (id: string) => {
    setTesterEndpoint(id);
    const ep = TESTER_ENDPOINTS.find(e => e.id === id);
    setRequestBody(ep?.body ? JSON.stringify(ep.body, null, 2) : '');
    setResponse(null);
  };

  const handleSend = () => {
    const ep = TESTER_ENDPOINTS.find(e => e.id === testerEndpoint);
    if (!ep) return;

    if (ep.id !== 'health' && !apiKey.trim()) {
      setResponse({ status: 401, data: { error: 'Missing Authorization header' }, ms: 12 });
      return;
    }

    if (ep.method === 'POST' && requestBody) {
      try { JSON.parse(requestBody); } catch {
        setResponse({ status: 400, data: { error: 'Invalid request', details: 'Request body is not valid JSON' }, ms: 8 });
        return;
      }
    }

    setIsSending(true);
    setResponse(null);
    setTimeout(() => {
      const mock = MOCK_RESPONSES[testerEndpoint];
      setResponse({ status: mock.status, data: mock.data, ms: Math.floor(Math.random() * 120) + 60 });
      setIsSending(false);
    }, 650);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      const scrollY = container.scrollTop + 80;
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id];
        if (el && el.offsetTop <= scrollY) setActiveSection(s.id);
      }
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => container.removeEventListener('scroll', handler);
  }, []);

  const baseUrl = 'https://your-docgen.com';

  return (
    <div className="flex h-full min-h-0 max-w-[1600px] mx-auto w-full overflow-hidden">

      {/* ── Left Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 xl:w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">FinTrust API</span>
            <Badge variant="outline" className="text-[9px] ml-auto text-slate-500 border-slate-300">v1</Badge>
          </div>
          {/* Language toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
            <button
              onClick={() => setLang('th')}
              className={`flex-1 py-1.5 font-medium transition-colors flex items-center justify-center gap-1 ${
                lang === 'th'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3 h-3" /> ภาษาไทย
            </button>
            <button
              onClick={() => setLang('en')}
              className={`flex-1 py-1.5 font-medium transition-colors flex items-center justify-center gap-1 ${
                lang === 'en'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3 h-3" /> English
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeSection === s.id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span className={activeSection === s.id ? 'text-indigo-500' : 'text-slate-400'}>{s.icon}</span>
              {s.label[lang]}
              {activeSection === s.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-indigo-400" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {lang === 'en'
              ? 'Node/TypeScript only. Thai font (Sarabun) embedded. Strict mode, no any.'
              : 'Node/TypeScript เท่านั้น รองรับฟอนต์ภาษาไทย (Sarabun) TypeScript strict mode'}
          </p>
        </div>
      </aside>

      {/* ── Center: Doc Content ─────────────────────────────────────────────── */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto p-6 lg:p-8 xl:p-10 min-w-0"
      >
        <div className="max-w-3xl space-y-16">

          {/* Overview */}
          <section ref={el => { sectionRefs.current['overview'] = el; }}>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                {lang === 'en' ? 'FinTrust Docgen API' : 'FinTrust Docgen API'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                {lang === 'en'
                  ? 'Generate PDF invoices, retrieve documents, and create PromptPay QR codes via a REST API.'
                  : 'สร้างใบแจ้งหนี้ PDF, ดึงข้อมูลเอกสาร, และสร้าง QR Code พร้อมเพย์ผ่าน REST API'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: lang === 'en' ? 'Base URL' : 'Base URL', value: baseUrl, mono: true },
                { label: lang === 'en' ? 'Protocol' : 'Protocol', value: 'HTTPS / REST', mono: false },
                { label: lang === 'en' ? 'Response Format' : 'รูปแบบ Response', value: 'JSON', mono: false },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">{item.label}</div>
                  <div className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${item.mono ? 'font-mono' : ''}`}>{item.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              {lang === 'en'
                ? '⚠️ This service runs on a separate VPS Docker container — NOT on Vercel. Deploy via docker compose up -d at the repo root.'
                : '⚠️ Service นี้รันบน Docker Container แยกบน VPS — ไม่ได้อยู่บน Vercel เริ่มใช้งานด้วย docker compose up -d ที่ root ของ repo'}
            </div>
          </section>

          {/* Authentication */}
          <section ref={el => { sectionRefs.current['auth'] = el; }}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {lang === 'en' ? 'Authentication' : 'การยืนยันตัวตน (Authentication)'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              {lang === 'en'
                ? 'All authenticated endpoints require a Bearer token in the Authorization header. Two token types are accepted:'
                : 'ทุก endpoint ที่ต้องการ auth จะต้องส่ง Bearer token ใน Authorization header รองรับ 2 รูปแบบ:'}
            </p>

            <div className="space-y-4 mb-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0 text-xs">ft_ API Key</Badge>
                  <span className="text-xs text-slate-500">
                    {lang === 'en' ? 'Recommended for server-to-server' : 'แนะนำสำหรับ server-to-server'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  {lang === 'en'
                    ? 'API keys start with ft_ and are issued per account. They are stored as HMAC-SHA256 hashes — the raw key is only shown once at creation.'
                    : 'API key ขึ้นต้นด้วย ft_ ออกให้ต่อ account เก็บเป็น HMAC-SHA256 hash ในฐานข้อมูล — raw key จะแสดงครั้งเดียวตอนสร้างเท่านั้น'}
                </p>
                <CodeBlock code={`Authorization: Bearer ft_your_api_key_here`} lang="http" />
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">Supabase JWT</Badge>
                  <span className="text-xs text-slate-500">
                    {lang === 'en' ? 'For authenticated frontend users' : 'สำหรับ frontend ที่ login แล้ว'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  {lang === 'en'
                    ? 'Frontend callers can use the Supabase session access_token directly as the Bearer token.'
                    : 'Frontend สามารถใช้ session.access_token จาก Supabase Auth เป็น Bearer token ได้โดยตรง'}
                </p>
                <CodeBlock code={`Authorization: Bearer eyJhbGci...supabase_jwt`} lang="http" />
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 text-sm text-red-800 dark:text-red-300">
              {lang === 'en'
                ? '🔒 Never expose ft_ API keys in client-side code or public repositories. Rotate immediately if compromised.'
                : '🔒 อย่านำ ft_ API key ไปใส่ใน client-side code หรือ public repository หากรั่วไหลต้องสร้างใหม่ทันที'}
            </div>
          </section>

          {/* Health */}
          <section ref={el => { sectionRefs.current['health'] = el; }}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              {ENDPOINTS.health.title[lang]}
            </h2>
            <EndpointSection ep={ENDPOINTS.health} lang={lang} />
          </section>

          {/* Render */}
          <section ref={el => { sectionRefs.current['render'] = el; }}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              {ENDPOINTS.render.title[lang]}
            </h2>
            <EndpointSection ep={ENDPOINTS.render} lang={lang} />

            {/* Invoice template data shape */}
            <div className="mt-8">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {lang === 'en' ? 'invoice-default: Template Data Shape' : 'invoice-default: โครงสร้าง data ของ template'}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {lang === 'en'
                  ? 'The built-in invoice-default template expects the following data structure. All amounts in THB.'
                  : 'Template invoice-default รองรับโครงสร้าง data ดังนี้ จำนวนเงินหน่วยเป็น THB (บาท)'}
              </p>
              <CodeBlock lang="typescript" code={`interface InvoiceTemplateData {
  invoice: {
    number: string;       // ${lang === 'en' ? 'e.g. "INV-2026-0042"' : 'เช่น "INV-2026-0042"'}
    date: string;         // ${lang === 'en' ? 'ISO date "YYYY-MM-DD"' : 'วันที่ออก "YYYY-MM-DD"'}
    dueDate: string;      // ${lang === 'en' ? 'Due date "YYYY-MM-DD"' : 'วันครบกำหนด "YYYY-MM-DD"'}
    currency: string;     // ${lang === 'en' ? '"THB" recommended' : '"THB" (แนะนำ)'}
  };
  seller: {
    name: string;         // ${lang === 'en' ? 'Your business name' : 'ชื่อธุรกิจของคุณ'}
    address?: string;
    taxId?: string;       // ${lang === 'en' ? 'Thai tax ID (13 digits)' : 'เลขประจำตัวผู้เสียภาษี (13 หลัก)'}
    phone?: string;
    email?: string;
  };
  client: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  vatRate: number;        // ${lang === 'en' ? '7 for Thai VAT 7%' : '7 สำหรับ VAT 7% ของไทย'}
  vatAmount: number;
  whtRate?: number;       // ${lang === 'en' ? 'Withholding tax rate (optional)' : 'ภาษีหัก ณ ที่จ่าย (ถ้ามี)'}
  whtAmount?: number;
  total: number;
  promptpayQr?: string;   // ${lang === 'en' ? 'PromptPay ID to embed QR in PDF' : 'เบอร์พร้อมเพย์สำหรับแสดง QR ใน PDF'}
  notes?: string;
  paymentTerms?: string;
}`} />
            </div>
          </section>

          {/* Documents */}
          <section ref={el => { sectionRefs.current['documents'] = el; }}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              {ENDPOINTS.documents.title[lang]}
            </h2>
            <EndpointSection ep={ENDPOINTS.documents} lang={lang} />
          </section>

          {/* QR */}
          <section ref={el => { sectionRefs.current['qr'] = el; }}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              {ENDPOINTS.qr.title[lang]}
            </h2>
            <EndpointSection ep={ENDPOINTS.qr} lang={lang} />

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
              {lang === 'en'
                ? '💡 Embed in your website: once you receive qrDataUrl, use it directly as <img src={qrDataUrl} /> — no QR library needed on the frontend.'
                : '💡 นำไปใช้ในเว็บได้เลย: เมื่อได้ qrDataUrl แล้วใส่ใน <img src={qrDataUrl} /> ได้ทันที ไม่ต้องติดตั้ง QR library เพิ่มที่ฝั่ง frontend'}
            </div>
          </section>

          {/* Errors */}
          <section ref={el => { sectionRefs.current['errors'] = el; }}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {lang === 'en' ? 'Error Reference' : 'ตาราง Error'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {lang === 'en'
                ? 'All errors return a JSON body with an error field. Validation errors additionally include a details field.'
                : 'ทุก error จะคืน JSON body ที่มีฟิลด์ error หากเป็น validation error จะมี details เพิ่มเติม'}
            </p>

            <CodeBlock lang="json" code={`// ${lang === 'en' ? 'Generic error' : 'Error ทั่วไป'}
{ "error": "Template not found" }

// ${lang === 'en' ? 'Validation error (422)' : 'Validation error (422)'}
{
  "errors": [
    { "code": "invalid_type", "path": ["templateId"], "message": "Required" }
  ]
}

// ${lang === 'en' ? 'QR validation error (400)' : 'QR validation error (400)'}
{
  "error": "Invalid request",
  "details": {
    "fieldErrors": {
      "promptpayId": ["promptpayId must be 10 digits (phone) or 13 digits (national ID)"]
    }
  }
}`} />

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-24">
                      {lang === 'en' ? 'Status' : 'Status'}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      {lang === 'en' ? 'Meaning' : 'ความหมาย'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { code: '200', en: 'Success', th: 'สำเร็จ' },
                    { code: '201', en: 'Resource created (PDF rendered)', th: 'สร้าง resource สำเร็จ (PDF render แล้ว)' },
                    { code: '400', en: 'Bad request — invalid input', th: 'Request ไม่ถูกต้อง — ข้อมูลที่ส่งมาผิดรูปแบบ' },
                    { code: '401', en: 'Unauthorized — missing or invalid token', th: 'ไม่ได้รับอนุญาต — ไม่มี token หรือ token ไม่ถูกต้อง' },
                    { code: '404', en: 'Not found — template or document does not exist', th: 'ไม่พบ — template หรือ document ที่ระบุไม่มีในระบบ' },
                    { code: '422', en: 'Validation error — Zod schema mismatch', th: 'Validation error — ข้อมูลไม่ตรงตาม schema (Zod)' },
                    { code: '502', en: 'Upstream error — Gotenberg or Storage failed', th: 'Error จาก upstream — Gotenberg หรือ Supabase Storage ล้มเหลว' },
                  ].map(row => (
                    <tr key={row.code} className="bg-white dark:bg-slate-900/30">
                      <td className="px-4 py-3">
                        <code className={`text-xs font-mono font-bold ${
                          row.code.startsWith('2') ? 'text-emerald-600 dark:text-emerald-400' :
                          row.code.startsWith('4') ? 'text-amber-600 dark:text-amber-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>{row.code}</code>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{lang === 'en' ? row.en : row.th}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>

      {/* ── Right: API Tester ───────────────────────────────────────────────── */}
      <div className="hidden xl:flex w-[420px] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-950 overflow-y-auto">

        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-black/30">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">
            {lang === 'en' ? 'API Tester' : 'ทดสอบ API'}
          </span>
          <span className="ml-auto text-[10px] text-slate-600 font-mono">
            {lang === 'en' ? 'Simulated responses' : 'Mock response'}
          </span>
        </div>

        <div className="p-5 space-y-5 flex-1">

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              {lang === 'en' ? 'API Key' : 'API Key'}
            </Label>
            <Input
              type="password"
              placeholder="ft_your_api_key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-indigo-500 font-mono text-sm h-9"
            />
          </div>

          {/* Endpoint selector */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              Endpoint
            </Label>
            <div className="space-y-1">
              {TESTER_ENDPOINTS.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => handleTesterEndpointChange(ep.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    testerEndpoint === ep.id
                      ? 'bg-indigo-600/20 border border-indigo-600/40 text-indigo-300'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <MethodBadge method={ep.method} />
                  <code className="text-xs">{ep.path}</code>
                </button>
              ))}
            </div>
          </div>

          {/* Request body */}
          {TESTER_ENDPOINTS.find(e => e.id === testerEndpoint)?.method === 'POST' && (
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                {lang === 'en' ? 'Request Body' : 'Request Body (JSON)'}
              </Label>
              <textarea
                value={requestBody}
                onChange={e => setRequestBody(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y min-h-[160px] leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}

          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium h-10"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                {lang === 'en' ? 'Sending...' : 'กำลังส่ง...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 fill-current" />
                {lang === 'en' ? 'Send Request' : 'ส่ง Request'}
              </span>
            )}
          </Button>
        </div>

        {/* Response panel */}
        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, height: reduced ? 'auto' : 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: reduced ? 0.1 : 0.25 }}
              className="border-t border-slate-800 flex-shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className={`font-bold ${response.status < 300 ? 'text-emerald-400' : response.status < 500 ? 'text-amber-400' : 'text-red-400'}`}>
                    {response.status}
                  </span>
                  <span className="text-slate-500">{response.ms}ms</span>
                </div>
                <CopyButton text={JSON.stringify(response.data, null, 2)} />
              </div>
              <div className="p-4 max-h-72 overflow-y-auto bg-[#0c1017]">
                <pre className="text-[11px] font-mono text-slate-300 m-0 leading-relaxed">
                  <code>{JSON.stringify(response.data, null, 2)}</code>
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!response && (
          <div className="px-5 pb-5 text-[11px] text-slate-600 text-center">
            {lang === 'en'
              ? 'Responses are simulated — no real API calls made.'
              : 'Response ที่แสดงเป็นการจำลอง — ไม่ได้เรียก API จริง'}
          </div>
        )}
      </div>

    </div>
  );
}
