import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Invoice } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Search, FileText, ArrowUpRight, DollarSign, Activity, Download, Repeat, Link as LinkIcon, Check, Terminal, Mail, RotateCcw, AlertTriangle, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'Jan', revenue: 1500, volume: 12 },
  { name: 'Feb', revenue: 2300, volume: 18 },
  { name: 'Mar', revenue: 3800, volume: 22 },
  { name: 'Apr', revenue: 3200, volume: 16 },
  { name: 'May', revenue: 4500, volume: 29 },
  { name: 'Jun', revenue: 5800, volume: 34 },
];

interface ActivityLog {
  id: string;
  type: 'api_request' | 'payment_confirmation' | 'webhook' | 'system';
  message: string;
  metadata?: any;
  timestamp: string;
}

function ActivityLogsFeed() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/logs/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setLogs(data.logs);
        } else {
          setLogs((prev) => [data, ...prev].slice(0, 100));
        }
      } catch (err) {
        console.error("Failed to parse SSE message", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleRetryWebhook = async (eventId: string, logId: string) => {
    setRetryingLogId(logId);
    try {
      await fetch(`/api/webhooks/retry/${eventId}`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to retry webhook', err);
    } finally {
      setRetryingLogId(null);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm h-[390px] flex flex-col">
      <CardHeader className="pb-3 border-b border-slate-100 shrink-0">
         <CardTitle className="text-lg flex items-center gap-2">
           <Terminal className="h-5 w-5 text-slate-500" />
           Live Activity Feed
         </CardTitle>
         <CardDescription>Recent server events and webhooks.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
         <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">No recent activity...</div>
            ) : (
              logs.map(log => (
                 <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className={`p-2 rounded-full shrink-0 ${
                      log.type === 'payment_confirmation' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                      log.type === 'webhook' && log.metadata?.status === 'failed' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                      log.type === 'webhook' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' :
                      log.type === 'api_request' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    }`}>
                      {log.type === 'payment_confirmation' && <DollarSign className="w-4 h-4" />}
                      {log.type === 'webhook' && log.metadata?.status === 'failed' && <AlertTriangle className="w-4 h-4" />}
                      {log.type === 'webhook' && log.metadata?.status !== 'failed' && <Repeat className="w-4 h-4" />}
                      {log.type === 'api_request' && <Activity className="w-4 h-4" />}
                      {log.type === 'system' && <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className={`text-sm font-medium truncate ${log.metadata?.status === 'failed' ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {log.message}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                        {log.type === 'webhook' && log.metadata?.status === 'failed' && log.metadata?.eventId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shrink-0"
                            onClick={() => handleRetryWebhook(log.metadata.eventId, log.id)}
                            disabled={retryingLogId === log.id}
                          >
                            <RotateCcw className={`mr-1.5 h-3 w-3 ${retryingLogId === log.id ? 'animate-spin' : ''}`} />
                            {retryingLogId === log.id ? 'Retrying...' : 'Retry'}
                          </Button>
                        )}
                      </div>
                    </div>
                 </div>
              ))
            )}
         </div>
      </CardContent>
    </Card>
  )
}

import { useLanguage } from './language-provider';

const dashboardTranslations = {
  en: {
    overview: 'Overview',
    overviewDesc: "Welcome back. Here's what's happening with your invoices today.",
    paymentsVolume: 'Payments Volume',
    recurringRevenue: 'Recurring Revenue',
    averageInvoice: 'Average Invoice',
    invoicesIssued: 'Invoices Issued',
    allTime: 'All time',
    createInvoice: 'Create Invoice',
  },
  th: {
    overview: 'ภาพรวม',
    overviewDesc: 'ยินดีต้อนรับกลับมา นี่คือสิ่งที่เกิดขึ้นกับใบแจ้งหนี้ของคุณวันนี้',
    paymentsVolume: 'ปริมาณการชำระเงิน',
    recurringRevenue: 'รายได้ประจำ',
    averageInvoice: 'ใบแจ้งหนี้เฉลี่ย',
    invoicesIssued: 'ใบแจ้งหนี้ที่ออก',
    allTime: 'ตลอดเวลา',
    createInvoice: 'สร้างใบแจ้งหนี้',
  },
  zh: {
    overview: '概览',
    overviewDesc: '欢迎回来。这是您今天的发票动态。',
    paymentsVolume: '付款量',
    recurringRevenue: '经常性收入',
    averageInvoice: '平均发票',
    invoicesIssued: '已开发票',
    allTime: '总计',
    createInvoice: '创建发票',
  }
};

export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState('Monthly');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [emailPreviewInvoice, setEmailPreviewInvoice] = useState<Invoice | null>(null);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [reminderPreviewInvoice, setReminderPreviewInvoice] = useState<Invoice | null>(null);
  const [isReminderSending, setIsReminderSending] = useState(false);
  const [isRevenueDetailsOpen, setIsRevenueDetailsOpen] = useState(false);
  
  const { language } = useLanguage();
  const t = dashboardTranslations[language] || dashboardTranslations.en;

  const handleSendEmail = () => {
    setIsEmailSending(true);
    setTimeout(() => {
      setIsEmailSending(false);
      setEmailPreviewInvoice(null);
    }, 1500);
  };

  const handleSendReminder = () => {
    setIsReminderSending(true);
    setTimeout(() => {
      setIsReminderSending(false);
      setReminderPreviewInvoice(null);
    }, 1500);
  };

  const copyLink = (invoiceNumber: string) => {
    const url = `${window.location.origin}/pay/${invoiceNumber}`;
    navigator.clipboard.writeText(url);
    setCopiedId(invoiceNumber);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateRecurringInvoice = () => {
    // In a real app, this would save the recurring schedule to the backend
    console.log(`Creating ${recurringFrequency} recurring invoice`);
    setIsRecurringModalOpen(false);
  };

  useEffect(() => {
    fetch('/api/invoices')
      .then(res => res.json())
      .then(data => {
        setInvoices(data.data);
        setLoading(false);
      });
  }, []);

  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0);
  const outstanding = invoices.filter(i => i.status === 'UNPAID').reduce((sum, i) => sum + i.amount, 0);

  const filteredInvoices = invoices.filter(invoice => {
    if (statusFilter !== 'ALL' && invoice.status !== statusFilter) return false;
    
    if (invoiceSearchTerm.trim()) {
      const term = invoiceSearchTerm.toLowerCase();
      if (!invoice.customerName.toLowerCase().includes(term) && 
          !invoice.invoiceNumber.toLowerCase().includes(term)) {
        return false;
      }
    }
    
    return true;
  });

  const downloadPdf = (invoice: Invoice) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('INVOICE', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 14, 30);
    doc.text(`Date Issued: ${new Date(invoice.createdAt).toLocaleDateString()}`, 14, 35);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 14, 40);
    
    // Billed To
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Billed To:', 14, 55);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(invoice.customerName, 14, 62);
    doc.text(invoice.customerEmail, 14, 67);

    // Items table
    const tableData = invoice.items.map(item => [
      item.description,
      item.quantity.toString(),
      `$${item.price.toFixed(2)}`,
      `$${(item.quantity * item.price).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }, // indigo-600
      styles: { fontSize: 10, cellPadding: 5 },
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY || 80;
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`Total Amount: ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${invoice.currency}`, 14, finalY + 15);
    
    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">{t.overview}</h1>
          <p className="text-slate-500 text-sm">{t.overviewDesc}</p>
        </div>
        <div className="flex items-center space-x-3">
          <Dialog open={isRecurringModalOpen} onOpenChange={setIsRecurringModalOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="bg-white border-slate-200">
                <Repeat className="mr-2 h-4 w-4" />
                Recurring
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Recurring Invoice</DialogTitle>
                <DialogDescription>
                  Set up a schedule to automatically generate this invoice.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="frequency" className="text-right">
                    Frequency
                  </Label>
                  <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsRecurringModalOpen(false)}>Cancel</Button>
                <Button type="button" onClick={handleCreateRecurringInvoice}>
                  Create Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Link to="/invoice/new">
            <Button className="shadow-sm rounded-md transition-all">
              <PlusCircle className="mr-2 h-4 w-4" />
              {t.createInvoice || 'Create Invoice'}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <p className="text-xs text-emerald-600 font-medium mt-1">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Outstanding</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${outstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <p className="text-xs text-orange-600 font-medium mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Invoices Issued</CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{invoices.length}</div>
            <p className="text-xs text-slate-500 font-medium mt-1">+4 this week</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">28</div>
            <p className="text-xs text-emerald-600 font-medium mt-1">+2 since last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="border-slate-200 shadow-sm lg:col-span-2 h-[390px] flex flex-col">
          <CardHeader className="shrink-0 pb-0 flex flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Revenue Trends</CardTitle>
              <CardDescription>Monthly payment growth visualization.</CardDescription>
            </div>
            <Dialog open={isRevenueDetailsOpen} onOpenChange={setIsRevenueDetailsOpen}>
              <DialogTrigger render={
                <Button variant="outline" size="sm" className="shrink-0">
                  View Details
                </Button>
              } />
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Monthly Revenue Breakdown</DialogTitle>
                  <DialogDescription>
                    Detailed transaction volume and average value per month.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900">
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">Avg Value</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockChartData.map((data, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-slate-900 dark:text-slate-100">{data.name}</TableCell>
                          <TableCell className="text-right">{data.volume}</TableCell>
                          <TableCell className="text-right">
                            ${(data.revenue / data.volume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900 dark:text-slate-100">
                            ${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="flex-1 pb-6 pt-4">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value}`, 'Revenue']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <ActivityLogsFeed />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Recent Invoices</CardTitle>
              <CardDescription>You issued {invoices.length} invoices recently.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="VOID">Void</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search invoices..." 
                  className="pl-9 w-full md:w-[250px] bg-slate-50 border-slate-200"
                  value={invoiceSearchTerm}
                  onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="py-3 px-4 font-semibold text-slate-600">Invoice</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-slate-600">Customer</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-slate-600">Issued</TableHead>
                  <TableHead className="py-3 px-4 text-right font-semibold text-slate-600">Amount</TableHead>
                  <TableHead className="py-3 px-4 text-right font-semibold text-slate-600">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading data...</TableCell></TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No invoices found for this status.</TableCell></TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-4 py-4 font-medium text-indigo-600">
                        <Link to={`/pay/${invoice.invoiceNumber}`} className="hover:underline flex items-center gap-1 w-max">
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{invoice.customerName}</span>
                          <span className="text-xs text-slate-500">{invoice.customerEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Badge className={`font-medium transition-all duration-200 hover:scale-[1.03] hover:shadow-sm cursor-default ${
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                            invoice.status === 'UNPAID' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 
                            'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`} variant="secondary">
                            {invoice.status}
                          </Badge>
                          {invoice.status === 'UNPAID' && (invoice.expiresAt || invoice.dueDate) && new Date(invoice.expiresAt || invoice.dueDate) < new Date() && (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 flex items-center gap-1 px-1.5 py-0">
                              <AlertTriangle className="w-3 h-3" />
                              Past Due
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-slate-600">{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="px-4 py-4 text-right font-semibold text-slate-900">
                        {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-slate-500 font-normal ml-1">{invoice.currency}</span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            onClick={() => copyLink(invoice.invoiceNumber)}
                            title="Copy Shareable Link"
                          >
                            {copiedId === invoice.invoiceNumber ? <Check className="h-4 w-4 text-green-600" /> : <LinkIcon className="h-4 w-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            onClick={() => setEmailPreviewInvoice(invoice)}
                            title="Email Invoice"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'UNPAID' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => setReminderPreviewInvoice(invoice)}
                              title="Send Payment Reminder"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            onClick={() => downloadPdf(invoice)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <a 
                            href={`/pay/${invoice.invoiceNumber}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                          >
                            View <ArrowUpRight className="ml-1 h-3 w-3" />
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden flex flex-col divide-y divide-slate-100">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading data...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No invoices found for this status.</div>
            ) : (
              filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link to={`/pay/${invoice.invoiceNumber}`} className="font-medium text-indigo-600 hover:underline flex items-center gap-1 w-max">
                        {invoice.invoiceNumber}
                      </Link>
                      <div className="mt-1">
                        <span className="font-medium text-slate-900 block">{invoice.customerName}</span>
                        <span className="text-xs text-slate-500 block">{invoice.customerEmail}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-slate-500 font-normal ml-1">{invoice.currency}</span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">{new Date(invoice.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`font-medium cursor-default ${
                        invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 
                        invoice.status === 'UNPAID' ? 'bg-amber-100 text-amber-700' : 
                        'bg-slate-100 text-slate-700'
                      }`} variant="secondary">
                        {invoice.status}
                      </Badge>
                      {invoice.status === 'UNPAID' && (invoice.expiresAt || invoice.dueDate) && new Date(invoice.expiresAt || invoice.dueDate) < new Date() && (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 flex items-center gap-1 px-1.5 py-0">
                          <AlertTriangle className="w-3 h-3" />
                          Past Due
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 hover:bg-slate-100"
                        onClick={() => copyLink(invoice.invoiceNumber)}
                      >
                        {copiedId === invoice.invoiceNumber ? <Check className="h-4 w-4 text-green-600" /> : <LinkIcon className="h-4 w-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-600 hover:bg-slate-100"
                        onClick={() => setEmailPreviewInvoice(invoice)}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      {invoice.status === 'UNPAID' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                          onClick={() => setReminderPreviewInvoice(invoice)}
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-600 hover:bg-slate-100"
                        onClick={() => downloadPdf(invoice)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <a 
                        href={`/pay/${invoice.invoiceNumber}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center justify-center h-8 w-8 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Preview Dialog */}
      <Dialog open={!!emailPreviewInvoice} onOpenChange={(open) => !open && setEmailPreviewInvoice(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Email Invoice Preview</DialogTitle>
            <DialogDescription>
              Preview the email that will be sent to the customer.
            </DialogDescription>
          </DialogHeader>
          {emailPreviewInvoice && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4 text-sm font-sans">
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center border-b border-slate-200 dark:border-slate-800 pb-4">
                <span className="text-slate-500 text-right">To:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{emailPreviewInvoice.customerEmail || 'customer@example.com'}</span>
                <span className="text-slate-500 text-right">Subject:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">Invoice {emailPreviewInvoice.invoiceNumber} from FinTrust</span>
              </div>
              <div className="py-2 space-y-4 text-slate-700 dark:text-slate-300">
                <p>Hi {emailPreviewInvoice.customerName},</p>
                <p>Your invoice <strong>{emailPreviewInvoice.invoiceNumber}</strong> for <strong>{emailPreviewInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {emailPreviewInvoice.currency}</strong> is available.</p>
                <div className="py-4">
                  <a href={`/pay/${emailPreviewInvoice.invoiceNumber}`} target="_blank" rel="noreferrer" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg no-underline transition-colors dark:text-white">
                    View & Pay Invoice
                  </a>
                </div>
                <p>Thank you,<br/>The FinTrust Team</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailPreviewInvoice(null)} disabled={isEmailSending}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={isEmailSending} className="min-w-[100px]">
              {isEmailSending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Preview Dialog */}
      <Dialog open={!!reminderPreviewInvoice} onOpenChange={(open) => !open && setReminderPreviewInvoice(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Payment Reminder Preview</DialogTitle>
            <DialogDescription>
              Preview the payment reminder that will be sent to the customer.
            </DialogDescription>
          </DialogHeader>
          {reminderPreviewInvoice && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4 text-sm font-sans">
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center border-b border-slate-200 dark:border-slate-800 pb-4">
                <span className="text-slate-500 text-right">To:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{reminderPreviewInvoice.customerEmail || 'customer@example.com'}</span>
                <span className="text-slate-500 text-right">Subject:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">Reminder: Invoice {reminderPreviewInvoice.invoiceNumber} from FinTrust</span>
              </div>
              <div className="py-2 space-y-4 text-slate-700 dark:text-slate-300">
                <p>Hi {reminderPreviewInvoice.customerName},</p>
                <p>This is a friendly reminder that your invoice <strong>{reminderPreviewInvoice.invoiceNumber}</strong> for <strong>{reminderPreviewInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {reminderPreviewInvoice.currency}</strong> is currently unpaid.</p>
                <div className="py-4">
                  <a href={`/pay/${reminderPreviewInvoice.invoiceNumber}`} target="_blank" rel="noreferrer" className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg no-underline transition-colors dark:text-white">
                    View & Pay Invoice
                  </a>
                </div>
                <p>If you've already made the payment, please disregard this message. Thank you for your business!</p>
                <p>Thank you,<br/>The FinTrust Team</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderPreviewInvoice(null)} disabled={isReminderSending}>Cancel</Button>
            <Button onClick={handleSendReminder} disabled={isReminderSending} className="bg-amber-600 hover:bg-amber-700 text-white min-w-[100px]">
              {isReminderSending ? 'Sending...' : 'Send Reminder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

