import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generatePromptPayQRBase64 } from '../lib/promptpay';
import { PLANS } from '../lib/plans';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useLanguage } from './language-provider';
import { useAuth } from '../lib/auth-context';
import { Upload, Trash2, Image } from 'lucide-react';

const translations = {
  en: {
    companyProfileTitle: "Company Profile",
    companyProfileDesc: "Set your company details or brand name as the invoice issuer.",
    companyName: "Company / Brand Name",
    companyLogoUrlLvl: "Company Logo URL (Fallback)",
    companyLogoFileLvl: "Upload Logo Image",
    saveCompanyDetails: "Save Company Details",
    savedCompanyMsg: "Company details saved successfully",
    settingsTitle: "Settings",
    gatewaysTitle: "Payment Gateways",
    gatewaysDesc: "Configure how your clients pay their invoices. Connect external providers securely.",
    stripeDesc: "Credit cards & ACH",
    connected: "Connected",
    notConnected: "Not Connected",
    apiKeyVerify: "API keys verified",
    liveKey: "Live Publishable Key",
    disconnect: "Disconnect",
    manageSettings: "Manage Settings",
    paypalDesc: "Global payments",
    paypalInfo: "Connect your PayPal business account to accept global payments directly on your invoices.",
    connectPaypal: "Connect PayPal",
    promptPayDesc: "Local bank transfers",
    promptPayInfo: "Enter your National ID or Mobile number registered with PromptPay to automatically generate payment QR codes on your invoices.",
    promptPayId: "PromptPay ID",
    promptPayPlaceholder: "e.g. 0812345678 or 1100...",
    saveDetails: "Save Details",
    qrPreview: "Preview",
    errOnlyNum: "PromptPay ID must contain only numbers",
    errLength: "PromptPay ID must be 10, 13, or 15 digits",
    errGen: "Failed to generate QR code",
    language: "Language",
    languageDesc: "Select your preferred language for the interface.",
    english: "English",
    thai: "Thai",
  },
  th: {
    companyProfileTitle: "โปรไฟล์บริษัท",
    companyProfileDesc: "ตั้งค่ารายละเอียดบริษัทหรือชื่อแบรนด์ของคุณในฐานะผู้ออกใบแจ้งหนี้",
    companyName: "ชื่อบริษัท / แบรนด์",
    companyLogoUrlLvl: "URL โลโก้บริษัท (สํารอง)",
    companyLogoFileLvl: "อัปโหลดรูปภาพโลโก้",
    saveCompanyDetails: "บันทึกรายละเอียดบริษัท",
    savedCompanyMsg: "บันทึกรายละเอียดบริษัทแล้ว",
    settingsTitle: "การตั้งค่า",
     manageSettings: "จัดการการตั้งค่า",
    paypalDesc: "การชำระเงินทั่วโลก",
    paypalInfo: "เชื่อมต่อบัญชีธุรกิจ PayPal ของคุณเพื่อรับเงินทั่วโลกโดยตรงบนใบแจ้งหนี้ของคุณ",
    connectPaypal: "เชื่อมต่อ PayPal",
    promptPayDesc: "โอนเงินผ่านระบบพร้อมเพย์",
    promptPayInfo: "ป้อนรหัสบัตรประชาชนหรือเบอร์โทรศัพท์มือถือที่ลงทะเบียนพร้อมเพย์ เพื่อคำนวณและสร้าง QR Code สำหรับชำระเงินบนใบแจ้งหนี้โดยอัตโนมัติ",
    promptPayId: "หมายเลขพร้อมเพย์",
    promptPayPlaceholder: "เช่น 0812345678 หรือ 1100...",
    saveDetails: "บันทึกรายละเอียด",
    qrPreview: "ดูตัวอย่าง",
    errOnlyNum: "หมายเลขพร้อมเพย์ต้องมีเฉพาะตัวเลขเท่านั้น",
    errLength: "หมายเลขพร้อมเพย์ต้องมี 10, 13 หรือ 15 หลัก",
    errGen: "ไม่สามารถสร้างคิวอาร์โค้ดได้",
    language: "ภาษา",
    languageDesc: "เลือกภาษาที่คุณต้องการสำหรับอินเทอร์เฟซ",
    english: "ภาษาอังกฤษ (English)",
    thai: "ภาษาไทย (Thai)",
  }
};

interface GatewayStatus {
  stripe: { connected: boolean; mode: string | null };
  paypal: { connected: boolean; environment: string | null };
  promptpay: { connected: boolean };
}

export default function Settings() {
  const reduced = useReducedMotion();
  const { user, companyName: authCompanyName, updateMetadata } = useAuth();
  const [promptPayId, setPromptPayId] = useState(user?.user_metadata?.promptpay_id || localStorage.getItem('promptPayId') || '');
  const [promptPayError, setPromptPayError] = useState('');
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState(authCompanyName || 'FinTrust Corp.');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(user?.user_metadata?.logo_url || localStorage.getItem('companyLogoUrl') || '');
  const [companyLogo, setCompanyLogo] = useState(user?.user_metadata?.company_logo || localStorage.getItem('companyLogo') || '');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [usage, setUsage] = useState<{ invoicesThisMonth: number; invoiceLimit: number | null; canCreateInvoice: boolean } | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; publishableKey: string | null; environment: string | null } | null>(null);
  const [stripeForm, setStripeForm] = useState({ publishableKey: '', secretKey: '', environment: 'live' });
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [searchParams] = useSearchParams();
  const { language: lang, setLanguage: changeLanguage } = useLanguage();
  const { plan: currentPlan, planId, session } = useAuth();

  const t = translations[lang];

  useEffect(() => {
    if (promptPayId) {
      generatePromptPayQRBase64(promptPayId)
        .then(setQrPreview)
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetch('/api/gateways/status').then(r => r.json()).then(setGatewayStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/gateways/stripe/status', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json()).then(setStripeStatus).catch(() => {});
  }, [session]);

  const handleStripeConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setStripeConnecting(true);
    setStripeError('');
    try {
      const res = await fetch('/api/gateways/stripe/connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(stripeForm),
      });
      const data = await res.json();
      if (!res.ok) { setStripeError(data.error ?? 'Connection failed'); return; }
      setStripeStatus({ connected: true, publishableKey: stripeForm.publishableKey, environment: stripeForm.environment });
      setStripeForm({ publishableKey: '', secretKey: '', environment: 'live' });
    } finally {
      setStripeConnecting(false);
    }
  };

  const handleStripeDisconnect = async () => {
    if (!session?.access_token) return;
    await fetch('/api/gateways/stripe/disconnect', { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
    setStripeStatus({ connected: false, publishableKey: null, environment: null });
  };

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/plan/usage', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json()).then(setUsage).catch(() => {});
  }, [session]);

  // Handle ?upgrade=success redirect from Stripe
  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      setSaveSuccess('Your account has been upgraded to Pro!');
      setTimeout(() => setSaveSuccess(''), 5000);
    }
  }, [searchParams]);

  const handleUpgrade = async () => {
    if (!session?.access_token) return;
    setUpgradeLoading(true);
    try {
      const res = await fetch('/api/plan/upgrade', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Upgrade unavailable. Contact support.');
      }
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleSaveCompany = async () => {
    try {
      await updateMetadata({
        company_name: companyName,
        logo_url: companyLogoUrl,
        company_logo: companyLogo
      });
      localStorage.setItem('companyName', companyName);
      localStorage.setItem('companyLogoUrl', companyLogoUrl);
      localStorage.setItem('companyLogo', companyLogo);
      setSaveSuccess(t.savedCompanyMsg);
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save company settings:', err);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePromptPay = async () => {
    // Basic validation for Thai PromptPay ID
    if (!/^\d+$/.test(promptPayId)) {
      setPromptPayError(t.errOnlyNum);
      return;
    }
    
    if (promptPayId.length !== 10 && promptPayId.length !== 13 && promptPayId.length !== 15 /* E-Wallet */) {
      setPromptPayError(t.errLength);
      return;
    }
    
    setPromptPayError('');
    localStorage.setItem('promptPayId', promptPayId);
    
    try {
      await updateMetadata({
        promptpay_id: promptPayId
      });
      const qrImage = await generatePromptPayQRBase64(promptPayId);
      setQrPreview(qrImage);
    } catch (err) {
      setPromptPayError(t.errGen);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <span>{t.settingsTitle}</span>
          <span>›</span>
          <span className="text-slate-900 font-medium">{t.gatewaysTitle}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h1 className="text-3xl font-bold text-slate-900">{t.settingsTitle}</h1>
          
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 w-max">
            <button 
              onClick={() => changeLanguage('en')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${lang === 'en' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              EN
            </button>
            <button 
              onClick={() => changeLanguage('th')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${lang === 'th' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              TH
            </button>
          </div>
        </div>
        
        <p className="text-slate-500">{t.gatewaysDesc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col md:col-span-3">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{t.companyProfileTitle}</h3>
                <p className="text-sm text-slate-500 leading-tight">{t.companyProfileDesc}</p>
              </div>
            </div>
          </div>
          <div className="mb-6 space-y-4 text-sm text-slate-600 max-w-md">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-2">{t.companyName}</label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:ring-primary/20 focus:border-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-2">{t.companyLogoFileLvl}</label>
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleLogoDrop}
                className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center cursor-pointer relative min-h-[140px]"
              >
                {companyLogo ? (
                  <div className="relative">
                    <img src={companyLogo} alt="Company Logo" className="max-h-24 max-w-full rounded-lg object-contain shadow-sm" />
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompanyLogo('');
                      }}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                    <Upload className="w-6 h-6 text-slate-400 mb-2 animate-bounce" />
                    <span className="text-xs font-semibold text-slate-700">Drag & drop logo here or click to upload</span>
                    <span className="text-[10px] text-slate-400 mt-1">Recommended: JPG, PNG, or SVG (max 2MB)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoFileChange}
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-2">{t.companyLogoUrlLvl}</label>
              <input 
                type="text" 
                placeholder="https://example.com/logo.png"
                value={companyLogoUrl}
                onChange={(e) => setCompanyLogoUrl(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:ring-primary/20 focus:border-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all font-mono text-xs text-slate-700 placeholder:font-sans placeholder:text-slate-400"
              />
            </div>

            {saveSuccess && <p className="text-emerald-600 text-xs mt-1.5 font-semibold bg-emerald-50 px-3 py-1.5 rounded border border-emerald-100 flex items-center gap-1.5 animate-in fade-in zoom-in-95">✓ {saveSuccess}</p>}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <button 
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              onClick={handleSaveCompany}
            >
              {t.saveCompanyDetails}
            </button>
          </div>
        </div>
      </div>

      {/* ── Billing / Plan section ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-bold text-lg leading-tight">Plan &amp; Billing</h2>
            <p className="text-sm text-slate-500">Manage your subscription and usage.</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full self-start ${currentPlan.badge.class}`}>
            {currentPlan.name}
          </span>
        </div>

        {saveSuccess && (
          <div className="mb-4 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm p-3 rounded-lg">
            ✓ {saveSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Current usage */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700">This month's usage</p>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Invoices</span>
                <span className="font-semibold tabular-nums">
                  {usage?.invoicesThisMonth ?? '—'}
                  {usage?.invoiceLimit ? ` / ${usage.invoiceLimit}` : ' / ∞'}
                </span>
              </div>
              {usage?.invoiceLimit && (
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (usage.invoicesThisMonth / usage.invoiceLimit) >= 1
                        ? 'bg-red-500'
                        : (usage.invoicesThisMonth / usage.invoiceLimit) >= 0.7
                        ? 'bg-amber-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min((usage.invoicesThisMonth / usage.invoiceLimit) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">PromptPay QR</span>
                <span className="font-semibold tabular-nums">
                  —{' / '}{planId === 'pro' ? '∞' : '10'}
                </span>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Stripe</span>
              <span className={`font-semibold text-xs ${stripeStatus?.connected ? 'text-emerald-600' : 'text-slate-400'}`}>
                {stripeStatus?.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          </div>

          {/* Plan comparison / upgrade */}
          {planId === 'free' ? (
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
              <p className="text-xs font-semibold text-primary">Upgrade to Pro</p>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                {[
                  'Unlimited invoices',
                  'Stripe card payments',
                  'PayPal global payments',
                  'Webhooks &amp; API access',
                  'Analytics dashboard',
                ].map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                    <span dangerouslySetInnerHTML={{ __html: f }} />
                  </li>
                ))}
              </ul>
              <button
                onClick={handleUpgrade}
                disabled={upgradeLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {upgradeLoading ? 'Redirecting…' : 'Upgrade — ฿499/month'}
              </button>
            </div>
          ) : (
            <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/50 space-y-3">
              <p className="text-xs font-semibold text-emerald-700">Pro Plan Active</p>
              <ul className="text-xs text-slate-700 space-y-1.5">
                {['Unlimited invoices', 'All payment gateways', 'Webhooks &amp; API', 'Analytics'].map(f => (
                  <li key={f} className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                    <span dangerouslySetInnerHTML={{ __html: f }} />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">Manage billing via the Stripe customer portal.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stripe Card — per-user keys, available on all plans */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">S</div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Stripe</h3>
                <p className="text-sm text-slate-500 leading-tight">{t.stripeDesc}</p>
              </div>
            </div>
            {stripeStatus?.connected ? (
              <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{t.connected}
              </div>
            ) : (
              <div className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />{t.notConnected}
              </div>
            )}
          </div>

          {stripeStatus?.connected ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 space-y-2 flex-1">
              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Keys verified
              </div>
              <p className="text-xs text-slate-500">
                Mode: <span className={`font-semibold ${stripeStatus.environment === 'live' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {stripeStatus.environment === 'live' ? 'Live' : 'Test'}
                </span>
              </p>
              <p className="text-xs text-slate-400 font-mono truncate">{stripeStatus.publishableKey?.slice(0, 24)}…</p>
            </div>
          ) : (
            <form onSubmit={handleStripeConnect} className="space-y-3 flex-1">
              {stripeError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{stripeError}</p>}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Publishable Key (pk_...)</label>
                <input
                  type="text"
                  value={stripeForm.publishableKey}
                  onChange={e => setStripeForm(f => ({ ...f, publishableKey: e.target.value }))}
                  placeholder="pk_live_..."
                  className="w-full border border-slate-200 focus:ring-primary/20 focus:border-primary rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 transition-all"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Secret Key (sk_...)</label>
                <input
                  type="password"
                  value={stripeForm.secretKey}
                  onChange={e => setStripeForm(f => ({ ...f, secretKey: e.target.value }))}
                  placeholder="sk_live_..."
                  className="w-full border border-slate-200 focus:ring-primary/20 focus:border-primary rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 transition-all"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Mode</label>
                <select
                  value={stripeForm.environment}
                  onChange={e => setStripeForm(f => ({ ...f, environment: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="live">Live</option>
                  <option value="test">Test</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={stripeConnecting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {stripeConnecting ? 'Verifying…' : 'Connect Stripe'}
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                Get keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="underline text-primary">dashboard.stripe.com</a>
              </p>
            </form>
          )}

          {stripeStatus?.connected && (
            <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
              <button onClick={handleStripeDisconnect} className="text-sm font-medium text-red-500 hover:text-red-700">Disconnect</button>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer"
                className="ml-auto bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                Dashboard
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          )}
        </div>

        {/* PayPal Card */}
        {(() => {
          const paypal = gatewayStatus?.paypal;
          const connected = paypal?.connected ?? false;
          const env = paypal?.environment;
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center font-bold text-xl italic">
                    P
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">PayPal</h3>
                    <p className="text-sm text-slate-500 leading-tight">{t.paypalDesc}</p>
                  </div>
                </div>
                {connected ? (
                  <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {t.connected}
                  </div>
                ) : (
                  <div className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    {t.notConnected}
                  </div>
                )}
              </div>

              {connected ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    Credentials verified
                  </div>
                  {env && (
                    <p className="text-xs text-slate-500">
                      Environment: <span className={`font-semibold ${env === 'live' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {env === 'live' ? 'Live' : 'Sandbox'}
                      </span>
                      {env === 'sandbox' && ' — set PAYPAL_ENVIRONMENT=live when ready'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-slate-300 rounded-lg p-4 mb-6 bg-slate-50/50 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">To connect PayPal:</p>
                  <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                    <li>Create app at <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noreferrer" className="text-primary underline">developer.paypal.com</a></li>
                    <li>Add <code className="bg-slate-100 px-1 rounded">PAYPAL_CLIENT_ID</code>, <code className="bg-slate-100 px-1 rounded">PAYPAL_CLIENT_SECRET</code>, and <code className="bg-slate-100 px-1 rounded">VITE_PAYPAL_CLIENT_ID</code> to Vercel</li>
                    <li>Set <code className="bg-slate-100 px-1 rounded">PAYPAL_ENVIRONMENT=sandbox</code> for testing</li>
                  </ol>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-slate-100">
                <a
                  href="https://developer.paypal.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {connected ? t.manageSettings : 'Open PayPal Developer'}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </a>
              </div>
            </div>
          );
        })()}

        {/* PromptPay QR Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M7 7h.01"></path><path d="M17 7h.01"></path><path d="M7 17h.01"></path><path d="M17 17h.01"></path></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">PromptPay QR</h3>
                <p className="text-sm text-slate-500 leading-tight">{t.promptPayDesc}</p>
              </div>
            </div>
            {(/^\d+$/.test(promptPayId) && [10, 13, 15].includes(promptPayId.length)) ? (
              <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                {t.connected}
              </div>
            ) : (
              <div className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                {t.notConnected}
              </div>
            )}
          </div>

          <div className="mb-6 space-y-4 text-sm text-slate-600">
            <p>{t.promptPayInfo}</p>
            
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-2">{t.promptPayId}</label>
              <input 
                type="text" 
                placeholder={t.promptPayPlaceholder} 
                value={promptPayId}
                onChange={(e) => {
                  setPromptPayId(e.target.value);
                  if (promptPayError) setPromptPayError(''); // clear error on type
                }}
                className={`w-full bg-white border ${promptPayError ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200 focus:ring-primary/20 focus:border-primary'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all font-mono placeholder:font-sans`}
              />
              {promptPayError && <p className="text-red-500 text-xs mt-1.5 font-medium">{promptPayError}</p>}
            </div>
            
            <AnimatePresence>
              {qrPreview && (
                <motion.div
                  initial={{ opacity: 0, y: reduced ? 0 : 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: reduced ? 1 : 0.95 }}
                  transition={{ duration: reduced ? 0.15 : 0.2 }}
                  className="qr-preview-container mt-4 p-4 border border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50 relative"
                >
                  <div className="flex w-full items-center justify-between mb-3 px-1">
                    <p className="text-xs font-semibold text-slate-700">{t.qrPreview}</p>
                    <span 
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        /^\d+$/.test(promptPayId) && [10, 13, 15].includes(promptPayId.length)
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}
                    >
                      {/^\d+$/.test(promptPayId) && [10, 13, 15].includes(promptPayId.length) ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                  <img src={qrPreview} alt="PromptPay QR Code Preview" className="w-32 h-32 bg-white rounded-lg p-1 border border-slate-200 shadow-sm mb-4" />
                  <div className="flex w-full gap-2">
                    <a
                      href={qrPreview}
                      download={`promptpay-qr-${promptPayId}.png`}
                      className="flex-1 text-center bg-primary/10 text-primary hover:bg-primary/20 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-primary/20 flex items-center justify-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Download
                    </a>
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(qrPreview);
                          const blob = await response.blob();
                          await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                          ]);
                          // Create a brief visual feedback
                          const btn = document.activeElement as HTMLButtonElement;
                          if (btn) {
                            const originalText = btn.innerHTML;
                            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="text-emerald-600"><polyline points="20 6 9 17 4 12"></polyline></svg> <span class="text-emerald-700">Copied!</span>`;
                            btn.classList.replace('text-slate-600', 'text-emerald-700');
                            btn.classList.replace('bg-slate-50', 'bg-emerald-50');
                            btn.classList.replace('border-slate-200', 'border-emerald-200');
                            setTimeout(() => {
                              btn.innerHTML = originalText;
                              btn.classList.replace('text-emerald-700', 'text-slate-600');
                              btn.classList.replace('bg-emerald-50', 'bg-slate-50');
                              btn.classList.replace('border-emerald-200', 'border-slate-200');
                            }, 2000);
                          }
                        } catch (err) {
                          console.error("Failed to copy image:", err);
                        }
                      }}
                      className="flex-1 text-center bg-slate-50 text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-slate-200 flex items-center justify-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      Copy Image
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <button 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              onClick={handleSavePromptPay}
            >
              {t.saveDetails}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
