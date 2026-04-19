import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { HrEmployee } from '../types';
import { hrEmployeesService, hrClinicLocationService } from '../services/hrApiServices';
import { useLanguage } from '../context/LanguageContext';

const DAYS = [
  { value: 1, label: 'Mon', labelAr: 'إثنين' },
  { value: 2, label: 'Tue', labelAr: 'ثلاثاء' },
  { value: 3, label: 'Wed', labelAr: 'أربعاء' },
  { value: 4, label: 'Thu', labelAr: 'خميس' },
  { value: 5, label: 'Fri', labelAr: 'جمعة' },
  { value: 6, label: 'Sat', labelAr: 'سبت' },
  { value: 7, label: 'Sun', labelAr: 'أحد' },
];

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

interface EmployeeFormData {
  full_name: string;
  username: string;
  password: string;
  phone: string;
  email: string;
  basic_salary: number;
  role: 'HR_ADMIN' | 'HR_EMPLOYEE';
  work_days: number[];
  start_time: string;
  end_time: string;
  grace_minutes: number;
  overtime_enabled: boolean;
}

const defaultForm: EmployeeFormData = {
  full_name: '',
  username: '',
  password: generatePassword(),
  phone: '',
  email: '',
  basic_salary: 0,
  role: 'HR_EMPLOYEE',
  work_days: [1, 2, 3, 4, 5],
  start_time: '09:00',
  end_time: '17:00',
  grace_minutes: 10,
  overtime_enabled: true,
};

const HrEmployeesView: React.FC = () => {
  const { t, language } = useLanguage();
  const isAr = language === 'ar';

  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EmployeeFormData>({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [revealPassword, setRevealPassword] = useState(false);
  const [pwSecondsLeft, setPwSecondsLeft] = useState(30);
  const [error, setError] = useState('');

  // Location config
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationForm, setLocationForm] = useState({ latitude: '', longitude: '', radius: '100', clinic_id: 0 });
  const [clinics, setClinics] = useState<any[]>([]);

  // SECURITY: auto-clear newly issued password from memory after 30 seconds.
  // Reduces window for screen-sharing / shoulder-surfing leaks.
  useEffect(() => {
    if (!newPassword) {
      setRevealPassword(false);
      setPwSecondsLeft(30);
      return;
    }
    setPwSecondsLeft(30);
    const interval = setInterval(() => {
      setPwSecondsLeft((s) => {
        if (s <= 1) {
          setNewPassword(null);
          setRevealPassword(false);
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [newPassword]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, locs] = await Promise.all([
        hrEmployeesService.getAll(),
        hrClinicLocationService.getAll(),
      ]);
      setEmployees(emps);
      setClinics(locs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...defaultForm, password: generatePassword() });
    setError('');
    setShowForm(true);
  };

  const openEdit = (emp: HrEmployee) => {
    setEditingId(emp.id);
    setForm({
      full_name: emp.fullName,
      username: emp.username,
      password: '',
      phone: emp.phone || '',
      email: emp.email || '',
      basic_salary: (emp as any).basicSalary || 0,
      role: (emp as any).role || 'HR_EMPLOYEE',
      work_days: emp.schedule?.workDays || [1, 2, 3, 4, 5],
      start_time: emp.schedule?.startTime?.slice(0, 5) || '09:00',
      end_time: emp.schedule?.endTime?.slice(0, 5) || '17:00',
      grace_minutes: emp.schedule?.graceMinutes ?? 10,
      overtime_enabled: emp.schedule?.overtimeEnabled !== false,
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.username) {
      setError(isAr ? 'الاسم واسم المستخدم مطلوبان' : 'Name and username are required');
      return;
    }
    if (!editingId && !form.password) {
      setError(isAr ? 'كلمة المرور مطلوبة' : 'Password is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await hrEmployeesService.update(editingId, {
          full_name: form.full_name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          basic_salary: form.basic_salary,
          role: form.role,
          work_days: form.work_days,
          start_time: form.start_time,
          end_time: form.end_time,
          grace_minutes: form.grace_minutes,
          overtime_enabled: form.overtime_enabled,
        } as any);
      } else {
        await hrEmployeesService.create({
          full_name: form.full_name,
          username: form.username,
          password: form.password,
          phone: form.phone || undefined,
          email: form.email || undefined,
          basic_salary: form.basic_salary,
          role: form.role,
          work_days: form.work_days,
          start_time: form.start_time,
          end_time: form.end_time,
          grace_minutes: form.grace_minutes,
          overtime_enabled: form.overtime_enabled,
        } as any);
      }
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm(isAr ? 'تعطيل هذا الموظف؟' : 'Deactivate this employee?')) return;
    try {
      await hrEmployeesService.deactivate(id);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (id: number) => {
    setResettingId(id);
    try {
      const result = await hrEmployeesService.resetPassword(id);
      setNewPassword(result.password);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResettingId(null);
    }
  };

  const handleSaveLocation = async () => {
    try {
      await hrClinicLocationService.update({
        clinic_id: locationForm.clinic_id || undefined,
        latitude: parseFloat(locationForm.latitude),
        longitude: parseFloat(locationForm.longitude),
        allowed_radius_meters: parseInt(locationForm.radius) || 100,
      });
      setShowLocationModal(false);
      await fetchData();
      alert(isAr ? 'تم حفظ الموقع' : 'Location saved');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const activeCount = employees.filter(e => e.status === 'active').length;
  const bioCount = employees.filter(e => e.bioRegistered).length;

  return (
    <Layout title={isAr ? 'إدارة الموظفين - HR' : 'HR Employees'}>
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-soft border border-gray-100 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-800">{activeCount}</div>
            <div className="text-xs font-bold uppercase text-slate-400">{isAr ? 'موظف نشط' : 'Active'}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-soft border border-gray-100 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-fingerprint"></i>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-800">{bioCount}</div>
            <div className="text-xs font-bold uppercase text-slate-400">{isAr ? 'بصمة مسجلة' : 'Biometric'}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-soft border border-gray-100 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-800">
              {clinics.filter(c => c.latitude != null).length}/{clinics.length}
            </div>
            <div className="text-xs font-bold uppercase text-slate-400">{isAr ? 'مواقع محددة' : 'Locations Set'}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={openAdd} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all flex items-center gap-2">
          <i className="fa-solid fa-plus"></i> {isAr ? 'إضافة موظف' : 'Add Employee'}
        </button>
        <button onClick={() => {
          const first = clinics[0];
          setLocationForm({
            latitude: first?.latitude?.toString() || '',
            longitude: first?.longitude?.toString() || '',
            radius: first?.allowed_radius_meters?.toString() || '100',
            clinic_id: first?.id || 0,
          });
          setShowLocationModal(true);
        }} className="bg-white text-slate-700 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-50 border border-slate-200 transition-all flex items-center gap-2">
          <i className="fa-solid fa-map-pin"></i> {isAr ? 'إعدادات الموقع' : 'Location Settings'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fa-solid fa-users text-4xl mb-3 block"></i>
            <p className="font-bold">{isAr ? 'لا يوجد موظفين بعد' : 'No employees yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-start">{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'اسم المستخدم' : 'Username'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'البصمة' : 'Bio'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'الراتب' : 'Salary'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الدوام' : 'Schedule'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{emp.fullName}</div>
                      {emp.phone && <div className="text-xs text-slate-400">{emp.phone}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.username}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {emp.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطّل' : 'Inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {emp.bioRegistered ? (
                        <i className="fa-solid fa-fingerprint text-emerald-500"></i>
                      ) : (
                        <i className="fa-solid fa-fingerprint text-slate-300"></i>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm font-bold text-slate-700">
                      {((emp as any).basicSalary || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {emp.schedule ? (
                        <>
                          <span>{emp.schedule.startTime?.slice(0,5)} - {emp.schedule.endTime?.slice(0,5)}</span>
                          <br />
                          <span className="text-[10px]">
                            {emp.schedule.workDays?.map(d => DAYS.find(dd => dd.value === d)?.[isAr ? 'labelAr' : 'label']).join(', ')}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(emp)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="Edit">
                          <i className="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button onClick={() => handleResetPassword(emp.id)} disabled={resettingId === emp.id} className="p-2 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors" title="Reset Password">
                          {resettingId === emp.id ? <i className="fa-solid fa-circle-notch fa-spin text-xs"></i> : <i className="fa-solid fa-key text-xs"></i>}
                        </button>
                        {emp.status === 'active' && (
                          <button onClick={() => handleDeactivate(emp.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Deactivate">
                            <i className="fa-solid fa-ban text-xs"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Password Display Modal */}
      {newPassword && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-key text-amber-600 text-2xl"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</h3>
            <div className="bg-slate-100 rounded-xl p-4 font-mono text-lg tracking-widest mb-2 flex items-center justify-center gap-3">
              <span aria-label={isAr ? 'كلمة المرور' : 'password'}>
                {revealPassword ? newPassword : '•'.repeat(newPassword.length)}
              </span>
              <button
                onClick={() => setRevealPassword(v => !v)}
                className="text-slate-400 hover:text-primary"
                title={revealPassword ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Reveal')}
              >
                <i className={`fa-solid ${revealPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
              <button onClick={() => copyToClipboard(newPassword)} className="text-slate-400 hover:text-primary" title={isAr ? 'نسخ' : 'Copy'}>
                <i className="fa-solid fa-copy"></i>
              </button>
            </div>
            <p className="text-xs text-amber-600 mb-2">
              <i className="fa-solid fa-clock"></i>{' '}
              {isAr
                ? `ستختفي تلقائياً خلال ${pwSecondsLeft} ثانية`
                : `Auto-clears in ${pwSecondsLeft}s`}
            </p>
            <p className="text-xs text-slate-400 mb-4">{isAr ? 'شاركها مع الموظف. لن تظهر مرة أخرى.' : 'Share with employee. Will not appear again.'}</p>
            <button onClick={() => setNewPassword(null)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold w-full">
              {isAr ? 'تم' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Employee Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="bg-indigo-600 p-5 rounded-t-2xl flex justify-between items-center text-white">
              <h3 className="text-lg font-bold">
                <i className="fa-solid fa-user-plus mr-2"></i>
                {editingId ? (isAr ? 'تعديل موظف' : 'Edit Employee') : (isAr ? 'إضافة موظف' : 'Add Employee')}
              </h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation"></i> {error}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'الاسم الكامل' : 'Full Name'} *</label>
                <input type="text" className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>

              {!editingId && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'اسم المستخدم' : 'Username'} *</label>
                    <input type="text" className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none font-mono" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'كلمة المرور' : 'Password'} *</label>
                    <div className="flex gap-2">
                      <input type="text" className="flex-1 p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none font-mono" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                      <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500" title="Generate">
                        <i className="fa-solid fa-rotate"></i>
                      </button>
                      <button type="button" onClick={() => copyToClipboard(form.password)} className="px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500" title="Copy">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'الهاتف' : 'Phone'}</label>
                  <input type="text" className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'الإيميل' : 'Email'}</label>
                  <input type="email" className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'الراتب الأساسي (JOD)' : 'Basic Salary (JOD)'}</label>
                  <input type="number" step="0.01" min="0" className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.basic_salary} onChange={e => setForm({ ...form, basic_salary: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'الصلاحية' : 'Role'}</label>
                  <select className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
                    <option value="HR_EMPLOYEE">{isAr ? 'موظف' : 'Employee'}</option>
                    <option value="HR_ADMIN">{isAr ? 'مسؤول HR' : 'HR Admin'}</option>
                  </select>
                </div>
              </div>

              {/* Schedule Section */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-clock text-indigo-500"></i> {isAr ? 'جدول العمل' : 'Work Schedule'}
                </h4>

                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{isAr ? 'أيام العمل' : 'Work Days'}</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {DAYS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        const wd = form.work_days.includes(d.value)
                          ? form.work_days.filter(x => x !== d.value)
                          : [...form.work_days, d.value].sort();
                        setForm({ ...form, work_days: wd });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${form.work_days.includes(d.value) ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {isAr ? d.labelAr : d.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'بداية الدوام' : 'Start Time'}</label>
                    <input type="time" className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'نهاية الدوام' : 'End Time'}</label>
                    <input type="time" className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'فترة السماح (دقائق)' : 'Grace (min)'}</label>
                    <input type="number" min={0} max={60} className="w-full p-3 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none" value={form.grace_minutes} onChange={e => setForm({ ...form, grace_minutes: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.overtime_enabled} onChange={e => setForm({ ...form, overtime_enabled: e.target.checked })} className="w-5 h-5 rounded accent-indigo-600" />
                      <span className="text-sm font-bold text-slate-700">{isAr ? 'حساب إضافي' : 'Overtime'}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (editingId ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء' : 'Create'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Settings Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-map-pin text-amber-500"></i> {isAr ? 'إعدادات موقع العيادة' : 'Clinic Location Settings'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {isAr ? 'حدد إحداثيات العيادة لتفعيل نظام الحضور بالموقع الجغرافي' : 'Set clinic coordinates to enable GPS attendance geo-fence'}
            </p>

            {clinics.length > 1 && (
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'العيادة' : 'Clinic'}</label>
                <select className="w-full p-3 rounded-xl border border-gray-200 outline-none" value={locationForm.clinic_id} onChange={e => {
                  const cid = parseInt(e.target.value);
                  const c = clinics.find(cc => cc.id === cid);
                  setLocationForm({
                    clinic_id: cid,
                    latitude: c?.latitude?.toString() || '',
                    longitude: c?.longitude?.toString() || '',
                    radius: c?.allowed_radius_meters?.toString() || '100',
                  });
                }}>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Latitude</label>
                <input type="text" className="w-full p-3 rounded-xl border border-gray-200 outline-none font-mono text-sm" placeholder="31.9539" value={locationForm.latitude} onChange={e => setLocationForm({ ...locationForm, latitude: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Longitude</label>
                <input type="text" className="w-full p-3 rounded-xl border border-gray-200 outline-none font-mono text-sm" placeholder="35.9106" value={locationForm.longitude} onChange={e => setLocationForm({ ...locationForm, longitude: e.target.value })} />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{isAr ? 'نطاق السماح (متر)' : 'Allowed Radius (m)'}</label>
              <input type="number" min={10} max={5000} className="w-full p-3 rounded-xl border border-gray-200 outline-none" value={locationForm.radius} onChange={e => setLocationForm({ ...locationForm, radius: e.target.value })} />
            </div>

            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    pos => setLocationForm({ ...locationForm, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }),
                    () => alert(isAr ? 'تعذر الحصول على الموقع' : 'Could not get location')
                  );
                }
              }}
              className="w-full mb-4 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-crosshairs"></i> {isAr ? 'استخدم موقعي الحالي' : 'Use My Current Location'}
            </button>

            <div className="flex gap-3">
              <button onClick={() => setShowLocationModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleSaveLocation} className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white shadow-lg hover:bg-indigo-700">
                {isAr ? 'حفظ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default HrEmployeesView;
