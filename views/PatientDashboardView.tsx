import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Patient } from '../types';

const PatientDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { patientUser, logout } = useAuth();
  const { t, dir } = useLanguage();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientUser) {
      navigate('/patient/login');
      return;
    }

    // In a real app, fetch patient data from backend
    // For now, use the patient data from auth context
    setPatient(patientUser as Patient);
    setLoading(false);
  }, [patientUser, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/patient/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50" dir={dir}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-user-injured text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">بوابة المريض</h1>
              <p className="text-xs text-slate-500">MED LOOP Patient Portal</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-all"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl">
              <i className="fa-solid fa-user"></i>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">مرحباً، {patient.name}</h2>
              <p className="text-blue-100 text-sm">نتمنى لك صحة وعافية دائمة</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl">
                <i className="fa-solid fa-calendar-check"></i>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">0</div>
                <div className="text-sm text-slate-500">المواعيد القادمة</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 text-xl">
                <i className="fa-solid fa-file-medical"></i>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{patient.history?.length || 0}</div>
                <div className="text-sm text-slate-500">الزيارات السابقة</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-xl">
                <i className="fa-solid fa-file-invoice-dollar"></i>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">0</div>
                <div className="text-sm text-slate-500">الفواتير المعلقة</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Personal Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-id-card text-blue-500"></i>
                المعلومات الشخصية
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-slate-500 text-sm">الاسم الكامل</span>
                <span className="font-medium text-slate-800">{patient.name}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-slate-500 text-sm">العمر</span>
                <span className="font-medium text-slate-800">{patient.age} سنة</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-slate-500 text-sm">الجنس</span>
                <span className="font-medium text-slate-800">{patient.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-slate-500 text-sm">رقم الهاتف</span>
                <span className="font-medium text-slate-800 font-mono">{patient.phone}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-slate-500 text-sm">البريد الإلكتروني</span>
                <span className="font-medium text-slate-800">{patient.email || '—'}</span>
              </div>
            </div>
          </div>

          {/* Medical History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-green-500"></i>
                السجل الطبي
              </h3>
            </div>
            {patient.history && patient.history.length > 0 ? (
              <div className="space-y-4">
                {patient.history.slice(0, 3).map((visit, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="text-sm font-bold text-slate-800">
                      {new Date(visit.date).toLocaleDateString('ar-EG')}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{visit.reasonForVisit}</div>
                    <div className="text-xs text-green-600 font-medium mt-1">
                      <i className="fa-solid fa-check-circle"></i> مكتمل
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <i className="fa-solid fa-folder-open text-4xl mb-3"></i>
                <p className="text-sm">لا توجد زيارات سابقة</p>
              </div>
            )}
          </div>

          {/* Medical Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-red-500"></i>
                التنبيهات الطبية
              </h3>
            </div>
            {patient.medicalProfile.allergies.exists || patient.medicalProfile.chronicConditions.exists ? (
              <div className="space-y-3">
                {patient.medicalProfile.allergies.exists && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <div className="text-xs font-bold text-red-800 uppercase mb-1">حساسية</div>
                    <div className="text-sm text-red-700">{patient.medicalProfile.allergies.details}</div>
                  </div>
                )}
                {patient.medicalProfile.chronicConditions.exists && (
                  <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                    <div className="text-xs font-bold text-orange-800 uppercase mb-1">أمراض مزمنة</div>
                    <div className="text-sm text-orange-700">{patient.medicalProfile.chronicConditions.details}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-green-600">
                <i className="fa-solid fa-shield-check text-4xl mb-3"></i>
                <p className="text-sm font-medium">لا توجد تنبيهات طبية</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-bolt text-yellow-500"></i>
                إجراءات سريعة
              </h3>
            </div>
            <div className="space-y-3">
              <button className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-calendar-plus"></i>
                حجز موعد جديد
              </button>
              <button className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-file-medical"></i>
                عرض السجل الطبي الكامل
              </button>
              <button className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-receipt"></i>
                عرض الفواتير
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-16 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>© 2026 MED LOOP. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
};

export default PatientDashboardView;
