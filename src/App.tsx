/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import PaymentLinks from './components/PaymentLinks';
import PromptPay from './components/PromptPay';
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

import { ThemeProvider } from './components/theme-provider';
import { LanguageProvider } from './components/language-provider';
import { AuthProvider, useAuth } from './lib/auth-context';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/payment-links" element={<PaymentLinks />} />
                <Route path="/promptpay" element={<PromptPay />} />
                <Route path="/crypto" element={<PlaceholderPage title="Crypto Payments" description="Accept and settle USDC and other cryptocurrencies." />} />
                <Route path="/analytics" element={<PlaceholderPage title="Analytics" description="Detailed insights into revenue, conversion rates, and gateway performance." />} />
                <Route path="/webhooks" element={<PlaceholderPage title="Webhooks" description="Configure endpoint URLs and monitor webhook deliveries." />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/payments" element={<Navigate to="/dashboard" replace />} />
                <Route path="/invoice/new" element={<CreateInvoice />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/api-docs" element={<ApiDocs />} />
              </Route>
              <Route path="/pay/:id" element={<PaymentPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}


