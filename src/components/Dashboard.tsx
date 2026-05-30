import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Invoice } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  PlusCircle, 
  Search, 
  FileText, 
  ArrowUpRight, 
  DollarSign, 
  Activity, 
  Download, 
  Repeat, 
  Link as LinkIcon, 
  Check, 
  Terminal, 
  Mail, 
  RotateCcw, 
  AlertTriangle, 
  Bell, 
  Users,
  CreditCard,
  QrCode,
  Bitcoin,
  TrendingUp,
  Percent,
  ServerCrash,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useLanguage } from './language-provider';
import { useDashboardMetrics } from '../lib/use-dashboard-metrics';

const mockChartData = [
  { name: 'Jan', revenue: 15000, volume: 120 },
  { name: 'Feb', revenue: 23000, volume: 180 },
  { name: 'Mar', revenue: 38000, volume: 220 },
  { name: 'Apr', revenue: 32000, volume: 160 },
  { name: 'May', revenue: 45000, volume: 290 },
  { name: 'Jun', revenue: 58000, volume: 340 },
];

const mockTransactions = [
  { id: 'pi_3MtwBwLkdIwHu7ix28a3tqPc', amount: 450.00, currency: 'USD', status: 'succeeded', customer: 'Acme Corp', method: 'card', date: '2026-05-30T04:20:00Z' },
  { id: 'ch_3MtwBwLkdIwHu7ix28a3tqPd', amount: 1250.00, currency: 'USD', status: 'pending', customer: 'Global Tech', method: 'promptpay', date: '2026-05-29T14:15:00Z' },
  { id: 'pi_3MtwBwLkdIwHu7ix28a3tqPe', amount: 85.00, currency: 'USD', status: 'failed', customer: 'StartUp Inc', method: 'crypto', date: '2026-05-28T09:30:00Z' },
  { id: 'pi_3MtwBwLkdIwHu7ix28a3tqPf', amount: 3400.00, currency: 'USD', status: 'succeeded', customer: 'Nexus Industries', method: 'card', date: '2026-05-27T16:45:00Z' },
  { id: 'pi_3MtwBwLkdIwHu7ix28a3tqPg', amount: 150.00, currency: 'USD', status: 'refunded', customer: 'Wayne Corp', method: 'card', date: '2026-05-26T11:20:00Z' },
];

const GatewayHealth = () => (
  <Card className="border-slate-200 dark:border-slate-800 shadow-sm h-full">
    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
      <CardTitle className="text-sm font-medium flex items-center justify-between">
        Gateway Health
        <Activity className="h-4 w-4 text-slate-400" />
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Stripe</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">45ms</span>
          <span className="text-xs text-emerald-600 block">Operational</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">PayPal</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">120ms</span>
          <span className="text-xs text-emerald-600 block">Operational</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">PromptPay</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">85ms</span>
          <span className="text-xs text-emerald-600 block">Operational</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Crypto Pay</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">High Load</span>
          <span className="text-xs text-amber-600 block">Degraded</span>
        </div>
      </div>
    </CardContent>
  </Card>
);

const QuickActions = () => (
  <div className="mb-8">
    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Quick Actions</h3>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <Link to="/invoice/new">
        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors bg-white shadow-sm">
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold">Create Invoice</span>
        </Button>
      </Link>
      <Link to="/payments">
        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors bg-white shadow-sm">
          <LinkIcon className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold">Payment Link</span>
        </Button>
      </Link>
      <Link to="/promptpay">
        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors bg-white shadow-sm">
          <QrCode className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold">PromptPay QR</span>
        </Button>
      </Link>
      <Link to="/crypto">
        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors bg-white shadow-sm">
          <Bitcoin className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold">Crypto Pay</span>
        </Button>
      </Link>
      <Link to="/clients">
        <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 border-slate-200 hover:border-primary hover:bg-primary/5 transition-colors bg-white shadow-sm">
          <Users className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold">Add Customer</span>
        </Button>
      </Link>
    </div>
  </div>
);

export default function Dashboard() {
  const { language } = useLanguage();
  const {
    loading,
    monthlyVolume,
    totalRevenue,
    outstandingBalance,
    successRate,
    collectionRate,
    activeCustomers,
    activeLinks,
    chartData,
    recentTransactions
  } = useDashboardMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 pb-20">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Payment intelligence and platform performance.</p>
        </div>
      </div>

      <QuickActions />

      {/* Primary KPI Grid (Stripe style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
             <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400">Monthly Volume</CardTitle>
             <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold text-slate-900 dark:text-white">{monthlyVolume.value}</div>
             <div className="flex items-center text-xs mt-1">
               <TrendingUp className="w-3 h-3 text-emerald-500 mr-1" />
               <span className="text-emerald-600 font-medium">{monthlyVolume.percentage}</span>
               <span className="text-slate-500 ml-1">vs last month</span>
             </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
             <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Revenue</CardTitle>
             <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalRevenue.value}</div>
             <div className="flex items-center text-xs mt-1">
               <TrendingUp className="w-3 h-3 text-emerald-500 mr-1" />
               <span className="text-emerald-600 font-medium">{totalRevenue.percentage}</span>
               <span className="text-slate-500 ml-1">vs last year</span>
             </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
             <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400">Outstanding Balance</CardTitle>
             <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold text-slate-900 dark:text-white">{outstandingBalance.value}</div>
             <div className="flex items-center text-xs mt-1">
               <span className="text-amber-600 font-medium mr-1">{outstandingBalance.percentage}</span>
               <span className="text-slate-500">pending collection</span>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-xs font-semibold text-slate-500 mb-1 lg:hidden">Success Rate</span>
            <span className="text-sm font-semibold text-slate-500 mb-1 hidden lg:block">Success Rate</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{successRate}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-xs font-semibold text-slate-500 mb-1 lg:hidden">Collection Rate</span>
            <span className="text-sm font-semibold text-slate-500 mb-1 hidden lg:block">Collection Rate</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{collectionRate}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
             <span className="text-xs font-semibold text-slate-500 mb-1 lg:hidden">Active Customers</span>
             <span className="text-sm font-semibold text-slate-500 mb-1 hidden lg:block">Active Customers</span>
             <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{activeCustomers}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-xs font-semibold text-slate-500 mb-1 lg:hidden">Active Links</span>
            <span className="text-sm font-semibold text-slate-500 mb-1 hidden lg:block">Active Links</span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{activeLinks}</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 flex flex-col">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
             <CardTitle className="text-base font-semibold">Revenue Forecast</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `$${val / 1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gateway Health Widget */}
        <div className="lg:col-span-1">
           <GatewayHealth />
        </div>
      </div>

      {/* Recent Transactions Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 px-4 sm:px-6 flex flex-row items-center justify-between bg-white dark:bg-slate-900">
           <div>
             <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
           </div>
           <Link to="/transactions">
             <Button variant="outline" size="sm" className="hidden sm:flex">
               View All
             </Button>
           </Link>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto bg-white dark:bg-slate-900">
          <Table className="min-w-[600px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="font-semibold px-4 sm:px-6">Status</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Method</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-right px-4 sm:px-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.map((tx) => (
                <TableRow key={tx.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                       {tx.status === 'succeeded' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                        tx.status === 'pending' ? <RotateCcw className="w-4 h-4 text-amber-500 animate-spin-slow" /> :
                        <AlertCircle className="w-4 h-4 text-red-500" />
                       }
                       <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                         {tx.status}
                       </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-slate-100">{tx.customer}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-slate-500 border-slate-200 dark:border-slate-700">
                      {tx.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </TableCell>
                  <TableCell className="text-right px-4 sm:px-6 font-semibold text-slate-900 dark:text-slate-100">
                    ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 sm:hidden">
            <Link to="/transactions" className="w-full inline-block">
              <Button variant="outline" className="w-full">
                View All Transactions
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}

