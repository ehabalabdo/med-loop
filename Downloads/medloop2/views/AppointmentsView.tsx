
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { AppointmentService, ClinicService, PatientService, AuthService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Appointment, Clinic, Patient, UserRole, User, Gender } from '../types';

const AppointmentsView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  
  // View State
  const [activeTab, setActiveTab] = useState<'scheduled' | 'history'>('scheduled');
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Patient Mode: 'existing' or 'new'
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');

  const [formData, setFormData] = useState({
      // Appointment Info
      patientId: '', 
      clinicId: '', 
      doctorId: '', 
      date: '', 
      time: '', 
      reason: '',

      // New Patient Info - Personal
      newName: '',
      newPhone: '',
      newAge: '',
      newGender: 'male' as Gender,

      // New Patient Info - Medical
      newAllergies: false, newAllergiesDetail: '',
      newChronic: false, newChronicDetail: '',
      newMeds: false, newMedsDetail: '',
      newPregnant: false
  });

  const fetchData = async () => {
      if (!user) return;
      try {
          const [apps, clins, allUsers, allPatients] = await Promise.all([
              AppointmentService.getAll(user),
              ClinicService.getAll(),
              AuthService.getAllUsers(),
              PatientService.getAll(user)
          ]);
          setAppointments(apps.sort((a,b) => a.date - b.date));
          
          // STRICT FILTER: Only show patient-facing clinics
          const patientClinics = clins.filter(c => c.category === 'clinic');
          setClinics(patientClinics);
          
          setDoctors(allUsers.filter(u => u.role === UserRole.DOCTOR));
          setPatients(allPatients);
          
          if (!isEditing && patientClinics.length > 0 && !formData.clinicId) {
              setFormData(prev => ({...prev, clinicId: patientClinics[0].id}));
          }
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
      fetchData();
  }, [user]);

  // -- FILTER LOGIC --
  const filteredAppointments = appointments.filter(app => {
      if (activeTab === 'scheduled') return app.status === 'scheduled';
      return app.status !== 'scheduled'; // Show Checked-in, Cancelled, Completed in History
  });

  // -- FORM HANDLERS --

  const openNewModal = () => {
      setFormData({
          patientId: '', clinicId: clinics[0]?.id || '', doctorId: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          reason: '',
          newName: '', newPhone: '', newAge: '', newGender: 'male',
          newAllergies: false, newAllergiesDetail: '',
          newChronic: false, newChronicDetail: '',
          newMeds: false, newMedsDetail: '',
          newPregnant: false
      });
      setPatientMode('existing');
      setIsEditing(false);
      setIsModalOpen(true);
  };

  const openEditModal = (app: Appointment) => {
      const d = new Date(app.date);
      setFormData({
          patientId: app.patientId,
          clinicId: app.clinicId,
          doctorId: app.doctorId || '',
          date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
          time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
          reason: app.reason,
          newName: '', newPhone: '', newAge: '', newGender: 'male',
          newAllergies: false, newAllergiesDetail: '',
          newChronic: false, newChronicDetail: '',
          newMeds: false, newMedsDetail: '',
          newPregnant: false
      });
      setPatientMode('existing');
      setIsEditing(true);
      setEditingId(app.id);
      setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      try {
          const timestamp = new Date(`${formData.date}T${formData.time}`).getTime();
          if(isNaN(timestamp)) throw new Error("Invalid Date");

          let finalPatientId = formData.patientId;
          let finalPatientName = '';

          if (!isEditing && patientMode === 'new') {
             if (!formData.newName || !formData.newPhone) {
                 alert("Please fill all new patient fields");
                 return;
             }

             finalPatientId = await PatientService.add(user, {
                 name: formData.newName,
                 phone: formData.newPhone,
                 age: parseInt(formData.newAge) || 0,
                 gender: formData.newGender,
                 medicalProfile: { 
                     allergies: { exists: formData.newAllergies, details: formData.newAllergiesDetail },
                     chronicConditions: { exists: formData.newChronic, details: formData.newChronicDetail },
                     currentMedications: { exists: formData.newMeds, details: formData.newMedsDetail },
                     isPregnant: formData.newGender === 'female' && formData.newPregnant
                 },
                 currentVisit: {
                     visitId: '', 
                     clinicId: formData.clinicId,
                     date: Date.now(),
                     status: 'completed', 
                     priority: 'normal',
                     source: 'appointment',
                     reasonForVisit: 'Initial Registration'
                 }
             });
             finalPatientName = formData.newName;
          } else {
             const selectedPatient = patients.find(p => p.id === formData.patientId);
             if (!selectedPatient) { alert("Select patient"); return; }
             finalPatientId = selectedPatient.id;
             finalPatientName = selectedPatient.name;
          }

          if (isEditing && editingId) {
             await AppointmentService.update(user, editingId, {
                 clinicId: formData.clinicId,
                 doctorId: formData.doctorId || undefined,
                 date: timestamp,
                 reason: formData.reason
             });
          } else {
             await AppointmentService.create(user, {
                 patientId: finalPatientId,
                 patientName: finalPatientName,
                 clinicId: formData.clinicId,
                 doctorId: formData.doctorId || undefined,
                 date: timestamp,
                 reason: formData.reason
             });
          }
          setIsModalOpen(false);
          fetchData(); 
      } catch (e: any) {
          alert(e.message);
      }
  };

  // -- ACTIONS --
  
  const handleCheckIn = async (appId: string) => {
      if (!user) return;
      // Optimistic Update: Remove from view immediately by changing status
      setAppointments(prev => prev.map(a => a.id === appId ? { ...a, status: 'checked-in' } : a));

      try {
          await AppointmentService.checkIn(user, appId);
      } catch (e: any) {
          alert("Error: " + e.message);
          fetchData(); 
      }
  };

  const handleDelete = async (appId: string) => {
      if (!user) return;
      if (!window.confirm(t('cancel_btn') + "?")) return; 

      setAppointments(prev => prev.filter(a => a.id !== appId));

      try {
          await AppointmentService.delete(user, appId);
      } catch (e: any) {
          alert("Error: " + e.message);
          fetchData();
      }
  };

  const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;
  const getDoctorName = (id?: string) => doctors.find(d => d.uid === id)?.name || '-';

  return (
    <Layout title={t('appointments_title')}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
          
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3">
                 <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center">
                     <i className="fa-regular fa-calendar-check"></i>
                 </div>
                 <h2 className="font-bold text-slate-800">{t('appointments_title')}</h2>
             </div>
             
             <div className="flex gap-2 bg-gray-200 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('scheduled')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'scheduled' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {t('status_scheduled')} ({appointments.filter(a => a.status === 'scheduled').length})
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'history' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    History
                </button>
             </div>

             {user?.role !== UserRole.DOCTOR && (
                 <button onClick={openNewModal} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                     <i className="fa-solid fa-plus"></i> {t('new_appointment')}
                 </button>
             )}
          </div>

          <div className="flex-1 overflow-auto p-4">
              {filteredAppointments.length === 0 ? (
                  <div className="text-center p-10 text-slate-400">
                      <i className={`fa-regular ${activeTab === 'scheduled' ? 'fa-calendar-check' : 'fa-clock-rotate-left'} text-4xl mb-3 opacity-50`}></i>
                      <p>{activeTab === 'scheduled' ? t('no_appointments') : "No past appointments found."}</p>
                  </div>
              ) : (
                  <div className="space-y-3">
                      {filteredAppointments.map(app => (
                          <div key={app.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg border transition-colors bg-white group ${activeTab === 'history' ? 'border-gray-100 opacity-75 grayscale-[0.5] hover:grayscale-0' : 'border-gray-100 hover:border-blue-200'}`}>
                              <div className="flex items-center gap-4">
                                  <div className={`flex flex-col items-center justify-center w-16 h-16 rounded border text-slate-600 ${app.status === 'checked-in' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-gray-200'}`}>
                                      <span className="text-xs uppercase font-bold">{new Date(app.date).toLocaleDateString([], { month: 'short' })}</span>
                                      <span className="text-xl font-bold text-slate-800">{new Date(app.date).getDate()}</span>
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-800 text-lg">{app.patientName}</h3>
                                      <div className="text-sm text-slate-500 flex flex-wrap gap-3">
                                          <span className="flex items-center gap-1"><i className="fa-regular fa-clock"></i> {new Date(app.date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                                          <span className="flex items-center gap-1"><i className="fa-solid fa-hospital"></i> {getClinicName(app.clinicId)}</span>
                                          <span className="flex items-center gap-1"><i className="fa-solid fa-user-doctor"></i> {getDoctorName(app.doctorId)}</span>
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400 italic">"{app.reason}"</div>
                                  </div>
                              </div>

                              <div className="mt-4 md:mt-0 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                                  {/* Status Label (Visible in History) */}
                                  {activeTab === 'history' && (
                                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase text-center ${
                                         app.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                         app.status === 'checked-in' ? 'bg-green-100 text-green-700' :
                                         'bg-gray-100 text-gray-500'
                                     }`}>
                                         {app.status === 'scheduled' ? t('status_scheduled') : 
                                          app.status === 'checked-in' ? t('status_checked_in') : 
                                          t('status_cancelled')}
                                     </span>
                                  )}

                                  {/* Action Buttons (Visible only in Scheduled) */}
                                  {user?.role !== UserRole.DOCTOR && activeTab === 'scheduled' && (
                                      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                                          {/* CHECK IN (Main Action) */}
                                          <button 
                                            onClick={() => handleCheckIn(app.id)} 
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 min-w-[120px]"
                                          >
                                              <i className="fa-solid fa-check"></i>
                                              <span>{t('check_in_btn')}</span>
                                          </button>
                                          
                                          {/* Edit */}
                                          <button 
                                            onClick={() => openEditModal(app)} 
                                            className="bg-white border border-gray-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                                          >
                                              <i className="fa-solid fa-pen"></i>
                                              <span>{t('edit_btn')}</span>
                                          </button>

                                          {/* Cancel */}
                                          <button 
                                            onClick={() => handleDelete(app.id)} 
                                            className="bg-white border border-gray-200 text-slate-400 hover:border-red-500 hover:text-red-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                                          >
                                              <i className="fa-solid fa-xmark"></i>
                                              <span>{t('cancel_btn')}</span>
                                          </button>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {isModalOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                      <div className="p-4 bg-slate-800 text-white flex justify-between items-center shrink-0">
                          <h3 className="font-bold">{isEditing ? 'Edit Appointment' : t('new_appointment')}</h3>
                          <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
                      </div>
                      
                      <div className="p-6 overflow-y-auto">
                        <form onSubmit={handleSave} className="space-y-5">
                            
                            {!isEditing && (
                                <div className="flex p-1 bg-slate-100 rounded-lg">
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${patientMode === 'existing' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
                                        onClick={() => setPatientMode('existing')}
                                    >
                                        Existing Patient
                                    </button>
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${patientMode === 'new' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
                                        onClick={() => setPatientMode('new')}
                                    >
                                        New Patient
                                    </button>
                                </div>
                            )}

                            {patientMode === 'existing' ? (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('select_existing_patient')}</label>
                                    <select className="w-full p-2 border rounded bg-white disabled:bg-gray-100" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})} required={patientMode === 'existing'} disabled={isEditing}>
                                        <option value="">-- Select Patient --</option>
                                        {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4 animate-fade-in">
                                    <h4 className="text-xs font-bold uppercase text-blue-800 mb-2 border-b border-blue-200 pb-1">Personal Details</h4>
                                    <div>
                                        <input type="text" placeholder={t('full_name')} className="w-full p-2 border rounded text-sm" value={formData.newName} onChange={e => setFormData({...formData, newName: e.target.value})} required={patientMode === 'new'} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="tel" placeholder={t('phone')} className="w-full p-2 border rounded text-sm" value={formData.newPhone} onChange={e => setFormData({...formData, newPhone: e.target.value})} required={patientMode === 'new'} />
                                        <input type="number" placeholder={t('age')} className="w-full p-2 border rounded text-sm" value={formData.newAge} onChange={e => setFormData({...formData, newAge: e.target.value})} required={patientMode === 'new'} />
                                    </div>
                                    <div>
                                        <select className="w-full p-2 border rounded text-sm bg-white" value={formData.newGender} onChange={e => setFormData({...formData, newGender: e.target.value as Gender})}>
                                            <option value="male">{t('male')}</option>
                                            <option value="female">{t('female')}</option>
                                        </select>
                                    </div>

                                    <h4 className="text-xs font-bold uppercase text-red-800 mt-4 mb-2 border-b border-red-200 pb-1">Medical Intake</h4>
                                    <div className="bg-white p-3 rounded border border-blue-100 space-y-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" id="newAllergies" checked={formData.newAllergies} onChange={e => setFormData({...formData, newAllergies: e.target.checked})} className="rounded text-red-500" />
                                                <label htmlFor="newAllergies" className="text-sm text-slate-700 font-medium">{t('allergies')}</label>
                                            </div>
                                            {formData.newAllergies && (
                                                <input type="text" placeholder="Details..." className="w-full mt-1 p-1.5 text-xs border rounded" value={formData.newAllergiesDetail} onChange={e => setFormData({...formData, newAllergiesDetail: e.target.value})} />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" id="newChronic" checked={formData.newChronic} onChange={e => setFormData({...formData, newChronic: e.target.checked})} className="rounded text-red-500" />
                                                <label htmlFor="newChronic" className="text-sm text-slate-700 font-medium">{t('chronic_conditions')}</label>
                                            </div>
                                            {formData.newChronic && (
                                                <input type="text" placeholder="Details..." className="w-full mt-1 p-1.5 text-xs border rounded" value={formData.newChronicDetail} onChange={e => setFormData({...formData, newChronicDetail: e.target.value})} />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" id="newMeds" checked={formData.newMeds} onChange={e => setFormData({...formData, newMeds: e.target.checked})} className="rounded text-red-500" />
                                                <label htmlFor="newMeds" className="text-sm text-slate-700 font-medium">{t('current_meds')}</label>
                                            </div>
                                            {formData.newMeds && (
                                                <input type="text" placeholder="Details..." className="w-full mt-1 p-1.5 text-xs border rounded" value={formData.newMedsDetail} onChange={e => setFormData({...formData, newMedsDetail: e.target.value})} />
                                            )}
                                        </div>
                                        {formData.newGender === 'female' && (
                                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                                <input type="checkbox" id="newPreg" checked={formData.newPregnant} onChange={e => setFormData({...formData, newPregnant: e.target.checked})} className="rounded text-blue-500" />
                                                <label htmlFor="newPreg" className="text-sm text-slate-700">{t('pregnancy')}</label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-gray-100 pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('clinic_col')}</label>
                                        <select className="w-full p-2 border rounded bg-white" value={formData.clinicId} onChange={e => setFormData({...formData, clinicId: e.target.value})} required>
                                            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('doctor_col')}</label>
                                        <select className="w-full p-2 border rounded bg-white" value={formData.doctorId} onChange={e => setFormData({...formData, doctorId: e.target.value})}>
                                            <option value="">-- Any --</option>
                                            {doctors.filter(d => d.clinicIds.includes(formData.clinicId)).map(d => <option key={d.uid} value={d.uid}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                        <input type="date" className="w-full p-2 border rounded" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time</label>
                                        <input type="time" className="w-full p-2 border rounded" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('reason_visit')}</label>
                                    <input type="text" className="w-full p-2 border rounded" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} required />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 mt-4">
                                {isEditing ? t('save_changes') : t('schedule_btn')}
                            </button>
                        </form>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </Layout>
  );
};

export default AppointmentsView;
