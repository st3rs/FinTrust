import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings as SettingsIcon,
  Plus,
  Search,
  Bell,
  HelpCircle,
  Grid,
  Menu,
  X,
  Terminal,
  ArrowRightLeft,
  Link as LinkIcon,
  QrCode,
  Bitcoin,
  LineChart,
  Key,
  Webhook
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ModeToggle } from './theme-toggle';
import { LanguageToggle } from './language-toggle';
import { useLanguage } from './language-provider';

const translations = {
  en: {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    clients: 'Customers',
    payments: 'Payments',
    apiDocs: 'API Docs',
    settings: 'Settings',
    createInvoice: 'Create Invoice',
    search: 'Search...',
    transactions: 'Transactions',
    paymentLinks: 'Payment Links',
    promptpay: 'PromptPay QR',
    crypto: 'Crypto Payments',
    analytics: 'Analytics',
    apiKeys: 'API Keys',
    webhooks: 'Webhooks'
  },
  th: {
    dashboard: 'แผงควบคุม',
    invoices: 'ใบแจ้งหนี้',
    clients: 'ลูกค้า',
    payments: 'การชำระเงิน',
    apiDocs: 'คู่มือ API',
    settings: 'การตั้งค่า',
    createInvoice: 'สร้างใบแจ้งหนี้',
    search: 'ค้นหา...',
    transactions: 'รายการธุรกรรม',
    paymentLinks: 'ลิงก์ชำระเงิน',
    promptpay: 'พร้อมเพย์คิวอาร์',
    crypto: 'คริปโต',
    analytics: 'การวิเคราะห์ข้อมูล',
    apiKeys: 'คีย์ API',
    webhooks: 'เว็บฮุก'
  },
  zh: {
    dashboard: '仪表板',
    invoices: '发票',
    clients: '客户',
    payments: '付款',
    apiDocs: 'API 文档',
    settings: '设置',
    createInvoice: '创建发票',
    search: '搜索...',
    transactions: '交易',
    paymentLinks: '支付链接',
    promptpay: 'PromptPay',
    crypto: '加密货币',
    analytics: '分析',
    apiKeys: 'API 密钥',
    webhooks: 'Webhooks'
  }
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { name: t.dashboard, path: '/dashboard', icon: LayoutDashboard },
    { name: t.invoices, path: '/invoices', icon: FileText, activePaths: ['/invoices', '/invoice/new'] },
    { name: t.clients, path: '/clients', icon: Users },
    { name: t.transactions, path: '/transactions', icon: ArrowRightLeft },
    { name: t.paymentLinks, path: '/payment-links', icon: LinkIcon },
    { name: t.promptpay, path: '/promptpay', icon: QrCode },
    { name: t.crypto, path: '/crypto', icon: Bitcoin },
    { name: t.analytics, path: '/analytics', icon: LineChart },
    { name: t.apiKeys, path: '/api-docs', icon: Key },
    { name: t.webhooks, path: '/webhooks', icon: Webhook },
    { name: t.settings, path: '/settings', icon: SettingsIcon },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-[#f6f9fc] dark:bg-[#0a0a0b] text-slate-900 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden" 
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-30 shrink-0 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-md flex items-center justify-center font-bold text-xl">
              F
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight dark:text-white">FinTrust</h1>
              <h2 className="font-bold text-sm leading-tight text-slate-500 dark:text-slate-400">Admin</h2>
            </div>
          </div>
          <button className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={closeSidebar}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="space-y-1 px-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.activePaths 
              ? item.activePaths.some(p => location.pathname.startsWith(p))
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 dark:hover:text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-6 space-y-6">
          <div className="w-full h-px bg-slate-200 dark:bg-slate-800"></div>
          <Button 
            className="w-full shadow-sm flex items-center gap-2 h-9 rounded-md transition-all" 
            onClick={() => {
              closeSidebar();
              navigate('/invoice/new');
            }}
          >
            <Plus className="w-4 h-4" />
            {t.createInvoice}
          </Button>

          <div 
            onClick={() => {
              closeSidebar();
              navigate('/login');
            }}
            className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 -mx-2 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                JD
              </div>
              <span className="text-sm font-medium dark:text-slate-200 truncate pr-2">John Doe</span>
            </div>
            <div className="text-slate-400 group-hover:text-red-500 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 relative z-10">
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 className="font-bold text-lg sm:text-xl tracking-tight hidden lg:block dark:text-white mr-4">FinTrust</h1>
            <div className="relative w-36 sm:w-48 md:w-64 lg:w-96 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={t.search}
                className="w-full pl-9 pr-4 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:focus:ring-primary/40"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 text-slate-500 dark:text-slate-400">
            <div className="hidden sm:block">
              <LanguageToggle />
            </div>
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors hidden sm:block p-1.5 sm:p-2 relative">
                  <Bell className="w-5 h-5 sm:w-5 sm:h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              } />
              <DropdownMenuContent align="end" className="w-[280px]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer flex flex-col items-start gap-1 p-3">
                    <span className="font-medium text-sm text-slate-900 dark:text-slate-100">Invoice paid!</span>
                    <span className="text-xs text-slate-500">Global Tech paid $8,400</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer flex flex-col items-start gap-1 p-3">
                    <span className="font-medium text-sm text-slate-900 dark:text-slate-100">Overdue reminder</span>
                    <span className="text-xs text-slate-500">Nexus Industries invoice is overdue.</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <button className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors hidden sm:block p-1.5 sm:p-2">
              <HelpCircle className="w-5 h-5 sm:w-5 sm:h-5" />
            </button>
            <button className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors sm:hidden p-1.5">
              <Search className="w-5 h-5" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ml-1 sm:ml-2 border border-slate-300 dark:border-slate-600 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/20">
                   <img src="https://ui-avatars.com/api/?name=John+Doe&background=random" alt="Avatar" className="w-full h-full object-cover" />
                </button>
              } />
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">Settings</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">Billing</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/login')} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto w-full dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
