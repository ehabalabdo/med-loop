
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { CourseService } from '../services/services';
import { useAuth } from '../context/AuthContext';
import { Course, CourseStudent, CourseSession, Gender, UserRole } from '../types';
import { jsPDF } from "jspdf";

const CoursesView: React.FC = () => {
  const { user } = useAuth();
  
  // Permission Check
  const isSecretary = user?.role === UserRole.SECRETARY;

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'courses' | 'students' | 'schedule'>('dashboard');
  
  // Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [courseForm, setCourseForm] = useState({ title: '', duration: '', price: 0, instructorName: '', hasCertificate: true });
  const [studentForm, setStudentForm] = useState({ name: '', phone: '', gender: 'female' as Gender, courseId: '' });
  const [sessionForm, setSessionForm] = useState({ courseId: '', date: '', time: '', topic: '', instructor: '' });
  
  // Selected Student for Payment
  const [selectedStudent, setSelectedStudent] = useState<CourseStudent | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  useEffect(() => {
      fetchData();
  }, [user]);

  const fetchData = async () => {
      if(!user) return;
      setLoading(true);
      const [crs, std, sess] = await Promise.all([
          CourseService.getAllCourses(),
          CourseService.getStudents(user),
          CourseService.getSessions(user)
      ]);
      setCourses(crs);
      setStudents(std);
      setSessions(sess);
      setLoading(false);
  };

  // --- Handlers ---

  const handleAddCourse = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!user) return;
      await CourseService.createCourse(user, courseForm);
      setShowCourseModal(false);
      setCourseForm({ title: '', duration: '', price: 0, instructorName: '', hasCertificate: true });
      fetchData();
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!user) return;
      const course = courses.find(c => c.id === studentForm.courseId);
      if(!course) return;

      await CourseService.registerStudent(user, {
          name: studentForm.name,
          phone: studentForm.phone,
          gender: studentForm.gender,
          courseId: course.id,
          courseName: course.title,
          totalFees: course.price
      });
      setShowStudentModal(false);
      setStudentForm({ name: '', phone: '', gender: 'female', courseId: '' });
      fetchData();
  };

  const handleAddSession = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!user) return;
      const course = courses.find(c => c.id === sessionForm.courseId);
      if(!course) return;

      const dateTs = new Date(`${sessionForm.date}T${sessionForm.time}`).getTime();
      await CourseService.addSession(user, {
          courseId: course.id,
          courseName: course.title,
          date: dateTs,
          topic: sessionForm.topic,
          instructor: sessionForm.instructor || course.instructorName
      });
      setShowSessionModal(false);
      setSessionForm({ courseId: '', date: '', time: '', topic: '', instructor: '' });
      fetchData();
  };

  const handlePayment = async () => {
      if(!user || !selectedStudent) return;
      await CourseService.recordPayment(user, selectedStudent.id, paymentAmount);
      setShowPaymentModal(false);
      setSelectedStudent(null);
      setPaymentAmount(0);
      fetchData();
  };

  const handleGenerateCertificate = async (student: CourseStudent) => {
      if (!user) return;
      
      const doc = new jsPDF('l', 'mm', 'a4');
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // Border
      doc.setDrawColor(13, 148, 136); // Teal
      doc.setLineWidth(3);
      doc.rect(10, 10, width - 20, height - 20);
      
      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(50, 50, 50);
      doc.text("CERTIFICATE OF COMPLETION", width / 2, 50, { align: "center" });
      
      // Subtext
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text("This is to certify that", width / 2, 70, { align: "center" });
      
      // Student Name
      doc.setFontSize(30);
      doc.setFont("times", "italic");
      doc.setTextColor(13, 148, 136);
      doc.text(student.name, width / 2, 90, { align: "center" });
      
      // Course Info
      doc.setFontSize(16);
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.text("Has successfully completed the training course:", width / 2, 110, { align: "center" });
      
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(student.courseName, width / 2, 125, { align: "center" });
      
      // Footer
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 40, 160);
      doc.text("Instructor Signature", width - 60, 160);
      doc.line(width - 80, 155, width - 30, 155);

      // Save update
      if (!student.isCertified) {
          await CourseService.issueCertificate(user, student.id);
          fetchData();
      }
      
      doc.save(`Cert_${student.name.replace(' ', '_')}.pdf`);
  };

  // Determine which tab to show
  const currentView = isSecretary ? 'schedule' : activeTab;

  return (
    <Layout title={isSecretary ? "Academy Schedule" : "Beauty Academy Management"}>
      <div className="flex flex-col gap-6">
          
          {/* Header Tabs - HIDDEN FOR SECRETARY */}
          {!isSecretary ? (
            <div className="flex gap-2 p-1 bg-white rounded-xl w-fit shadow-sm border border-slate-100">
                {['dashboard', 'courses', 'students', 'schedule'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 bg-white p-3 rounded-xl border border-slate-100 w-fit">
                <i className="fa-regular fa-calendar-days text-pink-500"></i>
                <span className="text-sm font-bold">Read-Only View: Class Schedule</span>
            </div>
          )}

          {/* CONTENT */}
          {currentView === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
                  <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                      <div className="text-slate-400 text-xs font-bold uppercase mb-2">Total Students</div>
                      <div className="text-3xl font-extrabold text-slate-800">{students.length}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                      <div className="text-slate-400 text-xs font-bold uppercase mb-2">Active Courses</div>
                      <div className="text-3xl font-extrabold text-slate-800">{courses.length}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                      <div className="text-slate-400 text-xs font-bold uppercase mb-2">Revenue Collected</div>
                      <div className="text-3xl font-extrabold text-emerald-600">${students.reduce((acc,s) => acc + s.paidAmount, 0)}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
                      <div className="text-slate-400 text-xs font-bold uppercase mb-2">Upcoming Sessions</div>
                      <div className="text-3xl font-extrabold text-blue-600">{sessions.length}</div>
                  </div>
              </div>
          )}

          {currentView === 'courses' && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 flex flex-col overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-slate-800">Available Courses</h3>
                      {!isSecretary && <button onClick={() => setShowCourseModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800"><i className="fa-solid fa-plus mr-2"></i> Add Course</button>}
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {courses.map(c => (
                          <div key={c.id} className="border border-slate-200 rounded-xl p-5 hover:border-blue-400 transition-all group relative">
                              <div className="flex justify-between items-start mb-4">
                                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xl"><i className="fa-solid fa-graduation-cap"></i></div>
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">{c.status}</span>
                              </div>
                              <h4 className="font-bold text-lg text-slate-800 mb-1">{c.title}</h4>
                              <p className="text-sm text-slate-500 mb-4">{c.duration} • Instructor: {c.instructorName}</p>
                              <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                  <span className="font-bold text-xl text-slate-800">${c.price}</span>
                                  <span className="text-xs text-slate-400 font-bold uppercase">{c.hasCertificate ? 'Certificate Included' : 'No Certificate'}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {currentView === 'students' && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 flex flex-col overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-slate-800">Students Registry</h3>
                      {!isSecretary && <button onClick={() => setShowStudentModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800"><i className="fa-solid fa-user-plus mr-2"></i> Register Student</button>}
                  </div>
                  <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                          <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-400">
                              <tr>
                                  <th className="px-6 py-4">Student Name</th>
                                  <th className="px-6 py-4">Course</th>
                                  <th className="px-6 py-4">Enrollment Date</th>
                                  <th className="px-6 py-4">Payment Status</th>
                                  <th className="px-6 py-4 text-end">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {students.map(s => (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                      <td className="px-6 py-4">
                                          <div className="font-bold text-slate-800">{s.name}</div>
                                          <div className="text-xs text-slate-400">{s.phone}</div>
                                      </td>
                                      <td className="px-6 py-4 font-medium">{s.courseName}</td>
                                      <td className="px-6 py-4 text-xs">{new Date(s.enrollmentDate).toLocaleDateString()}</td>
                                      <td className="px-6 py-4">
                                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${s.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : s.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                              {s.paymentStatus} ({Math.round((s.paidAmount/s.totalFees)*100)}%)
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 text-end">
                                          <div className="flex justify-end gap-2">
                                              {!isSecretary && s.paymentStatus !== 'PAID' && (
                                                  <button onClick={() => { setSelectedStudent(s); setShowPaymentModal(true); }} className="p-2 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100" title="Create Payment Invoice"><i className="fa-solid fa-money-bill-wave"></i></button>
                                              )}
                                              <button onClick={() => handleGenerateCertificate(s)} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Certificate"><i className="fa-solid fa-certificate"></i></button>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {currentView === 'schedule' && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 flex flex-col overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold text-slate-800">Sessions Schedule</h3>
                      {!isSecretary && <button onClick={() => setShowSessionModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800"><i className="fa-regular fa-calendar-plus mr-2"></i> Add Session</button>}
                  </div>
                  <div className="p-6 space-y-4">
                      {sessions.length === 0 ? <div className="text-center text-slate-400 py-10">No sessions scheduled.</div> : 
                        sessions.sort((a,b) => a.date - b.date).map(sess => (
                            <div key={sess.id} className="flex items-center gap-4 p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                                <div className="flex flex-col items-center justify-center w-16 h-16 bg-slate-100 rounded-lg text-slate-600">
                                    <span className="text-xs font-bold uppercase">{new Date(sess.date).toLocaleDateString(undefined, {month:'short'})}</span>
                                    <span className="text-xl font-bold text-slate-800">{new Date(sess.date).getDate()}</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800">{sess.topic}</h4>
                                    <div className="text-sm text-slate-500">{sess.courseName} • {new Date(sess.date).toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'})}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-400 uppercase">Instructor</div>
                                    <div className="text-sm font-medium text-slate-700">{sess.instructor}</div>
                                </div>
                            </div>
                        ))
                      }
                  </div>
              </div>
          )}

      </div>

      {/* MODALS (Only render for Manager) */}
      
      {/* 1. Add Course */}
      {!isSecretary && showCourseModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
                  <h3 className="font-bold text-lg mb-4">Add New Course</h3>
                  <form onSubmit={handleAddCourse} className="space-y-4">
                      <input className="w-full p-3 border rounded-xl" placeholder="Course Title" value={courseForm.title} onChange={e => setCourseForm({...courseForm, title: e.target.value})} required />
                      <div className="grid grid-cols-2 gap-4">
                          <input className="p-3 border rounded-xl" placeholder="Duration (e.g. 3 Months)" value={courseForm.duration} onChange={e => setCourseForm({...courseForm, duration: e.target.value})} required />
                          <input type="number" className="p-3 border rounded-xl" placeholder="Price" value={courseForm.price} onChange={e => setCourseForm({...courseForm, price: Number(e.target.value)})} required />
                      </div>
                      <input className="w-full p-3 border rounded-xl" placeholder="Instructor Name" value={courseForm.instructorName} onChange={e => setCourseForm({...courseForm, instructorName: e.target.value})} required />
                      <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Create Course</button>
                      <button type="button" onClick={() => setShowCourseModal(false)} className="w-full text-slate-500 py-2">Cancel</button>
                  </form>
              </div>
          </div>
      )}

      {/* 2. Register Student */}
      {!isSecretary && showStudentModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
                  <h3 className="font-bold text-lg mb-4">Register Student</h3>
                  <form onSubmit={handleRegisterStudent} className="space-y-4">
                      <select className="w-full p-3 border rounded-xl" value={studentForm.courseId} onChange={e => setStudentForm({...studentForm, courseId: e.target.value})} required>
                          <option value="">-- Select Course --</option>
                          {courses.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.title} (${c.price})</option>)}
                      </select>
                      <input className="w-full p-3 border rounded-xl" placeholder="Student Name" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} required />
                      <input className="w-full p-3 border rounded-xl" placeholder="Phone Number" value={studentForm.phone} onChange={e => setStudentForm({...studentForm, phone: e.target.value})} required />
                      <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Register</button>
                      <button type="button" onClick={() => setShowStudentModal(false)} className="w-full text-slate-500 py-2">Cancel</button>
                  </form>
              </div>
          </div>
      )}

      {/* 3. Payment Modal */}
      {!isSecretary && showPaymentModal && selectedStudent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4"><i className="fa-solid fa-cash-register"></i></div>
                  <h3 className="font-bold text-lg">Record Payment</h3>
                  <p className="text-slate-500 text-sm mb-6">For {selectedStudent.name}<br/>Remaining: ${selectedStudent.totalFees - selectedStudent.paidAmount}</p>
                  
                  <input type="number" className="w-full p-3 border rounded-xl mb-4 text-center font-bold text-lg" placeholder="Amount" value={paymentAmount} onChange={e => setPaymentAmount(Number(e.target.value))} autoFocus />
                  
                  <p className="text-[10px] text-slate-400 mb-4">Note: This will generate an invoice for the Secretary/Reception.</p>

                  <button onClick={handlePayment} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold mb-2">Create Invoice</button>
                  <button onClick={() => setShowPaymentModal(false)} className="w-full text-slate-400">Cancel</button>
              </div>
          </div>
      )}

      {/* 4. Session Modal */}
      {!isSecretary && showSessionModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
                  <h3 className="font-bold text-lg mb-4">Schedule Session</h3>
                  <form onSubmit={handleAddSession} className="space-y-4">
                      <select className="w-full p-3 border rounded-xl" value={sessionForm.courseId} onChange={e => setSessionForm({...sessionForm, courseId: e.target.value})} required>
                          <option value="">-- Select Course --</option>
                          {courses.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-4">
                          <input type="date" className="p-3 border rounded-xl" value={sessionForm.date} onChange={e => setSessionForm({...sessionForm, date: e.target.value})} required />
                          <input type="time" className="p-3 border rounded-xl" value={sessionForm.time} onChange={e => setSessionForm({...sessionForm, time: e.target.value})} required />
                      </div>
                      <input className="w-full p-3 border rounded-xl" placeholder="Session Topic" value={sessionForm.topic} onChange={e => setSessionForm({...sessionForm, topic: e.target.value})} required />
                      <input className="w-full p-3 border rounded-xl" placeholder="Instructor (Optional)" value={sessionForm.instructor} onChange={e => setSessionForm({...sessionForm, instructor: e.target.value})} />
                      <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Add to Schedule</button>
                      <button type="button" onClick={() => setShowSessionModal(false)} className="w-full text-slate-500 py-2">Cancel</button>
                  </form>
              </div>
          </div>
      )}

    </Layout>
  );
};

export default CoursesView;
