
import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { ClinicService, PatientService, AppointmentService, SettingsService } from '../services/services';
import { api } from '../src/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Patient, VisitData, Appointment, Gender, Priority, PrescriptionItem, Attachment, InvoiceItem } from '../types';
import { jsPDF } from "jspdf";

const DoctorView: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  
  // Data State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // EMR Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // Billing State
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedService, setSelectedService] = useState('Consultation');

  // Prescription Input State
  const [newRx, setNewRx] = useState({ name: '', dose: '', freq: '', dur: '' });

  // Mobile Tabs Logic
  const [mobileTab, setMobileTab] = useState<'queue' | 'emr'>('queue');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectPatient = async (p: Patient) => {
    setSelectedPatient(p);
    // Auto-update status to "in-progress" when doctor starts consultation
    if (p.currentVisit.status === 'waiting' && user) {
      try {
        await PatientService.updateStatus(user, p, 'in-progress');
      } catch (e) {
        console.error('Failed to update patient status:', e);
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribeQueue = PatientService.subscribe(user, (data) => {
      setPatients(data);
      // Real-time update for selected patient if their status changes externally
      if (selectedPatient) {
        const updated = data.find(p => p.id === selectedPatient.id);
        if (updated) {
            // Only update local state if status changed to avoid overwriting typing
            if(updated.currentVisit.status !== selectedPatient.currentVisit.status) {
                 setSelectedPatient(updated);
            }
        }
      }
    });
        const loadData = async () => {
            try {
                const apps = await AppointmentService.getAll(user);
                setAppointments(apps.filter(a => a.status === 'scheduled').sort((a,b) => a.date - b.date));
            } catch {
                setAppointments([]);
            }
        };
        loadData();
    return () => unsubscribeQueue();
  }, [user, selectedPatient?.id]); // Added selectedPatient dependency carefully

  useEffect(() => {
    if (selectedPatient) {
        // Load data from DB
        setDiagnosis(selectedPatient.currentVisit.diagnosis || '');
        setNotes(selectedPatient.currentVisit.doctorNotes || '');
        setPrescriptions(selectedPatient.currentVisit.prescriptions || []);
        setAttachments(selectedPatient.currentVisit.attachments || []);
        
        // Initialize billing with a default consultation if empty
        if (!selectedPatient.currentVisit.invoiceItems || selectedPatient.currentVisit.invoiceItems.length === 0) {
            setInvoiceItems([{ id: Date.now().toString(), description: 'Consultation', price: 50 }]);
        } else {
            setInvoiceItems(selectedPatient.currentVisit.invoiceItems);
        }
        
        if (window.innerWidth < 1024) setMobileTab('emr');
    }
  }, [selectedPatient?.id]); // Only re-run when a different patient is selected

  const handleSaveVisit = async (status: VisitData['status']) => {
    if (!selectedPatient || !user) return;
    try {
        await PatientService.updateStatus(user, selectedPatient, status, {
            diagnosis, doctorNotes: notes, prescriptions, attachments, invoiceItems
        });
        
        if(status === 'completed') {
            // Clear screen
            setSelectedPatient(null);
            setMobileTab('queue');
            setDiagnosis(''); setNotes(''); setPrescriptions([]); setAttachments([]); setInvoiceItems([]);
        } else if (status === 'in-progress') {
            // Just update local state to reflect UI change immediately
            setSelectedPatient({
                ...selectedPatient,
                currentVisit: { ...selectedPatient.currentVisit, status: 'in-progress' }
            });
        }
    } catch(e: any) { alert(e.message); }
  };

  // --- PDF GENERATOR ---
  const handlePrintRx = async () => {
      if (!selectedPatient || prescriptions.length === 0) return;
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
      doc.setFontSize(22);
      doc.setTextColor(13, 148, 136); // Teal color
      doc.text(settings.clinicName || "MedCore Clinic", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(settings.address || "Medical Plaza", pageWidth / 2, 26, { align: "center" });
      doc.text(settings.phone || "Tel: +1 234 567 8900", pageWidth / 2, 31, { align: "center" });
      
      // Separator
      doc.setDrawColor(200);
      doc.line(10, 35, pageWidth - 10, 35);
      
      // Info Block
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.text(`Dr. ${user?.name || 'Doctor'}`, 15, 45);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 15, 45, { align: "right" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Patient: ${selectedPatient.name}`, 15, 55);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Age/Sex: ${selectedPatient.age} / ${selectedPatient.gender}`, 15, 60);
      
      // Rx Section
      doc.setFillColor(240, 240, 240);
      doc.rect(10, 70, pageWidth - 20, 10, "F");
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PRESCRIPTION (Rx)", 15, 77);
      
      let y = 95;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      
      prescriptions.forEach((rx, i) => {
          doc.setFont("helvetica", "bold");
          doc.text(`${i + 1}. ${rx.drugName}`, 15, y);
          
          doc.setFont("helvetica", "normal");
          const details = `${rx.dosage}  |  ${rx.frequency}  |  ${rx.duration}`;
          doc.text(details, 20, y + 6);
          
          y += 18;
      });
      
      // Footer
      doc.setDrawColor(0);
      doc.line(15, 250, 80, 250);
      doc.setFontSize(10);
      doc.text("Doctor's Signature", 15, 255);
      
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Generated by MedCore System", pageWidth / 2, 280, { align: "center" });
      
      doc.save(`Rx_${selectedPatient.name.replace(/\s/g, '_')}.pdf`);
  };

  const addPrescription = () => {
      if(!newRx.name) return;
      const item: PrescriptionItem = {
          id: Date.now().toString(),
          drugName: newRx.name,
          dosage: newRx.dose,
          frequency: newRx.freq,
          duration: newRx.dur
      };
      setPrescriptions([...prescriptions, item]);
      setNewRx({ name: '', dose: '', freq: '', dur: '' });
  };

  const removePrescription = (id: string) => {
      setPrescriptions(prescriptions.filter(p => p.id !== id));
  };

  const addService = () => {
      let price = 0;
      switch(selectedService) {
          case 'Consultation': price = 50; break;
          case 'Follow-up': price = 25; break;
          case 'Ultrasound': price = 80; break;
          case 'Lab Test (Basic)': price = 40; break;
          case 'X-Ray': price = 60; break;
          case 'Minor Surgery': price = 150; break;
          default: price = 0;
      }
      const newItem: InvoiceItem = {
          id: Date.now().toString(),
          description: selectedService,
          price: price
      };
      setInvoiceItems([...invoiceItems, newItem]);
  };

  const removeService = (id: string) => {
      setInvoiceItems(invoiceItems.filter(i => i.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  const newAtt: Attachment = {
                      id: Date.now().toString(),
                      name: file.name,
                      type: file.type.includes('image') ? 'image' : 'pdf',
                      url: ev.target.result as string,
                      date: Date.now()
                  };
                  setAttachments([...attachments, newAtt]);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const waitingList = patients.filter(p => p.currentVisit.status !== 'completed');

  return (
    <Layout title={t('doctor_console')}>
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex mb-4 bg-white rounded-2xl p-1 shadow-sm border border-slate-100">
          <button onClick={() => setMobileTab('queue')} className={`flex-1 py-2 text-sm font-bold rounded-xl ${mobileTab === 'queue' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>
            <i className="fa-solid fa-users-viewfinder mr-2"></i> {t('waiting_room')}
          </button>
          <button onClick={() => setMobileTab('emr')} disabled={!selectedPatient} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mobileTab === 'emr' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 opacity-50'}`}>
            <i className="fa-solid fa-file-medical mr-2"></i> {t('emr_view')}
          </button>
      </div>

      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-160px)] gap-6 overflow-visible lg:overflow-hidden">
        
        {/* --- SIDEBAR --- */}
        <div className={`w-full lg:w-80 xl:w-96 flex-col gap-5 ${mobileTab === 'queue' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="flex-1 min-h-[300px] lg:min-h-0 bg-white rounded-3xl shadow-soft border border-slate-100 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 text-sm">{t('waiting_room')}</h2>
                    <span className="bg-slate-900 text-white text-xs px-2 py-1 rounded-lg font-bold">{waitingList.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {waitingList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 py-10"><i className="fa-solid fa-mug-hot text-3xl mb-2"></i><p className="text-[10px] font-bold">{t('no_active_patients')}</p></div>
                    ) : (
                        waitingList.map(p => {
                            const isUrgent = p.currentVisit.priority === 'urgent';
                            const isWaiting = p.currentVisit.status === 'waiting';
                            const isSelected = selectedPatient?.id === p.id;
                            
                            // Dynamic Styling for Queue Items
                            let cardClass = "w-full text-left p-4 rounded-2xl border transition-all relative group overflow-hidden shadow-sm ";
                            
                            if (isSelected) {
                                cardClass += "bg-slate-800 text-white border-slate-900 shadow-xl scale-[1.02] z-10 ";
                            } else if (isUrgent) {
                                cardClass += "bg-red-50 border-l-4 border-l-red-500 border-t-red-100 border-r-red-100 border-b-red-100 hover:shadow-md ";
                            } else if (isWaiting) {
                                cardClass += "bg-amber-50 border-l-4 border-l-amber-400 border-t-amber-100 border-r-amber-100 border-b-amber-100 hover:shadow-md ";
                            } else {
                                // In Progress but not selected (rare but possible)
                                cardClass += "bg-white border-slate-100 hover:bg-slate-50 ";
                            }

                            return (
                                <button key={p.id} onClick={() => handleSelectPatient(p)} className={cardClass}>
                                    {isUrgent && <div className="absolute top-2 right-2 text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded animate-pulse">URGENT</div>}
                                    <div className={`font-bold text-sm mb-1 truncate pr-6 ${isSelected ? 'text-white' : 'text-slate-800'}`}>{p.name}</div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className={`font-medium italic ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{p.currentVisit.reasonForVisit}</span>
                                        <div className={`px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${
                                            p.currentVisit.status === 'in-progress' 
                                            ? 'bg-blue-500 text-white animate-pulse' 
                                            : 'bg-amber-200 text-amber-800'
                                        }`}>
                                            {p.currentVisit.status === 'in-progress' && <i className="fa-solid fa-circle-play text-[8px]"></i>}
                                            {p.currentVisit.status === 'waiting' && <i className="fa-regular fa-clock text-[8px]"></i>}
                                            {p.currentVisit.status}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
            
             {/* Appointments Mini View */}
            <div className="h-48 bg-white rounded-3xl shadow-soft border border-slate-100 flex flex-col overflow-hidden shrink-0">
                <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Scheduled Today</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                     {appointments.map(app => (
                        <div key={app.id} className="flex gap-2 items-center text-xs p-2 rounded hover:bg-slate-50">
                            <span className="font-bold text-slate-900 bg-slate-200 px-1.5 rounded">{new Date(app.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            <span className="truncate text-slate-600">{app.patientName}</span>
                        </div>
                     ))}
                </div>
            </div>
        </div>

        {/* --- MAIN EMR WORKSPACE --- */}
        <div className={`flex-1 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col overflow-hidden relative ${mobileTab === 'emr' ? 'flex' : 'hidden lg:flex'}`}>
          {selectedPatient ? (
            <>
              {/* Patient Header */}
              <div className="p-6 border-b border-slate-50 bg-slate-50/20 flex justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${selectedPatient.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                    <i className="fa-solid fa-hospital-user"></i>
                  </div>
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">{selectedPatient.name}</h1>
                    <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>{selectedPatient.age} Yrs</span>
                      <span>•</span>
                      <span>{selectedPatient.currentVisit.reasonForVisit}</span>
                    </div>
                  </div>
                </div>
                
                {/* Allergy Alert */}
                {(selectedPatient.medicalProfile.allergies.exists || selectedPatient.medicalProfile.chronicConditions.exists) && (
                    <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-xs font-bold border border-rose-100 animate-pulse">
                        <i className="fa-solid fa-triangle-exclamation mr-1"></i> Medical Alert
                    </div>
                )}
              </div>

              {/* Workspace */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
                 
                 {/* --- BLOCKING OVERLAY FOR WAITING PATIENTS --- */}
                 {selectedPatient.currentVisit.status === 'waiting' && (
                     <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                         <div className="w-24 h-24 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center text-5xl mb-6 shadow-xl animate-bounce">
                             <i className="fa-solid fa-user-clock"></i>
                         </div>
                         <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Patient is Waiting</h2>
                         <p className="text-slate-500 max-w-md mb-8">Review the profile if needed. Click the button below to start the session and unlock the medical record forms.</p>
                         <button 
                             onClick={() => handleSaveVisit('in-progress')}
                             className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-primary shadow-2xl hover:scale-105 transition-all flex items-center gap-3"
                         >
                             <i className="fa-solid fa-play"></i> {t('start_consult')}
                         </button>
                     </div>
                 )}

                 <div className={`max-w-5xl mx-auto space-y-8 transition-opacity duration-300 ${selectedPatient.currentVisit.status === 'waiting' ? 'opacity-20 blur-sm overflow-hidden h-[500px]' : 'opacity-100'}`}>
                    
                    {/* 1. Diagnosis */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center text-xs">1</span> Diagnosis
                        </h3>
                        <textarea className="w-full h-24 p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-primary transition-all font-medium text-slate-800" placeholder="Clinical diagnosis..." value={diagnosis} onChange={e => setDiagnosis(e.target.value)}></textarea>
                    </section>

                    {/* 2. Services & Billing (Moved up) */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs">2</span> Services & Billing
                        </h3>
                        <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-4">
                            <div className="flex gap-2 mb-3">
                                <select className="flex-1 p-2 rounded-lg border text-sm bg-white" value={selectedService} onChange={e => setSelectedService(e.target.value)}>
                                    <option value="Consultation">General Consultation ($50)</option>
                                    <option value="Follow-up">Follow-up Visit ($25)</option>
                                    <option value="Ultrasound">Ultrasound ($80)</option>
                                    <option value="Lab Test (Basic)">Lab Test - Basic ($40)</option>
                                    <option value="X-Ray">X-Ray ($60)</option>
                                    <option value="Minor Surgery">Minor Surgery ($150)</option>
                                </select>
                                <button onClick={addService} className="bg-emerald-600 text-white px-4 rounded-lg font-bold text-sm hover:bg-emerald-700">Add Service</button>
                            </div>
                            
                            {invoiceItems.length > 0 ? (
                                <div className="space-y-2 bg-white p-3 rounded-lg border border-gray-100">
                                    {invoiceItems.map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-sm border-b border-gray-50 last:border-0 pb-1 last:pb-0">
                                            <span className="font-medium text-slate-700">{item.description}</span>
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold text-emerald-600">${item.price}</span>
                                                <button onClick={() => removeService(item.id)} className="text-slate-300 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100 font-bold text-slate-800">
                                        <span>Total Estimated</span>
                                        <span>${invoiceItems.reduce((acc, i) => acc + i.price, 0)}</span>
                                    </div>
                                </div>
                            ) : <div className="text-xs text-slate-400 italic text-center py-2">No services added. Invoice will be empty.</div>}
                        </div>
                    </section>

                    {/* 3. E-Prescription */}
                    <section>
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs">3</span> Prescription (Rx)
                             </h3>
                             {prescriptions.length > 0 && (
                                 <button onClick={handlePrintRx} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold hover:bg-blue-200 transition-colors">
                                     <i className="fa-solid fa-print mr-1"></i> Print Rx
                                 </button>
                             )}
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                             {/* Rx Builder */}
                             <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4">
                                 <div className="md:col-span-4"><input className="w-full p-2 rounded-lg border text-sm" placeholder="Drug Name (e.g. Panadol)" value={newRx.name} onChange={e => setNewRx({...newRx, name: e.target.value})} /></div>
                                 <div className="md:col-span-3"><input className="w-full p-2 rounded-lg border text-sm" placeholder="Dose (e.g. 500mg)" value={newRx.dose} onChange={e => setNewRx({...newRx, dose: e.target.value})} /></div>
                                 <div className="md:col-span-3"><select className="w-full p-2 rounded-lg border text-sm bg-white" value={newRx.freq} onChange={e => setNewRx({...newRx, freq: e.target.value})}><option value="">Freq</option><option value="1x1">1 x 1</option><option value="1x2">1 x 2</option><option value="1x3">1 x 3</option><option value="SOS">SOS</option></select></div>
                                 <div className="md:col-span-2"><button onClick={addPrescription} className="w-full bg-slate-800 text-white rounded-lg h-full font-bold text-xs hover:bg-slate-700">ADD</button></div>
                             </div>
                             
                             {/* Rx List */}
                             {prescriptions.length > 0 && (
                                 <div className="space-y-2">
                                     {prescriptions.map((p) => (
                                         <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 shadow-sm">
                                             <div className="flex gap-2 text-sm font-bold text-slate-700">
                                                 <span className="text-primary">{p.drugName}</span>
                                                 <span className="text-slate-400">|</span>
                                                 <span>{p.dosage}</span>
                                                 <span className="bg-gray-100 px-1 rounded text-xs py-0.5">{p.frequency}</span>
                                             </div>
                                             <button onClick={() => removePrescription(p.id)} className="text-rose-400 hover:text-rose-600"><i className="fa-solid fa-trash"></i></button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>
                    </section>

                    {/* 4. Attachments & Labs */}
                    <section>
                         <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center text-xs">4</span> Labs & Attachments
                        </h3>
                        <div className="flex flex-wrap gap-4">
                            {/* Upload Button */}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                            <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all">
                                <i className="fa-solid fa-cloud-arrow-up text-2xl mb-1"></i>
                                <span className="text-[10px] font-bold uppercase">Upload</span>
                            </button>

                            {/* Previews */}
                            {attachments.map(att => (
                                <div key={att.id} className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden relative group">
                                    <img src={att.url} className="w-full h-full object-cover" alt="attachment" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))} className="text-white hover:text-rose-400"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                 </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center shadow-2xl z-10">
                 <div className="text-xs font-bold text-slate-400 uppercase hidden md:block">Session Time: <span className="text-slate-800">12:05</span></div>
                 <div className="flex gap-3 w-full md:w-auto">
                    {/* Only show 'Complete' if In Progress */}
                    {selectedPatient.currentVisit.status === 'in-progress' && (
                        <button onClick={() => handleSaveVisit('completed')} className="flex-1 md:flex-none bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg w-full"><i className="fa-solid fa-check mr-2"></i> {t('complete_discharge')}</button>
                    )}
                 </div>
              </div>

            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 p-10 text-center">
              <i className="fa-solid fa-user-doctor text-6xl opacity-10 mb-6 animate-pulse"></i>
              <p className="text-xl font-extrabold text-slate-400">{t('select_patient')}</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DoctorView;
