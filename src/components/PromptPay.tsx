import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Copy, 
  ExternalLink,
  QrCode,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
  Smartphone,
  Repeat,
  RefreshCw,
  Wallet,
  Activity,
  History,
  FileText,
  Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

const mockRequests = [
  { id: 'req_pp_9A2bK', reference: 'REF-2026-001', customer: 'Anon. Customer', amount: 450.00, type: 'Dynamic', status: 'Paid', createdAt: '2026-05-30T04:20:00Z', expiresAt: '2026-05-30T04:35:00Z', paidAt: '2026-05-30T04:22:15Z' },
  { id: 'req_pp_3mX8C', reference: 'ORDER-9921', customer: 'Jane Smith', amount: 1250.00, type: 'Dynamic', status: 'Pending', createdAt: '2026-05-30T05:40:00Z', expiresAt: '2026-05-30T05:55:00Z', paidAt: null },
  { id: 'req_pp_7Jp1L', reference: 'DONATION-STATIC', customer: 'Multiple', amount: 0, type: 'Static', status: 'Active', createdAt: '2026-05-01T09:00:00Z', expiresAt: null, paidAt: null },
  { id: 'req_pp_5kR4w', reference: 'REF-2026-002', customer: 'Anon. Customer', amount: 890.00, type: 'Dynamic', status: 'Expired', createdAt: '2026-05-29T14:00:00Z', expiresAt: '2026-05-29T14:15:00Z', paidAt: null },
  { id: 'req_pp_1nV2x', reference: 'INV-2026-045', customer: 'Global Tech', amount: 3400.00, type: 'Dynamic', status: 'Paid', createdAt: '2026-05-28T10:15:00Z', expiresAt: '2026-05-28T10:30:00Z', paidAt: '2026-05-28T10:28:45Z' },
];

export default function PromptPay() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [qrType, setQrType] = useState('dynamic'); // 'dynamic' or 'static'
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    promptPayId: localStorage.getItem('defaultPromptPayId') || '',
    merchantName: localStorage.getItem('defaultMerchantName') || localStorage.getItem('companyName') || 'FinTrust Merchant',
    amount: '',
    reference: `REF-${Math.floor(Math.random() * 10000)}`,
    description: '',
    expiresIn: '15',
    isReusable: false,
    allowCustomAmount: false
  });

  // ─── Live QR preview ──────────────────────────────────────────────────────
  // Generate QR automatically whenever the PromptPay ID or amount changes,
  // without requiring the user to click Generate first.
  useEffect(() => {
    const id = formData.promptPayId;
    const isValidId = id.length === 10 || id.length === 13;

    if (!isValidId) {
      setGeneratedQR(null);
      return;
    }

    // Dynamic QR needs an amount; static can be open (any amount)
    if (qrType === 'dynamic' && !formData.amount) {
      setGeneratedQR(null);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const amount = formData.amount ? parseFloat(formData.amount) : undefined;
        const payload = generatePayload(id, {
          amount: amount && amount > 0 ? amount : undefined,
        });
        const dataUrl = await QRCode.toDataURL(payload, {
          width: 250,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        if (!cancelled) setGeneratedQR(dataUrl);
      } catch {
        if (!cancelled) setGeneratedQR(null);
      }
    }, 350); // 350ms debounce — fast enough to feel live, not too eager

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.promptPayId, formData.amount, formData.allowCustomAmount, qrType]);

  const filteredRequests = mockRequests.filter(req => {
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return req.reference.toLowerCase().includes(term) || req.id.toLowerCase().includes(term) || req.customer.toLowerCase().includes(term);
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Paid': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'Pending': return <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />;
      case 'Active': return <Activity className="w-3.5 h-3.5 text-indigo-500" />;
      case 'Expired': return <Clock className="w-3.5 h-3.5 text-slate-400" />;
      case 'Cancelled': return <Ban className="w-3.5 h-3.5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Paid': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Active': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      case 'Expired': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      case 'Cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`https://fintrust.app/pay/pp/${id}`);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Basic validation
    if (!formData.promptPayId) {
      const err = 'กรุณาระบุหมายเลขพร้อมเพย์'; // Please specify PromptPay ID
      setError(err);
      console.error('Validation Error:', err);
      return;
    }
    
    if (formData.promptPayId.length !== 10 && formData.promptPayId.length !== 13) {
      const err = 'หมายเลขพร้อมเพย์ต้องเป็น 10 หรือ 13 หลักเท่านั้น';
      setError(err);
      console.error('Validation Error:', err);
      return;
    }

    if (qrType === 'dynamic' && !formData.amount) {
      const err = 'Amount is required for dynamic QR';
      setError(err);
      console.error('Validation Error:', err);
      return;
    }

    if (!formData.reference && qrType === 'dynamic') {
       const err = 'Reference ID is required';
       setError(err);
       console.error('Validation Error:', err);
       return;
    }

    setIsGenerating(true);
    
    try {
      const amount = formData.amount ? parseFloat(formData.amount) : 0;
      const payload = generatePayload(formData.promptPayId, { amount: amount > 0 ? amount : undefined });
      
      const qrDataUrl = await QRCode.toDataURL(payload, { 
        width: 250, 
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      
      setGeneratedQR(qrDataUrl);
      setSuccessMessage('PromptPay QR generated successfully.');
      console.log('Successfully generated PromptPay QR code', { ...formData, type: qrType });
    } catch (err: any) {
      console.error('Failed to generate PromptPay QR:', err);
      setError('An error occurred while generating the QR code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDefault = () => {
    localStorage.setItem('defaultPromptPayId', formData.promptPayId);
    localStorage.setItem('defaultMerchantName', formData.merchantName);
    setSuccessMessage('Defaults saved successfully.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDownloadAll = async () => {
    try {
      const doc = new jsPDF();
      let yOffset = 20;
      doc.setFontSize(20);
      doc.text('PromptPay QR Codes', 20, yOffset);
      yOffset += 20;

      for (let i = 0; i < filteredRequests.length; i++) {
        const req = filteredRequests[i];
        const targetPromptPayId = formData.promptPayId || '0123456789'; // Fallback
        const payload = generatePayload(targetPromptPayId, { amount: req.amount > 0 ? req.amount : undefined });
        const qrDataUrl = await QRCode.toDataURL(payload, { width: 100, margin: 1 });

        if (yOffset > 250) {
          doc.addPage();
          yOffset = 20;
        }

        doc.setFontSize(14);
        doc.text(`Reference: ${req.reference}`, 20, yOffset);
        doc.setFontSize(10);
        doc.text(`ID: ${req.id}`, 20, yOffset + 5);
        doc.text(`Customer: ${req.customer}`, 20, yOffset + 10);
        doc.text(`Amount: ${req.amount > 0 ? 'THB ' + req.amount : 'Any Amount'}`, 20, yOffset + 15);
        doc.text(`Status: ${req.status}`, 20, yOffset + 20);
        doc.text(`Type: ${req.type} QR`, 20, yOffset + 25);
        
        doc.addImage(qrDataUrl, 'PNG', 120, yOffset - 5, 50, 50);
        
        yOffset += 60;
      }

      doc.save('PromptPay_QRCodes.pdf');
    } catch (err) {
      console.error('Failed to download QR codes:', err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">PromptPay QR</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Create, manage, and track PromptPay payment requests.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" className="shadow-sm bg-white dark:bg-slate-900 hidden md:flex" onClick={handleDownloadAll}>
            <Download className="mr-2 h-4 w-4" />
            Download all QR codes
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white border-transparent h-11 px-6 text-base font-medium shadow-md shadow-orange-200/50 dark:shadow-none hover:shadow-lg transition-all rounded-full">
                <Plus className="mr-2 h-5 w-5" />
                Create New QR
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-[240px] rounded-xl p-2">
              <DropdownMenuItem 
                className="cursor-pointer py-3 px-3 rounded-lg flex flex-col items-start gap-1 focus:bg-indigo-50 dark:focus:bg-indigo-900/40"
                onClick={() => { setQrType('dynamic'); setIsGenerateModalOpen(true); }}
              >
                <div className="flex items-center font-medium text-slate-900 dark:text-slate-100">
                  <Smartphone className="mr-2 h-4 w-4 text-indigo-500" /> Dynamic QR Request
                </div>
                <span className="text-[11px] text-slate-500 ml-6 leading-tight">Best for specific order amounts with an expiration timer.</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem 
                className="cursor-pointer py-3 px-3 rounded-lg flex flex-col items-start gap-1 focus:bg-indigo-50 dark:focus:bg-indigo-900/40"
                onClick={() => { setQrType('static'); setIsGenerateModalOpen(true); }}
              >
                <div className="flex items-center font-medium text-slate-900 dark:text-slate-100">
                  <QrCode className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" /> Static QR Code
                </div>
                <span className="text-[11px] text-slate-500 ml-6 leading-tight">Reusable, infinite scans. Best for tips and donations.</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Total QR Generated</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">1,248</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Payments Received</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">892</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
          <CardContent className="p-4 sm:p-6 flex flex-col">
             <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Pending Payments</span>
             <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">34</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Revenue Collected</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">฿1,420,500</span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search reference or ID..." 
            className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main List */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="px-6">Reference ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount (THB)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created / Expires</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <QrCode className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-4" />
                      <p className="text-base font-medium text-slate-900 dark:text-slate-100">No requests found</p>
                      <p className="text-sm mt-1 mb-4">No PromptPay requests match your criteria.</p>
                      <Button onClick={() => setIsGenerateModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6">
                        <Plus className="mr-2 h-4 w-4" /> Create New QR
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map(req => (
                  <TableRow key={req.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {req.reference}
                        {req.type === 'Static' && <Badge variant="outline" className="text-[9px] py-0 h-4 bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800">STATIC</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-slate-500">{req.id}</span>
                        <button 
                          onClick={() => handleCopyLink(req.id)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Copy Link URL"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-200">{req.customer}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {req.amount > 0 ? `฿${req.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : 'Any Amount'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-medium px-2 py-0.5 flex w-max items-center gap-1.5 ${getStatusBadge(req.status)}`}>
                        {getStatusIcon(req.status)}
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <div className="text-sm text-slate-700 dark:text-slate-300">
                         {new Date(req.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                       </div>
                       {req.expiresAt && req.status === 'Pending' && (
                         <div className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                           <Clock className="w-3 h-3" /> Expires {new Date(req.expiresAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </div>
                       )}
                       {req.paidAt && (
                         <div className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                           Paid {new Date(req.paidAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </div>
                       )}
                    </TableCell>
                    <TableCell className="pr-6">
                       <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopyLink(req.id)}>
                                <Copy className="mr-2 w-4 h-4 text-slate-500" /> Copy Link
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer">
                                <Download className="mr-2 w-4 h-4 text-slate-500" /> Download QR
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem className="cursor-pointer">View Details</DropdownMenuItem>
                              {req.status === 'Pending' && (
                                <DropdownMenuItem className="cursor-pointer text-amber-600">Cancel Request</DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="cursor-pointer text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="flex flex-col md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredRequests.length === 0 ? (
             <div className="p-8 text-center text-slate-500">
                <QrCode className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No requests found</p>
                <div className="mt-4">
                  <Button onClick={() => setIsGenerateModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-full">
                    <Plus className="mr-2 h-4 w-4" /> Create New QR
                  </Button>
                </div>
             </div>
          ) : (
            filteredRequests.map(req => (
              <div key={req.id} className="p-4 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {req.reference}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-slate-500">{req.id}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`font-medium px-1.5 py-0 text-[10px] flex items-center gap-1 ${getStatusBadge(req.status)}`}>
                    {req.status}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mt-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                    {req.amount > 0 ? `฿${req.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : 'Any Amount'}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {req.customer}
                  </div>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="outline" size="sm" className="h-8 shadow-sm">
                          More <MoreHorizontal className="w-3 h-3 ml-1" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopyLink(req.id)}>Copy Link</DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">Download QR</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer text-amber-600">Cancel</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Generate Modal */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden gap-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row h-[95vh] sm:h-[600px]">
          
          {/* Form Side */}
          <form onSubmit={handleGenerate} className="w-full sm:w-[450px] bg-white dark:bg-slate-950 p-6 flex flex-col h-full overflow-y-auto shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800">
            <DialogHeader className="mb-4 shrink-0">
              <DialogTitle className="text-xl">Generate PromptPay QR</DialogTitle>
              <DialogDescription>
                Create a new payment request bridging to your account.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 flex-1 pr-1">
              {error && (
                <div className="bg-red-50 text-red-600 border border-red-200 text-sm p-3 rounded-lg dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm p-3 rounded-lg dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400">
                  {successMessage}
                </div>
              )}
              
              {/* PromptPay ID — shared between Dynamic and Static tabs */}
              <div className="grid gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <Label htmlFor="promptPayId" className="text-slate-700 dark:text-slate-300">
                  PromptPay ID (Phone or National ID) *
                </Label>
                <Input
                  id="promptPayId"
                  placeholder="ใส่เบอร์โทร 10 หลัก หรือ เลขบัตรประชาชน 13 หลัก"
                  value={formData.promptPayId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 13);
                    setFormData({ ...formData, promptPayId: val });
                  }}
                  className={
                    formData.promptPayId &&
                    !(formData.promptPayId.length === 10 || formData.promptPayId.length === 13)
                      ? 'border-red-500 focus-visible:ring-red-500/20 text-red-600'
                      : ''
                  }
                  required
                />
                <div className="flex justify-between">
                  <p className="text-xs text-slate-500">ใช้เบอร์มือถือหรือเลขบัตร ปช. ที่ผูกกับพร้อมเพย์</p>
                  <p className={`text-xs font-medium ${
                    formData.promptPayId.length === 0 ? '' :
                    formData.promptPayId.length === 10 || formData.promptPayId.length === 13
                      ? 'text-primary'
                      : 'text-red-500'
                  }`}>
                    {formData.promptPayId.length === 0 ? '' :
                      formData.promptPayId.length === 10 ? 'Phone Number ✓' :
                      formData.promptPayId.length === 13 ? 'National ID ✓' :
                      'Invalid (must be 10 or 13 digits)'}
                  </p>
                </div>
              </div>

              <Tabs value={qrType} onValueChange={(v) => { setQrType(v); setGeneratedQR(null); }} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 dark:bg-slate-900">
                  <TabsTrigger value="dynamic">Dynamic QR</TabsTrigger>
                  <TabsTrigger value="static">Static QR</TabsTrigger>
                </TabsList>

                {/* Dynamic Content Details */}
                <TabsContent value="dynamic" className="space-y-5 animate-in fade-in-50">
                  <div className="grid gap-2">
                    <Label htmlFor="amount" className="text-slate-700 dark:text-slate-300">Amount (THB) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500 font-medium">฿</span>
                      <Input 
                        id="amount" 
                        type="number" 
                        placeholder="0.00" 
                        className="pl-8 text-lg font-semibold h-11"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="reference" className="text-slate-700 dark:text-slate-300">Reference ID</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="reference" 
                        value={formData.reference}
                        onChange={(e) => setFormData({...formData, reference: e.target.value})}
                      />
                      <Button variant="outline" type="button" onClick={() => setFormData({...formData, reference: `REF-${Math.floor(Math.random() * 100000)}`})}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="desc" className="text-slate-700 dark:text-slate-300">Description <span className="text-slate-400 font-normal">(Optional)</span></Label>
                    <Input 
                      id="desc" 
                      placeholder="Order #12345, Coffee, etc."
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="merchantName" className="text-slate-700 dark:text-slate-300">Merchant Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                    <Input 
                      id="merchantName" 
                      placeholder="e.g. Coffee Shop"
                      value={formData.merchantName}
                      onChange={(e) => setFormData({...formData, merchantName: e.target.value})}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="expires" className="text-slate-700 dark:text-slate-300">Auto Expiration</Label>
                    <Select value={formData.expiresIn} onValueChange={(v) => setFormData({...formData, expiresIn: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 Minutes</SelectItem>
                        <SelectItem value="15">15 Minutes</SelectItem>
                        <SelectItem value="30">30 Minutes</SelectItem>
                        <SelectItem value="60">1 Hour</SelectItem>
                        <SelectItem value="1440">24 Hours</SelectItem>
                        <SelectItem value="never">Never Expire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* Static Content Details */}
                <TabsContent value="static" className="space-y-5 animate-in fade-in-50">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                    <p className="text-sm text-indigo-800 dark:text-indigo-300">
                      Static QR codes are reusable and do not expire. Customers can scan them multiple times.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Label className="text-slate-900 dark:text-slate-100 font-semibold mb-0.5 block">Allow Custom Amount</Label>
                        <p className="text-xs text-slate-500">Let customers enter amount when scanning.</p>
                      </div>
                      <Switch 
                        checked={formData.allowCustomAmount} 
                        onCheckedChange={(c) => setFormData({...formData, allowCustomAmount: c})} 
                      />
                    </div>
                  </div>

                  {!formData.allowCustomAmount && (
                    <div className="grid gap-2 animate-in fade-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out">
                      <Label htmlFor="static-amount" className="text-slate-700 dark:text-slate-300">Fixed Amount (THB)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 font-medium">฿</span>
                        <Input 
                          id="static-amount" 
                          type="number" 
                          placeholder="0.00" 
                          className="pl-8 text-lg font-semibold h-11"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="static-ref" className="text-slate-700 dark:text-slate-300">Default Reference</Label>
                    <Input 
                      id="static-ref" 
                      placeholder="e.g. TIP-JAR"
                      value={formData.reference}
                      onChange={(e) => setFormData({...formData, reference: e.target.value})}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="pt-6 shrink-0 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between gap-3 bg-white dark:bg-slate-950">
              <Button type="button" variant="ghost" onClick={() => setIsGenerateModalOpen(false)}>Cancel</Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleSaveDefault} className="hidden sm:flex" title="Save Defaults">
                  <Save className="h-4 w-4 mr-2" />
                  Save Defaults
                </Button>
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      {qrType === 'dynamic' ? 'Create Dynamic QR' : 'Save Static QR'} <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Preview Side */}
          <div className="flex-1 bg-slate-100 p-6 sm:p-10 flex flex-col items-center justify-center relative min-h-[400px]">
            <div className="absolute inset-0 pattern-dots text-slate-200" style={{ backgroundSize: '24px 24px', backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)' }}></div>
            
            <div className="relative w-full max-w-[320px] bg-white rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-200 flex flex-col items-center">
              
              {/* Fake Thai QR Header */}
              <div className="w-full bg-[#1e3a8a] py-3 px-4 text-center">
                <span className="text-xs font-bold text-white tracking-widest uppercase">Thai QR Payment</span>
              </div>
              <div className="w-full bg-[#0057b8] py-1"></div>
              
              <div className="p-6 flex flex-col items-center w-full">
                
                {/* QR Image Placeholder or Generated QR */}
                <div className={`qr-preview-container bg-white p-2 border ${
                  formData.promptPayId && !(formData.promptPayId.length === 10 || formData.promptPayId.length === 13)
                    ? 'border-red-500'
                    : 'border-slate-200'
                } rounded-lg shadow-sm mb-4 w-[200px] h-[200px] flex items-center justify-center relative transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-default`}>
                  <div 
                    className={`absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors duration-500 ease-in-out ${
                      formData.promptPayId.length === 10 || formData.promptPayId.length === 13
                        ? 'bg-emerald-500' 
                        : 'bg-red-500'
                    }`} 
                    title={
                      formData.promptPayId.length === 10 || formData.promptPayId.length === 13
                        ? 'Valid PromptPay ID' 
                        : 'Invalid PromptPay ID length'
                    }
                  />
                  {generatedQR ? (
                    <img src={generatedQR} alt="Generated PromptPay QR" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 border-2 border-dashed border-slate-200 rounded flex flex-col items-center justify-center text-slate-400">
                      <QrCode className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Preview Only</span>
                    </div>
                  )}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                    </div>
                  )}
                </div>
                
                <div className="text-center w-full">
                  <h3 className="font-bold text-slate-900 text-lg mb-1">{formData.merchantName || 'FinTrust Merchant'}</h3>
                  
                  {formData.amount && (!formData.allowCustomAmount || qrType === 'dynamic') ? (
                    <div className="text-2xl font-bold text-indigo-700 my-3">
                      ฿ {Number(formData.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                  ) : (
                    <div className="text-slate-500 my-3 text-sm italic">
                      Amount to be entered by customer
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-left bg-slate-50 p-3 rounded-lg border border-slate-100 w-full mt-2">
                    <div className="text-slate-500">Ref ID:</div>
                    <div className="font-mono font-medium text-slate-900 text-right truncate" title={formData.reference}>{formData.reference || 'N/A'}</div>
                    
                    {qrType === 'dynamic' && formData.expiresIn !== 'never' && (
                      <>
                        <div className="text-slate-500">Expires:</div>
                        <div className="text-amber-600 font-medium text-right flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" /> {formData.expiresIn} mins
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
              
            </div>
            
            <div className="absolute bottom-6 flex gap-2">
              <Button variant="secondary" size="sm" className="shadow-sm bg-white hover:bg-slate-50">
                <Download className="w-4 h-4 mr-2" /> PNG
              </Button>
              <Button variant="secondary" size="sm" className="shadow-sm bg-white hover:bg-slate-50">
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
            </div>

            <Badge className="absolute top-4 right-4 bg-white text-slate-600 border-slate-200 shadow-sm pointer-events-none hover:bg-white uppercase tracking-widest text-[10px]">
               {qrType} Preview
            </Badge>
          </div>
          
        </DialogContent>
      </Dialog>
    </div>
  );
}
