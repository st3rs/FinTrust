import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ShieldCheck, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

// Force a light surface that matches the landing page, regardless of the
// visitor's system/dark theme. Re-asserting the light design-token values on
// `.auth-light` makes token-driven shadcn components (Input/Button/Label)
// render light even when <html> carries the `.dark` class — CSS custom
// properties inherit, so the nearest declaration wins.
const AUTH_LIGHT = `
  .auth-light {
    --surface-shell: oklch(0.968 0.009 165);
    --background: oklch(1 0 0);
    --foreground: oklch(0.20 0.03 165);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.20 0.03 165);
    --primary: oklch(0.52 0.13 162);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0.01 162);
    --secondary-foreground: oklch(0.20 0.03 165);
    --muted: oklch(0.97 0.006 165);
    --muted-foreground: oklch(0.46 0.03 165);
    --accent: oklch(0.95 0.02 162);
    --accent-foreground: oklch(0.20 0.03 165);
    --border: oklch(0.90 0.012 162);
    --input: oklch(0.90 0.012 162);
    --ring: oklch(0.58 0.10 162);
    color: var(--foreground);
  }
`;

export default function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="auth-light min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, oklch(0.95 0.04 162) 0%, transparent 60%), oklch(0.985 0.006 150)',
      }}
    >
      <style>{AUTH_LIGHT}</style>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.4 }}
          className="flex justify-center"
        >
          <Link
            to="/"
            aria-label="InvoicePro home"
            className="flex items-center justify-center w-12 h-12 rounded-xl shadow-sm"
            style={{ background: 'oklch(0.52 0.13 162)' }}
          >
            <Receipt className="w-6 h-6" style={{ color: 'oklch(0.985 0.006 150)' }} strokeWidth={2.5} />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: reduced ? 0 : 0.1 }}
        >
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            {subtitle}
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.4, delay: reduced ? 0 : 0.2 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 px-4 shadow-xl shadow-emerald-900/5 sm:rounded-2xl sm:px-10 border border-slate-200">
          {children}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Secured by FinTrust Enterprise
        </div>
      </motion.div>
    </div>
  );
}
