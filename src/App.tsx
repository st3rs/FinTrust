/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CreateInvoice from './components/CreateInvoice';
import PaymentPage from './components/PaymentPage';
import Settings from './components/Settings';
import Clients from './components/Clients';
import ApiDocs from './components/ApiDocs';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';

import { ThemeProvider } from './components/theme-provider';
import { LanguageProvider } from './components/language-provider';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/invoices" element={<Navigate to="/dashboard" replace />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/payments" element={<Navigate to="/dashboard" replace />} />
              <Route path="/invoice/new" element={<CreateInvoice />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/api-docs" element={<ApiDocs />} />
            </Route>
            <Route path="/pay/:id" element={<PaymentPage />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}


