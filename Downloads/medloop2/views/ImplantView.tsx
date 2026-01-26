
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { ImplantService, ClinicService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole, ImplantItem, ImplantOrder, ImplantOrderStatus, Clinic } from '../types';

const ImplantView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // State
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [orders, setOrders] = useState<ImplantOrder[]>([]);
  const [inventory, setInventory] = useState<ImplantItem[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  
  // Forms
  const [orderForm, setOrderForm] = useState({
      clinicId: '', itemId: '', quantity: 1, requiredDate: '', notes: ''
  });
  const [stockForm, setStockForm] = useState({
      brand: '', type: '', size: '', quantity: 0, minThreshold: 5
  });

  const isManager = user?.role === UserRole.ADMIN || user?.role === UserRole.IMPLANT_MANAGER;

  const fetchData = async () => {
      if(!user) return;
      setIsLoading(true);
      try {
          const [ords, inv, clins] = await Promise.all([
              ImplantService.getOrders(user),
              ImplantService.getInventory(user),
              ClinicService.getActive()
          ]);
          setOrders(ords);
          setInventory(inv);
          // Only show patient clinics as options for ordering
          setClinics(clins.filter(c => c.category === 'clinic')); 
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [user]);

  // -- Handlers --

  const handleCreateOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!user) return;
      
      const selectedItem = inventory.find(i => i.id === orderForm.itemId);
      const selectedClinic = clinics.find(c => c.id === orderForm.clinicId);
      
      if (!selectedItem || !selectedClinic) return;

      try {
          await ImplantService.createOrder(user, {
              clinicId: selectedClinic.id,
              clinicName: selectedClinic.name,
              doctorId: user.uid,
              doctorName: user.name,
              itemId: selectedItem.id,
              brand: selectedItem.brand,
              type: selectedItem.type,
              size: selectedItem.size,
              quantity: Number(orderForm.quantity),
              requiredDate: new Date(orderForm.requiredDate).getTime(),
              notes: orderForm.notes
          });
          setIsOrderModalOpen(false);
          setOrderForm({ clinicId: '', itemId: '', quantity: 1, requiredDate: '', notes: '' });
          fetchData();
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleCreateStock = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!user) return;
      try {
          await ImplantService.addInventoryItem(user, {
              brand: stockForm.brand,
              type: stockForm.type,
              size: stockForm.size,
              quantity: Number(stockForm.quantity),
              minThreshold: Number(stockForm.minThreshold)
          });
          setIsStockModalOpen(false);
          setStockForm({ brand: '', type: '', size: '', quantity: 0, minThreshold: 5 });
          fetchData();
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: ImplantOrderStatus) => {
      if(!user) return;
      try {
          await ImplantService.updateOrderStatus(user, orderId, newStatus);
          fetchData();
      } catch (e: any) {
          alert(e.message);
      }
  };

  // Status Badge
  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
        'PENDING': 'bg-gray-100 text-gray-600',
        'IN_PRODUCTION': 'bg-blue-100 text-blue-700',
        'READY': 'bg-amber-100 text-amber-700',
        'DELIVERED': 'bg-emerald-100 text-emerald-700',
        'CANCELLED': 'bg-red-50 text-red-500'
    };
    return <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${colors[status] || 'bg-gray-100'}`}>{status.replace('_', ' ')}</span>;
  };

  // KPI Stats
  const kpiPending = orders.filter(o => o.status === 'PENDING').length;
  const kpiProduction = orders.filter(o => o.status === 'IN_PRODUCTION').length;
  const kpiReady = orders.filter(o => o.status === 'READY').length;
  const kpiDelivered = orders.filter(o => o.status === 'DELIVERED').length;
  const lowStockCount = inventory.filter(i => i.quantity <= i.minThreshold).length;

  return (
    <Layout title="Implant Logistics Company">
      <div className="flex flex-col gap-6">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Pending Orders</div>
                  <div className="text-2xl font-bold text-slate-700">{kpiPending}</div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Processing</div>
                  <div className="text-2xl font-bold text-blue-600">{kpiProduction}</div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Ready To Ship</div>
                  <div className="text-2xl font-bold text-amber-500">{kpiReady}</div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Delivered</div>
                  <div className="text-2xl font-bold text-emerald-600">{kpiDelivered}</div>
              </div>
              <div className={`p-4 rounded-xl shadow-sm border ${lowStockCount > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                  <div className={`text-[10px] font-bold uppercase ${lowStockCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>Low Stock Alerts</div>
                  <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>{lowStockCount}</div>
              </div>
          </div>

          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 min-h-[500px] flex flex-col overflow-hidden">
              
              {/* Tab Header */}
              <div className="flex border-b border-gray-100">
                  <button onClick={() => setActiveTab('orders')} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700'}`}>
                      Orders Registry
                  </button>
                  <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'inventory' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700'}`}>
                      Inventory & Stock
                  </button>
              </div>

              {/* Toolbar */}
              <div className="p-4 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700">{activeTab === 'orders' ? 'Manage Orders' : 'Stock Levels'}</h3>
                  <button 
                    onClick={() => activeTab === 'orders' ? setIsOrderModalOpen(true) : setIsStockModalOpen(true)}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 shadow-lg flex items-center gap-2"
                  >
                      <i className="fa-solid fa-plus"></i> {activeTab === 'orders' ? 'New Order' : 'Add Item'}
                  </button>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-auto p-4">
                  {isLoading ? <div className="text-center p-10 text-slate-400">Loading...</div> : (
                      <>
                        {activeTab === 'orders' && (
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Order ID</th>
                                        <th className="px-4 py-3">Clinic / Doctor</th>
                                        <th className="px-4 py-3">Item Details</th>
                                        <th className="px-4 py-3">Qty</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3">Required Date</th>
                                        <th className="px-4 py-3 rounded-r-lg text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {orders.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-slate-400 italic">No orders found.</td></tr> : 
                                      orders.map(order => (
                                          <tr key={order.id} className="hover:bg-slate-50">
                                              <td className="px-4 py-3 font-mono text-xs text-slate-400">{order.id.split('_')[2]}</td>
                                              <td className="px-4 py-3">
                                                  <div className="font-bold text-slate-800">{order.clinicName}</div>
                                                  <div className="text-xs text-slate-400">{order.doctorName}</div>
                                              </td>
                                              <td className="px-4 py-3">
                                                  <div className="font-bold text-slate-700">{order.brand} - {order.type}</div>
                                                  <div className="text-xs text-slate-500">{order.size}</div>
                                              </td>
                                              <td className="px-4 py-3 font-bold">{order.quantity}</td>
                                              <td className="px-4 py-3 text-center"><StatusBadge status={order.status} /></td>
                                              <td className="px-4 py-3 text-xs">{new Date(order.requiredDate).toLocaleDateString()}</td>
                                              <td className="px-4 py-3 text-end">
                                                  {isManager && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                                                      <div className="flex justify-end gap-1">
                                                          {order.status === 'PENDING' && <button onClick={() => handleStatusUpdate(order.id, 'IN_PRODUCTION')} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Start Production"><i className="fa-solid fa-gears"></i></button>}
                                                          {order.status === 'IN_PRODUCTION' && <button onClick={() => handleStatusUpdate(order.id, 'READY')} className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100" title="Mark Ready"><i className="fa-solid fa-box-open"></i></button>}
                                                          {order.status === 'READY' && <button onClick={() => handleStatusUpdate(order.id, 'DELIVERED')} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100" title="Mark Delivered"><i className="fa-solid fa-truck"></i></button>}
                                                          <button onClick={() => handleStatusUpdate(order.id, 'CANCELLED')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Cancel"><i className="fa-solid fa-ban"></i></button>
                                                      </div>
                                                  )}
                                              </td>
                                          </tr>
                                      ))
                                    }
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'inventory' && (
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Brand</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Size</th>
                                        <th className="px-4 py-3 text-center">Stock Level</th>
                                        <th className="px-4 py-3 rounded-r-lg text-end">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {inventory.length === 0 ? <tr><td colSpan={5} className="text-center py-10 text-slate-400 italic">Inventory empty.</td></tr> :
                                      inventory.map(item => (
                                          <tr key={item.id} className="hover:bg-slate-50">
                                              <td className="px-4 py-3 font-bold text-slate-800">{item.brand}</td>
                                              <td className="px-4 py-3">{item.type}</td>
                                              <td className="px-4 py-3 font-mono text-xs">{item.size}</td>
                                              <td className="px-4 py-3 text-center">
                                                  <span className={`px-3 py-1 rounded font-bold ${item.quantity <= item.minThreshold ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                      {item.quantity}
                                                  </span>
                                              </td>
                                              <td className="px-4 py-3 text-end">
                                                  {item.quantity <= item.minThreshold ? (
                                                      <span className="text-xs font-bold text-red-500 uppercase flex items-center justify-end gap-1"><i className="fa-solid fa-triangle-exclamation"></i> Low Stock</span>
                                                  ) : (
                                                      <span className="text-xs font-bold text-emerald-500 uppercase flex items-center justify-end gap-1"><i className="fa-solid fa-check"></i> OK</span>
                                                  )}
                                              </td>
                                          </tr>
                                      ))
                                    }
                                </tbody>
                            </table>
                        )}
                      </>
                  )}
              </div>
          </div>
      </div>

      {/* NEW ORDER MODAL */}
      {isOrderModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                  <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                      <h3 className="font-bold">Create New Order</h3>
                      <button onClick={() => setIsOrderModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clinic</label>
                          <select className="w-full p-2 border rounded" value={orderForm.clinicId} onChange={e => setOrderForm({...orderForm, clinicId: e.target.value})} required>
                              <option value="">-- Select Clinic --</option>
                              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Implant Item</label>
                          <select className="w-full p-2 border rounded" value={orderForm.itemId} onChange={e => setOrderForm({...orderForm, itemId: e.target.value})} required>
                              <option value="">-- Select from Inventory --</option>
                              {inventory.map(i => (
                                  <option key={i.id} value={i.id}>{i.brand} - {i.type} ({i.size}) [Stock: {i.quantity}]</option>
                              ))}
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                              <input type="number" min="1" className="w-full p-2 border rounded" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} required />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Required Date</label>
                              <input type="date" className="w-full p-2 border rounded" value={orderForm.requiredDate} onChange={e => setOrderForm({...orderForm, requiredDate: e.target.value})} required />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                          <textarea className="w-full p-2 border rounded h-20 resize-none" value={orderForm.notes} onChange={e => setOrderForm({...orderForm, notes: e.target.value})} placeholder="Special requests..."></textarea>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Submit Order</button>
                  </form>
              </div>
          </div>
      )}

      {/* NEW STOCK MODAL (Manager Only) */}
      {isStockModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                  <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                      <h3 className="font-bold">Add Inventory Item</h3>
                      <button onClick={() => setIsStockModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <form onSubmit={handleCreateStock} className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand</label>
                              <input type="text" className="w-full p-2 border rounded" value={stockForm.brand} onChange={e => setStockForm({...stockForm, brand: e.target.value})} placeholder="e.g. Straumann" required />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                              <input type="text" className="w-full p-2 border rounded" value={stockForm.type} onChange={e => setStockForm({...stockForm, type: e.target.value})} placeholder="e.g. Bone Level" required />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Size / Dimensions</label>
                          <input type="text" className="w-full p-2 border rounded" value={stockForm.size} onChange={e => setStockForm({...stockForm, size: e.target.value})} placeholder="e.g. 4.1mm x 10mm" required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Quantity</label>
                              <input type="number" min="0" className="w-full p-2 border rounded" value={stockForm.quantity} onChange={e => setStockForm({...stockForm, quantity: Number(e.target.value)})} required />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Low Stock Threshold</label>
                              <input type="number" min="1" className="w-full p-2 border rounded" value={stockForm.minThreshold} onChange={e => setStockForm({...stockForm, minThreshold: Number(e.target.value)})} required />
                          </div>
                      </div>
                      <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900">Add to Inventory</button>
                  </form>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default ImplantView;
