
import { Clinic, Patient, User, UserRole, AuditMetadata, VisitData, Appointment, Invoice, Notification, PrescriptionItem, Attachment, SystemSettings, ClinicCategory, LabCase, LabCaseStatus, ImplantItem, ImplantOrder, ImplantOrderStatus, Course, CourseStudent, CourseSession, CourseStatus } from '../types';
import { mockDb } from './mockFirebase';
import { pgUsers, pgClinics, pgPatients, pgAppointments } from './pgServices';

// Check if we should use PostgreSQL (production) or mockDb (development)
// For now, always use PostgreSQL since we have Neon set up
const USE_POSTGRES = true;

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
  
  createUser: async (admin: User, data: Pick<User, 'name'|'email'|'password'|'role'|'clinicIds'>): Promise<void> => {
    if (admin.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    
    if (USE_POSTGRES) {
      await pgUsers.create({
        ...data,
        password: data.password || 'password123',
        isActive: true,
        isArchived: false
      });
    } else {
      const newUser: User = {
        uid: generateId('user'),
        ...data,
        password: data.password || 'password123',
        isActive: true,
        ...createMeta(admin)
      };
      mockDb.saveUser(newUser);
    }
  },

  updateUser: async (admin: User, userId: string, data: Partial<User>): Promise<void> => {
    if (admin.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    
    if (USE_POSTGRES) {
      // Remove password from update if it's empty (keep existing password)
      const updateData = { ...data };
      if (!updateData.password) {
        delete updateData.password;
      }
      await pgUsers.update(userId, updateData);
    } else {
      const allUsers = mockDb.getAllUsers();
      const user = allUsers.find(u => u.uid === userId);
      if (!user) throw new Error("User not found");
      const updated = { ...user, ...data, ...createMeta(admin, user) };
      mockDb.update('users', userId, updated);
    }
  },

  deleteUser: async (admin: User, userId: string): Promise<void> => {
    if (admin.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    if (admin.uid === userId) throw new Error("Cannot delete your own account");
    
    if (USE_POSTGRES) {
      await pgUsers.delete(userId);
    } else {
      await mockDb.deleteDocument('users', userId);
    }
  }
};

export const ClinicService = {

  getActive: async (): Promise<Clinic[]> => {
    if (USE_POSTGRES) {
      return await pgClinics.getAll();
    } else {
      const all = mockDb.getCollection<Clinic>('clinics');
      return all.filter(c => c.active && !c.isArchived);
    }
  },

  add: async (user: User, name: string, type: string, category: ClinicCategory): Promise<void> => {
    if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized: Admins only");
    
    if (USE_POSTGRES) {
      await pgClinics.create({
        name,
        type,
        category,
        active: true,
        isArchived: false
      });
    } else {
      const newClinic: Clinic = {
        id: generateId(category === 'clinic' ? 'c' : 'dept'),
        name, 
        type, 
        category,
        active: true, 
        ...createMeta(user)
      };
      mockDb.add('clinics', newClinic);
    }
  },

  toggleStatus: async (user: User, clinicId: string, status: boolean): Promise<void> => {
    if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    
    if (USE_POSTGRES) {
      await pgClinics.toggleStatus(clinicId, status);
    } else {
      const clinics = mockDb.getCollection<Clinic>('clinics');
      const clinic = clinics.find(c => c.id === clinicId);
      if (!clinic) throw new Error("Clinic not found");
      const updated = { ...clinic, active: status, ...createMeta(user, clinic) };
      mockDb.update('clinics', clinicId, updated);
    }
  },
  
  delete: async (user: User, clinicId: string): Promise<void> => {
    if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
    
    if (USE_POSTGRES) {
      await pgClinics.delete(clinicId);
    } else {
      await mockDb.deleteDocument('clinics', clinicId);
    }
  }
};

export const PatientService = {
  subscribe: (user: User, callback: (patients: Patient[]) => void): (() => void) => {
    if (USE_POSTGRES) {
      // Use PostgreSQL with polling for real-time updates
      return pgPatients.subscribe((allPatients) => {
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
    } else {
      // Use mockDb.subscribeToPatients for real-time updates
      return mockDb.subscribeToPatients((allPatients) => {
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
    }
  },

  getAll: async (user: User): Promise<Patient[]> => {
    if (USE_POSTGRES) {
      const allPatients = await pgPatients.getAll();
      const activePatients = allPatients.filter(p => !p.isArchived);
      if (user.role === UserRole.DOCTOR) {
        if (!user.clinicIds || user.clinicIds.length === 0) return [];
        return activePatients.filter(p => user.clinicIds.includes(p.currentVisit.clinicId));
      }
      return activePatients;
    } else {
      const allPatients = mockDb.getCollection<Patient>('patients');
      const activePatients = allPatients.filter(p => !p.isArchived);
      if (user.role === UserRole.DOCTOR) {
        if (!user.clinicIds || user.clinicIds.length === 0) return [];
        return activePatients.filter(p => user.clinicIds.includes(p.currentVisit.clinicId));
      }
      return activePatients;
    }
  },

  getById: async (user: User, id: string): Promise<Patient | null> => {
    if (USE_POSTGRES) {
      const allPatients = await pgPatients.getAll();
      const patient = allPatients.find(p => p.id === id);
      if (!patient || patient.isArchived) return null;
      if (user.role === UserRole.DOCTOR) {
        const isAssigned = user.clinicIds.includes(patient.currentVisit.clinicId);
        if (!isAssigned) throw new Error("Access Denied");
      }
      return patient;
    } else {
      const allPatients = mockDb.getCollection<Patient>('patients');
      const patient = allPatients.find(p => p.id === id);
      if (!patient || patient.isArchived) return null;
      if (user.role === UserRole.DOCTOR) {
        const isAssigned = user.clinicIds.includes(patient.currentVisit.clinicId);
        if (!isAssigned) throw new Error("Access Denied");
      }
      return patient;
    }
  },

  add: async (user: User, data: Pick<Patient, 'name'|'age'|'phone'|'gender'|'medicalProfile'|'currentVisit'|'username'|'email'|'password'>): Promise<string> => {
    if (USE_POSTGRES) {
      const patientId = await pgPatients.create({
        ...data,
        hasAccess: !!(data.username && data.password), // Enable access if username and password provided
        currentVisit: { ...data.currentVisit, visitId: generateId('v') },
        history: [],
        isArchived: false
      });
      return patientId;
    } else {
      const patientId = generateId('p');
      const newPatient: Patient = {
        id: patientId,
        ...data,
        hasAccess: !!(data.username && data.password),
        currentVisit: { ...data.currentVisit, visitId: generateId('v') },
        history: [],
        ...createMeta(user)
      };
      await mockDb.writeDocument('patients', newPatient);
      return patientId;
    }
  },

  updateVisitData: async (user: User, patient: Patient, data: Partial<VisitData>) => {
    const updated: Patient = { 
        ...patient,
        currentVisit: { ...patient.currentVisit, ...data },
        ...createMeta(user, patient) 
    };
    await mockDb.writeDocument('patients', updated);
  },

  updateStatus: async (user: User, patient: Patient, status: VisitData['status'], doctorData?: Partial<VisitData>) => {
    const updated: Patient = { 
      ...patient,
      currentVisit: { ...patient.currentVisit, status, ...(doctorData || {}) },
      ...createMeta(user, patient) 
    };
    await mockDb.writeDocument('patients', updated);
    
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
      const allPatients = mockDb.getCollection<Patient>('patients');
      const patient = allPatients.find(p => p.id === patientId);
      if (!patient) throw new Error("Patient not found");
      const updated = { ...patient, isArchived: true, ...createMeta(user, patient) };
      await mockDb.writeDocument('patients', updated);
  }
};

export const AppointmentService = {
    getAll: async (user: User): Promise<Appointment[]> => {
        if (USE_POSTGRES) {
            const allApps = await pgAppointments.getAll();
            if (user.role === UserRole.DOCTOR) {
                return allApps.filter(a => (a.doctorId === user.uid) || (!a.doctorId && user.clinicIds.includes(a.clinicId)));
            }
            return allApps;
        } else {
            const apps = mockDb.getCollection<Appointment>('appointments');
            if (user.role === UserRole.DOCTOR) {
                return apps.filter(a => (a.doctorId === user.uid) || (!a.doctorId && user.clinicIds.includes(a.clinicId)));
            }
            return apps;
        }
    },

    create: async (user: User, data: Pick<Appointment, 'patientId'|'patientName'|'clinicId'|'doctorId'|'date'|'reason'>) => {
        const newApp: Appointment = {
            id: generateId('app'),
            ...data,
            status: 'scheduled',
            ...createMeta(user)
        };
        await mockDb.writeDocument('appointments', newApp);
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
        const apps = mockDb.getCollection<Appointment>('appointments');
        const app = apps.find(a => a.id === id);
        if (!app) throw new Error("Appointment not found");
        const updated = { ...app, ...data, ...createMeta(user, app) };
        await mockDb.writeDocument('appointments', updated);
    },

    updateStatus: async (user: User, id: string, status: Appointment['status']) => {
        const apps = mockDb.getCollection<Appointment>('appointments');
        const app = apps.find(a => a.id === id);
        if (!app) throw new Error("Appointment not found");
        const updated = { ...app, status, ...createMeta(user, app) };
        await mockDb.writeDocument('appointments', updated);
    },
    
    delete: async (user: User, id: string) => {
        await mockDb.deleteDocument('appointments', id);
    },

    checkIn: async (user: User, appointmentId: string) => {
        const apps = mockDb.getCollection<Appointment>('appointments');
        const app = apps.find(a => a.id === appointmentId);
        if (!app) throw new Error("Appointment not found");

        const patients = mockDb.getCollection<Patient>('patients');
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

        await mockDb.writeDocument('appointments', updatedApp);
        await mockDb.writeDocument('patients', updatedPatient);
    }
};

export const BillingService = {
    getAll: async (user: User): Promise<Invoice[]> => {
        const invoices = mockDb.getCollection<Invoice>('invoices');
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
        await mockDb.writeDocument('invoices', newInvoice);
    },

    update: async (user: User, id: string, data: Partial<Invoice>) => {
        const invoices = mockDb.getCollection<Invoice>('invoices');
        const inv = invoices.find(i => i.id === id);
        if (!inv) throw new Error("Invoice not found");
        
        let total = inv.totalAmount;
        if (data.items) {
            total = data.items.reduce((sum, item) => sum + item.price, 0);
        }

        const updated = { ...inv, ...data, totalAmount: total, ...createMeta(user, inv) };
        await mockDb.writeDocument('invoices', updated);
    },
    
    processPayment: async (user: User, id: string, amount: number, method: Invoice['paymentMethod']) => {
        const invoices = mockDb.getCollection<Invoice>('invoices');
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
        await mockDb.writeDocument('invoices', updated);
    }
};

export const NotificationService = {
    getAll: async (user: User): Promise<Notification[]> => {
        const all = mockDb.getCollection<Notification>('notifications');
        return all.filter(n => !n.targetRole || n.targetRole === user.role).sort((a,b) => b.createdAt - a.createdAt);
    },
    
    getPendingReminders: async (user: User): Promise<Notification[]> => {
        const all = mockDb.getCollection<Notification>('notifications');
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
        await mockDb.writeDocument('notifications', notif);
    },

    markAsRead: async (user: User, id: string) => {
        const all = mockDb.getCollection<Notification>('notifications');
        const notif = all.find(n => n.id === id);
        if (notif) {
            const updated = { ...notif, isRead: true, ...createMeta(user, notif) };
            await mockDb.writeDocument('notifications', updated);
        }
    }
};

export const SettingsService = {
    getSettings: async (): Promise<SystemSettings> => {
        const arr = mockDb.getCollection<SystemSettings>('settings');
        return arr.length > 0 ? arr[0] : DEFAULT_SETTINGS;
    },
    
    updateSettings: async (user: User, settings: SystemSettings): Promise<void> => {
        if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
        // Add an id to make it compatible with writeDocument
        const settingsWithId = { ...settings, id: 'settings_default' };
        await mockDb.writeDocument('settings', settingsWithId);
    }
};

export const DentalLabService = {
    getAllCases: async (user: User): Promise<LabCase[]> => {
        const allCases = mockDb.getCollection<LabCase>('labCases');
        const isLabAdmin = user.role === UserRole.ADMIN || user.role === UserRole.LAB_TECH;
        
        if (isLabAdmin) {
            return allCases.sort((a,b) => b.createdAt - a.createdAt);
        } else if (user.role === UserRole.DOCTOR) {
            return allCases.filter(c => c.doctorId === user.uid).sort((a,b) => b.createdAt - a.createdAt);
        }
        return [];
    },

    getEligibleVisits: async (user: User) => {
        const allPatients = mockDb.getCollection<Patient>('patients');
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
        await mockDb.writeDocument('labCases', newCase);
    },

    updateStatus: async (user: User, caseId: string, status: LabCaseStatus) => {
        const isLabUser = user.role === UserRole.ADMIN || user.role === UserRole.LAB_TECH;
        if (!isLabUser) throw new Error("Unauthorized");
        const allCases = mockDb.getCollection<LabCase>('labCases');
        const labCase = allCases.find(c => c.id === caseId);
        if (!labCase) throw new Error("Case not found");
        const updated = { ...labCase, status, ...createMeta(user, labCase) };
        await mockDb.writeDocument('labCases', updated);
    }
};

export const ImplantService = {
    getInventory: async (user: User): Promise<ImplantItem[]> => {
        if (user.role === UserRole.SECRETARY) return [];
        const items = mockDb.getCollection<ImplantItem>('implant_inventory');
        return items;
    },

    addInventoryItem: async (user: User, data: Pick<ImplantItem, 'brand'|'type'|'size'|'quantity'|'minThreshold'>) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.IMPLANT_MANAGER) throw new Error("Unauthorized");
        const newItem: ImplantItem = {
            id: generateId('imp'),
            ...data,
            ...createMeta(user)
        };
        await mockDb.writeDocument('implant_inventory', newItem);
    },

    updateStock: async (user: User, itemId: string, newQuantity: number) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.IMPLANT_MANAGER) throw new Error("Unauthorized");
        const items = mockDb.getCollection<ImplantItem>('implant_inventory');
        const item = items.find(i => i.id === itemId);
        if (!item) throw new Error("Item not found");
        const updated = { ...item, quantity: newQuantity, ...createMeta(user, item) };
        await mockDb.writeDocument('implant_inventory', updated);
    },

    getOrders: async (user: User): Promise<ImplantOrder[]> => {
        const orders = mockDb.getCollection<ImplantOrder>('implant_orders');
        if (user.role === UserRole.ADMIN || user.role === UserRole.IMPLANT_MANAGER) {
            return orders.sort((a,b) => b.createdAt - a.createdAt);
        }
        if (user.role === UserRole.DOCTOR) {
            return orders.filter(o => o.doctorId === user.uid).sort((a,b) => b.createdAt - a.createdAt);
        }
        return [];
    },

    createOrder: async (user: User, data: Pick<ImplantOrder, 'clinicId'|'clinicName'|'doctorId'|'doctorName'|'itemId'|'brand'|'type'|'size'|'quantity'|'requiredDate'|'notes'>) => {
        const items = mockDb.getCollection<ImplantItem>('implant_inventory');
        const item = items.find(i => i.id === data.itemId);
        if (!item) throw new Error("Item not found");
        if (item.quantity < data.quantity) throw new Error(`Insufficient stock. Available: ${item.quantity}`);

        const newOrder: ImplantOrder = {
            id: generateId('imp_ord'),
            ...data,
            status: 'PENDING',
            ...createMeta(user)
        };
        await mockDb.writeDocument('implant_orders', newOrder);
    },

    updateOrderStatus: async (user: User, orderId: string, status: ImplantOrderStatus) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.IMPLANT_MANAGER) throw new Error("Unauthorized");
        
        const orders = mockDb.getCollection<ImplantOrder>('implant_orders');
        const order = orders.find(o => o.id === orderId);
        if (!order) throw new Error("Order not found");

        if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
            const items = mockDb.getCollection<ImplantItem>('implant_inventory');
            const item = items.find(i => i.id === order.itemId);
            if (item) {
                const newQty = Math.max(0, item.quantity - order.quantity);
                const updatedItem = { ...item, quantity: newQty, ...createMeta(user, item) };
                await mockDb.writeDocument('implant_inventory', updatedItem);
            }
        }
        const updatedOrder = { ...order, status, ...createMeta(user, order) };
        await mockDb.writeDocument('implant_orders', updatedOrder);
    }
};

// --- NEW: Course Service (Beauty Academy) ---
export const CourseService = {
    getAllCourses: async (): Promise<Course[]> => {
        const courses = mockDb.getCollection<Course>('courses');
        return courses.filter(c => c.status === 'ACTIVE');
    },

    createCourse: async (user: User, data: Pick<Course, 'title'|'description'|'duration'|'price'|'instructorName'|'hasCertificate'>) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const newCourse: Course = {
            id: generateId('crs'),
            ...data,
            status: 'ACTIVE',
            ...createMeta(user)
        };
        await mockDb.writeDocument('courses', newCourse);
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
        await mockDb.writeDocument('course_students', newStudent);
    },

    getStudents: async (user: User): Promise<CourseStudent[]> => {
        const students = mockDb.getCollection<CourseStudent>('course_students');
        if (user.role === UserRole.ADMIN || user.role === UserRole.COURSE_MANAGER) {
            return students.sort((a,b) => b.createdAt - a.createdAt);
        }
        return [];
    },

    recordPayment: async (user: User, studentId: string, amount: number) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const students = mockDb.getCollection<CourseStudent>('course_students');
        const student = students.find(s => s.id === studentId);
        if (!student) throw new Error("Student not found");

        const newPaid = student.paidAmount + amount;
        const newStatus = newPaid >= student.totalFees ? 'PAID' : 'PARTIAL';
        
        const updated = { ...student, paidAmount: newPaid, paymentStatus: newStatus, ...createMeta(user, student) };
        await mockDb.writeDocument('course_students', updated);

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
        const students = mockDb.getCollection<CourseStudent>('course_students');
        const student = students.find(s => s.id === studentId);
        if (!student) throw new Error("Student not found");
        
        const updated = { ...student, isCertified: true, ...createMeta(user, student) };
        await mockDb.writeDocument('course_students', updated);
    },

    getSessions: async (user: User): Promise<CourseSession[]> => {
        const sessions = mockDb.getCollection<CourseSession>('course_sessions');
        return sessions.sort((a,b) => b.createdAt - a.createdAt);
    },

    addSession: async (user: User, data: Pick<CourseSession, 'courseId'|'courseName'|'date'|'topic'|'instructor'>) => {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.COURSE_MANAGER) throw new Error("Unauthorized");
        const session: CourseSession = {
            id: generateId('sess'),
            ...data,
            ...createMeta(user)
        };
        await mockDb.writeDocument('course_sessions', session);
    }
};
