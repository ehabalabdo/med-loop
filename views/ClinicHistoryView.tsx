
import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { ClinicService, PatientService, AppointmentService, BillingService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Patient, Clinic, Appointment, Invoice, VisitData, UserRole } from '../types';

type DateFilter = 'today' | 'week' | 'month' | 'year' | 'all';

interface ClinicStats {
  clinicId: string;
  clinicName: string;
  totalPatients: number;
  totalVisits: number;
  completedVisits: number;
  waitingNow: number;
  inProgressNow: number;
  totalRevenue: number;
  paidRevenue: number;
  unpaidRevenue: number;
  totalAppointments: number;
  scheduledAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  visits: (VisitData & { patientName: string; patientPhone: string })[];
}

const ClinicHistoryView: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isAr = language === 'ar';

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [selectedClinicId, setSelectedClinicId] = useState<string>('all');
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null);

  // Fetch all data
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [c, p, a, inv] = await Promise.all([
          ClinicService.getActive(),
          PatientService.getAllForRegistry(user),
          AppointmentService.getAll(user),
          BillingService.getAll(user),
        ]);
        setClinics(c);
        setPatients(p);
        setAppointments(a);
        setInvoices(inv);
      } catch (err) {
        console.error('[ClinicHistory] Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  // Date filter bounds
  const getDateBounds = (filter: DateFilter): { start: number; end: number } => {
    const now = new Date();
    const end = now.getTime();
    let start = 0;
    switch (filter) {
      case 'today': {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start = d.getTime();
        break;
      }
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        d.setHours(0, 0, 0, 0);
        start = d.getTime();
        break;
      }
      case 'month': {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        start = d.getTime();
        break;
      }
      case 'year': {
        const d = new Date(now.getFullYear(), 0, 1);
        start = d.getTime();
        break;
      }
      case 'all':
      default:
        start = 0;
    }
    return { start, end };
  };

  // Compute stats
  const clinicStats = useMemo(() => {
    const { start, end } = getDateBounds(dateFilter);
    const statsMap = new Map<string, ClinicStats>();

    // Determine which clinics the user can see
    let visibleClinics = clinics.filter(c => c.active && c.category === 'clinic');
    if (user?.role === UserRole.DOCTOR) {
      visibleClinics = visibleClinics.filter(c => user.clinicIds?.includes(c.id));
    }

    // Initialize stats for each clinic
    visibleClinics.forEach(c => {
      statsMap.set(c.id, {
        clinicId: c.id,
        clinicName: c.name,
        totalPatients: 0,
        totalVisits: 0,
        completedVisits: 0,
        waitingNow: 0,
        inProgressNow: 0,
        totalRevenue: 0,
        paidRevenue: 0,
        unpaidRevenue: 0,
        totalAppointments: 0,
        scheduledAppointments: 0,
        cancelledAppointments: 0,
        noShowAppointments: 0,
        visits: [],
      });
    });

    // Build a visit→clinicId lookup for invoices
    const visitClinicMap = new Map<string, string>();

    // Process patient visits
    const patientClinicSet = new Map<string, Set<string>>(); // clinicId → Set<patientId>

    patients.forEach(p => {
      const allVisits: VisitData[] = [...(p.history || [])];
      // Include currentVisit if it has a valid visitId
      if (p.currentVisit?.visitId && p.currentVisit.visitId.trim() !== '') {
        allVisits.push(p.currentVisit);
      }

      allVisits.forEach(v => {
        if (!v.clinicId || !statsMap.has(v.clinicId)) return;
        if (v.date < start || v.date > end) return;

        const stats = statsMap.get(v.clinicId)!;
        visitClinicMap.set(v.visitId, v.clinicId);

        // Track unique patients per clinic
        if (!patientClinicSet.has(v.clinicId)) {
          patientClinicSet.set(v.clinicId, new Set());
        }
        patientClinicSet.get(v.clinicId)!.add(p.id);

        stats.totalVisits++;
        if (v.status === 'completed') stats.completedVisits++;
        if (v.status === 'waiting') stats.waitingNow++;
        if (v.status === 'in-progress') stats.inProgressNow++;

        // Add to visits list
        stats.visits.push({
          ...v,
          patientName: p.name,
          patientPhone: p.phone,
        });
      });
    });

    // Set unique patient counts
    patientClinicSet.forEach((patientSet, clinicId) => {
      const stats = statsMap.get(clinicId);
      if (stats) stats.totalPatients = patientSet.size;
    });

    // Process appointments
    appointments.forEach(a => {
      if (!statsMap.has(a.clinicId)) return;
      if (a.date < start || a.date > end) return;

      const stats = statsMap.get(a.clinicId)!;
      stats.totalAppointments++;
      if (a.status === 'scheduled') stats.scheduledAppointments++;
      if (a.status === 'cancelled') stats.cancelledAppointments++;
      if (a.status === 'no-show') stats.noShowAppointments++;
    });

    // Process invoices (link to clinic via visitId)
    invoices.forEach(inv => {
      const clinicId = visitClinicMap.get(inv.visitId);
      if (!clinicId || !statsMap.has(clinicId)) return;
      if (inv.createdAt < start || inv.createdAt > end) return;

      const stats = statsMap.get(clinicId)!;
      stats.totalRevenue += inv.totalAmount || 0;
      stats.paidRevenue += inv.paidAmount || 0;
      stats.unpaidRevenue += (inv.totalAmount || 0) - (inv.paidAmount || 0);
    });

    // Sort visits by date descending
    statsMap.forEach(stats => {
      stats.visits.sort((a, b) => b.date - a.date);
    });

    return Array.from(statsMap.values());
  }, [clinics, patients, appointments, invoices, dateFilter, user]);

  // Filter by selected clinic
  const filteredStats = useMemo(() => {
    if (selectedClinicId === 'all') return clinicStats;
    return clinicStats.filter(s => s.clinicId === selectedClinicId);
  }, [clinicStats, selectedClinicId]);

  // Grand totals
  const totals = useMemo(() => {
    return filteredStats.reduce(
      (acc, s) => ({
        patients: acc.patients + s.totalPatients,
        visits: acc.visits + s.totalVisits,
        completed: acc.completed + s.completedVisits,
        revenue: acc.revenue + s.totalRevenue,
        paid: acc.paid + s.paidRevenue,
        unpaid: acc.unpaid + s.unpaidRevenue,
        appointments: acc.appointments + s.totalAppointments,
      }),
      { patients: 0, visits: 0, completed: 0, revenue: 0, paid: 0, unpaid: 0, appointments: 0 }
    );
  }, [filteredStats]);

  const formatDate = (ts: number) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString(isAr ? 'ar-JO' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ${isAr ? 'د.أ' : 'JOD'}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    if (isAr) {
      switch (status) {
        case 'completed': return 'مكتمل';
        case 'in-progress': return 'جاري المعاينة';
        case 'waiting': return 'انتظار';
        default: return status;
      }
    }
    switch (status) {
      case 'completed': return 'Completed';
      case 'in-progress': return 'In Progress';
      case 'waiting': return 'Waiting';
      default: return status;
    }
  };

  const dateFilterLabels: Record<DateFilter, { en: string; ar: string }> = {
    today: { en: 'Today', ar: 'اليوم' },
    week: { en: 'This Week', ar: 'هذا الأسبوع' },
    month: { en: 'This Month', ar: 'هذا الشهر' },
    year: { en: 'This Year', ar: 'هذه السنة' },
    all: { en: 'All Time', ar: 'الكل' },
  };

  if (loading) {
    return (
      <Layout title={isAr ? 'سجل العيادات' : 'Clinic History'}>
        <div className="flex items-center justify-center h-64">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isAr ? 'سجل العيادات' : 'Clinic History'}>
      <div className="space-y-6 animate-fade-in-up">
        {/* Filters Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Date Filter */}
          <div className="flex bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            {(Object.keys(dateFilterLabels) as DateFilter[]).map(key => (
              <button
                key={key}
                onClick={() => setDateFilter(key)}
                className={`px-3 py-2 text-xs font-bold transition-all ${
                  dateFilter === key
                    ? 'bg-primary text-white'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {isAr ? dateFilterLabels[key].ar : dateFilterLabels[key].en}
              </button>
            ))}
          </div>

          {/* Clinic Filter */}
          <select
            value={selectedClinicId}
            onChange={e => setSelectedClinicId(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm"
          >
            <option value="all">{isAr ? 'كل العيادات' : 'All Clinics'}</option>
            {clinicStats.map(s => (
              <option key={s.clinicId} value={s.clinicId}>
                {s.clinicName}
              </option>
            ))}
          </select>
        </div>

        {/* Grand Totals Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon="fa-solid fa-users"
            label={isAr ? 'إجمالي المرضى' : 'Total Patients'}
            value={totals.patients}
            color="from-blue-500 to-cyan-400"
          />
          <StatCard
            icon="fa-solid fa-stethoscope"
            label={isAr ? 'إجمالي الزيارات' : 'Total Visits'}
            value={totals.visits}
            subValue={`${totals.completed} ${isAr ? 'مكتمل' : 'completed'}`}
            color="from-emerald-500 to-teal-400"
          />
          <StatCard
            icon="fa-solid fa-money-bill-wave"
            label={isAr ? 'إجمالي الإيرادات' : 'Total Revenue'}
            value={formatCurrency(totals.revenue)}
            subValue={`${formatCurrency(totals.paid)} ${isAr ? 'مقبوض' : 'paid'}`}
            color="from-amber-500 to-yellow-400"
          />
          <StatCard
            icon="fa-regular fa-calendar-check"
            label={isAr ? 'المواعيد' : 'Appointments'}
            value={totals.appointments}
            color="from-purple-500 to-pink-400"
          />
        </div>

        {/* Per-Clinic Breakdown */}
        {filteredStats.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <i className="fa-solid fa-chart-bar text-5xl mb-4 block"></i>
            <p className="font-semibold">{isAr ? 'لا توجد بيانات للفترة المحددة' : 'No data for the selected period'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStats.map(stats => (
              <div key={stats.clinicId} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all">
                {/* Clinic Header */}
                <button
                  onClick={() => setExpandedClinic(expandedClinic === stats.clinicId ? null : stats.clinicId)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white text-lg shadow-lg shadow-primary/20">
                      <i className="fa-solid fa-hospital"></i>
                    </div>
                    <div className={`text-${isAr ? 'right' : 'left'}`}>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">{stats.clinicName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {stats.totalPatients} {isAr ? 'مريض' : 'patients'} • {stats.totalVisits} {isAr ? 'زيارة' : 'visits'} • {formatCurrency(stats.totalRevenue)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Mini stats badges */}
                    {stats.waitingNow > 0 && (
                      <span className="hidden md:flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-bold">
                        <i className="fa-solid fa-clock"></i>
                        {stats.waitingNow} {isAr ? 'منتظر' : 'waiting'}
                      </span>
                    )}
                    {stats.inProgressNow > 0 && (
                      <span className="hidden md:flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold">
                        <i className="fa-solid fa-user-doctor"></i>
                        {stats.inProgressNow} {isAr ? 'جاري' : 'in progress'}
                      </span>
                    )}
                    <i className={`fa-solid fa-chevron-${expandedClinic === stats.clinicId ? 'up' : 'down'} text-slate-400 transition-transform`}></i>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedClinic === stats.clinicId && (
                  <div className="border-t border-slate-100 dark:border-slate-700">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 dark:bg-slate-700">
                      <MiniStat icon="fa-solid fa-user-group" label={isAr ? 'مرضى' : 'Patients'} value={stats.totalPatients} />
                      <MiniStat icon="fa-solid fa-clipboard-check" label={isAr ? 'زيارات مكتملة' : 'Completed'} value={stats.completedVisits} />
                      <MiniStat icon="fa-solid fa-coins" label={isAr ? 'مقبوض' : 'Paid'} value={formatCurrency(stats.paidRevenue)} />
                      <MiniStat icon="fa-solid fa-hand-holding-dollar" label={isAr ? 'غير مقبوض' : 'Unpaid'} value={formatCurrency(stats.unpaidRevenue)} />
                      <MiniStat icon="fa-regular fa-calendar" label={isAr ? 'مواعيد' : 'Appointments'} value={stats.totalAppointments} />
                      <MiniStat icon="fa-solid fa-calendar-xmark" label={isAr ? 'ملغي' : 'Cancelled'} value={stats.cancelledAppointments} />
                      <MiniStat icon="fa-solid fa-user-slash" label={isAr ? 'لم يحضر' : 'No-Show'} value={stats.noShowAppointments} />
                      <MiniStat icon="fa-solid fa-money-bill-trend-up" label={isAr ? 'إجمالي الإيرادات' : 'Revenue'} value={formatCurrency(stats.totalRevenue)} highlight />
                    </div>

                    {/* Visits Table */}
                    <div className="p-4">
                      <h4 className="font-bold text-sm text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-list-ul text-primary"></i>
                        {isAr ? 'سجل الزيارات' : 'Visit Log'}
                        <span className="text-xs text-slate-400 font-normal">({stats.visits.length})</span>
                      </h4>

                      {stats.visits.length === 0 ? (
                        <p className="text-center py-8 text-slate-400 text-sm">{isAr ? 'لا توجد زيارات' : 'No visits found'}</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
                                <th className={`py-2 px-3 text-${isAr ? 'right' : 'left'} font-bold`}>{isAr ? 'المريض' : 'Patient'}</th>
                                <th className={`py-2 px-3 text-${isAr ? 'right' : 'left'} font-bold`}>{isAr ? 'الهاتف' : 'Phone'}</th>
                                <th className={`py-2 px-3 text-${isAr ? 'right' : 'left'} font-bold`}>{isAr ? 'التاريخ' : 'Date'}</th>
                                <th className={`py-2 px-3 text-${isAr ? 'right' : 'left'} font-bold`}>{isAr ? 'السبب' : 'Reason'}</th>
                                <th className={`py-2 px-3 text-${isAr ? 'right' : 'left'} font-bold`}>{isAr ? 'التشخيص' : 'Diagnosis'}</th>
                                <th className={`py-2 px-3 text-center font-bold`}>{isAr ? 'الحالة' : 'Status'}</th>
                                <th className={`py-2 px-3 text-${isAr ? 'left' : 'right'} font-bold`}>{isAr ? 'المبلغ' : 'Amount'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stats.visits.slice(0, 50).map((v, i) => {
                                const visitRevenue = v.invoiceItems?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
                                return (
                                  <tr key={v.visitId + i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-200">{v.patientName}</td>
                                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{v.patientPhone}</td>
                                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                      <span className="block">{formatDate(v.date)}</span>
                                      <span className="text-xs text-slate-400">{formatTime(v.date)}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{v.reasonForVisit || '-'}</td>
                                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{v.diagnosis || '-'}</td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(v.status)}`}>
                                        {getStatusLabel(v.status)}
                                      </span>
                                    </td>
                                    <td className={`py-2.5 px-3 text-${isAr ? 'left' : 'right'} font-bold ${visitRevenue > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                      {visitRevenue > 0 ? formatCurrency(visitRevenue) : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {stats.visits.length > 50 && (
                            <p className="text-center py-3 text-xs text-slate-400">
                              {isAr ? `يتم عرض أول 50 من ${stats.visits.length} زيارة` : `Showing first 50 of ${stats.visits.length} visits`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

// --- Sub Components ---

const StatCard: React.FC<{
  icon: string;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}> = ({ icon, label, value, subValue, color }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg`}>
        <i className={`${icon} text-sm`}></i>
      </div>
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
    {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
  </div>
);

const MiniStat: React.FC<{
  icon: string;
  label: string;
  value: string | number;
  highlight?: boolean;
}> = ({ icon, label, value, highlight }) => (
  <div className={`p-4 ${highlight ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-white dark:bg-slate-800'} flex flex-col items-center justify-center text-center`}>
    <i className={`${icon} text-sm mb-1 ${highlight ? 'text-emerald-500' : 'text-slate-400'}`}></i>
    <p className={`text-lg font-bold ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-white'}`}>{value}</p>
    <span className="text-[10px] text-slate-400 font-medium uppercase">{label}</span>
  </div>
);

export default ClinicHistoryView;
