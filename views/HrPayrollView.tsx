import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { HrPayrollRun, HrPayslip, HrEmployee } from '../types';
import { hrPayrollService, hrEmployeesService, hrSocialSecurityService } from '../services/hrApiServices';
import { useLanguage } from '../context/LanguageContext';

// ───────── helpers ─────────
function fmtMinutes(mins: number) {
  if (!mins) return '0';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtMoney(amount: number) {
  return amount.toFixed(2) + ' JOD';
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
  closed: 'bg-slate-200 text-slate-800 border-slate-400',
};

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  approved: 'مُعتمد',
  rejected: 'مرفوض',
  closed: 'مغلق',
};

// ───────── Component ─────────
const HrPayrollView: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [run, setRun] = useState<(HrPayrollRun & { payslips: HrPayslip[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<HrPayslip | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    final_late_amount: 0,
    final_absence_amount: 0,
    final_overtime_amount: 0,
    overtime_multiplier: 1.0,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchRun = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrPayrollService.getRun(month);
      setRun(data);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchRun(); }, [fetchRun]);

  const handleGenerate = async () => {
    setGenerating(true);
    setMsg(null);
    try {
      await hrPayrollService.generate(month);
      setMsg({ text: isAr ? 'تم إنشاء مسودة الرواتب بنجاح' : 'Draft payroll generated successfully', type: 'ok' });
      fetchRun();
    } catch (e: any) {
      setMsg({ text: e?.message || 'Error generating payroll', type: 'err' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCloseMonth = async () => {
    if (!confirm(isAr ? 'هل أنت متأكد من إغلاق الشهر؟ لا يمكن التراجع.' : 'Are you sure you want to close this month? This cannot be undone.')) return;
    setClosing(true);
    try {
      await hrPayrollService.closeMonth(month);
      setMsg({ text: isAr ? 'تم إغلاق الشهر بنجاح' : 'Month closed successfully', type: 'ok' });
      fetchRun();
    } catch (e: any) {
      setMsg({ text: e?.message || 'Error closing month', type: 'err' });
    } finally {
      setClosing(false);
    }
  };

  const openPayslip = async (ps: HrPayslip) => {
    try {
      const full = await hrPayrollService.getPayslip(ps.id);
      setSelectedPayslip(full);
      setEditMode(false);
      setEditData({
        final_late_amount: full.finalLateAmount,
        final_absence_amount: full.finalAbsenceAmount,
        final_overtime_amount: full.finalOvertimeAmount,
        overtime_multiplier: full.overtimeMultiplier,
      });
    } catch (e: any) {
      setMsg({ text: e?.message || 'Error loading payslip', type: 'err' });
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedPayslip) return;
    setActionLoading(true);
    try {
      const updated = await hrPayrollService.updatePayslip(selectedPayslip.id, editData);
      setSelectedPayslip(updated);
      setEditMode(false);
      setMsg({ text: isAr ? 'تم حفظ التعديلات' : 'Changes saved', type: 'ok' });
      fetchRun();
    } catch (e: any) {
      setMsg({ text: e?.message || 'Error saving', type: 'err' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPayslip) return;
    setActionLoading(true);
    try {
      const updated = await hrPayrollService.approvePayslip(selectedPayslip.id);
      setSelectedPayslip(updated);
      setMsg({ text: isAr ? 'تم اعتماد القسيمة' : 'Payslip approved', type: 'ok' });
      fetchRun();
    } catch (e: any) {
      setMsg({ text: e?.message || 'Error approving', type: 'err' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayslip) return;
    setActionLoading(true);
    try {
      const updated = await hrPayrollService.rejectPayslip(selectedPayslip.id, rejectReason);
      setSelectedPayslip(updated);
      setShowRejectModal(false);
      setRejectReason('');
      setMsg({ text: isAr ? 'تم رفض القسيمة' : 'Payslip rejected', type: 'ok' });
      fetchRun();
    } catch (e: any) {
      setMsg({ text: e?.message || 'Error rejecting', type: 'err' });
    } finally {
      setActionLoading(false);
    }
  };

  // Summary
  const payslips = run?.payslips || [];
  const draftCount = payslips.filter(p => p.status === 'draft').length;
  const approvedCount = payslips.filter(p => p.status === 'approved').length;
  const rejectedCount = payslips.filter(p => p.status === 'rejected').length;
  const totalNet = payslips.reduce((s, p) => s + p.netSalary, 0);
  const canClose = run?.status === 'draft' && payslips.length > 0 && draftCount === 0;

  return (
    <Layout title={isAr ? 'الرواتب - HR' : 'HR Payroll'}>
      {/* Alert */}
      {msg && (
        <div className={`mb-4 p-4 rounded-2xl font-bold text-sm flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          <i className={`fa-solid ${msg.type === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
          {msg.text}
          <button className="ms-auto opacity-60 hover:opacity-100" onClick={() => setMsg(null)}><i className="fa-solid fa-xmark"></i></button>
        </div>
      )}

      {/* DETAIL VIEW - Selected Payslip */}
      {selectedPayslip ? (
        <div className="space-y-6">
          <button onClick={() => setSelectedPayslip(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-bold">
            <i className="fa-solid fa-arrow-left"></i> {isAr ? 'العودة للقائمة' : 'Back to list'}
          </button>

          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800">{selectedPayslip.employeeName || `Employee #${selectedPayslip.employeeId}`}</h2>
                <p className="text-slate-400 text-sm">{isAr ? 'قسيمة راتب — ' : 'Payslip — '}{month}</p>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${STATUS_COLORS[selectedPayslip.status || 'draft']}`}>
                {isAr ? STATUS_AR[selectedPayslip.status || 'draft'] : (selectedPayslip.status || 'draft').toUpperCase()}
              </span>
            </div>

            {/* Attendance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">{isAr ? 'أيام عمل' : 'Days Worked'}</p>
                <p className="text-2xl font-extrabold text-slate-800">{selectedPayslip.daysWorked}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-xs text-red-400 mb-1">{isAr ? 'أيام غياب' : 'Absent Days'}</p>
                <p className="text-2xl font-extrabold text-red-600">{selectedPayslip.suggestedAbsentDays}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-xs text-amber-400 mb-1">{isAr ? 'دقائق تأخير' : 'Late Min.'}</p>
                <p className="text-2xl font-extrabold text-amber-600">{selectedPayslip.suggestedLateMinutes}</p>
                {selectedPayslip.lateThresholdExceeded && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">⚠ {isAr ? 'تجاوز 180 دقيقة' : '>180 min threshold'}</p>
                )}
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <p className="text-xs text-indigo-400 mb-1">{isAr ? 'دقائق إضافية' : 'OT Min.'}</p>
                <p className="text-2xl font-extrabold text-indigo-600">{selectedPayslip.suggestedOvertimeMinutes}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <p className="text-xs text-orange-400 mb-1">{isAr ? 'دقائق استراحة' : 'Break Min.'}</p>
                <p className="text-2xl font-extrabold text-orange-600">{selectedPayslip.totalBreakMinutes}</p>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="bg-slate-50 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-extrabold text-slate-500 uppercase mb-4">
                {isAr ? 'التفاصيل المالية' : 'Financial Breakdown'}
              </h3>
              <div className="space-y-3">
                {/* Basic Salary */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">{isAr ? 'الراتب الأساسي' : 'Basic Salary'}</span>
                  <span className="font-bold text-slate-800">{fmtMoney(selectedPayslip.basicSalary)}</span>
                </div>

                {/* Social Security */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">{isAr ? 'ضمان اجتماعي (موظف)' : 'Social Security (Employee)'}</span>
                  <span className="font-bold text-red-600">- {fmtMoney(selectedPayslip.employeeSs)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">{isAr ? 'ضمان اجتماعي (شركة) — للتقارير فقط' : 'Social Security (Employer) — reporting only'}</span>
                  <span className="font-bold text-slate-400">{fmtMoney(selectedPayslip.employerSs)}</span>
                </div>

                <div className="border-t border-slate-200 pt-3"></div>

                {/* Lateness */}
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <span className="text-slate-600">{isAr ? 'خصم تأخير' : 'Late Deduction'}</span>
                    <span className="text-xs text-slate-400 ms-2">({isAr ? 'مقترح' : 'suggested'}: {fmtMoney(selectedPayslip.suggestedLateAmount)})</span>
                  </div>
                  {editMode ? (
                    <input type="number" step="0.01" min="0" value={editData.final_late_amount}
                      onChange={e => setEditData({ ...editData, final_late_amount: parseFloat(e.target.value) || 0 })}
                      className="w-32 text-right border border-slate-300 rounded-lg px-3 py-1 text-sm font-bold" />
                  ) : (
                    <span className="font-bold text-red-600">- {fmtMoney(selectedPayslip.finalLateAmount)}</span>
                  )}
                </div>

                {/* Absence */}
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <span className="text-slate-600">{isAr ? 'خصم غياب' : 'Absence Deduction'}</span>
                    <span className="text-xs text-slate-400 ms-2">({isAr ? 'مقترح' : 'suggested'}: {fmtMoney(selectedPayslip.suggestedAbsenceAmount)})</span>
                  </div>
                  {editMode ? (
                    <input type="number" step="0.01" min="0" value={editData.final_absence_amount}
                      onChange={e => setEditData({ ...editData, final_absence_amount: parseFloat(e.target.value) || 0 })}
                      className="w-32 text-right border border-slate-300 rounded-lg px-3 py-1 text-sm font-bold" />
                  ) : (
                    <span className="font-bold text-red-600">- {fmtMoney(selectedPayslip.finalAbsenceAmount)}</span>
                  )}
                </div>

                {/* Manual Deductions */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">{isAr ? 'خصومات إدارية' : 'Manual Deductions'}</span>
                  <span className="font-bold text-red-600">- {fmtMoney(selectedPayslip.manualDeductionsTotal)}</span>
                </div>

                <div className="border-t border-slate-200 pt-3"></div>

                {/* Overtime */}
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <span className="text-slate-600">{isAr ? 'عمل إضافي' : 'Overtime'}</span>
                    <span className="text-xs text-slate-400 ms-2">
                      ({isAr ? 'مقترح' : 'suggested'}: {fmtMoney(selectedPayslip.suggestedOvertimeAmount)})
                      {editMode && (
                        <span className="ms-2">× <input type="number" step="0.25" min="1" max="3" value={editData.overtime_multiplier}
                          onChange={e => setEditData({ ...editData, overtime_multiplier: parseFloat(e.target.value) || 1 })}
                          className="w-16 text-center border border-slate-300 rounded px-1 py-0.5 text-xs" /></span>
                      )}
                    </span>
                  </div>
                  {editMode ? (
                    <input type="number" step="0.01" min="0" value={editData.final_overtime_amount}
                      onChange={e => setEditData({ ...editData, final_overtime_amount: parseFloat(e.target.value) || 0 })}
                      className="w-32 text-right border border-slate-300 rounded-lg px-3 py-1 text-sm font-bold" />
                  ) : (
                    <span className="font-bold text-emerald-600">+ {fmtMoney(selectedPayslip.finalOvertimeAmount)}</span>
                  )}
                </div>
                {!editMode && selectedPayslip.overtimeMultiplier !== 1 && (
                  <p className="text-xs text-indigo-500 text-right">× {selectedPayslip.overtimeMultiplier} {isAr ? 'مضاعف' : 'multiplier'}</p>
                )}

                <div className="border-t-2 border-slate-300 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-extrabold text-slate-800">{isAr ? 'صافي الراتب' : 'Net Salary'}</span>
                    <span className="text-2xl font-extrabold text-emerald-600">{fmtMoney(selectedPayslip.netSalary)}</span>
                  </div>
                  <p className="text-xs text-slate-400 text-right mt-1">{isAr ? 'دينار أردني' : 'Jordanian Dinar'}</p>
                </div>
              </div>
            </div>

            {/* Reject Reason Display */}
            {selectedPayslip.rejectReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-bold text-red-700"><i className="fa-solid fa-ban me-1"></i> {isAr ? 'سبب الرفض' : 'Reject Reason'}:</p>
                <p className="text-sm text-red-600 mt-1">{selectedPayslip.rejectReason}</p>
              </div>
            )}

            {/* Action Buttons */}
            {selectedPayslip.status === 'draft' && run?.status === 'draft' && (
              <div className="flex flex-wrap gap-3">
                {editMode ? (
                  <>
                    <button onClick={handleSaveEdit} disabled={actionLoading}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50">
                      {actionLoading && <i className="fa-solid fa-circle-notch fa-spin me-2"></i>}
                      <i className="fa-solid fa-floppy-disk me-1"></i> {isAr ? 'حفظ التعديلات' : 'Save Changes'}
                    </button>
                    <button onClick={() => setEditMode(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold text-sm">
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleApprove} disabled={actionLoading}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50">
                      <i className="fa-solid fa-check me-1"></i> {isAr ? 'اعتماد' : 'Approve'}
                    </button>
                    <button onClick={() => setEditMode(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold text-sm">
                      <i className="fa-solid fa-pen me-1"></i> {isAr ? 'تعديل المبالغ' : 'Edit Amounts'}
                    </button>
                    <button onClick={() => setShowRejectModal(true)}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm">
                      <i className="fa-solid fa-xmark me-1"></i> {isAr ? 'رفض' : 'Reject'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* PDF Download (only if approved) */}
            {selectedPayslip.status === 'approved' && (
              <div className="mt-4">
                <a href={hrPayrollService.downloadPdf(selectedPayslip.id)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition">
                  <i className="fa-solid fa-file-pdf"></i> {isAr ? 'تحميل PDF' : 'Download PDF'}
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{isAr ? 'الشهر' : 'Month'}</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                  className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" />
              </div>
              {(!run || run.status === 'draft') && (
                <button onClick={handleGenerate} disabled={generating}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition">
                  {generating ? <i className="fa-solid fa-circle-notch fa-spin me-2"></i> : <i className="fa-solid fa-calculator me-2"></i>}
                  {run ? (isAr ? 'إعادة حساب المسودة' : 'Recalculate Draft') : (isAr ? 'إنشاء مسودة الرواتب' : 'Generate Draft Payroll')}
                </button>
              )}
              {canClose && (
                <button onClick={handleCloseMonth} disabled={closing}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition">
                  {closing ? <i className="fa-solid fa-circle-notch fa-spin me-2"></i> : <i className="fa-solid fa-lock me-2"></i>}
                  {isAr ? 'إغلاق الشهر' : 'Close Month'}
                </button>
              )}
            </div>
          </div>

          {/* Run Status */}
          {run && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl shadow-soft border p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">{isAr ? 'حالة الدورة' : 'Run Status'}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[run.status || 'draft']}`}>
                  {isAr ? STATUS_AR[run.status || 'draft'] : (run.status || 'draft').toUpperCase()}
                </span>
              </div>
              <div className="bg-white rounded-2xl shadow-soft border p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">{isAr ? 'إجمالي' : 'Total'}</p>
                <p className="text-lg font-extrabold text-slate-800">{payslips.length}</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-center">
                <p className="text-xs text-emerald-500 mb-1">{isAr ? 'معتمد' : 'Approved'}</p>
                <p className="text-lg font-extrabold text-emerald-600">{approvedCount}</p>
              </div>
              <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-4 text-center">
                <p className="text-xs text-yellow-500 mb-1">{isAr ? 'مسودة' : 'Draft'}</p>
                <p className="text-lg font-extrabold text-yellow-600">{draftCount}</p>
              </div>
              <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-4 text-center">
                <p className="text-xs text-indigo-500 mb-1">{isAr ? 'إجمالي صافي' : 'Total Net'}</p>
                <p className="text-lg font-extrabold text-indigo-600">{fmtMoney(totalNet)}</p>
              </div>
            </div>
          )}

          {/* Payslips Table */}
          {loading ? (
            <div className="p-12 text-center text-slate-400"><i className="fa-solid fa-circle-notch fa-spin text-3xl"></i></div>
          ) : !run ? (
            <div className="bg-white rounded-2xl shadow-soft border p-12 text-center">
              <i className="fa-solid fa-receipt text-5xl text-slate-200 mb-4"></i>
              <p className="text-slate-400 font-bold">{isAr ? 'لا توجد دورة رواتب لهذا الشهر' : 'No payroll run for this month'}</p>
              <p className="text-slate-300 text-sm mt-1">{isAr ? 'اضغط "إنشاء مسودة الرواتب" للبدء' : 'Click "Generate Draft Payroll" to start'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-start px-4 py-3 font-bold text-slate-500">{isAr ? 'الموظف' : 'Employee'}</th>
                    <th className="text-center px-3 py-3 font-bold text-slate-500">{isAr ? 'أساسي' : 'Basic'}</th>
                    <th className="text-center px-3 py-3 font-bold text-slate-500 hidden md:table-cell">{isAr ? 'تأخير' : 'Late'}</th>
                    <th className="text-center px-3 py-3 font-bold text-slate-500 hidden md:table-cell">{isAr ? 'غياب' : 'Absent'}</th>
                    <th className="text-center px-3 py-3 font-bold text-slate-500 hidden md:table-cell">{isAr ? 'إضافي' : 'OT'}</th>
                    <th className="text-center px-3 py-3 font-bold text-slate-500">{isAr ? 'صافي' : 'Net'}</th>
                    <th className="text-center px-3 py-3 font-bold text-slate-500">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="text-center px-3 py-3 font-bold text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map(ps => (
                    <tr key={ps.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{ps.employeeName || `#${ps.employeeId}`}</p>
                      </td>
                      <td className="text-center px-3 py-3 font-mono text-slate-600">{ps.basicSalary.toFixed(2)}</td>
                      <td className="text-center px-3 py-3 hidden md:table-cell">
                        <span className="text-amber-600 font-bold">{ps.suggestedLateMinutes}m</span>
                        {ps.lateThresholdExceeded && <span className="text-red-500 ms-1" title=">180min">⚠</span>}
                      </td>
                      <td className="text-center px-3 py-3 hidden md:table-cell">
                        <span className="text-red-600 font-bold">{ps.suggestedAbsentDays}d</span>
                      </td>
                      <td className="text-center px-3 py-3 hidden md:table-cell">
                        <span className="text-indigo-600 font-bold">{ps.suggestedOvertimeMinutes}m</span>
                      </td>
                      <td className="text-center px-3 py-3 font-mono font-bold text-emerald-600">{ps.netSalary.toFixed(2)}</td>
                      <td className="text-center px-3 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_COLORS[ps.status]}`}>
                          {isAr ? STATUS_AR[ps.status] : ps.status}
                        </span>
                      </td>
                      <td className="text-center px-3 py-3">
                        <button onClick={() => openPayslip(ps)}
                          className="text-indigo-500 hover:text-indigo-700 font-bold text-xs transition">
                          <i className="fa-solid fa-eye me-1"></i> {isAr ? 'تفاصيل' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-800 mb-4">
              <i className="fa-solid fa-ban text-red-500 me-2"></i>
              {isAr ? 'سبب الرفض' : 'Rejection Reason'}
            </h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder={isAr ? 'أدخل سبب الرفض...' : 'Enter rejection reason...'}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mb-4" />
            <div className="flex gap-3">
              <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                {actionLoading && <i className="fa-solid fa-circle-notch fa-spin me-2"></i>}
                {isAr ? 'تأكيد الرفض' : 'Confirm Reject'}
              </button>
              <button onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-sm">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default HrPayrollView;
