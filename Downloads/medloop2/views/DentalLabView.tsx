
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { DentalLabService, AuthService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { LabCase, UserRole, User } from '../types';

const PREDEFINED_CASE_TYPES = [
    'Crown (Zirconia)',
    'Crown (E-Max)',
    'Crown (PFM)',
    'Bridge (Zirconia)',
    'Bridge (Porcelain)',
    'Veneer',
    'Implant Abutment',
    'Denture (Complete)',
    'Denture (Partial)',
    'Night Guard',
    'Retainer',
    'Bleaching Tray'
];

const DentalLabView: React.FC = () => {
  const { user } = useAuth();
  
  // Data State
  const [cases, setCases] = useState<LabCase[]>([]);
  const [eligibleVisits, setEligibleVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<LabCase | null>(null);

  // Form State
  const [isCustomType, setIsCustomType] = useState(false);
  const [formData, setFormData] = useState({
      selectedVisitId: '',
      caseType: PREDEFINED_CASE_TYPES[0],
      dueDate: '',
      notes: ''
  });

  const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
          const [allCases, visits] = await Promise.all([
              DentalLabService.getAllCases(user),
              DentalLabService.getEligibleVisits(user)
          ]);
          setCases(allCases);
          setEligibleVisits(visits);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [user]);

  // -- Handlers --

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !formData.selectedVisitId) return;

      const visit = eligibleVisits.find(v => v.visitId === formData.selectedVisitId);
      if (!visit) return;

      // In real app, we'd fetch doctor name. Here assuming user is doctor or we use generic.
      const doctorName = user.role === UserRole.DOCTOR ? user.name : 'Referring Doctor';

      try {
          await DentalLabService.createCase(user, {
              visitId: visit.visitId,
              patientId: visit.patientId,
              patientName: visit.patientName,
              doctorId: user.uid,
              doctorName: doctorName,
              caseType: formData.caseType || 'Unspecified', // Handle empty custom input
              notes: formData.notes,
              dueDate: new Date(formData.dueDate).getTime()
          });
          setIsCreateOpen(false);
          // Reset Form
          setFormData({ selectedVisitId: '', caseType: PREDEFINED_CASE_TYPES[0], dueDate: '', notes: '' });
          setIsCustomType(false);
          fetchData();
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleStatusUpdate = async (status: LabCase['status']) => {
      if (!user || !selectedCase) return;
      try {
          await DentalLabService.updateStatus(user, selectedCase.id, status);
          setSelectedCase({ ...selectedCase, status }); // Optimistic update
          fetchData(); // Refresh list
      } catch (e: any) {
          alert(e.message);
      }
  };

  // Toggle Input Mode
  const toggleCustomType = () => {
      setIsCustomType(!isCustomType);
      // If switching back to list, reset to default if the current value isn't in the list
      if (isCustomType) { // switching TO list
          setFormData(prev => ({ ...prev, caseType: PREDEFINED_CASE_TYPES[0] }));
      } else { // switching TO custom
          setFormData(prev => ({ ...prev, caseType: '' }));
      }
  };

  // RBAC Helpers: Admin or Lab Tech can manage
  const isLabUser = user?.role === UserRole.ADMIN || user?.role === UserRole.LAB_TECH;

  // Status Badge Helper
  const StatusBadge = ({ status }: { status: string }) => {
      const colors: Record<string, string> = {
          'PENDING': 'bg-gray-100 text-gray-600',
          'IN_PROGRESS': 'bg-blue-100 text-blue-700',
          'READY': 'bg-amber-100 text-amber-700',
          'DELIVERED': 'bg-emerald-100 text-emerald-700'
      };
      return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${colors[status] || 'bg-gray-100'}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <Layout title="Dental Lab Management">
      <div className="flex flex-col gap-6">
          
          {/* Stats Header */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                      <div className="text-slate-400 text-xs font-bold uppercase">Pending Cases</div>
                      <div className="text-2xl font-bold text-slate-800">{cases.filter(c => c.status === 'PENDING').length}</div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><i className="fa-solid fa-clock"></i></div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                      <div className="text-slate-400 text-xs font-bold uppercase">In Work</div>
                      <div className="text-2xl font-bold text-blue-600">{cases.filter(c => c.status === 'IN_PROGRESS').length}</div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"><i className="fa-solid fa-flask"></i></div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                      <div className="text-slate-400 text-xs font-bold uppercase">Ready</div>
                      <div className="text-2xl font-bold text-amber-600">{cases.filter(c => c.status === 'READY').length}</div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center"><i className="fa-solid fa-box-open"></i></div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                      <div className="text-slate-400 text-xs font-bold uppercase">Total Delivered</div>
                      <div className="text-2xl font-bold text-emerald-600">{cases.filter(c => c.status === 'DELIVERED').length}</div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center"><i className="fa-solid fa-check"></i></div>
              </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-soft border border-slate-100 flex flex-col min-h-[500px]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-cyan-50/20">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                      <i className="fa-solid fa-tooth text-cyan-600"></i> Lab Cases Registry
                  </h2>
                  <button onClick={() => setIsCreateOpen(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2">
                      <i className="fa-solid fa-plus"></i> New Case
                  </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                  <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-400">
                          <tr>
                              <th className="px-6 py-4 rounded-l-lg">Case ID</th>
                              <th className="px-6 py-4">Patient</th>
                              <th className="px-6 py-4">Type</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4">Due Date</th>
                              <th className="px-6 py-4 rounded-r-lg text-end">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {cases.map(c => (
                              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 font-mono text-xs">{c.id.split('_')[1]}</td>
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-slate-800">{c.patientName}</div>
                                      <div className="text-xs text-slate-400">{c.doctorName}</div>
                                  </td>
                                  <td className="px-6 py-4 font-medium">{c.caseType}</td>
                                  <td className="px-6 py-4 text-center"><StatusBadge status={c.status} /></td>
                                  <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(c.dueDate).toLocaleDateString()}</td>
                                  <td className="px-6 py-4 text-end">
                                      <button onClick={() => setSelectedCase(c)} className="text-slate-400 hover:text-cyan-600 transition-colors p-2">
                                          <i className="fa-solid fa-eye"></i>
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {cases.length === 0 && (
                              <tr>
                                  <td colSpan={6} className="text-center py-10 text-slate-400 italic">No lab cases found.</td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                  <div className="p-5 bg-cyan-700 text-white flex justify-between items-center">
                      <h3 className="font-bold">Create Lab Case</h3>
                      <button onClick={() => setIsCreateOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <form onSubmit={handleCreate} className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Completed Visit</label>
                          <select 
                              className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-cyan-600 text-sm"
                              value={formData.selectedVisitId}
                              onChange={e => setFormData({ ...formData, selectedVisitId: e.target.value })}
                              required
                          >
                              <option value="">-- Choose Patient Visit --</option>
                              {eligibleVisits.map(v => (
                                  <option key={v.visitId} value={v.visitId}>
                                      {v.patientName} - {new Date(v.date).toLocaleDateString()}
                                  </option>
                              ))}
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-1">
                              <div className="flex justify-between items-center mb-1">
                                  <label className="block text-xs font-bold text-slate-500 uppercase">Case Type</label>
                                  <button 
                                      type="button" 
                                      onClick={toggleCustomType}
                                      className="text-[10px] font-bold text-cyan-600 hover:underline"
                                  >
                                      {isCustomType ? 'Select List' : 'Type Custom'}
                                  </button>
                              </div>
                              {isCustomType ? (
                                  <input 
                                      type="text"
                                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-cyan-600 text-sm placeholder-slate-400"
                                      value={formData.caseType}
                                      onChange={e => setFormData({ ...formData, caseType: e.target.value })}
                                      placeholder="e.g. Special Splint"
                                      autoFocus
                                      required
                                  />
                              ) : (
                                  <select 
                                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-cyan-600 text-sm"
                                      value={formData.caseType}
                                      onChange={e => setFormData({ ...formData, caseType: e.target.value })}
                                  >
                                      {PREDEFINED_CASE_TYPES.map(type => (
                                          <option key={type} value={type}>{type}</option>
                                      ))}
                                  </select>
                              )}
                          </div>
                          <div className="col-span-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                              <input 
                                  type="date" 
                                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-cyan-600 text-sm"
                                  value={formData.dueDate}
                                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                  required
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Doctor Notes / Instructions</label>
                          <textarea 
                              className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-cyan-600 text-sm h-24 resize-none"
                              placeholder="Shade: A2, Special instructions..."
                              value={formData.notes}
                              onChange={e => setFormData({ ...formData, notes: e.target.value })}
                          ></textarea>
                      </div>
                      <button type="submit" className="w-full bg-cyan-600 text-white py-3 rounded-xl font-bold hover:bg-cyan-700 shadow-lg">Submit Order</button>
                  </form>
              </div>
          </div>
      )}

      {/* DETAILS MODAL */}
      {selectedCase && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                  <div className="p-5 bg-slate-800 text-white flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="font-bold text-lg">Case #{selectedCase.id.split('_')[1]}</h3>
                          <p className="text-xs text-slate-400">Created: {new Date(selectedCase.createdAt).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => setSelectedCase(null)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-6 mb-6">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Patient Details</div>
                              <div className="font-bold text-lg text-slate-800">{selectedCase.patientName}</div>
                              <div className="text-sm text-slate-500">Ref: {selectedCase.doctorName}</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <div className="text-xs font-bold text-slate-400 uppercase mb-2">Job Details</div>
                              <div className="font-bold text-lg text-slate-800">{selectedCase.caseType}</div>
                              <div className="text-sm text-slate-500">Due: <span className="text-red-500 font-bold">{new Date(selectedCase.dueDate).toLocaleDateString()}</span></div>
                          </div>
                      </div>

                      <div className="mb-6">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-2">Instructions</div>
                          <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-100 text-sm">
                              {selectedCase.notes || "No additional notes provided."}
                          </div>
                      </div>

                      <div className="border-t border-slate-100 pt-6">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-3">Update Workflow Status</div>
                          {isLabUser ? (
                              <div className="flex gap-2 flex-wrap">
                                  {['PENDING', 'IN_PROGRESS', 'READY'].map(s => (
                                      <button 
                                          key={s}
                                          onClick={() => handleStatusUpdate(s as any)}
                                          className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${
                                              selectedCase.status === s 
                                              ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                                              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                          }`}
                                      >
                                          {s.replace('_', ' ')}
                                      </button>
                                  ))}
                                  <button 
                                      onClick={() => handleStatusUpdate('DELIVERED')}
                                      className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${
                                          selectedCase.status === 'DELIVERED' 
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                                          : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                                      }`}
                                  >
                                      DELIVERED
                                  </button>
                              </div>
                          ) : (
                              <div className="text-center p-3 bg-gray-100 rounded-xl text-sm text-gray-500">
                                  Only Lab Department staff can update status.
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </Layout>
  );
};

export default DentalLabView;
