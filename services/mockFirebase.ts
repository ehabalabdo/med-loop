
import { Clinic, Patient, User, UserRole, AuditMetadata, ImplantItem, ImplantOrder, Course, CourseStudent } from '../types';

/**
 * MOCK DATABASE ADAPTER (DAL) - HIGH PERFORMANCE MODE
 * Delays removed to ensure UI/Storage consistency (Single Source of Truth).
 */

// --- Safe Storage Helper ---
const memoryStore: Record<string, string> = {};

const getLocalStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    const storage = window.localStorage;
    const test = '__storage_test__';
    storage.setItem(test, test);
    storage.removeItem(test);
    return storage;
  } catch (e) {
    return null;
  }
};

const storageImpl = getLocalStorage();

const safeStorage = {
  getItem: (key: string): string | null => {
    if (!storageImpl) return memoryStore[key] || null;
    try { return storageImpl.getItem(key); } 
    catch (e) { return memoryStore[key] || null; }
  },
  setItem: (key: string, value: string): void => {
    if (!storageImpl) { memoryStore[key] = value; return; }
    try { storageImpl.setItem(key, value); } 
    catch (e) { memoryStore[key] = value; }
  },
  removeItem: (key: string): void => {
    if (!storageImpl) { delete memoryStore[key]; return; }
    try { storageImpl.removeItem(key); } 
    catch (e) { delete memoryStore[key]; }
  }
};

// --- Persistence Helpers ---
const load = <T>(key: string, def: T): T => {
  const s = safeStorage.getItem(key);
  return s ? JSON.parse(s) : def;
}
const save = (key: string, data: any) => safeStorage.setItem(key, JSON.stringify(data));

// --- Seed Data (UPDATED WITH STRICT CATEGORIZATION) ---
const SEED_CLINICS: Clinic[] = [
  // 1. PATIENT-FACING CLINICS
  { id: 'c_dental', name: 'Dental Clinic', type: 'Dental', category: 'clinic', active: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { id: 'c_gp', name: 'General Medicine', type: 'Medical', category: 'clinic', active: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { id: 'c_laser', name: 'Laser Clinic', type: 'Cosmetic', category: 'clinic', active: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { id: 'c_cosmetic', name: 'Cosmetic Clinic', type: 'Cosmetic', category: 'clinic', active: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  
  // 2. BACK-OFFICE / OPERATIONAL DEPARTMENTS
  { id: 'c_lab', name: 'Dental Lab', type: 'Laboratory', category: 'department', active: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { id: 'c_implant', name: 'Implantology Co.', type: 'Logistics', category: 'department', active: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  { id: 'c_courses', name: 'Beauty Courses', type: 'Education', category: 'department', active: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
];

// Updated Users to test STRICT ISOLATION
const SEED_USERS: User[] = [
  // 1. Admin & Secretary (See ALL)
  // تم حذف المستخدمين التجريبيين
  { uid: 'sec_1', email: 'reception@medcore.com', name: 'Sarah Reception', role: UserRole.SECRETARY, clinicIds: [], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  
  // 2. Dentist (Sees Dental + Implants only)
  //
  
  // 3. GP Doctor (Sees General Medicine only)
  { uid: 'doc_gp', email: 'gp@medcore.com', name: 'Dr. General', role: UserRole.DOCTOR, clinicIds: ['c_gp'], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },

  // 4. Cosmetic Doctor (Sees Laser + Cosmetic + Courses)
  { uid: 'doc_beauty', email: 'beauty@medcore.com', name: 'Dr. Beauty', role: UserRole.DOCTOR, clinicIds: ['c_laser', 'c_cosmetic'], isActive: true, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
  
  // 5. Lab Tech (Sees Lab only)
  //

  // 6. Implant Manager (Sees Implant Co only)
  //

  // 7. Course Manager (Sees Courses only) - NEW
  //
];

// --- SEED COURSES & STUDENTS ---
const SEED_COURSES: Course[] = [
    { id: 'crs_1', title: 'Advanced Botox & Fillers', duration: '2 Days', price: 1500, instructorName: 'Dr. Beauty', hasCertificate: true, status: 'ACTIVE', createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
    { id: 'crs_2', title: 'Laser Hair Removal Tech', duration: '1 Week', price: 800, instructorName: 'Sarah Tech', hasCertificate: true, status: 'ACTIVE', createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' },
];

const SEED_STUDENTS: CourseStudent[] = [
    { id: 'std_1', name: 'Jessica Student', phone: '0501234567', gender: 'female', courseId: 'crs_1', courseName: 'Advanced Botox & Fillers', enrollmentDate: Date.now(), totalFees: 1500, paidAmount: 500, paymentStatus: 'PARTIAL', isCertified: false, createdAt: Date.now(), createdBy: 'system', updatedAt: Date.now(), updatedBy: 'system' }
];

class MockAdapter {
  private patientListeners: ((data: Patient[]) => void)[] = [];
  
  constructor() {
    // FORCE RESET to ensure new Role is applied to seeded users
    const users = load<User[]>('medcore_users', []);
    const acadUser = users.find(u => u.email === 'academy@medcore.com');
    
    if (!acadUser) {
        console.warn("Detected missing Academy Manager. Refreshing Seed Data.");
        save('medcore_users', SEED_USERS);
        save('medcore_clinics', SEED_CLINICS);
    }

    if (!load('medcore_implant_inventory', null)) save('medcore_implant_inventory', []);
    if (!load('medcore_courses', null)) save('medcore_courses', SEED_COURSES);
    if (!load('medcore_course_students', null)) save('medcore_course_students', SEED_STUDENTS);
    
    // Ensure seeding
    if (!load('medcore_clinics', null)) save('medcore_clinics', SEED_CLINICS);
    if (!load('medcore_users', null)) save('medcore_users', SEED_USERS);
  }

  // --- Synchronous IO disguised as Async ---
  
  // Synchronous version for all services to use
  getCollection<T>(collection: string): T[] {
    return load<T[]>(`medcore_${collection}`, []);
  }

  async writeDocument<T extends { id?: string; uid?: string }>(collection: string, data: T): Promise<void> {
    const list = load<T[]>(`medcore_${collection}`, []);
    const getItemId = (item: any) => item.id || item.uid;
    const dataId = getItemId(data);
    const idx = list.findIndex(i => getItemId(i) === dataId);
    
    if (idx >= 0) {
      list[idx] = data; // Update
    } else {
      list.unshift(data); // Create
    }
    
    save(`medcore_${collection}`, list);
    
    if (collection === 'patients') this.notifyPatients();
  }

  // Additional methods required by services.ts
  add<T extends { id?: string; uid?: string }>(collection: string, data: T): void {
    const list = load<T[]>(`medcore_${collection}`, []);
    list.unshift(data);
    save(`medcore_${collection}`, list);
    if (collection === 'patients') this.notifyPatients();
  }

  update<T extends { id?: string; uid?: string }>(collection: string, id: string, data: T): void {
    const list = load<T[]>(`medcore_${collection}`, []);
    const idx = list.findIndex((i: any) => (i.id === id || i.uid === id));
    if (idx >= 0) {
      list[idx] = data;
      save(`medcore_${collection}`, list);
      if (collection === 'patients') this.notifyPatients();
    }
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    const list = load<any[]>(`medcore_${collection}`, []);
    const filtered = list.filter(i => (i.id !== id && i.uid !== id));
    save(`medcore_${collection}`, filtered);
    
    if (collection === 'patients') this.notifyPatients();
  }

  // --- Realtime Hooks ---
  subscribeToPatients(callback: (data: Patient[]) => void): () => void {
    const data = load<Patient[]>('medcore_patients', []);
    callback(data);
    this.patientListeners.push(callback);
    return () => {
      this.patientListeners = this.patientListeners.filter(l => l !== callback);
    };
  }

  private notifyPatients() {
    const data = load<Patient[]>('medcore_patients', []);
    this.patientListeners.forEach(l => l(data));
  }

  // --- Auth Simulation ---
  async authSignIn(email: string): Promise<User> {
    await new Promise(r => setTimeout(r, 300));
    const users = load<User[]>('medcore_users', []);
    const user = users.find(u => u.email === email);
    if (!user) throw new Error("Invalid credentials");
    if (!user.isActive) throw new Error("Account disabled");
    save('medcore_session', user);
    return user;
  }

  async authSignOut() {
    safeStorage.removeItem('medcore_session');
  }

  getSession(): User | null {
    return load<User | null>('medcore_session', null);
  }

  setSession(user: User) {
    save('medcore_session', user);
  }

  getAllUsers(): User[] {
    return load<User[]>('medcore_users', []);
  }

  saveUser(user: User): void {
    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.uid === user.uid);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    save('medcore_users', users);
  }
}

export const mockDb = new MockAdapter();
