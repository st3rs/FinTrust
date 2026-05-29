import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Calendar, 
  Receipt, 
  PlusCircle, 
  X, 
  Building2, 
  CreditCard,
  Building,
  QrCode,
  ArrowRight
} from 'lucide-react';

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [items, setItems] = useState([{ description: '', quantity: 10, price: 150 }]);
  const [loading, setLoading] = useState(false);

  // Default selections based on screenshot
  const [client, setClient] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDateType, setDueDateType] = useState('Net 30');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(10);
  
  const [paymentMethods, setPaymentMethods] = useState({
    card: true,
    ach: false,
    qr: true
  });

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const tax = subtotal * (taxRate / 100);
  const totalAmount = subtotal + tax;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    // Simulate save
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
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
        <div className="max-w-5xl mx-auto px-8 relative h-20 flex items-center justify-between">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -mt-2 -z-10 mx-16"></div>
            <div className="absolute top-1/2 left-0 w-1/3 h-0.5 bg-indigo-600 -mt-2 -z-10 mx-16"></div>
            
            <div className="flex flex-col items-center gap-1 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">1</div>
              <span className="text-xs font-bold text-slate-900">Details</span>
            </div>
            
            <div className="flex flex-col items-center gap-1 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">2</div>
              <span className="text-xs font-semibold text-slate-500">Items</span>
            </div>

            <div className="flex flex-col items-center gap-1 bg-white px-2">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">3</div>
              <span className="text-xs font-semibold text-slate-500">Review</span>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 font-sans">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create New Invoice</h1>
          <p className="text-slate-500">Draft a new professional invoice for your client.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm shadow-slate-200/50 shadow-sm overflow-hidden relative mb-12">
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
                    <label className="text-sm font-semibold text-slate-900">Select Client *</label>
                    <select 
                      value={client}
                      onChange={e => setClient(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                      <option value="" disabled>Choose a client...</option>
                      <option value="test">Acme Corp</option>
                    </select>
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
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-3 border-b border-slate-200 items-center relative group bg-white">
                      <div className="col-span-1 sm:col-span-6">
                         <input 
                           type="text" 
                           placeholder="Service description..." 
                           value={item.description}
                           onChange={(e) => updateItem(index, 'description', e.target.value)}
                           className="w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                         />
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                         <input 
                           type="number" 
                           min="1"
                           value={item.quantity || ''}
                           onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                           className="w-full border border-slate-200 rounded px-2 py-2 text-sm text-center focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                         />
                      </div>
                      <div className="col-span-1 sm:col-span-2 relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                         <input 
                           type="number" 
                           min="0"
                           step="0.01"
                           value={item.price || ''}
                           onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                           className="w-full border border-slate-200 rounded pl-6 pr-2 py-2 text-sm text-right focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                         />
                      </div>
                      <div className="col-span-1 sm:col-span-2 text-right pr-8 sm:pr-4 font-medium text-slate-900 text-sm">
                         ${(item.quantity * item.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      
                      {items.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeItem(index)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
                   className="px-6 py-2.5 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm"
                 >
                   Save Draft
                 </button>
                 <button 
                   type="button"
                   onClick={handleSubmit}
                   disabled={loading}
                   className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm"
                 >
                   {loading ? 'Saving...' : 'Continue to Review'}
                   {!loading && <ArrowRight className="w-4 h-4" />}
                 </button>
              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

