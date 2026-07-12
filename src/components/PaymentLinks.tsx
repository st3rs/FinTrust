import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth-context';
import { 
  Link as LinkIcon, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Copy, 
  ExternalLink,
  QrCode,
  Archive,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  ArrowRight,
  CreditCard,
  Bitcoin,
  Smartphone,
  Download,
  Printer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

export default function PaymentLinks() {
  const { session } = useAuth();
  const [links, setLinks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<any>(null);

  // Create Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'USD',
    methods: {
      stripe: true,
      paypal: false,
      promptpay: false,
      crypto: false
    }
  });

  const fetchLinks = useCallback(async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      const res = await fetch('/api/payment-links', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setLinks(json.data ?? []);
    } catch (err) {
      console.error('Failed to fetch payment links:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  async function handleSubmitCreate() {
    if (!session || !formData.name || !formData.amount) return;
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: formData.name,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          methods: formData.methods,
          description: formData.description,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? 'Failed to create link');
        return;
      }
      setIsCreateModalOpen(false);
      setFormData({ name: '', description: '', amount: '', currency: 'USD', methods: { stripe: true, paypal: false, promptpay: false, crypto: false } });
      await fetchLinks();
    } catch (err) {
      console.error('Create link error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredLinks = links.filter(link => {
    const status = link.is_active ? 'Active' : 'Disabled';
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (link.title ?? '').toLowerCase().includes(term) || (link.id ?? '').toLowerCase().includes(term);
    }
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Active': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'Expired': return <Clock className="w-3.5 h-3.5 text-slate-400" />;
      case 'Disabled': return <Ban className="w-3.5 h-3.5 text-amber-500" />;
      case 'Completed': return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'Expired': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      case 'Disabled': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Completed': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleCopyLink = (link: any) => {
    const url = link.reference ?? `${window.location.origin}/pay/${link.id}`;
    navigator.clipboard.writeText(url);
  };

  async function handleToggleActive(link: any) {
    if (!session) return;
    const res = await fetch(`/api/payment-links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ is_active: !link.is_active }),
    });
    if (res.ok) await fetchLinks();
    else alert((await res.json().catch(() => ({}))).error ?? 'Update failed');
  }

  async function handleDelete(link: any) {
    if (!session) return;
    if (!confirm(`Delete "${link.title}"? Anyone holding this link will no longer be able to pay.`)) return;
    const res = await fetch(`/api/payment-links/${link.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) await fetchLinks();
    else alert((await res.json().catch(() => ({}))).error ?? 'Delete failed');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Payment Links</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Create, manage, and track hosted payment pages.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Link
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Total Links</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : links.length}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Active Links</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : links.filter(l => l.is_active).length}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
          <CardContent className="p-4 sm:p-6 flex flex-col">
             <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Stripe Links</span>
             <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{isLoading ? '—' : links.filter(l => l.reference).length}</span>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 flex flex-col">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Total Value</span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {isLoading ? '—' : `$${links.reduce((s, l) => s + Number(l.amount), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search link name or ID..." 
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
              <SelectItem value="ALL">All Links</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Disabled">Disabled</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
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
                <TableHead className="px-6">Link Detail</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLinks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <LinkIcon className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-4" />
                      <p className="text-base font-medium text-slate-900 dark:text-slate-100">No payment links found</p>
                      <p className="text-sm mt-1 mb-4">You haven't created any links matching this search.</p>
                      <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>Create your first link</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLinks.map(link => {
                  const status = link.is_active ? 'Active' : 'Disabled';
                  return (
                  <TableRow key={link.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{link.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-slate-500 truncate max-w-[180px]">{link.reference ?? link.id}</span>
                        <button
                          onClick={() => handleCopyLink(link)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Copy Link URL"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">Created {new Date(link.created_at).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {Number(link.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                      {link.reference && (
                        <div className="flex items-center gap-1 mt-1.5 opacity-60">
                          <div className="bg-slate-200 dark:bg-slate-800 rounded px-1 py-0.5">
                            <CreditCard className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-medium px-2 py-0.5 flex w-max items-center gap-1.5 ${getStatusBadge(status)}`}>
                        {getStatusIcon(status)}
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="font-medium text-slate-900 dark:text-slate-100">{link.clicks ?? 0} <span className="text-xs font-normal text-slate-500">clicks</span></div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        ${Number(link.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
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
                              <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopyLink(link)}>
                                <Copy className="mr-2 w-4 h-4 text-slate-500" /> Copy Link
                              </DropdownMenuItem>
                              {link.reference && (
                                <DropdownMenuItem className="cursor-pointer" onClick={() => window.open(link.reference, '_blank')}>
                                  <ExternalLink className="mr-2 w-4 h-4 text-slate-500" /> Open in Stripe
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="cursor-pointer" onClick={() => {
                                setSelectedLink(link);
                                setIsQRModalOpen(true);
                              }}>
                                <QrCode className="mr-2 w-4 h-4 text-slate-500" /> Show QR Code
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem className="cursor-pointer text-amber-600" onClick={() => handleToggleActive(link)}>
                                {link.is_active ? 'Disable Link' : 'Enable Link'}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer text-red-600" onClick={() => handleDelete(link)}>Delete</DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="flex flex-col md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredLinks.length === 0 ? (
             <div className="p-8 text-center text-slate-500">
                <LinkIcon className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No payment links found</p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)}>Create Link</Button>
                </div>
             </div>
          ) : (
            filteredLinks.map(link => {
              const status = link.is_active ? 'Active' : 'Disabled';
              return (
              <div key={link.id} className="p-4 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{link.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-slate-500 truncate max-w-[160px]">{link.id}</span>
                      <button onClick={() => handleCopyLink(link)} className="text-indigo-600">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <Badge variant="outline" className={`font-medium px-1.5 py-0 text-[10px] flex items-center gap-1 ${getStatusBadge(status)}`}>
                    {status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                    ${Number(link.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{link.clicks ?? 0} clicks</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1 opacity-70">
                    {link.reference && (
                      <div className="bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5">
                        <CreditCard className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={() => { setSelectedLink(link); setIsQRModalOpen(true); }}>
                      <QrCode className="w-3 h-3 mr-1" /> QR
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="outline" size="sm" className="h-8 shadow-sm">
                          More <MoreHorizontal className="w-3 h-3 ml-1" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => handleCopyLink(link)}>Copy Link</DropdownMenuItem>
                        {link.reference && <DropdownMenuItem className="cursor-pointer" onClick={() => window.open(link.reference, '_blank')}>Open in Stripe</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer text-amber-600" onClick={() => handleToggleActive(link)}>
                          {link.is_active ? 'Disable' : 'Enable'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-red-600" onClick={() => handleDelete(link)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ); })
          )}
        </div>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader className="text-center pb-2">
            <DialogTitle className="text-center">{selectedLink?.title}</DialogTitle>
            <DialogDescription className="text-center cursor-pointer hover:text-indigo-600 transition-colors flex items-center justify-center gap-1 mt-1 font-mono text-xs"
              onClick={() => selectedLink && handleCopyLink(selectedLink)}>
              {selectedLink?.reference ? new URL(selectedLink.reference).hostname + '/...' : selectedLink?.id} <Copy className="w-3 h-3" />
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedLink?.reference ?? `${window.location.origin}/pay/${selectedLink?.id}`)}`} alt="QR Code" className="w-[200px] h-[200px]" />
             </div>
             <p className="text-xs text-slate-500 mt-4 text-center max-w-[250px]">
               Scan this QR code with any smartphone camera to open the payment page.
             </p>
          </div>
          <DialogFooter className="flex-row justify-center gap-2 sm:justify-center">
             <Button variant="outline" size="sm" className="w-full">
               <Download className="w-4 h-4 mr-2" /> Download
             </Button>
             <Button variant="outline" size="sm" className="w-full">
               <Printer className="w-4 h-4 mr-2" /> Print
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Link Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden gap-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row h-[90vh] sm:h-auto max-h-[800px]">
          
          {/* Form Side */}
          <div className="w-full sm:w-[500px] bg-white dark:bg-slate-950 p-6 flex flex-col h-full overflow-y-auto shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800">
            <DialogHeader className="mb-6 shrink-0">
              <DialogTitle className="text-xl">Create Payment Link</DialogTitle>
              <DialogDescription>
                Configure a hosted checkout page.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 flex-1 pr-1">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Product / Service Name *</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Masterclass Registration"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="desc" className="text-slate-700 dark:text-slate-300">Description <span className="text-slate-400 font-normal">(Optional)</span></Label>
                  <Input 
                    id="desc" 
                    placeholder="Brief details about what they are paying for"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="amount" className="text-slate-700 dark:text-slate-300">Amount *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                      <Input 
                        id="amount" 
                        type="number" 
                        placeholder="0.00" 
                        className="pl-7"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currency" className="text-slate-700 dark:text-slate-300">Currency</Label>
                    <Select value={formData.currency} onValueChange={(val) => setFormData({...formData, currency: val})}>
                      <SelectTrigger id="currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="THB">THB - Thai Baht</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2">
                   <Label className="text-slate-700 dark:text-slate-300 mb-3 block">Payment Methods Included</Label>
                   <div className="grid grid-cols-2 gap-3">
                     <Card className={`cursor-pointer border transition-colors ${formData.methods.stripe ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'}`} onClick={() => setFormData(p => ({...p, methods: {...p.methods, stripe: !p.methods.stripe}}))}>
                       <CardContent className="p-3 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <CreditCard className={`w-4 h-4 ${formData.methods.stripe ? 'text-primary' : 'text-slate-500'}`} />
                           <span className="text-sm font-medium">Stripe</span>
                         </div>
                         <Checkbox checked={formData.methods.stripe} />
                       </CardContent>
                     </Card>
                     
                     <Card className={`cursor-pointer border transition-colors ${formData.methods.paypal ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'}`} onClick={() => setFormData(p => ({...p, methods: {...p.methods, paypal: !p.methods.paypal}}))}>
                       <CardContent className="p-3 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Pay</span>
                           <span className="text-sm font-medium">PayPal</span>
                         </div>
                         <Checkbox checked={formData.methods.paypal} />
                       </CardContent>
                     </Card>
                     
                     <Card className={`cursor-pointer border transition-colors ${formData.methods.promptpay ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'}`} onClick={() => setFormData(p => ({...p, methods: {...p.methods, promptpay: !p.methods.promptpay}}))}>
                       <CardContent className="p-3 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <QrCode className={`w-4 h-4 ${formData.methods.promptpay ? 'text-primary' : 'text-slate-500'}`} />
                           <span className="text-sm font-medium">PromptPay</span>
                         </div>
                         <Checkbox checked={formData.methods.promptpay} />
                       </CardContent>
                     </Card>
                     
                     <Card className={`cursor-pointer border transition-colors ${formData.methods.crypto ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800'}`} onClick={() => setFormData(p => ({...p, methods: {...p.methods, crypto: !p.methods.crypto}}))}>
                       <CardContent className="p-3 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <Bitcoin className={`w-4 h-4 ${formData.methods.crypto ? 'text-primary' : 'text-slate-500'}`} />
                           <span className="text-sm font-medium">Crypto</span>
                         </div>
                         <Checkbox checked={formData.methods.crypto} />
                       </CardContent>
                     </Card>
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-slate-900 dark:text-slate-100 font-semibold mb-0.5 block">Require Customer Address</Label>
                      <p className="text-xs text-slate-500">Ask for billing and shipping address at checkout.</p>
                    </div>
                    <Switch />
                  </div>
                </div>
                
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-slate-900 dark:text-slate-100 font-semibold mb-0.5 block">Limit quantity</Label>
                      <p className="text-xs text-slate-500">Set a maximum number of payments for this link.</p>
                    </div>
                    <Switch />
                  </div>
                </div>

                <div className="pt-4">
                  <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs uppercase tracking-wider mb-3 block">Post-Payment Actions</Label>
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <Label className="text-xs text-slate-500">Success URL Redirect (Optional)</Label>
                      <Input placeholder="https://yourwebsite.com/success" className="h-9 text-sm" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="pt-6 shrink-0 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between gap-3 bg-white dark:bg-slate-950">
              <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmitCreate} disabled={isSubmitting || !formData.name || !formData.amount}>
                {isSubmitting ? 'Creating…' : 'Create Link'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Preview Side */}
          <div className="flex-1 bg-slate-100 p-6 sm:p-10 flex flex-col items-center justify-center relative min-h-[400px]">
            <div className="absolute inset-0 pattern-dots text-slate-200" style={{ backgroundSize: '24px 24px', backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)' }}></div>
            
            <div className="relative w-full max-w-[340px] bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-200">
              {/* Fake Browser Headers/Phone cutouts could go here */}
              <div className="p-6 pb-8">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl mb-6 shadow-sm flex items-center justify-center">
                  <span className="text-xl font-bold text-white">F</span>
                </div>
                <div className="text-slate-500 text-sm font-medium mb-1">{localStorage.getItem('companyName') || 'FinTrust Inc.'}</div>
                <h2 className="text-xl font-bold text-slate-900 mb-6 leading-tight break-words">
                  {formData.name || 'Product / Service Name'}
                </h2>
                
                <div className="text-3xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-8 flex items-baseline gap-1">
                  <span className="text-xl text-slate-500">$</span>
                  {formData.amount || '0.00'}
                  <span className="text-lg font-normal text-slate-500 ml-1 uppercase">{formData.currency}</span>
                </div>

                <div className="space-y-3">
                  <Button className="w-full h-11 text-base shadow-md hover:shadow-lg transition-all" size="lg">
                    Pay {formData.amount ? `$${formData.amount}` : ''}
                  </Button>
                  
                  <div className="flex items-center gap-2 justify-center py-2">
                    {formData.methods.stripe && <CreditCard className="w-5 h-5 text-slate-300" />}
                    {formData.methods.paypal && <span className="text-xs font-bold text-slate-300">PayPal</span>}
                    {formData.methods.crypto && <Bitcoin className="w-4 h-4 text-slate-300" />}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-medium">
                Powered by FinTrust securely.
              </div>
            </div>
            
            <Badge className="absolute top-4 right-4 bg-white text-slate-600 border-slate-200 shadow-sm pointer-events-none hover:bg-white">
              <Smartphone className="w-3 h-3 mr-1" /> Live Preview
            </Badge>
          </div>
          
        </DialogContent>
      </Dialog>
    </div>
  );
}
