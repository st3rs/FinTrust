import React, { useState, useEffect } from 'react';
import { generatePromptPayQRBase64 } from '../lib/promptpay';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from './language-provider';

const translations = {
  en: {
    companyProfileTitle: "Company Profile",
    companyProfileDesc: "Set your company details or brand name as the invoice issuer.",
    companyName: "Company / Brand Name",
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
    saveCompanyDetails: "บันทึกรายละเอียดบริษัท",
    savedCompanyMsg: "บันทึกรายละเอียดบริษัทแล้ว",
    settingsTitle: "การตั้งค่า",
    gatewaysTitle: "ช่องทางการชำระเงิน",
    gatewaysDesc: "กำหนดวิธีที่ลูกค้าใช้ชำระเงินสำหรับใบแจ้งหนี้ เชื่อมต่อผู้ให้บริการภายนอกอย่างปลอดภัย",
    stripeDesc: "บัตรเครดิตและ ACH",
    connected: "เชื่อมต่อแล้ว",
    notConnected: "ยังไม่เชื่อมต่อ",
    apiKeyVerify: "ตรวจสอบคีย์ API แล้ว",
    liveKey: "คีย์เผยแพร่ที่ใช้งานจริง",
    disconnect: "ยกเลิกการเชื่อมต่อ",
    manageSettings: "จัดการการตั้งค่า",
    paypalDesc: "การชำระเงินทั่วโลก",
    paypalInfo: "เชื่อมต่อบัญชีธุรกิจ PayPal ของคุณเพื่อยอมรับการชำระเงินทั่วโลกโดยตรงในใบแจ้งหนี้ของคุณ",
    connectPaypal: "เชื่อมต่อ PayPal",
    promptPayDesc: "โอนเงินผ่านธนาคารในประเทศ",
    promptPayInfo: "ป้อนหมายเลขบัตรประจำตัวประชาชนหรือหมายเลขโทรศัพท์มือถือที่ลงทะเบียนพร้อมเพย์ เพื่อสร้างคิวอาร์โค้ดการชำระเงินบนใบแจ้งหนี้ของคุณโดยอัตโนมัติ",
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

export default function Settings() {
  const [promptPayId, setPromptPayId] = useState('');
  const [promptPayError, setPromptPayError] = useState('');
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState(localStorage.getItem('companyName') || 'FinTrust Corp.');
  const [saveSuccess, setSaveSuccess] = useState('');
  const { language: lang, setLanguage: changeLanguage } = useLanguage();

  const t = translations[lang];

  const handleSaveCompany = () => {
    localStorage.setItem('companyName', companyName);
    setSaveSuccess(t.savedCompanyMsg);
    setTimeout(() => setSaveSuccess(''), 3000);
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
    // TODO: Actually save the ID
    console.log('Saving PromptPay ID:', promptPayId);
    
    try {
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
                className="w-full bg-white border border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all"
              />
            </div>
            {saveSuccess && <p className="text-emerald-600 text-xs mt-1.5 font-medium">{saveSuccess}</p>}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <button 
              className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              onClick={handleSaveCompany}
            >
              {t.saveCompanyDetails}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stripe Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
                S
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Stripe</h3>
                <p className="text-sm text-slate-500 leading-tight">{t.stripeDesc}</p>
              </div>
            </div>
            <div className="bg-green-50 text-green-700 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              {t.connected}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
            <label className="block text-xs font-semibold text-slate-700 mb-2">{t.liveKey}</label>
            <div className="flex items-center justify-between border border-slate-200 bg-white rounded p-2 mb-3">
              <span className="text-slate-800 font-mono text-sm tracking-widest">••••••••••••••••</span>
              <button className="text-slate-400 hover:text-slate-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              {t.apiKeyVerify}
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
            <button className="text-sm font-medium text-slate-600 hover:text-slate-900">{t.disconnect}</button>
            <button className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {t.manageSettings}
            </button>
          </div>
        </div>

        {/* PayPal Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-indigo-50 text-indigo-900 flex items-center justify-center font-bold text-xl italic">
                P
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">PayPal</h3>
                <p className="text-sm text-slate-500 leading-tight">{t.paypalDesc}</p>
              </div>
            </div>
            <div className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
              {t.notConnected}
            </div>
          </div>

          <div className="border border-dashed border-slate-300 rounded-lg p-6 mb-6 flex flex-col items-center justify-center text-center bg-slate-50/50">
             <div className="w-10 h-10 bg-white shadow-sm border border-slate-200 rounded-lg flex items-center justify-center mb-3 text-slate-400">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
             </div>
             <p className="text-sm text-slate-600">{t.paypalInfo}</p>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              {t.connectPaypal}
            </button>
          </div>
        </div>

        {/* PromptPay QR Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M7 7h.01"></path><path d="M17 7h.01"></path><path d="M7 17h.01"></path><path d="M17 17h.01"></path></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">PromptPay QR</h3>
                <p className="text-sm text-slate-500 leading-tight">{t.promptPayDesc}</p>
              </div>
            </div>
            <div className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
              {t.notConnected}
            </div>
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
                className={`w-full bg-white border ${promptPayError ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all font-mono placeholder:font-sans`}
              />
              {promptPayError && <p className="text-red-500 text-xs mt-1.5 font-medium">{promptPayError}</p>}
            </div>
            
            <AnimatePresence>
              {qrPreview && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
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
                      className="flex-1 text-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-indigo-200 flex items-center justify-center gap-1.5"
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
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
