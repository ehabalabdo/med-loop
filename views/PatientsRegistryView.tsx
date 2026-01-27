
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../src/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Patient, Clinic } from '../types';

const PatientsRegistryView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClinic, setFilterClinic] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pats, clins] = await Promise.all([
        api.get('/patients'),
        api.get('/clinics')
      ]);
      setPatients(pats);
      setClinics(clins.filter((c:any) => c.category === 'clinic'));
    } catch (err) {
      // Optionally handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // Filter Logic
  const filteredPatients = patients.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.phone.includes(searchTerm);
    
    const matchesClinic = filterClinic === 'all' || p.currentVisit.clinicId === filterClinic;
    const matchesStatus = filterStatus === 'all' || p.currentVisit.status === filterStatus;

    return matchesSearch && matchesClinic && matchesStatus;
  });

  const getClinicName = (id: string) => clinics.find(c => c.id === id)?.name || id;

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      'waiting': 'bg-amber-100 text-amber-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700'
    };
    const label = status === 'waiting' ? t('waiting') : status === 'in-progress' ? t('in_progress') : t('completed');
    // @ts-ignore
    return <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || 'bg-gray-100'}`}>{label}</span>;
  };

  return (
    <Layout title={t('patients_registry')}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[600px]">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
           <div className="relative w-full md:w-96">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto"></i>
              <input 
                 type="text" 
                 placeholder={t('search_placeholder')}
                 className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none rtl:pr-10 rtl:pl-4"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
              />
           </div>

           <div className="flex gap-3 w-full md:w-auto">
              <select 
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none bg-white"
                value={filterClinic}
                onChange={e => setFilterClinic(e.target.value)}
              >
                <option value="all">{t('all_clinics')}</option>
                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select 
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none bg-white"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">{t('all_statuses')}</option>
                <option value="waiting">{t('waiting')}</option>
                <option value="in-progress">{t('in_progress')}</option>
                <option value="completed">{t('completed')}</option>
              </select>
           </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
           {loading ? (
             <div className="flex justify-center items-center h-40 text-slate-400">Loading...</div>
           ) : (
             <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-6 py-4">{t('name_col')}</th>
                    <th className="px-6 py-4">{t('phone')}</th>
                    <th className="px-6 py-4">{t('age')} / {t('gender')}</th>
                    <th className="px-6 py-4">{t('clinic_col')}</th>
                    <th className="px-6 py-4">{t('status_col')}</th>
                    <th className="px-6 py-4">{t('last_visit')}</th>
                    <th className="px-6 py-4 text-end"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">No patients found.</td>
                    </tr>
                  ) : filteredPatients.map(p => (
                    <tr 
                        key={p.id} 
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                       <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 group-hover:text-primary transition-colors">{p.name}</div>
                          <div className="text-xs text-slate-400">ID: {p.id.slice(-6)}</div>
                       </td>
                       <td className="px-6 py-4 font-mono">{p.phone}</td>
                       <td className="px-6 py-4">
                          {p.age} <span className="text-slate-400 mx-1">•</span> {p.gender === 'male' ? t('male') : t('female')}
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                             {getClinicName(p.currentVisit.clinicId)}
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <StatusBadge status={p.currentVisit.status} />
                       </td>
                       <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(p.currentVisit.date).toLocaleDateString()}
                       </td>
                       <td className="px-6 py-4 text-end">
                          <button className="text-slate-400 hover:text-primary p-2">
                            <i className="fa-solid fa-chevron-right rtl:fa-chevron-left"></i>
                          </button>
                       </td>
                    </tr>
                  ))}
                </tbody>
             </table>
           )}
        </div>
      </div>
    </Layout>
  );
};

export default PatientsRegistryView;
