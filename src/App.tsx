/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import PaymentLinks from './components/PaymentLinks';
import PromptPay from './components/PromptPay';
import Crypto from './components/Crypto';
import PlaceholderPage from './components/PlaceholderPage';
import CreateInvoice from './components/CreateInvoice';
import PaymentPage from './components/PaymentPage';
import Settings from './components/Settings';
import Clients from './components/Clients';
import Invoices from './components/Invoices';
import ApiDocs from './components/ApiDocs';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import Onboarding from './components/Onboarding';
import LandingPage from './components/LandingPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminMerchants from './components/admin/AdminMerchants';
import AdminTransactions from './components/admin/AdminTransactions';
import AdminGateways from './components/admin/AdminGateways';

import { ThemeProvider } from './components/theme-provider';
import { LanguageProvider } from './components/language-provider';
import { AuthProvider, useAuth } from './lib/auth-context';
import { AdminProvider } from './lib/admin-context';

const OAUTH_PROVIDER_KEY = 'fintrust.oauth.provider';
const OAUTH_STARTED_AT_KEY = 'fintrust.oauth.started_at';
const OAUTH_ONBOARDING_PENDING_KEY = 'fintrust.oauth.onboarding_pending';

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, needsOnboarding, updateMetadata, signOut } = useAuth();
  const providerAtMount = typeof window !== 'undefined'
    ? sessionStorage.getItem(OAUTH_PROVIDER_KEY)
    : null;
  const [oauthCheckComplete, setOAuthCheckComplete] = useState(!providerAtMount);
  const [oauthError, setOAuthError] = useState('');
  const processedOAuthRef = useRef(false);

  useEffect(() => {
    if (loading || processedOAuthRef.current) return;

    if (!user) {
      processedOAuthRef.current = true;
      sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
      sessionStorage.removeItem(OAUTH_STARTED_AT_KEY);
      sessionStorage.removeItem(OAUTH_ONBOARDING_PENDING_KEY);
      setOAuthCheckComplete(true);
      return;
    }

    const provider = sessionStorage.getItem(OAUTH_PROVIDER_KEY);
    if (!provider) {
      processedOAuthRef.current = true;
      setOAuthCheckComplete(true);
      return;
    }

    processedOAuthRef.current = true;

    const finalizeOAuthSession = async () => {
      const startedAt = Number(sessionStorage.getItem(OAUTH_STARTED_AT_KEY) || 0);
      const createdAt = Date.parse(user.created_at || '');
      const lastSignInAt = Date.parse(user.last_sign_in_at || '');
      const isSupportedOAuthProvider = provider === 'google' || provider === 'github';
      const wasCreatedDuringThisAttempt =
        startedAt > 0 &&
        Number.isFinite(createdAt) &&
        createdAt >= startedAt - 60_000 &&
        createdAt <= Date.now() + 60_000;
      const looksLikeFirstSession =
        Number.isFinite(createdAt) &&
        Number.isFinite(lastSignInAt) &&
        Math.abs(lastSignInAt - createdAt) <= 120_000;
      const alreadyCompleted = user.user_metadata?.onboarding_completed === true;
      const isNewOAuthUser =
        isSupportedOAuthProvider &&
        !alreadyCompleted &&
        (wasCreatedDuringThisAttempt || looksLikeFirstSession);

      if (isNewOAuthUser) {
        sessionStorage.setItem(OAUTH_ONBOARDING_PENDING_KEY, '1');
        try {
          await updateMetadata({
            onboarding_required: true,
            onboarding_completed: false,
            oauth_provider: provider,
          });
        } catch (err: any) {
          sessionStorage.removeItem(OAUTH_ONBOARDING_PENDING_KEY);
          setOAuthError(err?.message || 'Could not complete account setup safely.');
          return;
        }
      } else {
        sessionStorage.removeItem(OAUTH_ONBOARDING_PENDING_KEY);
      }

      sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
      sessionStorage.removeItem(OAUTH_STARTED_AT_KEY);
      setOAuthCheckComplete(true);
    };

    void finalizeOAuthSession();
  }, [loading, user, updateMetadata]);

  if (loading) return <LoadingScreen />;

  if (oauthError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Account setup could not be completed</h1>
          <p className="mt-2 text-sm text-red-700">{oauthError}</p>
          <button
            type="button"
            className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            onClick={async () => {
              await signOut();
              window.location.assign('/login');
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!oauthCheckComplete) {
    return <LoadingScreen />;
  }

  const pendingOAuthOnboarding = sessionStorage.getItem(OAUTH_ONBOARDING_PENDING_KEY) === '1';
  if (needsOnboarding || pendingOAuthOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <LanguageProvider>
        <AuthProvider>
          <AdminProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/onboarding" element={<Onboarding />} />

                {/* Merchant routes */}
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/payment-links" element={<PaymentLinks />} />
                  <Route path="/promptpay" element={<PromptPay />} />
                  <Route path="/crypto" element={<Crypto />} />
                  <Route path="/analytics" element={<PlaceholderPage title="Analytics" description="Detailed insights into revenue, conversion rates, and gateway performance." />} />
                  <Route path="/webhooks" element={<PlaceholderPage title="Webhooks" description="Configure endpoint URLs and monitor webhook deliveries." />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/payments" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/invoice/new" element={<CreateInvoice />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/api-docs" element={<ApiDocs />} />
                </Route>

                {/* Super Admin routes — AdminLayout handles its own auth + role check */}
                <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/merchants" element={<AdminMerchants />} />
                  <Route path="/admin/transactions" element={<AdminTransactions />} />
                  <Route path="/admin/gateways" element={<AdminGateways />} />
                </Route>

                <Route path="/pay/:id" element={<PaymentPage />} />
              </Routes>
            </BrowserRouter>
          </AdminProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
