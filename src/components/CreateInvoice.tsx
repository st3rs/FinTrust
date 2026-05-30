import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  User, 
  Receipt, 
  PlusCircle, 
  X, 
  Building2, 
  CreditCard,
  Building,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Download,
  Send,
  Eye,
  Printer
} from 'lucide-react';

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [items, setItems] = useState([{ description: '', quantity: 1, price: 0 }]);
  const [loading, setLoading] = useState(false);

  // Default selections based on screenshot
  const [client, setClient] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDateType, setDueDateType] = useState('Net 30');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(10);
  
  const [CompanyIssuer] = useState(localStorage.getItem('companyName') || 'FinTrust Corp.');
  const [paymentMethods, setPaymentMethods] = useState({
    card: true,
    ach: false,
    qr: true
  });

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const tax = subtotal * (taxRate / 100);
  const totalAmount = subtotal + tax;

  const handleContinueToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      const generatedId = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const { error } = await supabase.from('invoices').insert({
        id: generatedId,
        client: client || 'Acme Corp',
        amount: totalAmount,
        date: invoiceDate || new Date().toISOString().split('T')[0],
        status: 'UNPAID',
        due_date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        user_id: user?.id,
        metadata: { items, notes, taxRate }
      });

      if (error) throw error;
      
      navigate('/invoices');
    } catch(err) {
      console.error('Save error', err);
      // Fallback
      setTimeout(() => {
        navigate('/invoices');
      }, 1000);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const invoiceId = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Add title
    doc.setFontSize(22);
    doc.text('INVOICE', 20, 20);
    
    // Add Company Issuer
    doc.setFontSize(12);
    doc.text(CompanyIssuer, 20, 30);
    doc.setFontSize(10);
    doc.text('123 Financial Ave, Suite 100', 20, 35);
    doc.text('San Francisco, CA 94107', 20, 40);
    
    // Add invoice info aligned right
    const pageWidth = doc.internal.pageSize.width;
    doc.text(`Invoice Number: ${invoiceId}`, pageWidth - 20, 20, { align: 'right' });
    doc.text(`Date: ${invoiceDate || new Date().toLocaleDateString()}`, pageWidth - 20, 25, { align: 'right' });
    doc.text(`Due Date: ${dueDateType}`, pageWidth - 20, 30, { align: 'right' });
    doc.text(`Status: UNPAID`, pageWidth - 20, 35, { align: 'right' });
    
    // Add client info
    doc.setFontSize(12);
    doc.text('Bill To:', 20, 55);
    doc.setFontSize(10);
    doc.text(client || 'Acme Corp', 20, 60);
    
    // Add table
    const tableBody = items.map(item => [
      item.description || 'Item Description',
      item.quantity.toString(),
      `$${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `$${(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Description', 'Qty', 'Price', 'Amount']],
      body: tableBody,
      foot: [
        ['', '', 'Subtotal', `$${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
        ['', '', `Tax (${taxRate}%)`, `$${tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
        ['', '', 'Total', `$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] }
    });

    if (notes) {
      // @ts-ignore - lastAutoTable exists on jsPDF instance
      const finalY = doc.lastAutoTable.finalY || 100;
      doc.setFontSize(10);
      doc.text('Notes:', 20, finalY + 10);
      doc.setFontSize(9);
      doc.text(notes, 20, finalY + 15, { maxWidth: pageWidth - 40 });
    }
    
    // Save the PDF
    doc.save(`${invoiceId}.pdf`);
  };

  const addItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
  
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 w-full bg-[#f8f9ff]">
      {/* Progress Stepper */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 hidden sm:block">
        <div className="max-w-3xl mx-auto px-8 relative h-20 flex items-center justify-between">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -mt-2 -z-10 mx-16"></div>
            <div className={`absolute top-1/2 left-0 h-0.5 bg-indigo-600 -mt-2 -z-10 mx-16 transition-all duration-500 ease-in-out ${step === 2 ? 'w-full' : 'w-1/2'}`}></div>
            
            <div className="flex flex-col items-center gap-1 bg-white px-2 cursor-pointer" onClick={() => setStep(1)}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-transform hover:scale-110 ${step === 1 ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-800 text-white shadow-slate-300'}`}>1</div>
              <span className={`text-xs font-bold ${step === 1 ? 'text-indigo-600' : 'text-slate-900'}`}>Compose</span>
            </div>
            
            <div className="flex flex-col items-center gap-1 bg-white px-2 cursor-pointer" onClick={() => { if (step === 1) setStep(2); }}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 hover:scale-110 ${step === 2 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white border-2 border-slate-200 text-slate-500'}`}>2</div>
              <span className={`text-xs font-semibold ${step === 2 ? 'text-indigo-600' : 'text-slate-500'}`}>Preview & Send</span>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 font-sans">
        
        {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Create New Invoice</h1>
              <p className="text-slate-500">Draft a new professional invoice for your client.</p>
            </div>
            <button 
              type="button"
              onClick={(e) => handleContinueToReview(e as any)}
              className="hidden sm:flex px-4 py-2 bg-slate-100 text-indigo-600 font-medium rounded-lg hover:bg-slate-200 transition-colors items-center gap-2 text-sm"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>

          <form onSubmit={handleContinueToReview}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 overflow-hidden relative mb-12 transform transition-all">
              {/* Top blue accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600"></div>
            
            <div className="p-8 sm:p-10 space-y-12">
              
              {/* Client Details */}
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                  <User className="text-indigo-600 w-5 h-5" />
                  Client Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">Client Name *</label>
                    <input 
                      type="text"
                      list="clients-list"
                      placeholder="Select or enter client name..."
                      value={client}
                      onChange={e => setClient(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      required
                    />
                    <datalist id="clients-list">
                      <option value="Acme Corp" />
                      <option value="Global Tech" />
                      <option value="Nexus Industries" />
                      <option value="Stark Enterprises" />
                      <option value="Wayne Corp" />
                    </datalist>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">Invoice Date</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={invoiceDate}
                        onChange={e => setInvoiceDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white appearance-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">Due Date</label>
                    <select 
                      value={dueDateType}
                      onChange={e => setDueDateType(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                      <option value="Net 30">Net 30</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Due on receipt">Due on receipt</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-900">Invoice Number</label>
                    <input 
                      type="text" 
                      readOnly 
                      value="INV-2023-0042" 
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500 focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </section>

              {/* Line Items */}
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                  <Receipt className="text-indigo-600 w-5 h-5" />
                  Line Items
                </h3>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 bg-slate-50 p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:grid">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Rate</div>
                    <div className="col-span-2 text-right pr-4">Amount</div>
                  </div>

                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-2 sm:grid-cols-12 gap-4 p-3 border-b border-slate-200 items-center relative group bg-white">
                      <div className="col-span-2 sm:col-span-6">
                         <label className="text-xs font-semibold text-slate-500 mb-1 block sm:hidden">Description</label>
                         <input 
                           type="text" 
                           placeholder="Service description..." 
                           value={item.description}
                           onChange={(e) => updateItem(index, 'description', e.target.value)}
                           className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                         />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                         <label className="text-xs font-semibold text-slate-500 mb-1 block sm:hidden">Qty</label>
                         <input 
                           type="number" 
                           min="1"
                           value={item.quantity || ''}
                           onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                           className="w-full border border-slate-200 rounded px-2 py-2 text-sm sm:text-center focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                         />
                      </div>
                      <div className="col-span-1 sm:col-span-2 relative">
                         <label className="text-xs font-semibold text-slate-500 mb-1 block sm:hidden">Rate</label>
                         <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                           <input 
                             type="number" 
                             min="0"
                             step="0.01"
                             value={item.price || ''}
                             onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                             className="w-full border border-slate-200 rounded pl-6 pr-2 py-2 text-sm sm:text-right focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                           />
                         </div>
                      </div>
                      <div className="col-span-2 sm:col-span-2 sm:text-right pr-8 sm:pr-4 font-medium text-slate-900 text-sm flex items-center justify-between sm:block">
                         <span className="text-xs font-semibold text-slate-500 sm:hidden">Amount</span>
                         ${(item.quantity * item.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      
                      {items.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeItem(index)}
                          className="absolute right-3 top-2 sm:top-1/2 sm:-translate-y-1/2 text-slate-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="p-3 bg-slate-50/50">
                    <button 
                      type="button" 
                      onClick={addItem}
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Add Line Item
                    </button>
                  </div>
                </div>
              </section>

              {/* Totals & Notes */}
              <section className="flex flex-col md:flex-row justify-between gap-8 pt-4 border-t border-slate-200">
                <div className="w-full md:w-1/2">
                   <label className="text-sm font-semibold text-slate-900 block mb-2">Client Notes</label>
                   <textarea 
                     rows={4}
                     placeholder="Thank you for your business..."
                     value={notes}
                     onChange={e => setNotes(e.target.value)}
                     className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none bg-white"
                   ></textarea>
                </div>

                <div className="w-full md:w-[35%] bg-slate-50 rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 p-6 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-3 text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4 text-sm text-slate-600 gap-2">
                    <div className="flex items-center gap-2">
                      <span>Tax</span>
                      <div className="flex items-center bg-white border border-slate-200 rounded">
                        <input 
                          type="number"
                          value={taxRate}
                          onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="w-12 text-right p-1 focus:outline-none rounded text-sm"
                        />
                      </div>
                      <span>%</span>
                    </div>
                    <span>${tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="border-t border-slate-200 mt-1 mb-4"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-slate-900">Total</span>
                    <span className="text-2xl font-bold text-slate-900">${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </section>

              {/* Payment Settings */}
              <section className="space-y-6 pt-6 border-t border-slate-200">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 pb-1">
                    <Building2 className="text-indigo-600 w-5 h-5" />
                    Payment Settings
                  </h3>
                  <p className="text-sm text-slate-500">Select how you want to be paid for this invoice.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Credit Card */}
                  <label className={`relative border rounded-xl p-4 flex gap-3 cursor-pointer transition-colors ${
                    paymentMethods.card ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 mt-1 border-slate-300 rounded text-indigo-600 focus:ring-indigo-600"
                      checked={paymentMethods.card}
                      onChange={e => setPaymentMethods({...paymentMethods, card: e.target.checked})}
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1">
                        <CreditCard className="w-4 h-4" /> Credit Card
                      </div>
                      <div className="text-xs text-slate-500">2.9% + 30¢ fee</div>
                    </div>
                    {paymentMethods.card && (
                      <div className="absolute top-0 right-0 w-0 h-0 border-t-[28px] border-t-indigo-600 border-l-[28px] border-l-transparent rounded-tr-xl">
                        <svg className="absolute -top-[24px] right-1 w-3 h-3 text-white stroke-[4]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </label>

                  {/* ACH Transfer */}
                  <label className={`relative border rounded-xl p-4 flex gap-3 cursor-pointer transition-colors ${
                    paymentMethods.ach ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 mt-1 border-slate-300 rounded text-indigo-600 focus:ring-indigo-600"
                      checked={paymentMethods.ach}
                      onChange={e => setPaymentMethods({...paymentMethods, ach: e.target.checked})}
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1">
                        <Building className="w-4 h-4" /> ACH Transfer
                      </div>
                      <div className="text-xs text-slate-500">1% fee (Max $15)</div>
                    </div>
                    {paymentMethods.ach && (
                      <div className="absolute top-0 right-0 w-0 h-0 border-t-[28px] border-t-indigo-600 border-l-[28px] border-l-transparent rounded-tr-xl">
                        <svg className="absolute -top-[24px] right-1 w-3 h-3 text-white stroke-[4]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </label>

                  {/* Link / QR Code */}
                  <label className={`relative border rounded-xl p-4 flex gap-3 cursor-pointer transition-colors ${
                    paymentMethods.qr ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 mt-1 border-slate-300 rounded text-indigo-600 focus:ring-indigo-600"
                      checked={paymentMethods.qr}
                      onChange={e => setPaymentMethods({...paymentMethods, qr: e.target.checked})}
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5 mb-1">
                        <QrCode className="w-4 h-4" /> Link / QR Code
                      </div>
                      <div className="text-xs text-slate-500">Client pays via portal</div>
                    </div>
                    {paymentMethods.qr && (
                      <div className="absolute top-0 right-0 w-0 h-0 border-t-[28px] border-t-indigo-600 border-l-[28px] border-l-transparent rounded-tr-xl">
                        <svg className="absolute -top-[24px] right-1 w-3 h-3 text-white stroke-[4]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </label>
                </div>
              </section>
               {/* Actions */}
              <div className="pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
                 <button 
                   type="button"
                   onClick={() => navigate('/dashboard')}
                   className="w-full sm:w-auto px-6 py-2.5 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm"
                 >
                   Save Draft
                 </button>
                 <button 
                   type="submit"
                   className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm"
                 >
                   Continue to Review
                   <ArrowRight className="w-4 h-4" />
                 </button>
              </div>

            </div>
          </div>
        </form>
        </div>
        )}

        {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <button onClick={() => setStep(1)} className="flex items-center text-sm text-slate-500 hover:text-slate-900 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Edit
                </button>
                <div className="flex space-x-3">
                    <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg text-sm font-medium transition-colors flex items-center">
                        <Printer className="w-4 h-4 mr-2" /> Generate PDF Preview
                    </button>
                    <button onClick={generatePDF} className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center text-slate-700">
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                    </button>
                    <button onClick={handleSend} disabled={loading} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center">
                        {loading ? 'Sending...' : <><Send className="w-4 h-4 mr-2" /> Send Invoice</>}
                    </button>
                </div>
            </div>

            <div id="printable-invoice-card" className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-10 md:p-14 w-full relative overflow-hidden">
                {/* watermark / decorative */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-bl-[100px] -z-10"></div>
                
                <div className="flex justify-between items-start border-b border-slate-100 pb-10 mb-10">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">INVOICE</h1>
                        <p className="text-slate-500 font-medium tracking-wide">INV-2023-0042</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="w-14 h-14 bg-slate-900 rounded-xl mb-4 flex items-center justify-center text-white font-bold text-xl shadow-md uppercase">
                          {CompanyIssuer.substring(0, 2)}
                        </div>
                        <p className="font-bold text-slate-900">{CompanyIssuer}</p>
                        <p className="text-slate-500 text-sm mt-1">123 Financial Ave, Suite 100</p>
                        <p className="text-slate-500 text-sm">San Francisco, CA 94107</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between mb-12 gap-8">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Billed To</p>
                        <p className="font-bold text-slate-900 text-lg">{client || 'Acme Corp'}</p>
                        <p className="text-slate-500 text-sm mt-1">Client Address Details Here</p>
                    </div>
                    <div className="text-left sm:text-right space-y-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date Issued</p>
                            <p className="font-medium text-slate-900">{invoiceDate || new Date().toISOString().split('T')[0]}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
                            <p className="font-medium text-slate-900">{dueDateType}</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse mb-8 min-w-[500px]">
                      <thead>
                          <tr className="border-y-2 border-slate-100 text-sm text-slate-900">
                              <th className="py-4 font-bold uppercase tracking-wider text-xs text-slate-500 pl-4">Description</th>
                              <th className="py-4 font-bold uppercase tracking-wider text-xs text-slate-500 text-center">Qty</th>
                              <th className="py-4 font-bold uppercase tracking-wider text-xs text-slate-500 text-right">Price</th>
                              <th className="py-4 font-bold uppercase tracking-wider text-xs text-slate-500 text-right pr-4">Amount</th>
                          </tr>
                      </thead>
                      <tbody className="text-slate-700 text-sm">
                          {items.map((item, i) => (
                              <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                  <td className="py-5 font-medium text-slate-900 pl-4">{item.description || 'Item Description'}</td>
                                  <td className="py-5 text-center text-slate-600">{item.quantity}</td>
                                  <td className="py-5 text-right text-slate-600">${item.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                  <td className="py-5 text-right font-medium text-slate-900 pr-4">${(item.quantity * item.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                </div>

                <div className="flex justify-end mb-12 mt-4 pr-4">
                    <div className="w-full sm:w-1/2 max-w-sm space-y-4 text-sm">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span className="font-medium text-slate-900">${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 pb-4 border-b border-slate-100">
                            <span>Tax ({taxRate}%)</span>
                            <span className="font-medium text-slate-900">${tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-slate-900 items-end pt-2">
                            <span>Total Due</span>
                            <span className="text-3xl text-indigo-600">${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row gap-8 bg-slate-50/50 -mx-10 md:-mx-14 px-10 md:px-14 pb-10 md:pb-14 -mb-10 md:-mb-14">
                    {notes && (
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Notes</p>
                            <p className="text-sm text-slate-600 italic leading-relaxed">"{notes}"</p>
                        </div>
                    )}
                    <div className="flex-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Payment Options</p>
                        <div className="flex flex-wrap gap-2">
                            {paymentMethods.card && <div className="flex items-center text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-md shadow-sm"><CreditCard className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Credit Card</div>}
                            {paymentMethods.ach && <div className="flex items-center text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-md shadow-sm"><Building className="w-3.5 h-3.5 mr-2 text-indigo-500" /> ACH Transfer</div>}
                            {paymentMethods.qr && <div className="flex items-center text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-md shadow-sm"><QrCode className="w-3.5 h-3.5 mr-2 text-indigo-500" /> PromptPay QR</div>}
                        </div>
                    </div>
                </div>

                {/* Stamp effect */}
                <div className="absolute top-40 mx-auto right-10 bottom-0 pointer-events-none flex items-center justify-center -z-10 opacity-30 mix-blend-multiply">
                    <div className="border-4 border-indigo-600/40 text-indigo-600/40 font-black text-6xl uppercase tracking-[0.2em] px-8 py-4 rotate-[-15deg] rounded-xl shadow-sm">
                        DRAFT
                    </div>
                </div>
            </div>
        </div>
        )}
      </div>
    </div>
  );
}

