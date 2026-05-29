import React, { useState, useRef } from 'react';
import { Download, Search, MoreHorizontal, UserPlus, Filter, FileSpreadsheet, ChevronDown, ChevronRight, FileText, Upload, Image as ImageIcon, X, Users, UserCheck, TrendingUp, TrendingDown, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion } from 'motion/react';
import { generatePromptPayQRBase64 } from '@/src/lib/promptpay';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock data for clients
const INITIAL_CLIENTS = [
  { id: '1', name: 'Acme Corp', email: 'billing@acme.corp', contactPerson: 'Jane Doe', status: 'Active', joinedDate: '2025-01-15', totalBilled: 12500, phone: '+1 555-0198', logoUrl: '' },
  { id: '2', name: 'Global Tech', email: 'accounts@globaltech.com', contactPerson: 'John Smith', status: 'Active', joinedDate: '2025-03-22', totalBilled: 8400, phone: '+1 555-0234', logoUrl: '' },
  { id: '3', name: 'Nexus Industries', email: 'finance@nexus.ind', contactPerson: 'Alice Johnson', status: 'Inactive', joinedDate: '2024-11-05', totalBilled: 4200, phone: '+1 555-0345', logoUrl: '' },
  { id: '4', name: 'Stark Enterprises', email: 'tony@stark.com', contactPerson: 'Tony Stark', status: 'Active', joinedDate: '2026-02-10', totalBilled: 25000, phone: '+1 555-0456', logoUrl: '' },
  { id: '5', name: 'Wayne Corp', email: 'bruce@wayne.corp', contactPerson: 'Bruce Wayne', status: 'Active', joinedDate: '2026-04-01', totalBilled: 50000, phone: '+1 555-0567', logoUrl: '' },
];

const CLIENT_INVOICES: Record<string, any[]> = {
  '1': [
    { id: 'INV-1045', date: '2025-05-15', amount: 5000, status: 'Paid', dueDate: '2025-05-30' },
    { id: 'INV-1046', date: '2025-06-20', amount: 7500, status: 'Overdue', dueDate: '2025-07-05' }
  ],
  '2': [
    { id: 'INV-1080', date: '2025-04-10', amount: 8400, status: 'Paid', dueDate: '2025-04-25' }
  ],
  '3': [
    { id: 'INV-0922', date: '2024-12-01', amount: 4200, status: 'Paid', dueDate: '2024-12-15' }
  ],
  '4': [
    { id: 'INV-1102', date: '2026-03-15', amount: 15000, status: 'Paid', dueDate: '2026-03-30' },
    { id: 'INV-1135', date: '2026-04-22', amount: 10000, status: 'Pending', dueDate: '2026-05-07' }
  ],
  '5': [
    { id: 'INV-1140', date: '2026-04-10', amount: 25000, status: 'Paid', dueDate: '2026-04-25' },
    { id: 'INV-1152', date: '2026-05-02', amount: 25000, status: 'Paid', dueDate: '2026-05-17' }
  ]
};

export default function Clients() {
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', contactPerson: '', phone: '', logoUrl: '' });
  const [qrModalClient, setQrModalClient] = useState<any | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalClients = clients.length;
  const activeClients = clients.filter(client => client.status === 'Active').length;

  const handleGenerateQR = async (client: any) => {
    try {
      setQrModalClient(client);
      const url = await generatePromptPayQRBase64('0812345678', client.totalBilled);
      setQrCodeDataUrl(url);
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      console.log('Loading file...')
      reader.onloadend = () => {
        setNewClient({ ...newClient, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewClient({ ...newClient, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    const id = (clients.length + 1).toString();
    const createdClient = {
      id,
      ...newClient,
      status: 'Active',
      joinedDate: new Date().toISOString().split('T')[0],
      totalBilled: 0
    };
    setClients([createdClient, ...clients]);
    setIsAddModalOpen(false);
    setNewClient({ name: '', email: '', contactPerson: '', phone: '', logoUrl: '' });
  };

  const handleExportCSV = () => {
    // Define CSV headers
    const headers = ['Client ID', 'Company Name', 'Contact Person', 'Email', 'Phone', 'Status', 'Joined Date', 'Total Billed (USD)'];
    
    // Map clients to CSV rows
    const rows = filteredClients.map(client => [
      client.id,
      `"${client.name}"`, // Quote strings that might contain commas
      `"${client.contactPerson}"`,
      `"${client.email}"`,
      `"${client.phone}"`,
      client.status,
      client.joinedDate,
      client.totalBilled
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Clients</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your customer relationships and billing contacts.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Download className="w-4 h-4 mr-2" />
            Export Clients
          </Button>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger render={
              <Button className="shadow-sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Enter the details of the new client organization.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4 py-4">
                <div className="flex flex-col items-center justify-center gap-4">
                  <div
                    className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center overflow-hidden cursor-pointer relative group transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      id="logo-upload"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    {newClient.logoUrl ? (
                      <React.Fragment>
                        <img src={newClient.logoUrl} alt="Client logo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                      </React.Fragment>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center text-slate-500 dark:text-slate-400">
                        <ImageIcon className="w-6 h-6 mb-1 text-slate-400" />
                        <span className="text-[10px] uppercase font-semibold">Upload Logo</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input 
                    id="companyName" 
                    value={newClient.name}
                    onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                    required 
                    placeholder="Acme Corp" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input 
                      id="contactPerson" 
                      value={newClient.contactPerson}
                      onChange={(e) => setNewClient({...newClient, contactPerson: e.target.value})}
                      required 
                      placeholder="Jane Doe" 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input 
                      id="contactPhone" 
                      value={newClient.phone}
                      onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                      placeholder="+1 (555) 000-0000" 
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Email Address</Label>
                  <Input 
                    id="contactEmail" 
                    type="email" 
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    required 
                    placeholder="billing@acme.corp" 
                  />
                </div>
                
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Add Client
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Clients</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{totalClients}</span>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12% from last month
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Clients</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{activeClients}</span>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +5% from last month
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4 justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search clients by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <Button variant="outline" className="w-full sm:w-auto h-9">
            <Filter className="w-4 h-4 mr-2 text-slate-500" />
            Filter
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="w-[200px]">Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead className="text-right">Total Billed</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <React.Fragment key={client.id}>
                    <TableRow 
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${expandedRows.has(client.id) ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}
                    >
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => toggleRow(client.id)}
                        >
                          {expandedRows.has(client.id) ? (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <motion.div 
                            whileHover={{ scale: 1.1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            title={client.name}
                            className="cursor-pointer"
                          >
                            {client.logoUrl ? (
                              <img src={client.logoUrl} alt={client.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-800" />
                            ) : (
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 tabular-nums text-white"
                                style={{
                                  backgroundColor: `hsl(${client.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360}, 65%, 55%)`
                                }}
                              >
                                {client.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </motion.div>
                          <div>
                            <div className="font-medium">{client.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-slate-900 dark:text-slate-200">{client.contactPerson}</div>
                          <div className="text-slate-500 dark:text-slate-400 text-xs">{client.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={client.status === 'Active' ? 'default' : 'secondary'}
                          className={client.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}
                        >
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {new Date(client.joinedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900 dark:text-slate-200">
                        ${client.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Edit Client</DropdownMenuItem>
                            <DropdownMenuItem>Create Invoice</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateQR(client)}>
                              <QrCode className="w-4 h-4 mr-2 text-indigo-500" />
                              Generate QR
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(client.id) && (
                      <TableRow className="bg-slate-50/30 dark:bg-slate-900/30">
                        <TableCell colSpan={7} className="p-0 border-b-0">
                          <div className="p-4 pl-14">
                            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
                                <FileText className="w-4 h-4 text-slate-500" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Past Invoices</span>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[120px] text-xs">Invoice #</TableHead>
                                    <TableHead className="text-xs">Date</TableHead>
                                    <TableHead className="text-xs">Due Date</TableHead>
                                    <TableHead className="text-xs">Amount</TableHead>
                                    <TableHead className="text-right text-xs">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(CLIENT_INVOICES[client.id] || []).map((invoice) => (
                                    <TableRow key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                      <TableCell className="font-medium text-sm text-primary">{invoice.id}</TableCell>
                                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{invoice.date}</TableCell>
                                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">{invoice.dueDate}</TableCell>
                                      <TableCell className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                        ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            invoice.status === 'Paid' ? 'border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:bg-emerald-900/20' : 
                                            invoice.status === 'Overdue' ? 'border-red-200 text-red-700 bg-red-50 dark:border-red-900 dark:text-red-400 dark:bg-red-900/20' :
                                            'border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:bg-amber-900/20'
                                          }`}
                                        >
                                          {invoice.status}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {(!CLIENT_INVOICES[client.id] || CLIENT_INVOICES[client.id].length === 0) && (
                                    <TableRow>
                                      <TableCell colSpan={5} className="h-20 text-center text-sm text-slate-500 dark:text-slate-400">
                                        No invoices found for this client.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500 dark:text-slate-400">
                    No clients found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!qrModalClient} onOpenChange={(open) => !open && setQrModalClient(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              Scan this PromptPay QR code to collect payment for <b className="text-slate-900 dark:text-slate-100">{qrModalClient?.name}</b>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            {qrCodeDataUrl ? (
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <img src={qrCodeDataUrl} alt="PromptPay QR Code" className="w-48 h-48 rounded" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-xl" />
            )}
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Amount Owed</p>
              <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                ${qrModalClient?.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center max-w-[250px]">
              Supported via PromptPay participating banks and applications.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setQrModalClient(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
