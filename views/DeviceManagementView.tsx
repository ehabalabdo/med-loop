
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../src/api';
import { Device, DeviceType, DeviceConnectionType } from '../types';

interface ApiKey {
  id: string;
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const DEVICE_TYPES: { value: DeviceType; label: string; icon: string }[] = [
  { value: 'cbc', label: 'جهاز تحليل دم (CBC)', icon: 'fa-droplet' },
  { value: 'chemistry', label: 'كيمياء حيوية (Chemistry)', icon: 'fa-flask' },
  { value: 'glucose', label: 'سكر الدم (Glucose)', icon: 'fa-candy-cane' },
  { value: 'ecg', label: 'تخطيط القلب (ECG)', icon: 'fa-heart-pulse' },
  { value: 'xray', label: 'أشعة (X-Ray)', icon: 'fa-x-ray' },
  { value: 'other', label: 'أخرى', icon: 'fa-microscope' },
];

const CONNECTION_TYPES: { value: DeviceConnectionType; label: string; icon: string }[] = [
  { value: 'lan', label: 'شبكة LAN / TCP', icon: 'fa-network-wired' },
  { value: 'serial', label: 'منفذ تسلسلي (COM Port)', icon: 'fa-plug' },
  { value: 'hl7', label: 'HL7 / MLLP', icon: 'fa-file-medical' },
  { value: 'folder', label: 'مراقبة مجلد (Folder Watch)', icon: 'fa-folder-open' },
  { value: 'api', label: 'API مباشر', icon: 'fa-code' },
];

const DeviceManagementView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // State
  const [devices, setDevices] = useState<Device[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'devices' | 'apikeys' | 'guide'>('devices');

  // Add/Edit Device Modal
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    name: '',
    type: 'cbc' as DeviceType,
    connectionType: 'lan' as DeviceConnectionType,
    ipAddress: '',
    port: '',
    comPort: '',
  });
  const [saving, setSaving] = useState(false);

  // API Key Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.clientId) return;
    try {
      const [devicesData, keysData] = await Promise.all([
        api.get(`/api/devices/${user.clientId}`),
        api.get(`/api/device-api-keys/${user.clientId}`),
      ]);
      setDevices(devicesData || []);
      setApiKeys(keysData || []);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Device CRUD ---
  const openAddDevice = () => {
    setEditingDevice(null);
    setDeviceForm({ name: '', type: 'cbc', connectionType: 'lan', ipAddress: '', port: '', comPort: '' });
    setShowDeviceModal(true);
  };

  const openEditDevice = (d: Device) => {
    setEditingDevice(d);
    setDeviceForm({
      name: d.name,
      type: d.type,
      connectionType: d.connectionType,
      ipAddress: d.ipAddress || '',
      port: d.port ? String(d.port) : '',
      comPort: d.comPort || '',
    });
    setShowDeviceModal(true);
  };

  const handleSaveDevice = async () => {
    if (!user?.clientId || !deviceForm.name.trim()) return;
    setSaving(true);
    try {
      if (editingDevice) {
        await api.put(`/api/devices/${editingDevice.id}`, {
          name: deviceForm.name,
          type: deviceForm.type,
          connectionType: deviceForm.connectionType,
          ipAddress: deviceForm.ipAddress || null,
          port: deviceForm.port ? parseInt(deviceForm.port) : null,
          comPort: deviceForm.comPort || null,
        });
      } else {
        await api.post('/api/devices', {
          clientId: user.clientId,
          clinicId: '1',
          name: deviceForm.name,
          type: deviceForm.type,
          connectionType: deviceForm.connectionType,
          ipAddress: deviceForm.ipAddress || null,
          port: deviceForm.port ? parseInt(deviceForm.port) : null,
          comPort: deviceForm.comPort || null,
        });
      }
      setShowDeviceModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الجهاز');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    try {
      await api.del(`/api/devices/${id}`);
      setDeletingId(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الجهاز');
    }
  };

  const handleToggleDevice = async (d: Device) => {
    try {
      await api.put(`/api/devices/${d.id}`, { isActive: !d.isActive });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث الجهاز');
    }
  };

  // --- API Key ---
  const handleGenerateKey = async () => {
    if (!user?.clientId || !keyLabel.trim()) return;
    setSaving(true);
    try {
      const data = await api.post('/api/device-api-keys', { clientId: user.clientId, label: keyLabel });
      setGeneratedKey(data.key);
      setKeyLabel('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'فشل إنشاء المفتاح');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await api.del(`/api/device-api-keys/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'فشل إلغاء المفتاح');
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const getTypeInfo = (type: DeviceType) => DEVICE_TYPES.find(t => t.value === type) || DEVICE_TYPES[5];
  const getConnInfo = (conn: DeviceConnectionType) => CONNECTION_TYPES.find(c => c.value === conn) || CONNECTION_TYPES[0];

  const getStatusColor = (d: Device) => {
    if (!d.isActive) return 'bg-slate-100 text-slate-400';
    if (d.lastSeenAt) {
      const diff = Date.now() - new Date(d.lastSeenAt).getTime();
      if (diff < 5 * 60 * 1000) return 'bg-emerald-100 text-emerald-600'; // Online < 5min
      if (diff < 30 * 60 * 1000) return 'bg-amber-100 text-amber-600'; // Idle < 30min
    }
    return 'bg-red-100 text-red-500'; // Offline
  };

  const getStatusLabel = (d: Device) => {
    if (!d.isActive) return 'معطّل';
    if (d.lastSeenAt) {
      const diff = Date.now() - new Date(d.lastSeenAt).getTime();
      if (diff < 5 * 60 * 1000) return 'متصل';
      if (diff < 30 * 60 * 1000) return 'خامل';
    }
    return 'غير متصل';
  };

  if (loading) {
    return (
      <Layout title="إدارة الأجهزة">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="إدارة الأجهزة">
      <div className="space-y-6" dir="rtl">

        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="fa-microchip" label="إجمالي الأجهزة" value={devices.length} color="bg-blue-500" />
          <StatCard icon="fa-circle-check" label="أجهزة نشطة" value={devices.filter(d => d.isActive).length} color="bg-emerald-500" />
          <StatCard icon="fa-wifi" label="متصل الآن" value={devices.filter(d => d.isActive && d.lastSeenAt && (Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000)).length} color="bg-violet-500" />
          <StatCard icon="fa-key" label="مفاتيح API" value={apiKeys.filter(k => k.is_active).length} color="bg-amber-500" />
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 w-fit">
          {[
            { id: 'devices' as const, label: 'الأجهزة', icon: 'fa-microchip' },
            { id: 'apikeys' as const, label: 'مفاتيح الربط', icon: 'fa-key' },
            { id: 'guide' as const, label: 'دليل الإعداد', icon: 'fa-book' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-slate-800 text-white shadow-lg' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* === DEVICES TAB === */}
        {activeTab === 'devices' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">الأجهزة المسجلة</h3>
              <button onClick={openAddDevice} className="bg-gradient-to-r from-primary to-secondary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-all flex items-center gap-2">
                <i className="fa-solid fa-plus"></i> إضافة جهاز
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-microchip text-3xl text-slate-300"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-600 mb-2">لا توجد أجهزة مسجلة</h3>
                <p className="text-slate-400 mb-6">ابدأ بإضافة أول جهاز طبي لربطه بالنظام</p>
                <button onClick={openAddDevice} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm">
                  <i className="fa-solid fa-plus ml-2"></i> إضافة جهاز
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map(d => {
                  const typeInfo = getTypeInfo(d.type);
                  const connInfo = getConnInfo(d.connectionType);
                  return (
                    <div key={d.id} className={`bg-white rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md ${!d.isActive ? 'opacity-60 border-slate-200' : 'border-slate-100'}`}>
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${d.isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className={`fa-solid ${typeInfo.icon} text-xl`}></i>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-base">{d.name}</h4>
                            <span className="text-xs text-slate-400">{typeInfo.label}</span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusColor(d)}`}>
                          {getStatusLabel(d)}
                        </span>
                      </div>

                      {/* Connection Info */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <i className={`fa-solid ${connInfo.icon} w-4`}></i>
                          <span className="font-medium">{connInfo.label}</span>
                        </div>
                        {d.ipAddress && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <i className="fa-solid fa-globe w-4"></i>
                            <span className="font-mono">{d.ipAddress}{d.port ? `:${d.port}` : ''}</span>
                          </div>
                        )}
                        {d.comPort && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <i className="fa-solid fa-plug w-4"></i>
                            <span className="font-mono">{d.comPort}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <i className="fa-solid fa-hashtag w-4"></i>
                          <span className="font-mono text-[10px]">ID: {d.id}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 border-t border-slate-50 pt-3">
                        <button onClick={() => openEditDevice(d)} className="flex-1 text-xs font-bold text-slate-500 hover:text-primary py-1.5 rounded-lg hover:bg-slate-50 transition-all">
                          <i className="fa-solid fa-pen-to-square ml-1"></i> تعديل
                        </button>
                        <button onClick={() => handleToggleDevice(d)} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${d.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}>
                          <i className={`fa-solid ${d.isActive ? 'fa-pause' : 'fa-play'} ml-1`}></i> {d.isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                        {deletingId === d.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleDeleteDevice(d.id)} className="text-xs font-bold text-red-500 px-2 py-1.5 rounded-lg bg-red-50">تأكيد</button>
                            <button onClick={() => setDeletingId(null)} className="text-xs font-bold text-slate-400 px-2 py-1.5">إلغاء</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingId(d.id)} className="text-xs font-bold text-red-400 hover:text-red-500 py-1.5 px-2 rounded-lg hover:bg-red-50 transition-all">
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* === API KEYS TAB === */}
        {activeTab === 'apikeys' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
              <i className="fa-solid fa-circle-info text-amber-500 mt-0.5"></i>
              <div className="text-sm text-amber-800">
                <strong>مفتاح API</strong> يُستخدم لمصادقة Bridge Agent مع السيرفر. يظهر المفتاح <strong>مرة واحدة فقط</strong> عند الإنشاء — احفظه في مكان آمن.
              </div>
            </div>

            {/* Generate New Key */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-key text-amber-500"></i> إنشاء مفتاح جديد
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="تسمية المفتاح (مثال: جهاز مختبر الطابق الأول)"
                  value={keyLabel}
                  onChange={e => setKeyLabel(e.target.value)}
                  className="flex-1 p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleGenerateKey}
                  disabled={!keyLabel.trim() || saving}
                  className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-slate-700 transition-all flex items-center gap-2"
                >
                  {saving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                  إنشاء
                </button>
              </div>

              {/* Generated Key Display */}
              {generatedKey && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-emerald-700"><i className="fa-solid fa-check-circle ml-1"></i> تم إنشاء المفتاح بنجاح</span>
                    <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full">يظهر مرة واحدة فقط!</span>
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-white p-3 rounded-lg text-xs font-mono break-all border border-emerald-100 text-slate-700 select-all">
                      {generatedKey}
                    </code>
                    <button onClick={copyKey} className={`px-4 rounded-lg font-bold text-sm transition-all ${keyCopied ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                      <i className={`fa-solid ${keyCopied ? 'fa-check' : 'fa-copy'}`}></i>
                    </button>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2">
                    ضع هذا المفتاح في ملف <code className="bg-white px-1 rounded">.env</code> الخاص بـ Bridge Agent: <code className="bg-white px-1 rounded">API_KEY=mdl_...</code>
                  </p>
                </div>
              )}
            </div>

            {/* Keys List */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-50">
                <h3 className="font-bold text-slate-800">المفاتيح الموجودة</h3>
              </div>
              {apiKeys.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <i className="fa-solid fa-key text-3xl opacity-20 mb-2"></i>
                  <p className="text-sm">لا توجد مفاتيح — أنشئ مفتاح أعلاه</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {apiKeys.map(k => (
                    <div key={k.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.is_active ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                          <i className="fa-solid fa-key text-sm"></i>
                        </div>
                        <div>
                          <span className="font-bold text-slate-700 text-sm">{k.label}</span>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>أُنشئ: {new Date(k.created_at).toLocaleDateString('ar')}</span>
                            {k.last_used_at && <span>آخر استخدام: {new Date(k.last_used_at).toLocaleDateString('ar')}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${k.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                          {k.is_active ? 'نشط' : 'ملغى'}
                        </span>
                        {k.is_active && (
                          <button onClick={() => handleRevokeKey(k.id)} className="text-xs text-red-400 hover:text-red-600 font-bold">
                            <i className="fa-solid fa-ban ml-1"></i> إلغاء
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === SETUP GUIDE TAB === */}
        {activeTab === 'guide' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-book text-primary"></i> دليل ربط الأجهزة الطبية
              </h3>

              {/* Step 1 */}
              <StepCard step={1} title="سجّل الجهاز" icon="fa-microchip" color="bg-blue-500">
                <p>اذهب لتبويب "الأجهزة" واضغط "إضافة جهاز". اختر نوع الجهاز وطريقة الاتصال (LAN أو Serial أو HL7).</p>
                <p className="text-slate-400 mt-1">احفظ الـ <strong>Device ID</strong> — ستحتاجه في الخطوة التالية.</p>
              </StepCard>

              {/* Step 2 */}
              <StepCard step={2} title="أنشئ مفتاح API" icon="fa-key" color="bg-amber-500">
                <p>اذهب لتبويب "مفاتيح الربط" وأنشئ مفتاح جديد. <strong className="text-red-500">انسخه فوراً</strong> — لن يظهر مرة ثانية.</p>
              </StepCard>

              {/* Step 3 */}
              <StepCard step={3} title="ثبّت Bridge Agent" icon="fa-server" color="bg-violet-500">
                <p>على كمبيوتر العيادة المتصل بالأجهزة:</p>
                <CodeBlock lines={[
                  'cd bridge-agent',
                  'npm install',
                  'copy .env.example .env',
                ]} />
              </StepCard>

              {/* Step 4 */}
              <StepCard step={4} title="اضبط ملف .env" icon="fa-file-code" color="bg-emerald-500">
                <CodeBlock lines={[
                  '# Server',
                  'API_URL=https://medloop-api.onrender.com',
                  'API_KEY=mdl_xxxxx  # المفتاح اللي نسخته',
                  '',
                  '# Device',
                  `DEVICE_ID=xxx  # ID الجهاز من الخطوة 1`,
                  '',
                  '# Connection (اختر واحدة)',
                  'SERIAL_PORT=COM3       # لأجهزة Serial',
                  'MLLP_PORT=2575         # لأجهزة HL7',
                  'WATCH_FOLDER=C:\\Results # لمراقبة مجلد',
                ]} />
              </StepCard>

              {/* Step 5 */}
              <StepCard step={5} title="شغّل Bridge Agent" icon="fa-play" color="bg-rose-500">
                <CodeBlock lines={['node bridge-agent.js']} />
                <p className="mt-2">حالة الجهاز ستتحول لـ "متصل" هنا، والنتائج ستظهر تلقائياً في صفحة نتائج الأجهزة.</p>
              </StepCard>
            </div>
          </div>
        )}

        {/* === ADD/EDIT DEVICE MODAL === */}
        {showDeviceModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDeviceModal(false)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">
                  {editingDevice ? 'تعديل جهاز' : 'إضافة جهاز جديد'}
                </h3>
                <button onClick={() => setShowDeviceModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-lg"></i></button>
              </div>

              <div className="p-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="text-sm font-bold text-slate-600 mb-1.5 block">اسم الجهاز</label>
                  <input
                    type="text"
                    placeholder="مثال: Mindray BC-5000"
                    value={deviceForm.name}
                    onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-sm font-bold text-slate-600 mb-1.5 block">نوع الجهاز</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DEVICE_TYPES.map(dt => (
                      <button
                        key={dt.value}
                        onClick={() => setDeviceForm({ ...deviceForm, type: dt.value })}
                        className={`p-3 rounded-xl border text-center transition-all text-xs font-bold ${
                          deviceForm.type === dt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <i className={`fa-solid ${dt.icon} text-lg mb-1 block`}></i>
                        {dt.label.split('(')[0].trim()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Connection Type */}
                <div>
                  <label className="text-sm font-bold text-slate-600 mb-1.5 block">طريقة الاتصال</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONNECTION_TYPES.map(ct => (
                      <button
                        key={ct.value}
                        onClick={() => setDeviceForm({ ...deviceForm, connectionType: ct.value })}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                          deviceForm.connectionType === ct.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <i className={`fa-solid ${ct.icon}`}></i> {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Connection Details */}
                {(deviceForm.connectionType === 'lan' || deviceForm.connectionType === 'hl7' || deviceForm.connectionType === 'api') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-bold text-slate-600 mb-1.5 block">عنوان IP</label>
                      <input type="text" placeholder="192.168.1.100" value={deviceForm.ipAddress} onChange={e => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary font-mono" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-600 mb-1.5 block">المنفذ (Port)</label>
                      <input type="text" placeholder={deviceForm.connectionType === 'hl7' ? '2575' : '9100'} value={deviceForm.port} onChange={e => setDeviceForm({ ...deviceForm, port: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary font-mono" />
                    </div>
                  </div>
                )}

                {deviceForm.connectionType === 'serial' && (
                  <div>
                    <label className="text-sm font-bold text-slate-600 mb-1.5 block">منفذ COM</label>
                    <input type="text" placeholder="COM3" value={deviceForm.comPort} onChange={e => setDeviceForm({ ...deviceForm, comPort: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary font-mono" />
                  </div>
                )}

                {deviceForm.connectionType === 'folder' && (
                  <div>
                    <label className="text-sm font-bold text-slate-600 mb-1.5 block">مسار المجلد</label>
                    <input type="text" placeholder="C:\Lab\Results" value={deviceForm.ipAddress} onChange={e => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary font-mono" />
                    <p className="text-[11px] text-slate-400 mt-1">المجلد اللي الجهاز بيحفظ فيه النتائج كملفات</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3">
                <button onClick={() => setShowDeviceModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">
                  إلغاء
                </button>
                <button onClick={handleSaveDevice} disabled={!deviceForm.name.trim() || saving} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm disabled:opacity-50 hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                  {saving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-check"></i>}
                  {editingDevice ? 'حفظ التعديلات' : 'إضافة الجهاز'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

// --- Sub-Components ---

const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl ${color} text-white flex items-center justify-center shadow-lg`}>
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <div>
      <div className="text-2xl font-extrabold text-slate-800">{value}</div>
      <div className="text-[11px] font-bold text-slate-400">{label}</div>
    </div>
  </div>
);

const StepCard = ({ step, title, icon, color, children }: { step: number; title: string; icon: string; color: string; children: React.ReactNode }) => (
  <div className="flex gap-4 mb-6 last:mb-0">
    <div className={`w-10 h-10 rounded-xl ${color} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg`}>
      {step}
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
        <i className={`fa-solid ${icon} text-slate-400`}></i> {title}
      </h4>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  </div>
);

const CodeBlock = ({ lines }: { lines: string[] }) => (
  <pre className="bg-slate-800 text-emerald-400 p-3 rounded-xl text-xs font-mono mt-2 overflow-x-auto leading-relaxed" dir="ltr">
    {lines.map((line, i) => (
      <div key={i} className={line.startsWith('#') ? 'text-slate-500' : ''}>{line}</div>
    ))}
  </pre>
);

export default DeviceManagementView;
