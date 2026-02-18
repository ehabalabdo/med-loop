import React, { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { HrMeProfile, HrMonthlyReport } from '../types';
import { hrMeService, hrPinService, hrAttendanceService, hrReportsService } from '../services/hrApiServices';
import { useLanguage } from '../context/LanguageContext';

// ───────── helpers ─────────
function fmtMinutes(mins: number) {
  if (!mins) return '0';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const DAY_LABELS_EN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_AR = ['', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'أحد'];

// ───────── component ─────────
const HrEmployeeMeView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [profile, setProfile] = useState<HrMeProfile | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<HrMonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const curMonth = new Date().toISOString().slice(0, 7);

  // PIN state
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);

  // ── load profile + monthly report ──
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        hrMeService.getProfile(),
        hrReportsService.myMonthly(curMonth).catch(() => null),
      ]);
      setProfile(p);
      setMonthlyReport(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [curMonth]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── GPS helper ──
  const getGps = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error(isAr ? 'GPS غير مدعوم' : 'GPS not supported'));
      setGpsStatus('loading');
      navigator.geolocation.getCurrentPosition(
        pos => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          coordsRef.current = c;
          setGpsStatus('ok');
          resolve(c);
        },
        err => {
          setGpsStatus('err');
          reject(new Error(isAr ? 'فشل تحديد الموقع. يرجى تفعيل GPS' : 'Location unavailable. Enable GPS.'));
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  // ── Set PIN ──
  const handleSetPin = async () => {
    if (!newPin || newPin.length < 4) {
      setMsg({ text: isAr ? 'الرمز يجب أن يكون 4 أرقام على الأقل' : 'PIN must be at least 4 digits', type: 'err' });
      return;
    }
    if (newPin !== confirmPin) {
      setMsg({ text: isAr ? 'الرمز غير متطابق' : 'PINs do not match', type: 'err' });
      return;
    }
    setActionLoading(true);
    setMsg(null);
    try {
      await hrPinService.setPin(newPin);
      setMsg({ text: isAr ? 'تم حفظ رمز PIN بنجاح ✓' : 'PIN set successfully ✓', type: 'ok' });
      setNewPin('');
      setConfirmPin('');
      setShowPinSetup(false);
      refresh();
    } catch (e: any) {
      setMsg({ text: e?.message || (isAr ? 'خطأ في حفظ الرمز' : 'Failed to set PIN'), type: 'err' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Check In ──
  const handleCheckIn = async () => {
    if (!pin || pin.length < 4) {
      setMsg({ text: isAr ? 'أدخل رمز PIN أولاً' : 'Enter your PIN first', type: 'err' });
      return;
    }
    setActionLoading(true);
    setMsg(null);
    try {
      const coords = await getGps();
      const result = await hrAttendanceService.checkIn({
        latitude: coords.lat,
        longitude: coords.lng,
        pin,
        device_info: navigator.userAgent.slice(0, 120),
      });
      setMsg({ text: `${result.message} — ${result.clinicName}`, type: 'ok' });
      setPin('');
      refresh();
    } catch (e: any) {
      setMsg({ text: e?.message || (isAr ? 'خطأ في تسجيل الحضور' : 'Check-in error'), type: 'err' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Check Out ──
  const handleCheckOut = async () => {
    if (!pin || pin.length < 4) {
      setMsg({ text: isAr ? 'أدخل رمز PIN أولاً' : 'Enter your PIN first', type: 'err' });
      return;
    }
    setActionLoading(true);
    setMsg(null);
    try {
      const coords = await getGps();
      const result = await hrAttendanceService.checkOut({
        latitude: coords.lat,
        longitude: coords.lng,
        pin,
        device_info: navigator.userAgent.slice(0, 120),
      });
      setMsg({
        text: `${result.message} — ${fmtMinutes(result.totalMinutes)} ${isAr ? 'عمل' : 'worked'}`,
        type: 'ok',
      });
      setPin('');
      refresh();
    } catch (e: any) {
      setMsg({ text: e?.message || (isAr ? 'خطأ في تسجيل المغادرة' : 'Check-out error'), type: 'err' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── derived state ──
  const today = profile?.todayAttendance;
  const checkedIn = !!today?.checkIn;
  const checkedOut = !!today?.checkOut;
  const sched = profile?.schedule;
  const summary = monthlyReport?.summary;

  if (loading) {
    return (
      <Layout title={isAr ? 'بوابة الموظف' : 'Employee Portal'}>
        <div className="p-12 text-center text-slate-400"><i className="fa-solid fa-circle-notch fa-spin text-3xl"></i></div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout title={isAr ? 'بوابة الموظف' : 'Employee Portal'}>
        <div className="p-12 text-center text-red-400 font-bold">{isAr ? 'فشل تحميل الملف الشخصي' : 'Failed to load profile'}</div>
      </Layout>
    );
  }

  return (
    <Layout title={isAr ? 'بوابة الموظف' : 'Employee Portal'}>
      {/* Alert Banner */}
      {msg && (
        <div className={`mb-4 p-4 rounded-2xl font-bold text-sm flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          <i className={`fa-solid ${msg.type === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
          {msg.text}
          <button className="ms-auto opacity-60 hover:opacity-100" onClick={() => setMsg(null)}><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile + Schedule Card */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-indigo-200">
                {profile.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-extrabold text-slate-800">{profile.fullName}</h2>
                <p className="text-sm text-slate-400 font-medium">@{profile.username}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${profile.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {profile.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
              </div>
            </div>

            {sched && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <h4 className="text-xs uppercase font-bold text-slate-400 mb-3">{isAr ? 'جدول العمل' : 'Work Schedule'}</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <span key={d} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${sched.workDays.includes(d) ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-300'}`}>
                      {isAr ? DAY_LABELS_AR[d] : DAY_LABELS_EN[d]}
                    </span>
                  ))}
                </div>
                <div className="flex gap-6 text-sm">
                  <span className="text-slate-500"><i className="fa-solid fa-clock text-indigo-400 me-1"></i> {sched.startTime} — {sched.endTime}</span>
                  <span className="text-slate-500"><i className="fa-solid fa-hourglass-half text-amber-400 me-1"></i> {sched.graceMinutes}m {isAr ? 'مهلة' : 'grace'}</span>
                  {sched.overtimeEnabled && <span className="text-indigo-600 font-bold"><i className="fa-solid fa-bolt me-1"></i> OT</span>}
                </div>
              </div>
            )}
          </div>

          {/* PIN Setup CTA (if PIN not set) */}
          {!profile.pinSet && !showPinSetup && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-dashed border-amber-300 p-6 text-center">
              <i className="fa-solid fa-lock text-5xl text-amber-500 mb-3"></i>
              <h3 className="text-lg font-extrabold text-amber-800 mb-1">
                {isAr ? 'أنشئ رمز PIN الخاص بك' : 'Set Your PIN Code'}
              </h3>
              <p className="text-sm text-amber-600 mb-4">
                {isAr ? 'رمز PIN مطلوب لتسجيل الحضور والانصراف' : 'PIN is required for attendance check-in/out'}
              </p>
              <button
                onClick={() => setShowPinSetup(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-2xl font-extrabold text-sm transition-colors shadow-lg shadow-amber-200"
              >
                <i className="fa-solid fa-key me-2"></i>
                {isAr ? 'إنشاء رمز PIN' : 'Create PIN'}
              </button>
            </div>
          )}

          {/* PIN Setup Form */}
          {showPinSetup && (
            <div className="bg-white rounded-2xl shadow-soft border border-indigo-200 p-6">
              <h3 className="font-extrabold text-slate-700 mb-4">
                <i className="fa-solid fa-key text-indigo-500 me-2"></i>
                {isAr ? 'إنشاء رمز PIN' : 'Create PIN Code'}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">{isAr ? 'رمز PIN (4-6 أرقام)' : 'PIN (4-6 digits)'}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • •"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">{isAr ? 'تأكيد الرمز' : 'Confirm PIN'}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • •"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSetPin}
                    disabled={actionLoading}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-extrabold text-sm transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <i className="fa-solid fa-circle-notch fa-spin me-2"></i> : <i className="fa-solid fa-check me-2"></i>}
                    {isAr ? 'حفظ' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setShowPinSetup(false); setNewPin(''); setConfirmPin(''); }}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PIN Status (if set) */}
          {profile.pinSet && !showPinSetup && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <i className="fa-solid fa-lock text-emerald-600 text-xl"></i>
              </div>
              <div className="flex-1">
                <p className="font-bold text-emerald-700">{isAr ? 'رمز PIN مفعّل' : 'PIN Code Active'}</p>
                <p className="text-xs text-emerald-500">{isAr ? 'جاهز لتسجيل الحضور' : 'Ready for attendance'}</p>
              </div>
              <button
                onClick={() => setShowPinSetup(true)}
                className="text-sm text-emerald-600 hover:text-emerald-800 font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <i className="fa-solid fa-pen me-1"></i> {isAr ? 'تغيير' : 'Change'}
              </button>
            </div>
          )}

          {/* Check-in / Check-out Card */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-extrabold text-slate-700 uppercase text-sm">{isAr ? 'الحضور والانصراف' : 'Attendance'}</h3>
              {gpsStatus === 'loading' && <span className="text-xs text-amber-500"><i className="fa-solid fa-circle-notch fa-spin"></i> GPS</span>}
              {gpsStatus === 'ok' && <span className="text-xs text-emerald-500"><i className="fa-solid fa-location-dot"></i> GPS OK</span>}
              {gpsStatus === 'err' && <span className="text-xs text-red-500"><i className="fa-solid fa-location-crosshairs"></i> GPS Error</span>}
            </div>

            {/* PIN Input */}
            {profile.pinSet && !checkedOut && (
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                  <i className="fa-solid fa-lock me-1"></i> {isAr ? 'رمز PIN' : 'Enter PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • •"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Check In */}
              <button
                onClick={handleCheckIn}
                disabled={actionLoading || checkedIn}
                className={`p-6 rounded-2xl font-extrabold text-lg transition-all flex flex-col items-center gap-2 ${
                  checkedIn
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-200 active:scale-95'
                }`}
              >
                {actionLoading ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
                ) : (
                  <i className={`fa-solid fa-right-to-bracket text-3xl ${checkedIn ? '' : 'animate-pulse'}`}></i>
                )}
                {checkedIn ? (
                  <span className="text-sm">{isAr ? 'تم الدخول' : 'Checked In'} ✓</span>
                ) : (
                  <span>{isAr ? 'تسجيل دخول' : 'Check In'}</span>
                )}
                {checkedIn && today?.checkIn && (
                  <span className="text-xs font-medium">{fmtTime(today.checkIn)}</span>
                )}
              </button>

              {/* Check Out */}
              <button
                onClick={handleCheckOut}
                disabled={actionLoading || !checkedIn || checkedOut}
                className={`p-6 rounded-2xl font-extrabold text-lg transition-all flex flex-col items-center gap-2 ${
                  !checkedIn || checkedOut
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-br from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-200 active:scale-95'
                }`}
              >
                {actionLoading ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
                ) : (
                  <i className="fa-solid fa-right-from-bracket text-3xl"></i>
                )}
                {checkedOut ? (
                  <span className="text-sm">{isAr ? 'تم الخروج' : 'Checked Out'} ✓</span>
                ) : (
                  <span>{isAr ? 'تسجيل خروج' : 'Check Out'}</span>
                )}
                {checkedOut && today?.checkOut && (
                  <span className="text-xs font-medium">{fmtTime(today.checkOut)}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">
          {/* Today's Status */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
            <h3 className="font-extrabold text-sm text-slate-500 uppercase mb-4">
              <i className="fa-solid fa-calendar-day me-1 text-indigo-400"></i>
              {isAr ? 'حالة اليوم' : "Today's Status"}
            </h3>
            {today ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{isAr ? 'دخول' : 'In'}</span>
                  <span className="font-bold text-sm font-mono">{fmtTime(today.checkIn)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{isAr ? 'خروج' : 'Out'}</span>
                  <span className="font-bold text-sm font-mono">{fmtTime(today.checkOut)}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{isAr ? 'المجموع' : 'Total'}</span>
                  <span className="font-extrabold text-slate-800">{fmtMinutes(today.totalMinutes)}</span>
                </div>
                {today.lateMinutes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-amber-500 text-sm">{isAr ? 'تأخير' : 'Late'}</span>
                    <span className="font-bold text-amber-600">{today.lateMinutes}m</span>
                  </div>
                )}
                {today.overtimeMinutes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-500 text-sm">{isAr ? 'إضافي' : 'Overtime'}</span>
                    <span className="font-bold text-indigo-600">{today.overtimeMinutes}m</span>
                  </div>
                )}
                <div className="pt-2 text-center">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    today.status === 'normal' ? 'bg-emerald-100 text-emerald-700' :
                    today.status === 'late' ? 'bg-amber-100 text-amber-700' :
                    today.status === 'incomplete' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {today.status === 'normal' ? (isAr ? 'منتظم' : 'Normal') :
                     today.status === 'late' ? (isAr ? 'متأخر' : 'Late') :
                     today.status === 'incomplete' ? (isAr ? 'غير مكتمل' : 'Incomplete') :
                     today.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-300">
                <i className="fa-solid fa-ghost text-3xl mb-2 block"></i>
                <p className="text-sm font-bold">{isAr ? 'لم تسجل حضور اليوم' : 'No attendance today'}</p>
              </div>
            )}
          </div>

          {/* Monthly Summary */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-5">
            <h3 className="font-extrabold text-sm text-slate-500 uppercase mb-4">
              <i className="fa-solid fa-chart-pie me-1 text-indigo-400"></i>
              {isAr ? 'ملخص الشهر' : 'Monthly Summary'}
            </h3>
            {summary ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{isAr ? 'أيام حضور' : 'Days Present'}</span>
                  <span className="font-extrabold text-emerald-600">{summary.daysPresent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{isAr ? 'إجمالي العمل' : 'Total Work'}</span>
                  <span className="font-extrabold text-slate-800">{fmtMinutes(summary.totalWorkMinutes)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{isAr ? 'تأخير' : 'Late'}</span>
                  <span className="font-bold text-amber-600">{fmtMinutes(summary.totalLateMinutes)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{isAr ? 'إضافي' : 'Overtime'}</span>
                  <span className="font-bold text-indigo-600">{fmtMinutes(summary.totalOvertimeMinutes)}</span>
                </div>
                {summary.totalAbsences > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">{isAr ? 'غياب' : 'Absences'}</span>
                    <span className="font-bold text-red-500">{summary.totalAbsences}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-slate-300 text-sm py-4">{isAr ? 'لا توجد بيانات' : 'No data yet'}</p>
            )}
          </div>

          {/* Quick Info */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2 text-xs text-slate-500">
            <p><i className="fa-solid fa-location-dot text-emerald-400 me-1"></i> {isAr ? 'يجب تفعيل GPS لتسجيل الحضور' : 'GPS must be enabled for attendance'}</p>
            <p><i className="fa-solid fa-lock text-indigo-400 me-1"></i> {isAr ? 'رمز PIN مطلوب عند كل تسجيل دخول/خروج' : 'PIN required for every check-in/out'}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HrEmployeeMeView;
