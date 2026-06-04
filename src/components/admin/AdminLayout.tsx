import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, ArrowRightLeft, Plug,
  ShieldAlert, Menu, X, LogOut, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { useAdmin } from '../../lib/admin-context';

const NAV = [
  { label: 'Platform Overview', path: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Merchants', path: '/admin/merchants', icon: Users },
  { label: 'Transactions', path: '/admin/transactions', icon: ArrowRightLeft },
  { label: 'Gateways', path: '/admin/gateways', icon: Plug },
];

function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, firstName, lastName, signOut } = useAuth();

  const initials = firstName
    ? `${firstName[0]}${lastName?.[0] ?? ''}`.toUpperCase()
    : (user?.email?.[0] ?? 'A').toUpperCase();

  const displayName = firstName
    ? `${firstName} ${lastName ?? ''}`.trim()
    : user?.email?.split('@')[0] ?? 'Admin';

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 w-64 flex flex-col',
          'bg-slate-900 border-r border-slate-800',
          'transition-transform duration-300 ease-out',
          'lg:translate-x-0 lg:static',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-sm text-primary-foreground select-none shrink-0">
              F
            </div>
            <div className="leading-tight">
              <span className="font-semibold text-slate-100 text-sm">FinTrust</span>
              <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-wide">
                ADMIN
              </span>
            </div>
          </div>
          <button
            aria-label="Close menu"
            className="lg:hidden text-slate-400 hover:text-slate-100 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.map(({ label, path, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === path
              : location.pathname.startsWith(path);

            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className={[
                  'group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: admin user */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2 px-1 mb-3">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400/80 font-medium">Admin Mode</span>
          </div>
          <button
            onClick={async () => {
              onClose();
              await signOut();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <span className="flex-1 text-left text-sm text-slate-400 group-hover:text-slate-200 truncate transition-colors">
              {displayName}
            </span>
            <LogOut className="w-4 h-4 text-slate-600 group-hover:text-red-400 transition-colors shrink-0" />
          </button>
        </div>
      </aside>
    </>
  );
}

function AdminAccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldAlert className="w-6 h-6 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
      <p className="text-muted-foreground text-sm max-w-xs">
        This area requires admin privileges. Contact your platform administrator.
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="text-sm text-primary hover:underline"
      >
        Back to Dashboard
      </button>
    </div>
  );
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isChecking } = useAdmin();
  const location = useLocation();

  if (!user && !authLoading) return <Navigate to="/login" replace />;

  if (authLoading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <AdminAccessDenied />;

  return (
    <div className="flex h-screen bg-surface-shell overflow-hidden">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open admin menu"
              className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {NAV.find((n) => {
                  const exact = (n as any).exact;
                  return exact
                    ? location.pathname === n.path
                    : location.pathname.startsWith(n.path);
                })?.label ?? 'Admin'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
              <ShieldAlert className="w-3 h-3" />
              Admin Mode
            </span>
            <Link
              to="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              ← Merchant View
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
