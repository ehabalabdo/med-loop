
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { PatientService, ClinicService } from '../services/services';
import { api } from '../src/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Patient, Clinic, UserRole } from '../types';

const PatientProfileView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, dir } = useLanguage();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [activeTab, setActiveTab] = useState<'basic' | 'timeline' | 'clinical'>('basic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit State for Clinical Tab
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                const appointments = await api.get('/appointments/patient');
                // يمكنك هنا ربط المواعيد مع بيانات المريض حسب الحاجة
                setPatient({ ...patient, appointments });
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

  const handleSaveClinical = async () => {
     if(!patient || !user) return;
     try {
         await PatientService.updateStatus(user, patient, patient.currentVisit.status, {
             diagnosis, 
             treatment
         });
         alert(t('saved_successfully'));
     } catch (e: any) {
         alert(e.message);
     }
  };

  const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;

  if (loading) return <Layout title="Loading..."><div className="p-10 text-center"><i className="fa-solid fa-spinner fa-spin text-2xl text-primary"></i></div></Layout>;
  
  if (error) return (
    <Layout title={t('access_denied')}>
        <div className="max-w-md mx-auto mt-20 text-center p-8 bg-white rounded-xl shadow border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <i className="fa-solid fa-ban"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{t('access_denied')}</h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button onClick={() => navigate('/patients')} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">
                Back to Registry
            </button>
        </div>
    </Layout>
  );

  if (!patient) return null;

  // -- Components --

  const TabButton = ({ id, label, icon }: { id: typeof activeTab, label: string, icon: string }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${
            activeTab === id 
            ? 'border-primary text-primary bg-primary/5' 
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-gray-50'
        }`}
      >
          <i className={icon}></i> {label}
      </button>
  );

  const MedicalBadge = ({ label, data }: { label: string, data: { exists: boolean, details: string } }) => {
      if (!data.exists) return null;
      return (
          <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-start gap-3">
              <i className="fa-solid fa-triangle-exclamation text-red-500 mt-1"></i>
              <div>
                  <div className="text-xs font-bold text-red-800 uppercase">{label}</div>
                  <div className="text-sm text-red-700 font-medium">{data.details}</div>
              </div>
          </div>
      );
  };

  return (
    <Layout title={patient.name}>
       
       {/* Profile Header */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
           <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-inner ${
               patient.gender === 'male' ? 'bg-blue-100 text-blue-500' : 'bg-pink-100 text-pink-500'
           }`}>
               <i className="fa-solid fa-user"></i>
           </div>
           
           <div className="flex-1 text-center md:text-start">
               <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                   <h1 className="text-3xl font-bold text-slate-800">{patient.name}</h1>
                   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase w-fit mx-auto md:mx-0 ${
                       patient.currentVisit.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                   }`}>
                       {patient.currentVisit.status}
                   </span>
               </div>
               
               <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-slate-500">
                   <span className="flex items-center gap-1"><i className="fa-solid fa-cake-candles"></i> {patient.age} {t('years')}</span>
                   <span className="flex items-center gap-1"><i className="fa-solid fa-phone"></i> {patient.phone}</span>
                   <span className="flex items-center gap-1"><i className="fa-solid fa-hospital"></i> {getClinicName(patient.currentVisit.clinicId)}</span>
               </div>
           </div>

           <div className="text-right hidden md:block">
               <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Entry ID</div>
               <div className="font-mono font-bold text-slate-700">{patient.id.split('_')[1]}</div>
           </div>
       </div>

       {/* Tabs Navigation */}
       <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 flex overflow-hidden">
           <TabButton id="basic" label={t('tab_basic')} icon="fa-solid fa-address-card" />
           <TabButton id="timeline" label={t('tab_timeline')} icon="fa-solid fa-clock-rotate-left" />
           <TabButton id="clinical" label={t('tab_clinical')} icon="fa-solid fa-file-medical" />
       </div>

       {/* Tab Content */}
       <div className="bg-white rounded-b-xl shadow-sm border border-gray-100 border-t-0 p-6 min-h-[400px]">
           
           {/* TAB 1: BASIC INFO */}
           {activeTab === 'basic' && (
               <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                       <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">{t('personal_info')}</h3>
                       <div className="space-y-4">
                           <div className="flex justify-between border-b border-gray-50 pb-2">
                               <span className="text-slate-500">{t('full_name')}</span>
                               <span className="font-medium">{patient.name}</span>
                           </div>
                           <div className="flex justify-between border-b border-gray-50 pb-2">
                               <span className="text-slate-500">{t('gender')}</span>
                               <span className="font-medium capitalize">{patient.gender}</span>
                           </div>
                           <div className="flex justify-between border-b border-gray-50 pb-2">
                               <span className="text-slate-500">{t('age')}</span>
                               <span className="font-medium">{patient.age}</span>
                           </div>
                           <div className="flex justify-between border-b border-gray-50 pb-2">
                               <span className="text-slate-500">{t('phone')}</span>
                               <span className="font-medium font-mono">{patient.phone}</span>
                           </div>
                       </div>
                   </div>

                   <div>
                       <h3 className="text-sm font-bold uppercase text-slate-400 mb-4">{t('medical_alerts')}</h3>
                       <div className="space-y-3">
                           {!patient.medicalProfile.allergies.exists && !patient.medicalProfile.chronicConditions.exists && (
                               <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                                   <i className="fa-solid fa-check-circle"></i> No known medical alerts.
                               </div>
                           )}
                           <MedicalBadge label={t('allergies')} data={patient.medicalProfile.allergies} />
                           <MedicalBadge label={t('chronic_conditions')} data={patient.medicalProfile.chronicConditions} />
                           <MedicalBadge label={t('current_meds')} data={patient.medicalProfile.currentMedications} />
                       </div>
                   </div>
               </div>
           )}

           {/* TAB 2: TIMELINE */}
           {activeTab === 'timeline' && (
               <div className="animate-fade-in relative pl-8 border-l-2 border-slate-100 space-y-8 py-2">
                   {/* Combined History + Current */}
                   {[patient.currentVisit, ...patient.history].map((visit, idx) => (
                       <div key={idx} className="relative">
                           <div className={`absolute -left-[41px] top-0 w-5 h-5 rounded-full border-4 border-white shadow-sm ${idx === 0 ? 'bg-primary' : 'bg-slate-300'}`}></div>
                           <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                               <div className="flex-1">
                                   <div className={`text-sm font-bold ${idx === 0 ? 'text-primary' : 'text-slate-600'}`}>
                                       {new Date(visit.date).toLocaleDateString()}
                                   </div>
                                   <div className="text-xs text-slate-400 mb-2">
                                       {new Date(visit.date).toLocaleTimeString()} • {getClinicName(visit.clinicId)}
                                   </div>
                                   
                                   {/* Clinical Summary Card */}
                                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 w-full space-y-2">
                                       <div className="text-sm font-medium text-slate-800">Reason: {visit.reasonForVisit}</div>
                                       
                                       {/* Show Medical Details if Authorized */}
                                       {user?.role !== UserRole.SECRETARY && (
                                           <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
                                               {visit.diagnosis && (
                                                   <div className="text-xs">
                                                       <span className="font-bold text-slate-500 uppercase">Dx:</span> <span className="text-slate-700">{visit.diagnosis}</span>
                                                   </div>
                                               )}
                                               
                                               {visit.prescriptions && visit.prescriptions.length > 0 && (
                                                   <div className="text-xs">
                                                       <span className="font-bold text-slate-500 uppercase block mb-1">Rx:</span>
                                                       <div className="flex flex-wrap gap-1">
                                                           {visit.prescriptions.map((rx, i) => (
                                                               <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                                                   {rx.drugName} {rx.dosage}
                                                               </span>
                                                           ))}
                                                       </div>
                                                   </div>
                                               )}

                                               {/* ATTACHMENTS SECTION */}
                                               {visit.attachments && visit.attachments.length > 0 && (
                                                   <div className="text-xs mt-3 bg-white p-2 rounded border border-slate-100">
                                                       <span className="font-bold text-slate-500 uppercase block mb-1.5 flex items-center gap-1"><i className="fa-solid fa-paperclip"></i> Attachments:</span>
                                                       <div className="flex flex-wrap gap-2">
                                                           {visit.attachments.map((att, i) => (
                                                               <a 
                                                                   key={i} 
                                                                   href={att.url} 
                                                                   target="_blank" 
                                                                   rel="noopener noreferrer" 
                                                                   className="block w-16 h-16 rounded-lg border border-slate-200 overflow-hidden hover:border-primary transition-all hover:scale-105 relative group shadow-sm"
                                                                   title={att.name}
                                                               >
                                                                   {att.type === 'image' ? (
                                                                       <img src={att.url} className="w-full h-full object-cover" alt="attachment" />
                                                                   ) : (
                                                                       <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-1">
                                                                           <i className="fa-solid fa-file-pdf text-xl text-red-400"></i>
                                                                           <span className="text-[8px] uppercase font-bold">PDF</span>
                                                                       </div>
                                                                   )}
                                                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                       <i className="fa-solid fa-magnifying-glass-plus"></i>
                                                                   </div>
                                                               </a>
                                                           ))}
                                                       </div>
                                                   </div>
                                               )}

                                           </div>
                                       )}
                                   </div>
                               </div>
                               <div className="text-right shrink-0">
                                   <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                       visit.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                   }`}>
                                       {visit.status}
                                   </span>
                               </div>
                           </div>
                       </div>
                   ))}
               </div>
           )}

           {/* TAB 3: CLINICAL DATA (Protected) */}
           {activeTab === 'clinical' && (
               <div className="animate-fade-in">
                   {user?.role === UserRole.SECRETARY ? (
                       // Secretary View (Restricted)
                       <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                           <i className="fa-solid fa-user-lock text-4xl mb-3 text-slate-300"></i>
                           <p>{t('access_denied_msg')}</p>
                       </div>
                   ) : (
                       // Doctor View (Editable)
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                           <div className="space-y-6">
                               <div>
                                   <label className="block text-sm font-bold text-slate-700 mb-2">{t('diagnosis')}</label>
                                   <textarea 
                                       className="w-full h-32 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                                       placeholder={t('diagnosis_placeholder')}
                                       value={diagnosis}
                                       onChange={e => setDiagnosis(e.target.value)}
                                   ></textarea>
                               </div>
                               <div>
                                   <label className="block text-sm font-bold text-slate-700 mb-2">{t('treatment')}</label>
                                   <textarea 
                                       className="w-full h-32 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                                       placeholder={t('treatment_placeholder')}
                                       value={treatment}
                                       onChange={e => setTreatment(e.target.value)}
                                   ></textarea>
                               </div>
                               <div className="pt-4">
                                   <button 
                                     onClick={handleSaveClinical}
                                     className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-primary/30 transition-all flex items-center gap-2"
                                   >
                                       <i className="fa-solid fa-save"></i> {t('save_changes')}
                                   </button>
                               </div>
                           </div>
                           
                           {/* Read-Only Context Side */}
                           <div className="bg-slate-50 p-6 rounded-lg border border-gray-100 h-fit">
                               <h4 className="text-xs font-bold uppercase text-slate-400 mb-4">Visit Metadata</h4>
                               <div className="space-y-4 text-sm">
                                   <div className="flex justify-between">
                                       <span className="text-slate-500">Visit ID</span>
                                       <span className="font-mono text-slate-700">{patient.currentVisit.visitId}</span>
                                   </div>
                                   <div className="flex justify-between">
                                       <span className="text-slate-500">Date</span>
                                       <span className="text-slate-700">{new Date(patient.currentVisit.date).toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between">
                                       <span className="text-slate-500">Priority</span>
                                       <span className={`font-bold ${patient.currentVisit.priority === 'urgent' ? 'text-red-600' : 'text-slate-700'}`}>
                                           {patient.currentVisit.priority}
                                       </span>
                                   </div>
                                   <div className="mt-4 pt-4 border-t border-gray-200">
                                       <div className="text-xs text-slate-400 mb-1">Reason for Visit</div>
                                       <div className="font-medium text-slate-800 italic">"{patient.currentVisit.reasonForVisit}"</div>
                                   </div>
                               </div>
                           </div>
                       </div>
                   )}
               </div>
           )}

       </div>

       <style>{`
         .animate-fade-in { animation: fadeIn 0.3s ease-out; }
         @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
       `}</style>
    </Layout>
  );
};

export default PatientProfileView;
