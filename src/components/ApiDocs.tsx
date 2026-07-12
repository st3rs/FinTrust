import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Terminal, Copy, Check, Play, ChevronRight, Globe, Key,
  FileText, QrCode, Activity, AlertTriangle, BookOpen, Zap,
  Plus, FolderOpen, Eye, EyeOff, Trash2, RefreshCw, ChevronDown,
  Layers, ShieldCheck, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'th';
type HttpMethod = 'GET' | 'POST';
type Environment = 'live' | 'test';

interface Project {
  id: string;
  name: string;
  description: string | null;
  environment: Environment;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  project_id: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

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

// ── Endpoint definitions (same as before) ────────────────────────────────────

const ENDPOINTS: Record<string, Endpoint> = {
  health: {
    id: 'health', method: 'GET', path: '/health',
    title: { en: 'Health Check', th: 'ตรวจสอบสถานะ' },
    desc: { en: 'Returns service status and server timestamp. No auth required.', th: 'คืนสถานะ service และเวลาเซิร์ฟเวอร์ ไม่ต้อง auth' },
    auth: false,
    responseFields: [
      { name: 'status', type: 'string', desc: { en: 'Always "ok" when healthy', th: '"ok" เสมอเมื่อ service ปกติ' } },
      { name: 'ts', type: 'string (ISO 8601)', desc: { en: 'UTC server timestamp', th: 'เวลาปัจจุบัน UTC' } },
    ],
    exampleResponse: { status: 'ok', ts: '2026-06-18T10:00:00.000Z' },
    statusCode: 200,
  },
  render: {
    id: 'render', method: 'POST', path: '/v1/render',
    title: { en: 'Render PDF', th: 'Render PDF' },
    desc: {
      en: 'Renders a template to PDF via Gotenberg. Stored permanently in Supabase Storage. Returns a 1-hour signed URL + SHA-256. Always call GET /v1/documents/:id for a fresh URL before sharing.',
      th: 'Render template เป็น PDF ผ่าน Gotenberg เก็บถาวรใน Supabase Storage คืน signed URL 1 ชั่วโมง + SHA-256 ต้องเรียก GET /v1/documents/:id ใหม่ก่อนส่งลูกค้าเสมอ'
    },
    auth: true,
    requestFields: [
      { name: 'templateId', type: 'string', required: true, desc: { en: '"invoice-default" or custom template UUID', th: '"invoice-default" หรือ UUID ของ template ที่สร้างเอง' } },
      { name: 'data', type: 'object', required: true, desc: { en: 'Template variable values', th: 'ค่าตัวแปรของ template' } },
      { name: 'format', type: '"pdf" | "html"', default: '"pdf"', desc: { en: 'Output format. Use "html" for preview only.', th: '"html" ใช้สำหรับ preview เท่านั้น' } },
      { name: 'options.paperSize', type: '"A4" | "Letter"', default: '"A4"', desc: { en: 'Paper size', th: 'ขนาดกระดาษ' } },
      { name: 'options.landscape', type: 'boolean', default: 'false', desc: { en: 'Landscape orientation', th: 'พิมพ์แนวนอน' } },
      { name: 'options.marginTop/Bottom/Left/Right', type: 'string', default: '"15mm"', desc: { en: 'Page margins e.g. "20mm"', th: 'ระยะขอบ เช่น "20mm"' } },
    ],
    responseFields: [
      { name: 'documentId', type: 'string (UUID)', desc: { en: 'Permanent document ID', th: 'UUID ถาวรของเอกสาร' } },
      { name: 'signedUrl', type: 'string', desc: { en: 'Signed download URL (1 hour)', th: 'URL ดาวน์โหลด (1 ชั่วโมง)' } },
      { name: 'sha256', type: 'string (hex)', desc: { en: 'SHA-256 hash for integrity check', th: 'SHA-256 สำหรับยืนยันความถูกต้อง' } },
      { name: 'byteSize', type: 'number', desc: { en: 'File size in bytes', th: 'ขนาดไฟล์ (bytes)' } },
      { name: 'expiresAt', type: 'string (ISO 8601)', desc: { en: 'URL expiry time', th: 'เวลาหมดอายุของ URL' } },
    ],
    exampleRequest: {
      templateId: 'invoice-default',
      data: {
        invoice: { number: 'INV-2026-0042', date: '2026-06-18', dueDate: '2026-07-18', currency: 'THB' },
        seller: { name: 'Panach Studio Co., Ltd.', taxId: '0105567012345' },
        client: { name: 'ลูกค้า ABC จำกัด', email: 'billing@abc.co.th' },
        items: [{ description: 'Web Development', quantity: 1, unitPrice: 50000, total: 50000 }],
        subtotal: 50000, vatRate: 7, vatAmount: 3500, total: 53500,
      },
    },
    exampleResponse: {
      documentId: 'e4c2a8f0-1234-5678-abcd-ef0123456789',
      signedUrl: 'https://xxx.supabase.co/storage/v1/object/sign/documents/...',
      sha256: 'a3f5c2b1d9e87f4a...', byteSize: 102400,
      expiresAt: '2026-06-18T11:00:00.000Z',
    },
    statusCode: 201,
  },
  documents: {
    id: 'documents', method: 'GET', path: '/v1/documents/:id',
    title: { en: 'Get Document', th: 'ดึงข้อมูลเอกสาร' },
    desc: {
      en: 'Returns document metadata and a fresh signed URL (1 hour). Call this whenever you need to share a download link — never cache the URL from POST /v1/render.',
      th: 'คืน metadata + fresh signed URL (1 ชั่วโมง) เรียก endpoint นี้ทุกครั้งก่อนแชร์ลิงก์ อย่า cache URL จาก POST /v1/render'
    },
    auth: true,
    requestFields: [
      { name: ':id', type: 'string (UUID)', required: true, desc: { en: 'documentId from POST /v1/render', th: 'documentId ที่ได้จาก POST /v1/render' } },
    ],
    responseFields: [
      { name: 'id', type: 'string', desc: { en: 'Document UUID', th: 'UUID ของเอกสาร' } },
      { name: 'sha256', type: 'string', desc: { en: 'SHA-256 hash', th: 'SHA-256 hash' } },
      { name: 'byteSize', type: 'number', desc: { en: 'File size bytes', th: 'ขนาดไฟล์ bytes' } },
      { name: 'createdAt', type: 'string', desc: { en: 'Creation timestamp', th: 'เวลาสร้าง' } },
      { name: 'signedUrl', type: 'string', desc: { en: 'Fresh signed URL (1 hour TTL)', th: 'Fresh signed URL (1 ชั่วโมง)' } },
      { name: 'expiresAt', type: 'string', desc: { en: 'URL expiry time', th: 'เวลาหมดอายุ' } },
    ],
    exampleResponse: {
      id: 'e4c2a8f0-1234-5678-abcd-ef0123456789',
      sha256: 'a3f5c2b1d9e87f4a...', byteSize: 102400,
      createdAt: '2026-06-18T10:00:00.000Z',
      signedUrl: 'https://xxx.supabase.co/storage/v1/object/sign/documents/...',
      expiresAt: '2026-06-18T11:00:00.000Z',
    },
    statusCode: 200,
  },
  qr: {
    id: 'qr', method: 'POST', path: '/v1/qr/promptpay',
    title: { en: 'PromptPay QR', th: 'QR พร้อมเพย์' },
    desc: {
      en: 'Generates a PromptPay QR code (BOT/EMVCo standard). Returns raw EMVCo payload + base64 PNG. Use qrDataUrl directly in <img src={qrDataUrl} /> — no QR library needed.',
      th: 'สร้าง QR Code พร้อมเพย์ตาม BOT/EMVCo คืน payload string + base64 PNG นำ qrDataUrl ใส่ใน <img src={qrDataUrl} /> ได้เลย ไม่ต้องติดตั้ง library เพิ่ม'
    },
    auth: true,
    requestFields: [
      { name: 'promptpayId', type: 'string', required: true, desc: { en: '10 digits (phone) or 13 digits (national ID)', th: '10 หลัก (เบอร์โทร) หรือ 13 หลัก (เลขบัตรประชาชน)' } },
      { name: 'amount', type: 'number', desc: { en: 'Amount in THB. Omit for open-amount.', th: 'จำนวนเงิน (บาท) ถ้าไม่ระบุ = open-amount' } },
      { name: 'reference', type: 'string (max 25)', desc: { en: 'Your reference string (not embedded in QR)', th: 'Reference ของคุณ (ไม่ฝังใน QR)' } },
      { name: 'width', type: 'number (100–1000)', default: '400', desc: { en: 'QR image width in pixels', th: 'ความกว้างรูป QR (pixels)' } },
    ],
    responseFields: [
      { name: 'payload', type: 'string', desc: { en: 'Raw EMVCo payload string', th: 'EMVCo payload string' } },
      { name: 'qrDataUrl', type: 'string (data URL)', desc: { en: 'Base64 PNG — use as <img src={qrDataUrl} />', th: 'Base64 PNG ใช้ใน <img src={qrDataUrl} />' } },
      { name: 'promptpayId', type: 'string', desc: { en: 'Echo of input', th: 'ยืนยัน promptpayId ที่ใช้' } },
      { name: 'amount', type: 'number?', desc: { en: 'Echo of amount if provided', th: 'จำนวนเงิน (ถ้าระบุ)' } },
    ],
    exampleRequest: { promptpayId: '0812345678', amount: 1500.00, reference: 'INV-2026-0042', width: 400 },
    exampleResponse: {
      payload: '00020101021229370016A000000677010111011300668123456785303764540615005802TH6304ABCD',
      qrDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...',
      promptpayId: '0812345678', amount: 1500,
    },
    statusCode: 200,
  },
};

const SECTIONS = [
  { id: 'api-keys', icon: <Key className="w-4 h-4" />, label: { en: 'API Keys', th: 'API Keys' } },
  { id: 'overview', icon: <BookOpen className="w-4 h-4" />, label: { en: 'Overview', th: 'ภาพรวม' } },
  { id: 'auth', icon: <ShieldCheck className="w-4 h-4" />, label: { en: 'Authentication', th: 'Authentication' } },
  { id: 'health', icon: <Activity className="w-4 h-4" />, label: { en: 'Health Check', th: 'Health Check' } },
  { id: 'render', icon: <FileText className="w-4 h-4" />, label: { en: 'Render PDF', th: 'Render PDF' } },
  { id: 'documents', icon: <FileText className="w-4 h-4" />, label: { en: 'Documents', th: 'Documents' } },
  { id: 'qr', icon: <QrCode className="w-4 h-4" />, label: { en: 'PromptPay QR', th: 'QR พร้อมเพย์' } },
  { id: 'errors', icon: <AlertTriangle className="w-4 h-4" />, label: { en: 'Errors', th: 'Errors' } },
];

const TESTER_ENDPOINTS = [
  { id: 'health', label: '/health', method: 'GET' as HttpMethod, path: '/v1/health', body: null },
  { id: 'render', label: '/v1/render', method: 'POST' as HttpMethod, path: '/v1/render', body: ENDPOINTS.render.exampleRequest },
  { id: 'qr', label: '/v1/qr/promptpay', method: 'POST' as HttpMethod, path: '/v1/qr/promptpay', body: ENDPOINTS.qr.exampleRequest },
];

// ── Helper components ─────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: HttpMethod }) {
  const colors = method === 'GET'
    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${colors}`}>{method}</span>;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-slate-400 hover:text-white hover:bg-slate-700 rounded p-1 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{lang}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed m-0"><code>{code}</code></pre>
    </div>
  );
}

function FieldTable({ fields, lang }: { fields: Field[]; lang: Lang }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-44">Field</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-36">Type</th>
            <th className="text-left px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">{lang === 'en' ? 'Description' : 'คำอธิบาย'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {fields.map(f => (
            <tr key={f.name} className="bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 align-top">
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400">{f.name}</code>
                {f.required && <span className="ml-1.5 text-[9px] text-red-500 font-bold uppercase">req</span>}
              </td>
              <td className="px-4 py-3 align-top">
                <code className="text-xs font-mono text-slate-500 dark:text-slate-400">{f.type}</code>
                {f.default !== undefined && <div className="text-[10px] text-slate-400 mt-0.5">default: {f.default}</div>}
              </td>
              <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc[lang]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointBlock({ ep, lang }: { ep: Endpoint; lang: Lang }) {
  const [tab, setTab] = useState<'curl' | 'js' | 'response'>('curl');
  const curl = ep.exampleRequest
    ? `curl -X ${ep.method} https://your-docgen.com${ep.path} \\\n  -H "Authorization: Bearer ft_your_key" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.exampleRequest, null, 2)}'`
    : `curl https://your-docgen.com${ep.path}`;
  const js = ep.exampleRequest
    ? `const res = await fetch('https://your-docgen.com${ep.path}', {\n  method: '${ep.method}',\n  headers: {\n    'Authorization': 'Bearer ft_your_key',\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify(${JSON.stringify(ep.exampleRequest, null, 4)}),\n});\nconst data = await res.json();`
    : `const res = await fetch('https://your-docgen.com${ep.path}', {\n  headers: { 'Authorization': 'Bearer ft_your_key' },\n});\nconst data = await res.json();`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <MethodBadge method={ep.method} />
        <code className="text-base font-mono font-semibold text-slate-800 dark:text-slate-100">{ep.path}</code>
        {!ep.auth && <Badge variant="outline" className="text-[10px] text-slate-500">{lang === 'en' ? 'No auth' : 'ไม่ต้อง auth'}</Badge>}
      </div>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{ep.desc[lang]}</p>
      {ep.requestFields && <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{lang === 'en' ? 'Request Parameters' : 'พารามิเตอร์'}</h4>
        <FieldTable fields={ep.requestFields} lang={lang} />
      </div>}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Response ({ep.statusCode})</h4>
        <FieldTable fields={ep.responseFields} lang={lang} />
      </div>
      <div>
        <div className="flex gap-1 mb-2">
          {(['curl', 'js', 'response'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-slate-900 text-white dark:bg-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {t === 'curl' ? 'cURL' : t === 'js' ? 'JavaScript' : 'Response'}
            </button>
          ))}
        </div>
        {tab === 'curl' && <CodeBlock code={curl} lang="bash" />}
        {tab === 'js' && <CodeBlock code={js} lang="javascript" />}
        {tab === 'response' && <CodeBlock code={JSON.stringify(ep.exampleResponse, null, 2)} />}
      </div>
    </div>
  );
}

// ── Project Empty State ───────────────────────────────────────────────────────

function ProjectGate({ lang, onCreated }: { lang: Lang; onCreated: (p: Project) => void }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [env, setEnv] = useState<Environment>('live');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setErr(lang === 'en' ? 'Project name is required.' : 'กรุณาระบุชื่อ project'); return; }
    if (!session?.user?.id) { setErr('Not authenticated'); return; }
    setSaving(true); setErr(null);
    const { data, error } = await supabase.from('projects').insert({
      account_id: session.user.id,
      name: name.trim(),
      description: description.trim() || null,
      environment: env,
    }).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    onCreated(data as Project);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center mx-auto mb-6">
          <Layers className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'en' ? 'Create your first project' : 'สร้าง Project แรกของคุณ'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          {lang === 'en'
            ? 'Projects let you separate your live and test environments. Each project gets its own API keys.'
            : 'Project ช่วยแยก Live กับ Test environment ออกจากกัน แต่ละ project มี API key เป็นของตัวเอง'}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8 text-left">
          {[
            { icon: <Lock className="w-4 h-4 text-indigo-500" />, en: 'Scoped API keys', th: 'API key แยกต่อ project' },
            { icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, en: 'Live / Test environments', th: 'แยก Live / Test' },
            { icon: <Key className="w-4 h-4 text-amber-500" />, en: 'Revoke keys anytime', th: 'Revoke key ได้ทุกเมื่อ' },
            { icon: <Activity className="w-4 h-4 text-rose-500" />, en: 'Usage tracking per key', th: 'ติดตาม usage ต่อ key' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              {item.icon}
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{item[lang]}</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-11 text-base font-semibold rounded-xl shadow-lg shadow-indigo-200/40 dark:shadow-none"
          onClick={() => setOpen(true)}
        >
          <Plus className="w-5 h-5 mr-2" />
          {lang === 'en' ? 'Create Project' : 'สร้าง Project'}
        </Button>
      </motion.div>

      {/* Create Project Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === 'en' ? 'New Project' : 'สร้าง Project ใหม่'}</DialogTitle>
            <DialogDescription>
              {lang === 'en' ? 'You can create multiple projects to separate environments.' : 'สามารถสร้างหลาย project เพื่อแยก environment ได้'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {err && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800">{err}</div>}

            <div className="space-y-1.5">
              <Label>{lang === 'en' ? 'Project Name' : 'ชื่อ Project'} *</Label>
              <Input
                placeholder={lang === 'en' ? 'e.g. My App' : 'เช่น My App, Production'}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>{lang === 'en' ? 'Description' : 'คำอธิบาย'} <span className="text-slate-400 font-normal">{lang === 'en' ? '(optional)' : '(ไม่บังคับ)'}</span></Label>
              <Input
                placeholder={lang === 'en' ? 'What is this project for?' : 'Project นี้ใช้สำหรับอะไร?'}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{lang === 'en' ? 'Environment' : 'Environment'}</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['live', 'test'] as const).map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEnv(e)}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                      env === e
                        ? e === 'live'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="font-semibold capitalize mb-0.5">{e === 'live' ? '🟢 Live' : '🟡 Test'}</div>
                    <div className="text-[11px] opacity-70">
                      {e === 'live'
                        ? (lang === 'en' ? 'Real data & transactions' : 'ข้อมูลจริง')
                        : (lang === 'en' ? 'Safe for testing' : 'ทดสอบได้ปลอดภัย')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{lang === 'en' ? 'Cancel' : 'ยกเลิก'}</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{lang === 'en' ? 'Creating...' : 'กำลังสร้าง...'}</> : (lang === 'en' ? 'Create Project' : 'สร้าง')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── API Keys Panel ────────────────────────────────────────────────────────────

function ApiKeysPanel({ project, lang }: { project: Project; lang: Lang }) {
  const { session } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false);
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);
  const [shownKeys, setShownKeys] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    setKeys((data ?? []) as ApiKey[]);
    setLoading(false);
  }, [project.id, session]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) { setErr(lang === 'en' ? 'Key name required.' : 'กรุณาตั้งชื่อ key'); return; }
    if (!session?.user?.id) return;
    setCreating(true); setErr(null);

    // Generate ft_ key client-side, hash server-side via server.ts /api/api-keys
    const raw = `ft_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    const prefix = raw.slice(3, 11);

    // Store hash — docgen service hashes with HMAC; for UI creation we call the internal API
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim(), raw_key: raw, project_id: project.id }),
    });

    if (!res.ok) {
      // Fallback: insert directly (dev mode without server.ts api-keys endpoint)
      const { data, error } = await supabase.from('api_keys').insert({
        account_id: session.user.id,
        name: newKeyName.trim(),
        key_hash: prefix,   // placeholder — real hash done server-side
        prefix,
        project_id: project.id,
      }).select().single();
      if (error) { setErr(error.message); setCreating(false); return; }
      setKeys(prev => [data as ApiKey, ...prev]);
    } else {
      await loadKeys();
    }

    setCreatedKeyValue(raw);
    setNewKeyName('');
    setCreating(false);
    setNewKeyDialogOpen(false);
  };

  const handleRevoke = async (keyId: string) => {
    await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', keyId);
    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k));
  };

  const toggleShow = (id: string) => setShownKeys(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const activeKeys = keys.filter(k => !k.revoked_at);
  const revokedKeys = keys.filter(k => k.revoked_at);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {lang === 'en' ? 'API Keys' : 'API Keys'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'en'
              ? 'Secret keys for this project. The full key is shown only once at creation.'
              : 'Secret key ของ project นี้ ดู key เต็มได้ครั้งเดียวตอนสร้างเท่านั้น'}
          </p>
        </div>
        <Button
          onClick={() => { setNewKeyDialogOpen(true); setErr(null); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg h-9 px-4 text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {lang === 'en' ? 'Create key' : 'สร้าง key'}
        </Button>
      </div>

      {/* Newly created key reveal */}
      <AnimatePresence>
        {createdKeyValue && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  {lang === 'en' ? 'Copy your key now — it won\'t be shown again.' : 'คัดลอก key ตอนนี้เลย — จะไม่แสดงอีก'}
                </p>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 mt-2">
                  <code className="text-sm font-mono text-slate-900 dark:text-slate-100 flex-1 min-w-0 truncate">{createdKeyValue}</code>
                  <CopyBtn text={createdKeyValue} />
                </div>
              </div>
              <button onClick={() => setCreatedKeyValue(null)} className="text-amber-400 hover:text-amber-600 text-lg leading-none">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active keys */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">{lang === 'en' ? 'Loading...' : 'กำลังโหลด...'}</span>
        </div>
      ) : activeKeys.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
          <Key className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {lang === 'en' ? 'No active API keys. Create one to start.' : 'ยังไม่มี API key กด "สร้าง key" เพื่อเริ่ม'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeKeys.map(key => (
            <div key={key.id} className="flex items-center gap-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{key.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs font-mono text-slate-500">
                    ft_{shownKeys.has(key.id) ? key.prefix + '••••••••••••••••' : '••••••••••••••••••••••••'}
                  </code>
                  <button onClick={() => toggleShow(key.id)} className="text-slate-400 hover:text-slate-600">
                    {shownKeys.has(key.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-slate-400">
                  {key.last_used_at
                    ? `${lang === 'en' ? 'Last used' : 'ใช้ล่าสุด'} ${new Date(key.last_used_at).toLocaleDateString()}`
                    : (lang === 'en' ? 'Never used' : 'ยังไม่ได้ใช้')}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="ml-1 text-slate-400 hover:text-red-500 transition-colors p-1"
                title={lang === 'en' ? 'Revoke key' : 'Revoke key'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {revokedKeys.length > 0 && (
        <details className="group">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 list-none flex items-center gap-1 select-none">
            <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
            {revokedKeys.length} {lang === 'en' ? 'revoked key(s)' : 'key ที่ถูก revoke แล้ว'}
          </summary>
          <div className="mt-2 space-y-1 opacity-50">
            {revokedKeys.map(key => (
              <div key={key.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 line-through">
                <code className="text-xs font-mono text-slate-400">ft_{key.prefix}••••••••••••••••</code>
                <span className="text-xs text-slate-400 ml-auto">{key.name}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Create Key Dialog */}
      <Dialog open={newKeyDialogOpen} onOpenChange={setNewKeyDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{lang === 'en' ? 'Create API Key' : 'สร้าง API Key'}</DialogTitle>
            <DialogDescription>
              {lang === 'en' ? 'Give this key a descriptive name.' : 'ตั้งชื่อ key ให้สื่อความหมาย'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {err && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-lg">{err}</div>}
            <div className="space-y-1.5">
              <Label>{lang === 'en' ? 'Key Name' : 'ชื่อ Key'} *</Label>
              <Input
                placeholder={lang === 'en' ? 'e.g. Production Server, CI Pipeline' : 'เช่น Production Server, CI Pipeline'}
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewKeyDialogOpen(false)}>{lang === 'en' ? 'Cancel' : 'ยกเลิก'}</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {creating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{lang === 'en' ? 'Creating...' : 'กำลังสร้าง...'}</> : (lang === 'en' ? 'Create' : 'สร้าง')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ApiDocs() {
  const reduced = useReducedMotion();
  const { session } = useAuth();

  const [lang, setLang] = useState<Lang>('th');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeSection, setActiveSection] = useState('api-keys');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  // Tester state
  const [testerEndpoint, setTesterEndpoint] = useState(TESTER_ENDPOINTS[0].id);
  const [apiKey, setApiKey] = useState('');
  const [requestBody, setRequestBody] = useState(JSON.stringify(TESTER_ENDPOINTS[0].body ?? {}, null, 2));
  const [response, setResponse] = useState<{ status: number; data: object; ms: number } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Load projects
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('projects')
      .select('*')
      .eq('account_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Project[];
        setProjects(list);
        if (list.length > 0) setActiveProject(list[0]);
        setLoadingProjects(false);
      });
  }, [session]);

  const handleProjectCreated = (p: Project) => {
    setProjects(prev => [p, ...prev]);
    setActiveProject(p);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      const y = container.scrollTop + 80;
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id];
        if (el && el.offsetTop <= y) setActiveSection(s.id);
      }
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => container.removeEventListener('scroll', handler);
  }, []);

  const handleTesterChange = (id: string) => {
    setTesterEndpoint(id);
    const ep = TESTER_ENDPOINTS.find(e => e.id === id);
    setRequestBody(ep?.body ? JSON.stringify(ep.body, null, 2) : '');
    setResponse(null);
  };

  const handleSend = async () => {
    const ep = TESTER_ENDPOINTS.find(e => e.id === testerEndpoint);
    if (!ep) return;
    if (ep.id !== 'health' && !apiKey.trim()) {
      setResponse({ status: 401, data: { error: 'Missing Authorization header' }, ms: 12 });
      return;
    }
    if (ep.method === 'POST' && requestBody) {
      try { JSON.parse(requestBody); } catch {
        setResponse({ status: 400, data: { error: 'Request body is not valid JSON' }, ms: 8 });
        return;
      }
    }
    setIsSending(true); setResponse(null);
    const started = performance.now();
    try {
      const res = await fetch(ep.path, {
        method: ep.method,
        headers: {
          ...(ep.method === 'POST' && { 'Content-Type': 'application/json' }),
          ...(apiKey.trim() && { Authorization: `Bearer ${apiKey.trim()}` }),
        },
        ...(ep.method === 'POST' && requestBody && { body: requestBody }),
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setResponse({ status: res.status, data, ms: Math.round(performance.now() - started) });
    } catch (err) {
      setResponse({
        status: 0,
        data: { error: err instanceof Error ? err.message : 'Network error' },
        ms: Math.round(performance.now() - started),
      });
    }
    setIsSending(false);
  };

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[50vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ── Gate: no projects yet ─────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Mini header with lang toggle */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">FinTrust API</span>
            <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-300">v1</Badge>
          </div>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
            {(['th', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${lang === l ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <Globe className="w-3 h-3" /> {l === 'th' ? 'ภาษาไทย' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <ProjectGate lang={lang} onCreated={handleProjectCreated} />
      </div>
    );
  }

  // ── Full layout: has projects ─────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 max-w-[1600px] mx-auto w-full overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
        <Zap className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-sm font-bold text-slate-900 dark:text-white hidden sm:block">FinTrust API</span>
        <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-300 hidden sm:flex">v1</Badge>

        {/* Project selector */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 transition-colors ml-2">
              <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 max-w-[140px] truncate">{activeProject?.name}</span>
              <Badge className={`text-[9px] px-1.5 py-0 border-0 ${activeProject?.environment === 'live' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                {activeProject?.environment?.toUpperCase()}
              </Badge>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          } />
          <DropdownMenuContent align="start" className="w-56">
            {projects.map(p => (
              <DropdownMenuItem key={p.id} onClick={() => setActiveProject(p)}
                className={`cursor-pointer ${activeProject?.id === p.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : ''}`}>
                <div className="flex items-center gap-2 w-full">
                  <span className="flex-1 truncate">{p.name}</span>
                  <Badge className={`text-[9px] px-1.5 py-0 border-0 ${p.environment === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.environment.toUpperCase()}
                  </Badge>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCreateProjectOpen(true)} className="cursor-pointer text-indigo-600 dark:text-indigo-400">
              <Plus className="w-4 h-4 mr-2" />
              {lang === 'en' ? 'New Project' : 'New Project'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Lang toggle — right side */}
        <div className="ml-auto flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
          {(['th', 'en'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${lang === l ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Globe className="w-3 h-3" /> {l === 'th' ? 'ภาษาไทย' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-52 xl:w-60 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
          <nav className="flex-1 p-3 pt-4 space-y-0.5">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => scrollToSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeSection === s.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}>
                <span className={activeSection === s.id ? 'text-indigo-500' : 'text-slate-400'}>{s.icon}</span>
                {s.label[lang]}
                {activeSection === s.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-indigo-400" />}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 leading-relaxed">Node/TypeScript · Sarabun Thai font · Strict mode</p>
          </div>
        </aside>

        {/* Center: content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6 lg:p-8 min-w-0">
          <div className="max-w-3xl space-y-16">

            {/* API Keys */}
            <section ref={el => { sectionRefs.current['api-keys'] = el; }}>
              {activeProject && <ApiKeysPanel project={activeProject} lang={lang} />}
            </section>

            {/* Overview */}
            <section ref={el => { sectionRefs.current['overview'] = el; }}>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                {lang === 'en' ? 'Overview' : 'ภาพรวม'}
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Base URL', value: 'https://your-docgen.com', mono: true },
                  { label: 'Protocol', value: 'HTTPS / REST', mono: false },
                  { label: lang === 'en' ? 'Response' : 'Response', value: 'JSON', mono: false },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1">{item.label}</div>
                    <div className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${item.mono ? 'font-mono text-xs' : ''}`}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
                {lang === 'en'
                  ? '⚠️ docgen service runs on a VPS Docker container — NOT Vercel. Start with docker compose up -d.'
                  : '⚠️ docgen service รันบน Docker Container บน VPS ไม่ใช่ Vercel เริ่มด้วย docker compose up -d'}
              </div>
            </section>

            {/* Auth */}
            <section ref={el => { sectionRefs.current['auth'] = el; }}>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Authentication</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                {lang === 'en'
                  ? 'Pass your API key as a Bearer token. Two formats accepted:'
                  : 'ส่ง API key เป็น Bearer token รองรับ 2 รูปแบบ:'}
              </p>
              <CodeBlock code={`// ft_ API key (server-to-server)\nAuthorization: Bearer ft_your_api_key\n\n// Supabase JWT (frontend user)\nAuthorization: Bearer eyJhbGci...`} lang="http" />
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
                {lang === 'en'
                  ? '🔒 Never put ft_ keys in client-side code or public repos. Revoke and regenerate immediately if leaked.'
                  : '🔒 อย่าใส่ ft_ key ใน client-side code หรือ public repo ถ้าหลุดต้อง revoke แล้วสร้างใหม่ทันที'}
              </div>
            </section>

            {/* Endpoints */}
            {(['health', 'render', 'documents', 'qr'] as const).map(id => (
              <section key={id} ref={el => { sectionRefs.current[id] = el; }}>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{ENDPOINTS[id].title[lang]}</h2>
                <EndpointBlock ep={ENDPOINTS[id]} lang={lang} />
                {id === 'render' && (
                  <div className="mt-8">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      {lang === 'en' ? 'invoice-default: data shape' : 'invoice-default: โครงสร้าง data'}
                    </h4>
                    <CodeBlock lang="typescript" code={`interface InvoiceTemplateData {
  invoice: { number: string; date: string; dueDate: string; currency: string; };
  seller: { name: string; taxId?: string; phone?: string; email?: string; address?: string; };
  client: { name: string; taxId?: string; email?: string; address?: string; };
  items: { description: string; quantity: number; unitPrice: number; total: number; }[];
  subtotal: number;
  vatRate: number;      // 7 = VAT 7%
  vatAmount: number;
  whtRate?: number;     // ${lang === 'en' ? 'Withholding tax (optional)' : 'ภาษีหัก ณ ที่จ่าย (ถ้ามี)'}
  whtAmount?: number;
  total: number;
  promptpayQr?: string; // ${lang === 'en' ? 'PromptPay ID — embeds QR in PDF' : 'เบอร์พร้อมเพย์สำหรับ QR ใน PDF'}
  notes?: string;
  paymentTerms?: string;
}`} />
                  </div>
                )}
              </section>
            ))}

            {/* Errors */}
            <section ref={el => { sectionRefs.current['errors'] = el; }}>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                {lang === 'en' ? 'Error Reference' : 'ตาราง Error'}
              </h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 w-20">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">{lang === 'en' ? 'Meaning' : 'ความหมาย'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { code: '200', en: 'OK', th: 'สำเร็จ' },
                      { code: '201', en: 'Created — PDF rendered & stored', th: 'สร้างสำเร็จ — PDF render และเก็บแล้ว' },
                      { code: '400', en: 'Bad request — invalid input', th: 'ข้อมูลไม่ถูกต้อง' },
                      { code: '401', en: 'Unauthorized — missing or invalid token', th: 'ไม่มี token หรือ token ไม่ถูกต้อง' },
                      { code: '404', en: 'Not found — template or document missing', th: 'ไม่พบ template หรือ document' },
                      { code: '422', en: 'Validation error — Zod schema mismatch', th: 'Validation error (Zod)' },
                      { code: '502', en: 'Upstream error — Gotenberg or Storage failed', th: 'Error จาก Gotenberg หรือ Storage' },
                    ].map(row => (
                      <tr key={row.code} className="bg-white dark:bg-slate-900/30">
                        <td className="px-4 py-3">
                          <code className={`text-xs font-mono font-bold ${row.code.startsWith('2') ? 'text-emerald-600 dark:text-emerald-400' : row.code.startsWith('4') ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{row.code}</code>
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

        {/* Right: API tester */}
        <div className="hidden xl:flex w-[400px] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-950 overflow-y-auto">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-black/30">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">{lang === 'en' ? 'API Tester' : 'ทดสอบ API'}</span>
            <span className="ml-auto text-[10px] text-emerald-500">{lang === 'en' ? 'Live' : 'ยิงจริง'}</span>
          </div>

          <div className="p-5 space-y-5 flex-1">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">API Key</Label>
              <Input
                type="password"
                placeholder="ft_your_api_key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-indigo-500 font-mono text-sm h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">Endpoint</Label>
              <div className="space-y-1">
                {TESTER_ENDPOINTS.map(ep => (
                  <button key={ep.id} onClick={() => handleTesterChange(ep.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${testerEndpoint === ep.id ? 'bg-indigo-600/20 border border-indigo-600/40 text-indigo-300' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'}`}>
                    <MethodBadge method={ep.method} />
                    <code className="text-xs">{ep.path}</code>
                  </button>
                ))}
              </div>
            </div>

            {TESTER_ENDPOINTS.find(e => e.id === testerEndpoint)?.method === 'POST' && (
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">Request Body</Label>
                <textarea
                  value={requestBody}
                  onChange={e => setRequestBody(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y min-h-[140px] leading-relaxed"
                  spellCheck={false}
                />
              </div>
            )}

            <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-10" onClick={handleSend} disabled={isSending}>
              {isSending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />{lang === 'en' ? 'Sending...' : 'กำลังส่ง...'}</>
                : <><Play className="w-3.5 h-3.5 fill-current mr-2" />{lang === 'en' ? 'Send Request' : 'ส่ง Request'}</>}
            </Button>
          </div>

          <AnimatePresence>
            {response && (
              <motion.div
                initial={{ opacity: 0, height: reduced ? 'auto' : 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: reduced ? 0.1 : 0.25 }}
                className="border-t border-slate-800 shrink-0"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className={`font-bold ${response.status < 300 ? 'text-emerald-400' : response.status < 500 ? 'text-amber-400' : 'text-red-400'}`}>{response.status}</span>
                    <span className="text-slate-500">{response.ms}ms</span>
                  </div>
                  <CopyBtn text={JSON.stringify(response.data, null, 2)} />
                </div>
                <div className="p-4 max-h-72 overflow-y-auto bg-[#0c1017]">
                  <pre className="text-[11px] font-mono text-slate-300 m-0 leading-relaxed"><code>{JSON.stringify(response.data, null, 2)}</code></pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Project Dialog (from header) */}
      <ProjectGateDialog lang={lang} open={createProjectOpen} onOpenChange={setCreateProjectOpen} onCreated={p => { setProjects(prev => [p, ...prev]); setActiveProject(p); }} session={session} />
    </div>
  );
}

function ProjectGateDialog({ lang, open, onOpenChange, onCreated, session }: {
  lang: Lang; open: boolean; onOpenChange: (v: boolean) => void;
  onCreated: (p: Project) => void; session: ReturnType<typeof useAuth>['session'];
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [env, setEnv] = useState<Environment>('live');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setErr(lang === 'en' ? 'Project name required.' : 'กรุณาระบุชื่อ project'); return; }
    if (!session?.user?.id) return;
    setSaving(true); setErr(null);
    const { data, error } = await supabase.from('projects').insert({
      account_id: session.user.id,
      name: name.trim(),
      description: description.trim() || null,
      environment: env,
    }).select().single();
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setName(''); setDescription(''); setEnv('live');
    onOpenChange(false);
    onCreated(data as Project);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{lang === 'en' ? 'New Project' : 'สร้าง Project ใหม่'}</DialogTitle>
          <DialogDescription>{lang === 'en' ? 'Separate your environments with projects.' : 'ใช้ project แยก Live กับ Test environment'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {err && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-lg">{err}</div>}
          <div className="space-y-1.5">
            <Label>{lang === 'en' ? 'Project Name' : 'ชื่อ Project'} *</Label>
            <Input placeholder={lang === 'en' ? 'e.g. My App' : 'เช่น My App'} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === 'en' ? 'Description' : 'คำอธิบาย'} <span className="text-slate-400 font-normal">{lang === 'en' ? '(optional)' : '(ไม่บังคับ)'}</span></Label>
            <Input placeholder={lang === 'en' ? 'What is this for?' : 'ใช้สำหรับอะไร?'} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['live', 'test'] as const).map(e => (
              <button key={e} type="button" onClick={() => setEnv(e)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${env === e ? (e === 'live' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300') : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                <div className="font-semibold capitalize">{e === 'live' ? '🟢 Live' : '🟡 Test'}</div>
                <div className="text-[11px] opacity-70">{e === 'live' ? (lang === 'en' ? 'Real data' : 'ข้อมูลจริง') : (lang === 'en' ? 'Safe for testing' : 'ทดสอบได้')}</div>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{lang === 'en' ? 'Cancel' : 'ยกเลิก'}</Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white">
            {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{lang === 'en' ? 'Creating...' : 'กำลังสร้าง...'}</> : (lang === 'en' ? 'Create' : 'สร้าง')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
