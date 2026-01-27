
import { Clinic, Patient, User, UserRole, AuditMetadata, VisitData, Appointment, Invoice, Notification, PrescriptionItem, Attachment, SystemSettings, ClinicCategory, LabCase, LabCaseStatus, ImplantItem, ImplantOrder, ImplantOrderStatus, Course, CourseStudent, CourseSession, CourseStatus } from '../types';

/**
 * PRODUCTION READINESS:
 * Services act as gatekeepers. IDs are now generated using high-entropy randoms.
 */

// --- Helpers ---
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`;

const createMeta = (user: User | null, existing?: AuditMetadata): AuditMetadata => {
  const now = Date.now();
  const uid = user?.uid || 'system';
  return {
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || uid,
    updatedAt: now,
    updatedBy: uid,
    isArchived: existing?.isArchived || false
  };
};

const DEFAULT_SETTINGS: SystemSettings = {
  clinicName: 'MED LOOP Clinic',
  logoUrl: '',
  address: 'Medical Plaza',
  phone: '000-000-0000'
};

// --- Services ---

export const AuthService = {
  
  createUser: async (admin: User, data: Pick<User, 'name'|'email'|'role'|'clinicIds'>): Promise<void> => {
    if (admin.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    const newUser: User = {
      uid: generateId('user'),
      ...data,
      isActive: true,
      ...createMeta(admin)
    };
  },

  updateUser: async (admin: User, userId: string, data: Partial<User>): Promise<void> => {
    if (admin.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    const user = allUsers.find(u => u.uid === userId);
    if (!user) throw new Error("User not found");
    const updated = { ...user, ...data, ...createMeta(admin, user) };
  },

  deleteUser: async (admin: User, userId: string): Promise<void> => {
    if (admin.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    if (admin.uid === userId) throw new Error("Cannot delete your own account");
  }
};

export const ClinicService = {

  getActive: async (): Promise<Clinic[]> => {
    return all.filter(c => c.active && !c.isArchived);
  },

  add: async (user: User, name: string, type: string, category: ClinicCategory): Promise<void> => {
    if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized: Admins only");
    const newClinic: Clinic = {
      id: generateId(category === 'clinic' ? 'c' : 'dept'),
      name, 
      type, 
      category,
      active: true, 
      ...createMeta(user)
    };
  },

  toggleStatus: async (user: User, clinicId: string, status: boolean): Promise<void> => {
    if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    const clinic = clinics.find(c => c.id === clinicId);
    if (!clinic) throw new Error("Clinic not found");
    const updated = { ...clinic, active: status, ...createMeta(user, clinic) };
  },
  
  delete: async (user: User, clinicId: string): Promise<void> => {
    if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
  }
};

export const PatientService = {
  subscribe: (user: User, callback: (patients: Patient[]) => void) => {
      let filtered = allPatients.filter(p => !p.isArchived);
      
      // Filter for Doctors: Only see patients in their clinics
      if (user.role === UserRole.DOCTOR) {
        if (!user.clinicIds || user.clinicIds.length === 0) {
          callback([]); return;
        }
        filtered = filtered.filter(p => user.clinicIds.includes(p.currentVisit.clinicId));
      } 
      
      callback(filtered.sort((a, b) => {
          if (a.currentVisit.priority === 'urgent' && b.currentVisit.priority !== 'urgent') return -1;
          if (a.currentVisit.priority !== 'urgent' && b.currentVisit.priority === 'urgent') return 1;
          return a.currentVisit.date - b.currentVisit.date;
      }));
    });
  },

  getAll: async (user: User): Promise<Patient[]> => {
    const activePatients = allPatients.filter(p => !p.isArchived);
    if (user.role === UserRole.DOCTOR) {
        if (!user.clinicIds || user.clinicIds.length === 0) return [];
        return activePatients.filter(p => user.clinicIds.includes(p.currentVisit.clinicId));
    }
    return activePatients;
  },

  getById: async (user: User, id: string): Promise<Patient | null> => {
    const patient = allPatients.find(p => p.id === id);
    if (!patient || patient.isArchived) return null;
    if (user.role === UserRole.DOCTOR) {
        const isAssigned = user.clinicIds.includes(patient.currentVisit.clinicId);
        if (!isAssigned) throw new Error("Access Denied");
    }
    return patient;
  },

  add: async (user: User, data: Pick<Patient, 'name'|'age'|'phone'|'gender'|'medicalProfile'|'currentVisit'>): Promise<string> => {
    const patientId = generateId('p');
    const newPatient: Patient = {
      id: patientId,
      ...data,
      currentVisit: { ...data.currentVisit, visitId: generateId('v') },
      history: [],
      ...createMeta(user)
    };
    return patientId;
  },

  updateVisitData: async (user: User, patient: Patient, data: Partial<VisitData>) => {
    const updated: Patient = { 
        ...patient,
        currentVisit: { ...patient.currentVisit, ...data },
        ...createMeta(user, patient) 
    };
  },

  updateStatus: async (user: User, patient: Patient, status: VisitData['status'], doctorData?: Partial<VisitData>) => {
    const updated: Patient = { 
      ...patient,
      currentVisit: { ...patient.currentVisit, status, ...(doctorData || {}) },
      ...createMeta(user, patient) 
    };
    
    if (status === 'completed') {
       const billableItems = doctorData?.invoiceItems || [];
       if (billableItems.length === 0) {
           billableItems.push({ id: generateId('item'), description: 'Medical Consultation', price: 50 });
       }
       await BillingService.create(user, {
           visitId: patient.currentVisit.visitId,
           patientId: patient.id,
           patientName: patient.name,
           items: billableItems
       });
    }

  },

  archive: async (user: User, patientId: string) => {
      if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
  }
};

export const AppointmentService = {
    getAll: async (user: User): Promise<Appointment[]> => {
        if (user.role === UserRole.DOCTOR) {
             return apps.filter(a => (a.doctorId === user.uid) || (!a.doctorId && user.clinicIds.includes(a.clinicId)));
        }
        return apps;
    },

    create: async (user: User, data: Pick<Appointment, 'patientId'|'patientName'|'clinicId'|'doctorId'|'date'|'reason'>) => {
        const newApp: Appointment = {
            id: generateId('app'),
            ...data,
            status: 'scheduled',
            ...createMeta(user)
        };
        await NotificationService.create(user, {
            type: 'reminder',
            title: 'Appointment Reminder',
            message: `Call ${data.patientName} for tomorrow's appointment.`,
            targetRole: UserRole.SECRETARY,
            relatedPatientId: data.patientId,
            dueDate: data.date - 86400000
        });
    },

    update: async (user: User, id: string, data: Partial<Pick<Appointment, 'clinicId'|'doctorId'|'date'|'reason'>>) => {
        const app = apps.find(a => a.id === id);
        if (!app) throw new Error("Appointment not found");
        const updated = { ...app, ...data, ...createMeta(user, app) };
    },

    updateStatus: async (user: User, id: string, status: Appointment['status']) => {
        const app = apps.find(a => a.id === id);
        if (!app) throw new Error("Appointment not found");
        const updated = { ...app, status, ...createMeta(user, app) };
    },
    
    delete: async (user: User, id: string) => {
    },

    checkIn: async (user: User, appointmentId: string) => {
        const app = apps.find(a => a.id === appointmentId);
        if (!app) throw new Error("Appointment not found");

        const patient = patients.find(p => p.id === app.patientId);
        if (!patient) throw new Error("Patient not found in database");

        const updatedApp = { ...app, status: 'checked-in' as const, ...createMeta(user, app) };

        const oldHistory = Array.isArray(patient.history) ? patient.history : [];
        const historyToAdd = patient.currentVisit ? [{ ...patient.currentVisit, status: 'completed' as const }] : [];
        
        const updatedPatient: Patient = {
            ...patient,
            history: [...oldHistory, ...historyToAdd],
            currentVisit: {
                visitId: generateId('v_app'),
                clinicId: app.clinicId,
                doctorId: app.doctorId,
                date: Date.now(),
                status: 'waiting',
                priority: 'normal',
                source: 'appointment',
                reasonForVisit: app.reason || 'Appointment'
            },
            ...createMeta(user, patient)
        };

    }
};

export const BillingService = {
    getAll: async (user: User): Promise<Invoice[]> => {
        return invoices.sort((a,b) => b.createdAt - a.createdAt);
    },

    create: async (user: User, data: Pick<Invoice, 'visitId'|'patientId'|'patientName'|'items'>) => {
        const total = data.items.reduce((sum, item) => sum + item.price, 0);
        const newInvoice: Invoice = {
            id: generateId('inv'),
            ...data,
            totalAmount: total,
            paidAmount: 0,
            status: 'unpaid',
            paymentMethod: 'cash',
            ...createMeta(user)
        };
    },

    update: async (user: User, id: string, data: Partial<Invoice>) => {
        const inv = invoices.find(i => i.id === id);
        if (!inv) throw new Error("Invoice not found");
        
        let total = inv.totalAmount;
        if (data.items) {
            total = data.items.reduce((sum, item) => sum + item.price, 0);
        }

        const updated = { ...inv, ...data, totalAmount: total, ...createMeta(user, inv) };
    },
    
    processPayment: async (user: User, id: string, amount: number, method: Invoice['paymentMethod']) => {
        const inv = invoices.find(i => i.id === id);
        if (!inv) throw new Error("Invoice not found");
        
        const newPaid = inv.paidAmount + amount;
        const status = newPaid >= inv.totalAmount ? 'paid' : 'partial';
        
        const updated = { 
            ...inv, 
            paidAmount: newPaid, 
            status, 
            paymentMethod: method, 
            ...createMeta(user, inv) 
        };
    }
};

export const NotificationService = {
    getAll: async (user: User): Promise<Notification[]> => {
        return all.filter(n => !n.targetRole || n.targetRole === user.role).sort((a,b) => b.createdAt - a.createdAt);
    },
    
    getPendingReminders: async (user: User): Promise<Notification[]> => {
        const now = Date.now();
        return all.filter(n => 
            n.type === 'reminder' && 
            !n.isRead && 
            n.dueDate && n.dueDate <= now &&
            (!n.targetRole || n.targetRole === user.role)
        );
    },

    create: async (user: User, data: Pick<Notification, 'type'|'title'|'message'|'targetRole'|'relatedPatientId'|'dueDate'>) => {
        const notif: Notification = {
            id: generateId('notif'),
            ...data,
            isRead: false,
            ...createMeta(user)
        };
    },

    markAsRead: async (user: User, id: string) => {
        const notif = all.find(n => n.id === id);
        if (notif) {
            const updated = { ...notif, isRead: true, ...createMeta(user, notif) };
        }
    }
};

export const SettingsService = {
    getSettings: async (): Promise<SystemSettings> => {
        return arr.length > 0 ? arr[0] : DEFAULT_SETTINGS;
    },
    
    updateSettings: async (user: User, settings: SystemSettings): Promise<void> => {
        if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    }
};

export const DentalLabService = {
    getAllCases: async (user: User): Promise<LabCase[]> => {
        const isLabAdmin = user.role === UserRole.ADMIN || user.role === UserRole.LAB_TECH;
        
        if (isLabAdmin) {
            return allCases.sort((a,b) => b.createdAt - a.createdAt);
        } else if (user.role === UserRole.DOCTOR) {
            return allCases.filter(c => c.doctorId === user.uid).sort((a,b) => b.createdAt - a.createdAt);
        }
        return []; 
    },

    getEligibleVisits: async (user: User) => {
        const eligible: { patientName: string, visitId: string, patientId: string, date: number, doctorId: string }[] = [];
        
        allPatients.forEach(p => {
            if (p.currentVisit.status === 'completed') {
                eligible.push({ 
                    patientName: p.name, 
                    visitId: p.currentVisit.visitId, 
                    patientId: p.id,
                    date: p.currentVisit.date,
                    doctorId: p.currentVisit.doctorId || 'unknown'
                });
            }
            if (p.history) {
                p.history.forEach(v => {
                    if (v.status === 'completed') {
                        eligible.push({ 
                            patientName: p.name, 
                            visitId: v.visitId, 
                            patientId: p.id,
                            date: v.date,
                            doctorId: v.doctorId || 'unknown'
                        });
                    }
                });
            }
        });
        return eligible.sort((a,b) => b.date - a.date);
    },

    createCase: async (user: User, data: Pick<LabCase, 'visitId'|'patientId'|'patientName'|'doctorId'|'doctorName'|'caseType'|'notes'|'dueDate'>) => {
        const newCase: LabCase = {
            id: generateId('lc'),
            ...data,
            status: 'PENDING',
            ...createMeta(user)
        };
    },

    updateStatus: async (user: User, caseId: string, status: LabCaseStatus) => {
        const isLabUser = user.role === UserRole.ADMIN || user.role === UserRole.LAB_TECH;
        if (!isLabUser) throw new Error("Unauthorized");
        const labCase = allCases.find(c => c.id === caseId);
        if (!labCase) throw new Error("Case not found");
        const updated = { ...labCase, status, ...createMeta(user, labCase) };
    }
};

export const ImplantService = {
    getInventory: async (user: User): Promise<ImplantItem[]> => {
        if (user.role === UserRole.SECRETARY) return []; 
    },

    addInventoryItem: async (user: User, data: Pick<ImplantItem, 'brand'|'type'|'size'|'quantity'|'minThreshold'>) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.IMPLANT_MANAGER) throw new Error("Unauthorized");
        const newItem: ImplantItem = {
            id: generateId('imp'),
            ...data,
            ...createMeta(user)
        };
    },

    updateStock: async (user: User, itemId: string, newQuantity: number) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.IMPLANT_MANAGER) throw new Error("Unauthorized");
        const item = items.find(i => i.id === itemId);
        if (!item) throw new Error("Item not found");
        const updated = { ...item, quantity: newQuantity, ...createMeta(user, item) };
    },

    getOrders: async (user: User): Promise<ImplantOrder[]> => {
        if (user.role === UserRole.ADMIN || user.role === UserRole.IMPLANT_MANAGER) {
            return orders.sort((a,b) => b.createdAt - a.createdAt);
        }
        if (user.role === UserRole.DOCTOR) {
            return orders.filter(o => o.doctorId === user.uid).sort((a,b) => b.createdAt - a.createdAt);
        }
        return [];
    },

    createOrder: async (user: User, data: Pick<ImplantOrder, 'clinicId'|'clinicName'|'doctorId'|'doctorName'|'itemId'|'brand'|'type'|'size'|'quantity'|'requiredDate'|'notes'>) => {
        const item = items.find(i => i.id === data.itemId);
        if (!item) throw new Error("Item not found");
        if (item.quantity < data.quantity) throw new Error(`Insufficient stock. Available: ${item.quantity}`);

        const newOrder: ImplantOrder = {
            id: generateId('imp_ord'),
            ...data,
            status: 'PENDING',
            ...createMeta(user)
        };
    },

    updateOrderStatus: async (user: User, orderId: string, status: ImplantOrderStatus) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.IMPLANT_MANAGER) throw new Error("Unauthorized");
        
        const order = orders.find(o => o.id === orderId);
        if (!order) throw new Error("Order not found");

        if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
            const item = items.find(i => i.id === order.itemId);
            if (item) {
                const newQty = Math.max(0, item.quantity - order.quantity);
                const updatedItem = { ...item, quantity: newQty, ...createMeta(user, item) };
            }
        }
        const updatedOrder = { ...order, status, ...createMeta(user, order) };
    }
};

// --- NEW: Course Service (Beauty Academy) ---
export const CourseService = {
    getAllCourses: async (): Promise<Course[]> => {
    },

    createCourse: async (user: User, data: Pick<Course, 'title'|'description'|'duration'|'price'|'instructorName'|'hasCertificate'>) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const newCourse: Course = {
            id: generateId('crs'),
            ...data,
            status: 'ACTIVE',
            ...createMeta(user)
        };
    },

    registerStudent: async (user: User, data: Pick<CourseStudent, 'name'|'phone'|'gender'|'courseId'|'courseName'|'totalFees'>) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const newStudent: CourseStudent = {
            id: generateId('std'),
            ...data,
            enrollmentDate: Date.now(),
            paidAmount: 0,
            paymentStatus: 'UNPAID',
            isCertified: false,
            ...createMeta(user)
        };
    },

    getStudents: async (user: User): Promise<CourseStudent[]> => {
        if (user.role === UserRole.ADMIN || user.role === UserRole.COURSE_MANAGER) {
            return students.sort((a,b) => b.createdAt - a.createdAt);
        }
        return [];
    },

    recordPayment: async (user: User, studentId: string, amount: number) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const student = students.find(s => s.id === studentId);
        if (!student) throw new Error("Student not found");

        const newPaid = student.paidAmount + amount;
        const newStatus = newPaid >= student.totalFees ? 'PAID' : 'PARTIAL';
        
        const updated = { ...student, paidAmount: newPaid, paymentStatus: newStatus, ...createMeta(user, student) };

        // --- NEW: Generate Invoice for Secretary to Collect/Verify ---
        // This makes the payment appear in the Reception "Billing" modal
        await BillingService.create(user, {
            visitId: 'academy_' + student.id + '_' + Date.now(), // Fake ID
            patientId: student.id, // Student ID
            patientName: student.name + ' (Student)',
            items: [{ 
                id: generateId('item'), 
                description: `Academy Fee: ${student.courseName}`, 
                price: amount 
            }]
        });
    },

    issueCertificate: async (user: User, studentId: string) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const student = students.find(s => s.id === studentId);
        if (!student) throw new Error("Student not found");
        
        const updated = { ...student, isCertified: true, ...createMeta(user, student) };
    },

    getSessions: async (user: User): Promise<CourseSession[]> => {
    },

    addSession: async (user: User, data: Pick<CourseSession, 'courseId'|'courseName'|'date'|'topic'|'instructor'>) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const session: CourseSession = {
            id: generateId('sess'),
            ...data,
            ...createMeta(user)
        };
    }
};
