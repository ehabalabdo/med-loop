import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, SuperAdmin } from '../types';
import { pgClientsService, pgSuperAdmin } from '../services/pgServices';

const SuperAdminView: React.FC = () => {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<SuperAdmin | null>(() => {
    const saved = localStorage.getItem('superAdmin');
    if (saved) { try { return JSON.parse(saved); } catch { return null; } }
    return null;
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientStats, setClientStats] = useState<Record<number, any>>({});
  const [newClient, setNewClient] = useState({
    name: '', slug: '', phone: '', email: '', address: '',
    ownerName: '', ownerEmail: '', ownerPassword: ''
  });
  const [addingClient, setAddingClient] = useState(false);
  const [extendDays, setExtendDays] = useState<Record<number, number>>({});

  const fetchClients = async () => {
    setLoading(true);
    try {
      const all = await pgClientsService.getAll();
      setClients(all);
      // Load stats for each client
      const statsMap: Record<number, any> = {};
      for (const c of all) {
        try {
          statsMap[c.id] = await pgClientsService.getStats(c.id);
        } catch { statsMap[c.id] = { patientsCount: 0, usersCount: 0, appointmentsCount: 0 }; }
      }
      setClientStats(statsMap);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) fetchClients();
    else setLoading(false);
  }, [admin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const result = await pgSuperAdmin.login(loginForm.username, loginForm.password);
      if (result) {
        setAdmin(result);
        localStorage.setItem('superAdmin', JSON.stringify(result));
      } else {
        setLoginError('بيانات الدخول غير صحيحة');
      }
    } catch (err: any) {
      setLoginError(err.message || 'خطأ في تسجيل الدخول');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('superAdmin');
    setAdmin(null);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.slug || !newClient.ownerName || !newClient.ownerEmail || !newClient.ownerPassword) {
      alert('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    setAddingClient(true);
    try {
      // 1. Create client
      const clientId = await pgClientsService.create({
        name: newClient.name,
        slug: newClient.slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        phone: newClient.phone,
        email: newClient.email,
        address: newClient.address
      });
      // 2. Create owner (admin user)
      await pgClientsService.createOwner(clientId, {
        name: newClient.ownerName,
        email: newClient.ownerEmail,
        password: newClient.ownerPassword
      });
      
      alert(`✅ تم إنشاء المركز بنجاح!\n\nالرابط: ${window.location.origin}/#/${newClient.slug}/login\nاسم المستخدم: ${newClient.ownerEmail}\nكلمة المرور: ${newClient.ownerPassword}`);
      setNewClient({ name: '', slug: '', phone: '', email: '', address: '', ownerName: '', ownerEmail: '', ownerPassword: '' });
      setShowAddClient(false);
      await fetchClients();
    } catch (err: any) {
      alert('خطأ: ' + (err.message || 'فشل الإنشاء'));
    } finally {
      setAddingClient(false);
    }
  };

  const handleExtend = async (clientId: number) => {
    const days = extendDays[clientId] || 30;
    try {
      await pgClientsService.extendSubscription(clientId, days);
      alert(`✅ تم تمديد الاشتراك ${days} يوم`);
      await fetchClients();
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleSuspend = async (clientId: number) => {
    if (!confirm('هل أنت متأكد من إيقاف هذا المركز؟')) return;
    try {
      await pgClientsService.suspend(clientId);
      await fetchClients();
    } catch (err: any) { alert('خطأ: ' + err.message); }
  };

  const handleActivate = async (clientId: number) => {
    try {
      await pgClientsService.activate(clientId);
      await fetchClients();
    } catch (err: any) { alert('خطأ: ' + err.message); }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      suspended: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
    };
    const labels: Record<string, string> = {
      trial: 'تجربة', active: 'فعال', expired: 'منتهي', suspended: 'موقوف'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors[status] || colors.trial}`}>{labels[status] || status}</span>;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // ==================== LOGIN SCREEN ====================
  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 p-4">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-gradient-to-tr from-amber-500 to-orange-600 text-white rounded-2xl flex items-center justify-center mb-4 mx-auto text-3xl shadow-lg">
              <i className="fa-solid fa-crown"></i>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Super Admin</h1>
            <p className="text-slate-400 text-sm">لوحة تحكم المنصة</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text" placeholder="اسم المستخدم"
              value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 outline-none focus:border-amber-500"
              required
            />
            <input
              type="password" placeholder="كلمة المرور"
              value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 outline-none focus:border-amber-500"
              required
            />
            {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
            <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition">
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== DASHBOARD ====================
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-crown text-2xl"></i>
          <div>
            <h1 className="text-xl font-bold">Medloop - لوحة التحكم</h1>
            <p className="text-amber-100 text-sm">مرحباً {admin.name}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddClient(true)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
            <i className="fa-solid fa-plus"></i> زبون جديد
          </button>
          <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm transition">
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 text-xs mb-1">إجمالي الزبائن</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{clients.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 text-xs mb-1">فعالين</p>
          <p className="text-2xl font-bold text-green-600">{clients.filter(c => c.status === 'active').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 text-xs mb-1">تجربة</p>
          <p className="text-2xl font-bold text-blue-600">{clients.filter(c => c.status === 'trial').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 text-xs mb-1">منتهين</p>
          <p className="text-2xl font-bold text-red-600">{clients.filter(c => c.status === 'expired' || c.status === 'suspended').length}</p>
        </div>
      </div>

      {/* Clients List */}
      <div className="px-6 pb-8">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">الزبائن (المراكز)</h2>
        
        {loading ? (
          <div className="text-center py-12 text-slate-400"><i className="fa-solid fa-circle-notch fa-spin text-3xl"></i></div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <i className="fa-solid fa-building text-4xl text-slate-300 mb-3"></i>
            <p className="text-slate-500">لا يوجد زبائن بعد</p>
            <button onClick={() => setShowAddClient(true)} className="mt-3 bg-amber-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-amber-600 transition">
              أضف أول زبون
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map(client => {
              const stats = clientStats[client.id] || {};
              return (
                <div key={client.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{client.name}</h3>
                        {getStatusBadge(client.status)}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        <span><i className="fa-solid fa-link ml-1"></i> /{client.slug}</span>
                        {client.phone && <span><i className="fa-solid fa-phone ml-1"></i> {client.phone}</span>}
                        {client.email && <span><i className="fa-solid fa-envelope ml-1"></i> {client.email}</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
                        <span>مرضى: <b className="text-slate-600 dark:text-slate-300">{stats.patientsCount || 0}</b></span>
                        <span>موظفين: <b className="text-slate-600 dark:text-slate-300">{stats.usersCount || 0}</b></span>
                        <span>مواعيد: <b className="text-slate-600 dark:text-slate-300">{stats.appointmentsCount || 0}</b></span>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-1 text-xs text-slate-400">
                        {client.status === 'trial' && <span>التجربة تنتهي: <b className="text-blue-600">{formatDate(client.trialEndsAt)}</b></span>}
                        {client.subscriptionEndsAt && <span>الاشتراك ينتهي: <b className="text-green-600">{formatDate(client.subscriptionEndsAt)}</b></span>}
                        <span>تاريخ التسجيل: {formatDate(client.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="1" value={extendDays[client.id] || 30}
                          onChange={e => setExtendDays({...extendDays, [client.id]: parseInt(e.target.value) || 30})}
                          className="w-16 px-2 py-1 border rounded-lg text-center text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                        <button onClick={() => handleExtend(client.id)} className="flex-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-600 transition">
                          <i className="fa-solid fa-calendar-plus ml-1"></i> تمديد (يوم)
                        </button>
                      </div>
                      {client.status !== 'suspended' ? (
                        <button onClick={() => handleSuspend(client.id)} className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-200 transition">
                          <i className="fa-solid fa-ban ml-1"></i> إيقاف
                        </button>
                      ) : (
                        <button onClick={() => handleActivate(client.id)} className="bg-green-100 text-green-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-200 transition">
                          <i className="fa-solid fa-check ml-1"></i> تفعيل
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/#/${client.slug}/login`;
                          navigator.clipboard.writeText(url);
                          alert(`تم نسخ الرابط:\n${url}`);
                        }}
                        className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                      >
                        <i className="fa-solid fa-copy ml-1"></i> نسخ الرابط
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                <i className="fa-solid fa-plus-circle text-amber-500 ml-2"></i>
                إضافة زبون جديد
              </h2>
              <button onClick={() => setShowAddClient(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                <p className="text-amber-700 dark:text-amber-300 text-sm font-bold mb-1"><i className="fa-solid fa-building ml-1"></i> بيانات المركز</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">اسم المركز *</label>
                <input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="مركز الشفاء الطبي" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">الرابط (Slug) * — حروف إنجليزية فقط</label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">/</span>
                  <input value={newClient.slug} 
                    onChange={e => setNewClient({...newClient, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                    className="flex-1 px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="alshifa" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">الهاتف</label>
                  <input value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})}
                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="07XXXXXXXX" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">الإيميل</label>
                  <input value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})}
                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="info@clinic.com" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">العنوان</label>
                <input value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="عمان - الأردن" />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800 mt-4">
                <p className="text-blue-700 dark:text-blue-300 text-sm font-bold mb-1"><i className="fa-solid fa-user-shield ml-1"></i> بيانات المدير (أول مستخدم)</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">اسم المدير *</label>
                <input value={newClient.ownerName} onChange={e => setNewClient({...newClient, ownerName: e.target.value})}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="د. أحمد" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">إيميل المدير (لتسجيل الدخول) *</label>
                <input value={newClient.ownerEmail} onChange={e => setNewClient({...newClient, ownerEmail: e.target.value})}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="admin@clinic.com" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">كلمة المرور *</label>
                <input type="text" value={newClient.ownerPassword} onChange={e => setNewClient({...newClient, ownerPassword: e.target.value})}
                  className="w-full px-4 py-2.5 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="كلمة مرور قوية" required />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={addingClient}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition disabled:opacity-50">
                  {addingClient ? <><i className="fa-solid fa-circle-notch fa-spin ml-2"></i> جاري الإنشاء...</> : <><i className="fa-solid fa-check ml-2"></i> إنشاء المركز</>}
                </button>
                <button type="button" onClick={() => setShowAddClient(false)} className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 transition">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminView;
