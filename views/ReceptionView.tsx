
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { ClinicService, PatientService, AppointmentService, NotificationService, BillingService, SettingsService, CourseService } from '../services/services';
import { api } from '../src/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Clinic, Patient, Gender, Priority, Appointment, Notification, Invoice } from '../types';
import { jsPDF } from "jspdf";

interface ReceptionViewProps {
    user?: any;
}

const ReceptionView: React.FC<ReceptionViewProps> = ({ user: propUser }) => {
    const { user: authUser } = useAuth();
    const user = propUser || authUser;
    const { t, language } = useLanguage();
  
  // Data State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Modals
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [formData, setFormData] = useState({
    name: '', age: '', phone: '', email: '', password: '', gender: 'male' as Gender,
    allergiesExists: false, allergiesDetail: '',
    chronicExists: false, chronicDetail: '',
    medsExists: false, medsDetail: '',
    isPregnant: false,
    clinicId: '', priority: 'normal' as Priority, source: 'walk-in', reasonForVisit: ''
  });

  const loadData = async () => {
    if (!user) return;
    const [allApps, activeClinics, notifs, allInvoices, allSessions] = await Promise.all([
        AppointmentService.getAll(user),
        ClinicService.getActive(),
        NotificationService.getPendingReminders(user),
        BillingService.getAll(user),
        CourseService.getSessions(user) // Fetch Academy Sessions
    ]);
    
    // STRICT FILTER: Reception should ONLY see patient-facing clinics, NOT departments.
    const patientClinics = activeClinics.filter(c => c.category === 'clinic');

    // Process Appointments
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 1. Regular Patient Appointments
    const todaysPatientApps = allApps.filter(a => a.date >= today.getTime() && a.date < tomorrow.getTime() && a.status === 'scheduled');
    
    // 2. Academy Sessions (Treat as Appointments)
    const todaysAcademySessions = allSessions.filter(s => s.date >= today.getTime() && s.date < tomorrow.getTime())
        .map(s => ({
            id: s.id,
            date: s.date,
            patientName: `${s.topic} (Class)`,
            reason: s.courseName,
            isClass: true, // Marker for UI
            clinicName: 'Academy'
        }));

    // Merge and Sort
    const unifiedSchedule = [...todaysPatientApps, ...todaysAcademySessions].sort((a: any, b: any) => a.date - b.date);
    
    setTodaysAppointments(unifiedSchedule);
    setClinics(patientClinics);
    setNotifications(notifs);
    setInvoices(allInvoices.filter(i => i.status !== 'paid')); // Show unpaid
    
    if (patientClinics.length > 0 && !formData.clinicId) setFormData(prev => ({ ...prev, clinicId: patientClinics[0].id }));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Polling for notifs
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);


    // Play notification sound when new patient arrives
    const prevPatientCountRef = React.useRef<number>(0);
    const playNotificationSound = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Pleasant notification tone
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
        } catch (e) {
            console.log('Audio notification not supported');
        }
    };

    // تحميل المرضى من السيرفر مع real-time subscription
    useEffect(() => {
        if (!user) return;
        
        const unsubscribe = PatientService.subscribe(user, (data) => {
            // Check if new patient arrived (count increased)
            if (prevPatientCountRef.current > 0 && data.length > prevPatientCountRef.current) {
                playNotificationSound();
            }
            prevPatientCountRef.current = data.length;
            setPatients(data);
        });
        
        return () => unsubscribe();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.clinicId || !user) return;
        try {
            await PatientService.add(user, {
                name: formData.name,
                age: parseInt(formData.age) || 0,
                phone: formData.phone,
                email: formData.email || undefined,
                password: formData.password || 'patient123',
                gender: formData.gender,
                medicalProfile: {},
                currentVisit: {
                    visitId: '',
                    clinicId: formData.clinicId,
                    date: Date.now(),
                    status: 'waiting',
                    priority: formData.priority,
                    reasonForVisit: formData.reasonForVisit,
                    source: 'walk-in'
                }
            });
            setFormData(prev => ({ ...prev, name: '', age: '', phone: '', email: '', password: '', reasonForVisit: '' }));
            setIsFormOpen(false);
            await fetchPatients();
            alert('تمت إضافة المريض بنجاح');
        } catch (e: any) {
            alert("Error: " + (e.message || 'فشل إضافة المريض'));
        }
    };

  const handleAppCheckIn = async (appId: string) => {
    if (!user) return;
    try {
        await AppointmentService.checkIn(user, appId);
        await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handlePayInvoice = async (amount: number) => {
      if(!user || !selectedInvoice) return;
      await BillingService.processPayment(user, selectedInvoice.id, amount, 'cash');
      setShowBillingModal(false);
      setSelectedInvoice(null);
      loadData();
  };

  // --- PDF GENERATOR ---
  const handlePrintInvoice = async () => {
      if (!selectedInvoice) return;
      const settings = await SettingsService.getSettings();
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // LOGO
      if (settings.logoUrl) {
          try {
             doc.addImage(settings.logoUrl, 'PNG', 15, 10, 20, 20); // x, y, w, h
          } catch(e) { console.error("Could not add logo", e); }
      }

      // Header
      doc.setFontSize(24);
      doc.setTextColor(0);
      doc.text("INVOICE", pageWidth - 20, 25, { align: "right" });
      
      doc.setFontSize(14);
      doc.setTextColor(13, 148, 136); // Teal
      doc.text(settings.clinicName || "MedCore Clinic", 40, 20); // Offset x if logo exists

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(settings.address || "Medical Plaza", 40, 26);
      
      // Info
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.text(`Invoice ID: ${selectedInvoice.id}`, 15, 50);
      doc.text(`Date: ${new Date(selectedInvoice.createdAt).toLocaleDateString()}`, pageWidth - 15, 50, { align: "right" });
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Bill To: ${selectedInvoice.patientName}`, 15, 60);
      doc.setFont("helvetica", "normal");
      
      // Table Header
      let y = 80;
      doc.setFillColor(240, 240, 240);
      doc.rect(15, y - 6, pageWidth - 30, 8, "F");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Description", 20, y);
      doc.text("Amount", pageWidth - 20, y, { align: "right" });
      
      // Items
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      
      selectedInvoice.items.forEach(item => {
          doc.text(item.description, 20, y);
          doc.text(`$${item.price.toFixed(2)}`, pageWidth - 20, y, { align: "right" });
          y += 8;
      });
      
      // Total
      y += 5;
      doc.setDrawColor(0);
      doc.line(15, y, pageWidth - 15, y);
      y += 10;
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Due: $${selectedInvoice.totalAmount.toFixed(2)}`, pageWidth - 20, y, { align: "right" });
      
      // Footer
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150);
      doc.text("Thank you for choosing us.", pageWidth / 2, 280, { align: "center" });
      
      doc.save(`Inv_${selectedInvoice.id}.pdf`);
  };

  const openQueueWindow = () => {
      try { const fullUrl = window.location.href.split('#')[0] + '#/queue-display'; window.open(fullUrl, 'MedCoreQueue', 'width=1000,height=800'); } catch (e) { alert("Cannot open window."); }
  };

  const activeQueue = patients.filter(p => p.currentVisit.status !== 'completed');

  // Time formatting for the fancy clock
  const hh = currentTime.getHours().toString().padStart(2, '0');
  const mm = currentTime.getMinutes().toString().padStart(2, '0');
  const ss = currentTime.getSeconds();
  
  return (
    <Layout title={t('reception_desk')}>
      <div className="flex flex-col gap-6 md:gap-10 max-w-7xl mx-auto relative">
        
        {/* NOTIFICATIONS & BILLING BAR */}
        <div className="flex justify-end gap-4 mb-2">
            <button onClick={() => setShowBillingModal(true)} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 relative">
                <i className="fa-solid fa-cash-register"></i> Billing
                {invoices.length > 0 && <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] absolute -top-2 -right-2">{invoices.length}</span>}
            </button>
            <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2 relative">
                <i className="fa-solid fa-bell"></i> Alerts
                {notifications.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full absolute top-2 right-3 animate-ping"></span>}
            </button>
        </div>

        {/* NOTIFICATION PANEL */}
        {showNotifPanel && (
            <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-fade-in-down">
                <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-sm text-slate-700">Pending Reminders</div>
                <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? <div className="p-6 text-center text-xs text-slate-400">No new alerts</div> : (
                        notifications.map(n => (
                            <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => { NotificationService.markAsRead(user!, n.id); loadData(); }}>
                                <div className="flex justify-between mb-1">
                                    <span className="text-xs font-bold text-primary">{n.title}</span>
                                    <span className="text-[10px] text-slate-400">{new Date(n.dueDate || 0).toLocaleDateString()}</span>
                                </div>
                                <div className="text-xs text-slate-600 leading-relaxed">{n.message}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

        {/* BILLING MODAL */}
        {showBillingModal && (
             <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up">
                    <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                        <h3 className="font-bold">Pending Invoices</h3>
                        <button onClick={() => { setShowBillingModal(false); setSelectedInvoice(null); }}><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="p-6">
                        {selectedInvoice ? (
                            <div className="space-y-4">
                                <div className="text-center pb-4 border-b border-slate-100 relative">
                                    {/* Print Button */}
                                    <button onClick={handlePrintInvoice} className="absolute top-0 right-0 text-slate-400 hover:text-primary" title="Print Invoice PDF">
                                        <i className="fa-solid fa-print text-xl"></i>
                                    </button>
                                    
                                    <div className="text-sm font-bold text-primary mt-1 mb-2 text-xl">{selectedInvoice.patientName}</div>
                                    <div className="bg-slate-50 p-4 rounded-xl text-left space-y-2 mb-4">
                                        {selectedInvoice.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-sm text-slate-600 border-b border-slate-200 pb-1 last:border-0 last:pb-0">
                                                <span>{item.description}</span>
                                                <span className="font-mono font-bold">${item.price}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-sm text-slate-400 uppercase">Total Due</div>
                                    <div className="text-4xl font-bold text-slate-800">${selectedInvoice.totalAmount}</div>
                                </div>
                                <button onClick={() => handlePayInvoice(selectedInvoice.totalAmount)} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 shadow-lg">
                                    <i className="fa-solid fa-check-circle mr-2"></i> Mark as Paid (Cash)
                                </button>
                                <button onClick={() => setSelectedInvoice(null)} className="w-full text-slate-400 text-sm hover:text-slate-600">Back to list</button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {invoices.length === 0 ? <div className="text-center py-10 text-slate-400">No pending invoices.</div> : invoices.map(inv => (
                                    <div key={inv.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl hover:border-primary cursor-pointer transition-colors" onClick={() => setSelectedInvoice(inv)}>
                                        <div>
                                            <div className="font-bold text-slate-800">{inv.patientName}</div>
                                            <div className="text-xs text-slate-500">{new Date(inv.createdAt).toLocaleDateString()} • {inv.items.length} items</div>
                                        </div>
                                        <div className="font-bold text-lg text-emerald-600">${inv.totalAmount}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                 </div>
             </div>
        )}

        {/* 1. THE "MESMERIZING" QUANTUM CLOCK WIDGET */}
        <div className="relative rounded-[2rem] md:rounded-3xl overflow-hidden shadow-2xl bg-[#0b1120] border border-slate-800 h-[220px] md:h-[280px] group select-none">
             
             {/* Background Effects */}
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-[#0b1120] to-black opacity-80"></div>
             <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(#0d9488 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
             
             {/* Main Flex Container */}
             <div className="relative z-10 w-full h-full flex items-center justify-between px-8 md:px-16 overflow-hidden">
                 
                 {/* Left Side: The "Reactor" Time Display */}
                 <div className="relative flex items-center justify-center">
                     {/* Outer Rotating Ring (Slow) */}
                     <div className="absolute w-40 h-40 md:w-56 md:h-56 rounded-full border border-slate-700/50 border-dashed animate-[spin_60s_linear_infinite]"></div>
                     
                     {/* Middle Rotating Ring (Medium, Reverse) */}
                     <div className="absolute w-36 h-36 md:w-48 md:h-48 rounded-full border border-primary/20 border-t-primary/80 animate-[spin_15s_linear_infinite_reverse]"></div>
                     
                     {/* Inner Ring (Fast) */}
                     <div className="absolute w-32 h-32 md:w-44 md:h-44 rounded-full border-2 border-slate-800 border-l-cyan-400/50 animate-[spin_3s_linear_infinite]"></div>
                     
                     {/* The Time Itself */}
                     <div className="flex flex-col items-center justify-center z-20 mix-blend-screen">
                        <div className="flex items-baseline gap-1 md:gap-2 font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-[0_0_10px_rgba(13,148,136,0.5)]">
                             <span className="text-6xl md:text-8xl font-bold">{hh}</span>
                             <span className="text-4xl md:text-6xl animate-pulse text-primary">:</span>
                             <span className="text-6xl md:text-8xl font-bold">{mm}</span>
                        </div>
                        {/* Seconds Bar */}
                        <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden relative">
                             <div className="absolute top-0 left-0 h-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" style={{width: `${(ss / 60) * 100}%`, transition: 'width 1s linear'}}></div>
                        </div>
                     </div>
                 </div>

                 {/* Right Side: Date & Status */}
                 <div className="hidden md:flex flex-col items-end gap-2 text-right z-20">
                     <div className="flex items-center gap-3">
                        <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping"></span>
                        <span className="text-emerald-500 font-bold text-xs uppercase tracking-[0.2em]">{t('system_name')} ONLINE</span>
                     </div>
                     <div className="text-4xl font-black text-white tracking-tight">
                         {currentTime.toLocaleDateString(undefined, { weekday: 'long' })}
                     </div>
                     <div className="text-xl text-slate-400 font-light uppercase tracking-widest flex items-center gap-3">
                         {currentTime.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                         <i className="fa-solid fa-calendar-day text-primary"></i>
                     </div>
                     
                     {/* Decorative Stat Pills - NOW WITH ICONS instead of Text */}
                     <div className="flex gap-3 mt-4">
                         <div className="bg-slate-800/80 border border-slate-700 pl-2 pr-4 py-1.5 rounded-full text-xs text-slate-300 font-mono flex items-center gap-2 backdrop-blur-sm" title="Patients in Queue">
                            <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400"><i className="fa-solid fa-users"></i></div>
                            <span className="font-bold text-white text-lg">{activeQueue.length}</span>
                            <span className="text-[9px] uppercase opacity-50">Wait</span>
                         </div>
                         <div className="bg-slate-800/80 border border-slate-700 pl-2 pr-4 py-1.5 rounded-full text-xs text-slate-300 font-mono flex items-center gap-2 backdrop-blur-sm" title="Active Clinics">
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400"><i className="fa-solid fa-heart-pulse"></i></div>
                            <span className="font-bold text-white text-lg">{clinics.length}</span>
                            <span className="text-[9px] uppercase opacity-50">Docs</span>
                         </div>
                     </div>
                 </div>

             </div>

             {/* Decorative Corner Accents */}
             <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary/50 rounded-tl-lg"></div>
             <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary/50 rounded-br-lg"></div>
        </div>

        {/* ... [Rest of the file remains same] ... */}
        {/* 2. Intake Form */}
        <div className="bg-white rounded-[1.5rem] md:rounded-3xl shadow-soft border border-slate-100 overflow-hidden transition-all duration-300">
            <button onClick={() => setIsFormOpen(!isFormOpen)} className={`w-full p-5 md:p-6 flex justify-between items-center transition-colors ${isFormOpen ? 'bg-slate-50 border-b border-gray-100' : 'bg-white'}`}>
                <div className="flex items-center gap-3 md:gap-4">
                   <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shadow-lg ${isFormOpen ? 'bg-primary text-white scale-105' : 'bg-primary/10 text-primary'}`}><i className="fa-solid fa-file-pen text-base md:text-xl"></i></div>
                   <div className="text-left rtl:text-right">
                       <h2 className="font-bold text-slate-800 text-lg md:text-xl">{t('new_patient')}</h2>
                       <p className="text-[10px] md:text-sm text-slate-400">{isFormOpen ? 'Fill intake' : 'Click to register arrival'}</p>
                   </div>
                </div>
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-100 flex items-center justify-center text-slate-400 transition-transform duration-300 ${isFormOpen ? 'rotate-180 bg-slate-200' : ''}`}><i className="fa-solid fa-chevron-down"></i></div>
            </button>
            
            {isFormOpen && (
                <div className="animate-fade-in-down overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 bg-slate-50/50">
                      <div className="space-y-6">
                         <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <h3 className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-2 mb-2"><span className="w-1 h-4 bg-primary rounded-full"></span> {t('personal_info')}</h3>
                            <input type="text" placeholder={t('full_name')} className="input-modern" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                            <div className="grid grid-cols-2 gap-4">
                                 <input type="number" placeholder={t('age')} className="input-modern" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} required />
                                 <select className="input-modern" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as Gender})}><option value="male">{t('male')}</option><option value="female">{t('female')}</option></select>
                            </div>
                            <input type="tel" placeholder={t('phone')} className="input-modern" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                            <input type="email" placeholder="البريد الإلكتروني (للحساب)" className="input-modern" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                            <input type="password" placeholder="كلمة المرور (للحساب)" className="input-modern" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                         </div>
                         <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                             <select className="input-modern" value={formData.clinicId} onChange={e => setFormData({...formData, clinicId: e.target.value})}>{clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                             <input type="text" placeholder={t('reason_visit')} className="input-modern" value={formData.reasonForVisit} onChange={e => setFormData({...formData, reasonForVisit: e.target.value})} />
                         </div>
                      </div>

                      <div className="flex flex-col h-full gap-6">
                          <div className="bg-rose-50/50 p-5 md:p-6 rounded-2xl border border-rose-100 flex-1 space-y-4">
                             <h3 className="text-[10px] font-bold uppercase text-rose-700 flex items-center gap-2 mb-4"><span className="w-1 h-4 bg-rose-500 rounded-full"></span> {t('medical_intake')}</h3>
                             {['allergies', 'chronic', 'meds'].map((key) => (
                                 <div key={key} className="bg-white/70 p-3 rounded-xl border border-rose-100/30">
                                    <div className="flex items-center gap-3 mb-2"><input type="checkbox" checked={(formData as any)[`${key}Exists`]} onChange={e => setFormData({...formData, [`${key}Exists`]: e.target.checked})} className="w-5 h-5 text-rose-600 rounded-md" /><label className="text-xs font-bold text-slate-700 capitalize">{t(key as any)}</label></div>
                                    {(formData as any)[`${key}Exists`] && <input type="text" placeholder="..." className="w-full bg-white border border-rose-100 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-rose-200" value={(formData as any)[`${key}Detail`]} onChange={e => setFormData({...formData, [`${key}Detail`]: e.target.value})} />}
                                 </div>
                             ))}
                          </div>
                          <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-xl transition-all hover:bg-primary transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 text-lg"><i className="fa-solid fa-check-circle"></i> {t('register_patient')}</button>
                      </div>
                    </form>
                </div>
            )}
        </div>

        {/* 3. Stacked Sections: Queue (Top) and Appointments (Bottom) */}
        <div className="flex flex-col gap-10">
            
            {/* --- QUEUE DISPLAY (PRIORITY #1) --- */}
            <div className="bg-white rounded-[1.5rem] md:rounded-3xl shadow-soft border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center bg-emerald-50/20">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 text-emerald-600 w-10 h-10 rounded-xl flex items-center justify-center"><i className="fa-solid fa-people-group"></i></div>
                        <div><h2 className="font-bold text-slate-800 leading-tight">{t('todays_queue')}</h2><p className="text-[10px] text-slate-400 uppercase tracking-wide">Currently Waiting in Clinics</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={openQueueWindow} className="hidden sm:block text-[11px] font-bold text-emerald-600 bg-emerald-100/50 px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all uppercase"><i className="fa-solid fa-desktop mr-1"></i> {t('open_queue_screen')}</button>
                        <span className="bg-slate-900 text-white text-xs px-4 py-2 rounded-xl font-bold shadow-lg">{activeQueue.length}</span>
                    </div>
                </div>
                <div className="p-4 md:p-6 overflow-auto max-h-[600px]">
                    {activeQueue.length === 0 ? (
                        <div className="text-center py-20 text-slate-300 flex flex-col items-center opacity-40"><i className="fa-solid fa-mug-hot text-5xl mb-4"></i><span className="font-bold uppercase text-[12px] tracking-widest">{t('no_active_patients')}</span></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {activeQueue.map(p => {
                                const clinic = clinics.find(c => c.id === p.currentVisit.clinicId);
                                const isUrgent = p.currentVisit.priority === 'urgent';
                                return (
                                    <div key={p.id} className={`p-5 rounded-3xl border transition-all flex items-center justify-between group hover:shadow-xl ${isUrgent ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg transform group-hover:scale-110 transition-transform ${isUrgent ? 'bg-red-500' : 'bg-slate-800'}`}>{(p?.name || p?.email || "U").charAt(0)}</div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-800 truncate text-lg">{p.name}</div>
                                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{clinic?.name}</div>
                                            </div>
                                        </div>
                                        <div className="text-end shrink-0">
                                            <div className="text-[12px] font-bold text-slate-900">{new Date(p.currentVisit.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                            <div className={`text-[9px] font-extrabold uppercase px-3 py-1 rounded-full mt-2 inline-block ${p.currentVisit.status === 'in-progress' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-amber-100 text-amber-600'}`}>{p.currentVisit.status}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* --- TODAYS APPOINTMENTS & CLASSES (PRIORITY #2) --- */}
            <div className="bg-white rounded-[1.5rem] md:rounded-3xl shadow-soft border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50/20">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center"><i className="fa-regular fa-calendar-check"></i></div>
                        <div><h2 className="font-bold text-slate-800 leading-tight">Scheduled Today</h2><p className="text-[10px] text-slate-400 uppercase tracking-wide">Appointments & Classes</p></div>
                    </div>
                    <span className="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-bold shadow-lg">{todaysAppointments.length}</span>
                </div>
                <div className="p-4 md:p-6 overflow-auto max-h-[500px]">
                    {todaysAppointments.length === 0 ? (
                        <div className="text-center py-20 text-slate-300 flex flex-col items-center opacity-40"><i className="fa-solid fa-calendar-day text-5xl mb-4"></i><span className="font-bold uppercase text-[12px] tracking-widest">No remaining schedule for today</span></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {todaysAppointments.map(app => (
                                <div key={app.id} className={`flex items-center justify-between p-5 border rounded-3xl hover:border-blue-300 transition-all group hover:shadow-xl ${app.isClass ? 'bg-purple-50 border-purple-100' : 'bg-white border-slate-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 text-white rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-lg transition-colors ${app.isClass ? 'bg-purple-600 group-hover:bg-purple-700' : 'bg-slate-900 group-hover:bg-blue-600'}`}>
                                            {app.isClass ? (
                                                <i className="fa-solid fa-chalkboard-user text-2xl"></i>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] font-bold opacity-60 uppercase">{new Date(app.date).toLocaleDateString([], {month:'short'})}</span>
                                                    <span className="font-bold text-sm leading-tight">{new Date(app.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 truncate text-lg">{app.patientName}</div>
                                            <div className="text-[10px] text-slate-400 italic truncate font-medium">
                                                {app.isClass ? (
                                                    <span>{new Date(app.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • {app.reason}</span>
                                                ) : app.reason}
                                            </div>
                                        </div>
                                    </div>
                                    {!app.isClass && (
                                        <button onClick={() => handleAppCheckIn(app.id)} className="bg-emerald-50 text-emerald-600 px-5 py-2.5 rounded-2xl text-[11px] font-extrabold uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100 flex items-center gap-2">
                                            <i className="fa-solid fa-check"></i>
                                            {t('check_in_btn')}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
      
      <style>{`
        .input-modern { width: 100%; padding: 0.875rem 1.25rem; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 1.25rem; font-size: 0.95rem; transition: all 0.2s; }
        .input-modern:focus { border-color: #0d9488; box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.1); outline: none; }
        .animate-fade-in-down { animation: fadeInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </Layout>
  );
};

export default ReceptionView;
