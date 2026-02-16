
import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { DeviceService, PatientService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DeviceResult, Patient, DeviceResultStatus } from '../types';

type TabFilter = 'pending' | 'matched' | 'all';

const DeviceResultsView: React.FC = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();

  const [results, setResults] = useState<DeviceResult[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('pending');
  
  // Match modal
  const [matchingResult, setMatchingResult] = useState<DeviceResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const statusFilter: DeviceResultStatus | undefined = 
        activeTab === 'pending' ? 'pending' : 
        activeTab === 'matched' ? 'matched' : 
        undefined;
      
      const [resultData, patientData] = await Promise.all([
        DeviceService.getAllResults(user, statusFilter),
        PatientService.getAll(user)
      ]);
      setResults(resultData);
      setPatients(patientData);
    } catch (err) {
      console.error('Error loading device results:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleMatch = async (patientId: string) => {
    if (!user || !matchingResult) return;
    setMatchLoading(true);
    try {
      await DeviceService.matchResult(user, matchingResult.id, patientId);
      setMatchingResult(null);
      setSearchQuery('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'فشل ربط النتيجة');
    } finally {
      setMatchLoading(false);
    }
  };

  const handleReject = async (resultId: string) => {
    if (!user) return;
    if (!confirm('هل أنت متأكد من رفض هذه النتيجة؟')) return;
    try {
      await DeviceService.rejectResult(user, resultId);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredPatients = patients.filter(p => 
    searchQuery.length >= 2 && (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      p.id.includes(searchQuery)
    )
  );

  const pendingCount = results.filter(r => r.status === 'pending').length;

  const getDeviceIcon = (type?: string) => {
    switch (type) {
      case 'cbc': return 'fa-solid fa-droplet';
      case 'ecg': return 'fa-solid fa-heart-pulse';
      case 'glucose': return 'fa-solid fa-syringe';
      case 'chemistry': return 'fa-solid fa-flask';
      case 'xray': return 'fa-solid fa-x-ray';
      default: return 'fa-solid fa-microscope';
    }
  };

  const getStatusBadge = (status: DeviceResultStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">معلّقة</span>;
      case 'matched':
        return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">مربوطة</span>;
      case 'error':
        return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">خطأ</span>;
      case 'rejected':
        return <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">مرفوضة</span>;
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-JO') + ' ' + d.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Layout title="نتائج الأجهزة">
        <div className="flex items-center justify-center h-64">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="نتائج الأجهزة الطبية">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{pendingCount}</div>
            <div className="text-xs text-slate-400 font-medium">نتائج معلّقة</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-xl">
            <i className="fa-solid fa-check-circle"></i>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">
              {results.filter(r => r.status === 'matched').length}
            </div>
            <div className="text-xs text-slate-400 font-medium">تم ربطها</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl">
            <i className="fa-solid fa-vials"></i>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{results.length}</div>
            <div className="text-xs text-slate-400 font-medium">إجمالي النتائج</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 flex overflow-hidden">
        {([
          { id: 'pending' as TabFilter, label: 'معلّقة', icon: 'fa-solid fa-clock', count: pendingCount },
          { id: 'matched' as TabFilter, label: 'مربوطة', icon: 'fa-solid fa-check', count: 0 },
          { id: 'all' as TabFilter, label: 'الكل', icon: 'fa-solid fa-list', count: 0 }
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setLoading(true); }}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-gray-50'
            }`}
          >
            <i className={tab.icon}></i>
            {tab.label}
            {tab.id === 'pending' && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-b-xl shadow-sm border border-gray-100 border-t-0 overflow-hidden">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="fa-solid fa-inbox text-5xl mb-4 text-slate-200"></i>
            <p className="text-lg font-semibold">لا توجد نتائج {activeTab === 'pending' ? 'معلّقة' : ''}</p>
            <p className="text-sm mt-1">ستظهر النتائج هنا عند وصولها من الأجهزة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-right px-4 py-3">الجهاز</th>
                  <th className="text-right px-4 py-3">الفحص</th>
                  <th className="text-right px-4 py-3">النتيجة</th>
                  <th className="text-right px-4 py-3">معرّف المريض</th>
                  <th className="text-right px-4 py-3">الحالة</th>
                  <th className="text-right px-4 py-3">التاريخ</th>
                  <th className="text-right px-4 py-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map(result => (
                  <tr key={result.id} className={`hover:bg-slate-50 transition-colors ${result.isAbnormal ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                          result.deviceType === 'cbc' ? 'bg-red-100 text-red-600' :
                          result.deviceType === 'ecg' ? 'bg-pink-100 text-pink-600' :
                          result.deviceType === 'glucose' ? 'bg-orange-100 text-orange-600' :
                          result.deviceType === 'chemistry' ? 'bg-purple-100 text-purple-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          <i className={getDeviceIcon(result.deviceType)}></i>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">{result.deviceName || 'جهاز'}</div>
                          <div className="text-[10px] text-slate-400 uppercase">{result.deviceType}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{result.testCode}</div>
                      {result.testName && <div className="text-[10px] text-slate-400">{result.testName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-mono font-bold ${result.isAbnormal ? 'text-red-600' : 'text-slate-800'}`}>
                        {result.value} {result.unit && <span className="text-xs font-normal text-slate-400">{result.unit}</span>}
                      </div>
                      {result.referenceRange && (
                        <div className="text-[10px] text-slate-400">المرجع: {result.referenceRange}</div>
                      )}
                      {result.isAbnormal && <span className="text-[10px] text-red-500 font-bold">⚠ غير طبيعي</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-slate-600">{result.patientIdentifier}</span>
                      {result.matchedPatientName && (
                        <div className="text-xs text-green-600 font-semibold mt-0.5">
                          <i className="fa-solid fa-user-check mr-1"></i>{result.matchedPatientName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(result.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDate(result.createdAt)}</td>
                    <td className="px-4 py-3">
                      {result.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setMatchingResult(result); setSearchQuery(''); }}
                            className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                          >
                            <i className="fa-solid fa-link"></i> ربط
                          </button>
                          <button
                            onClick={() => handleReject(result.id)}
                            className="bg-gray-200 hover:bg-gray-300 text-slate-600 px-2 py-1.5 rounded-lg text-xs"
                            title="رفض"
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </div>
                      )}
                      {result.status === 'matched' && result.matchedBy && (
                        <span className="text-[10px] text-slate-400">
                          بواسطة: {result.matchedBy === 'auto' ? 'تلقائي' : result.matchedBy}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Match Modal */}
      {matchingResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setMatchingResult(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">ربط النتيجة بمريض</h3>
                <button onClick={() => setMatchingResult(null)} className="text-slate-400 hover:text-slate-600">
                  <i className="fa-solid fa-times text-lg"></i>
                </button>
              </div>
              <div className="mt-3 bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                  <i className={getDeviceIcon(matchingResult.deviceType)}></i>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700">
                    {matchingResult.testCode}: <span className="font-mono">{matchingResult.value} {matchingResult.unit}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    معرّف المريض على الجهاز: <span className="font-mono font-bold">{matchingResult.patientIdentifier}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <i className="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف أو رقم المريض..."
                  className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Patient List */}
            <div className="max-h-60 overflow-y-auto px-4 pb-4 space-y-2">
              {searchQuery.length < 2 ? (
                <div className="text-center text-slate-400 text-sm py-6">
                  <i className="fa-solid fa-keyboard mb-2 text-2xl text-slate-200"></i>
                  <p>اكتب حرفين على الأقل للبحث</p>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-6">
                  <i className="fa-solid fa-user-slash mb-2 text-2xl text-slate-200"></i>
                  <p>لا يوجد مريض مطابق</p>
                </div>
              ) : (
                filteredPatients.map(patient => (
                  <button
                    key={patient.id}
                    onClick={() => handleMatch(patient.id)}
                    disabled={matchLoading}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary hover:bg-primary/5 transition-all text-right disabled:opacity-50"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0 ${
                      patient.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    }`}>
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{patient.name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span><i className="fa-solid fa-hashtag mr-0.5"></i>{patient.id}</span>
                        <span><i className="fa-solid fa-phone mr-0.5"></i>{patient.phone}</span>
                      </div>
                    </div>
                    <i className="fa-solid fa-link text-slate-300"></i>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </Layout>
  );
};

export default DeviceResultsView;
