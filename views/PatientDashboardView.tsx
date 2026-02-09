import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Patient, VisitData, Clinic, Appointment } from '../types';
import { pgPatients, pgAppointments } from '../services/pgServices';
import { ClinicService } from '../services/services';

const PatientDashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { patientUser, logout } = useAuth();
  const { t, dir } = useLanguage();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Booking modal state
  const [showBooking, setShowBooking] = useState(false);
  const [bookingClinic, setBookingClinic] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Load fresh data from database
  useEffect(() => {
    if (!patientUser) {
      navigate('/patient/login');
      return;
    }

    const loadPatientData = async () => {
      try {
        // Get fresh data from PostgreSQL database
        const allPatients = await pgPatients.getAll();
        const freshData = allPatients.find(p => p.id === patientUser.id);
        
        if (freshData) {
          setPatient(freshData);
        } else {
          // Fallback to localStorage data if not found in DB
          setPatient(patientUser as Patient);
        }

        // Load clinics
        const allClinics = await ClinicService.getActive();
        setClinics(allClinics);

        // Load this patient's appointments
        const allApps = await pgAppointments.getAll();
        const myApps = allApps.filter(a => a.patientId === patientUser.id && a.status === 'scheduled' && a.date >= Date.now());
        setAppointments(myApps.sort((a, b) => a.date - b.date));
      } catch (error) {
        console.error('[PatientDashboard] Error loading data:', error);
        // Fallback to localStorage data
        setPatient(patientUser as Patient);
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();
    
    // Poll for updates every 30 seconds (reduced from 3 seconds to prevent freeze)
    const interval = setInterval(loadPatientData, 30000);
    
    return () => clearInterval(interval);
  }, [patientUser, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/patient/login');
  };

  const handleBookAppointment = async () => {
    if (!patient || !bookingClinic || !bookingDate || !bookingTime) return;
    setBookingLoading(true);
    try {
      const timestamp = new Date(`${bookingDate}T${bookingTime}`).getTime();
      if (isNaN(timestamp)) throw new Error('تاريخ غير صالح');

      await pgAppointments.create({
        id: '',
        patientId: patient.id,
        patientName: patient.name,
        clinicId: bookingClinic,
        doctorId: undefined,
        date: timestamp,
        reason: bookingReason || 'حجز من بوابة المريض',
        status: 'scheduled'
      });

      setBookingSuccess(true);
      // Refresh appointments
      const allApps = await pgAppointments.getAll();
      const myApps = allApps.filter(a => a.patientId === patient.id && a.status === 'scheduled' && a.date >= Date.now());
      setAppointments(myApps.sort((a, b) => a.date - b.date));

      setTimeout(() => {
        setShowBooking(false);
        setBookingSuccess(false);
        setBookingClinic('');
        setBookingDate('');
        setBookingTime('');
        setBookingReason('');
      }, 2000);
    } catch (e: any) {
      alert('خطأ في الحجز: ' + e.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;

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

        {/* Current Visit Status - Show if patient has active visit */}
        {patient.currentVisit && patient.currentVisit.visitId && patient.currentVisit.visitId.trim() !== '' && (
          <div className={`rounded-2xl shadow-xl p-6 mb-8 border-2 ${
            patient.currentVisit.status === 'in-progress' 
              ? 'bg-gradient-to-r from-green-500 to-green-600 border-green-400' 
              : patient.currentVisit.status === 'waiting'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400'
              : 'bg-gradient-to-r from-gray-500 to-gray-600 border-gray-400'
          } text-white animate-pulse-slow`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl">
                  {patient.currentVisit.status === 'in-progress' ? (
                    <i className="fa-solid fa-user-doctor animate-bounce"></i>
                  ) : patient.currentVisit.status === 'waiting' ? (
                    <i className="fa-solid fa-clock"></i>
                  ) : (
                    <i className="fa-solid fa-check-circle"></i>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">
                    {patient.currentVisit.status === 'in-progress' 
                      ? '🔔 حان دورك!' 
                      : patient.currentVisit.status === 'waiting'
                      ? 'في قائمة الانتظار'
                      : 'الزيارة مكتملة'
                    }
                  </h3>
                  <p className="text-sm opacity-90">
                    {patient.currentVisit.status === 'in-progress' 
                      ? 'يرجى التوجه إلى غرفة الفحص الآن' 
                      : patient.currentVisit.status === 'waiting'
                      ? 'يرجى الانتظار حتى يحين دورك'
                      : 'شكراً لزيارتك'
                    }
                  </p>
                  {patient.currentVisit.reasonForVisit && (
                    <p className="text-xs opacity-75 mt-1">
                      <i className="fa-solid fa-notes-medical mr-1"></i>
                      السبب: {patient.currentVisit.reasonForVisit}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-75">وقت الوصول</div>
                <div className="text-xl font-bold font-mono">
                  {new Date(patient.currentVisit.date).toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xl">
                <i className="fa-solid fa-calendar-check"></i>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{appointments.length}</div>
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
              <button onClick={() => setShowBooking(true)} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2">
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

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-calendar-check text-blue-500"></i>
                المواعيد القادمة
              </h3>
            </div>
            <div className="space-y-3">
              {appointments.map(app => (
                <div key={app.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      <i className="fa-solid fa-calendar-day text-xl"></i>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">
                        {new Date(app.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        <i className="fa-solid fa-clock ml-1"></i>
                        {new Date(app.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        <i className="fa-solid fa-hospital ml-1"></i>
                        {getClinicName(app.clinicId)}
                      </div>
                      {app.reason && <div className="text-xs text-slate-400 mt-1">{app.reason}</div>}
                    </div>
                  </div>
                  <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">محجوز</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !bookingLoading && setShowBooking(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {bookingSuccess ? (
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-check text-green-600 text-4xl"></i>
                </div>
                <h3 className="text-2xl font-bold text-green-700 mb-2">تم الحجز بنجاح!</h3>
                <p className="text-slate-500 text-sm">سيظهر موعدك في صفحة السكرتيرة</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-calendar-plus text-blue-500"></i>
                    حجز موعد جديد
                  </h3>
                  <button onClick={() => setShowBooking(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  {/* Clinic */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      <i className="fa-solid fa-hospital ml-1"></i> العيادة *
                    </label>
                    <select
                      value={bookingClinic}
                      onChange={e => setBookingClinic(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">اختر العيادة...</option>
                      {clinics.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      <i className="fa-solid fa-calendar ml-1"></i> التاريخ *
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={e => setBookingDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Time */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      <i className="fa-solid fa-clock ml-1"></i> الوقت *
                    </label>
                    <input
                      type="time"
                      value={bookingTime}
                      onChange={e => setBookingTime(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      <i className="fa-solid fa-notes-medical ml-1"></i> سبب الزيارة (اختياري)
                    </label>
                    <textarea
                      value={bookingReason}
                      onChange={e => setBookingReason(e.target.value)}
                      placeholder="مثلاً: فحص دوري، ألم في الأسنان..."
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => setShowBooking(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-slate-600 font-medium hover:bg-gray-50 transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleBookAppointment}
                    disabled={bookingLoading || !bookingClinic || !bookingDate || !bookingTime}
                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {bookingLoading ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fa-solid fa-check"></i>
                        تأكيد الحجز
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-16 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>© 2026 MED LOOP. جميع الحقوق محفوظة.</p>
        </div>
      </footer>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.01); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default PatientDashboardView;
