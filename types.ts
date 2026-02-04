
export enum UserRole {
  ADMIN = 'admin',
  SECRETARY = 'secretary',
  DOCTOR = 'doctor',
  LAB_TECH = 'lab_tech',
  IMPLANT_MANAGER = 'implant_manager',
  COURSE_MANAGER = 'course_manager' // New Role
}

// Base Entity for Audit Trails
export interface AuditMetadata {
  createdAt: number;
  createdBy: string; // User UID
  updatedAt: number;
  updatedBy: string; // User UID
  isArchived?: boolean; // Soft Delete Flag (New)
}

// --- CLASSIFICATION UPDATE ---
export type ClinicCategory = 'clinic' | 'department';

export interface Clinic extends AuditMetadata {
  id: string;
  name: string;
  type: string;     // e.g. "Dental", "Laboratory" (Descriptive)
  category: ClinicCategory; // NEW: Structural Classification
  active: boolean;
}

export interface User extends AuditMetadata {
  uid: string;
  email: string;
  password?: string; // NEW - for login authentication
  name: string;
  role: UserRole;
  clinicIds: string[]; 
  isActive: boolean;
}

// --- New Medical & Visit Types ---

export type Priority = 'normal' | 'urgent';
export type Gender = 'male' | 'female';
export type VisitStatus = 'waiting' | 'in-progress' | 'completed';

export interface MedicalIntake {
  allergies: { exists: boolean; details: string };
  chronicConditions: { exists: boolean; details: string };
  currentMedications: { exists: boolean; details: string };
  isPregnant: boolean; // Only for female
  notes?: string;
}

// --- NEW: Structured Clinical Data ---
export interface PrescriptionItem {
    id: string;
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
}

export interface Attachment {
    id: string;
    name: string;
    type: 'image' | 'pdf' | 'lab';
    url: string; // Base64 or URL
    date: number;
}

// Re-using InvoiceItem here for the Doctor's selection
export interface InvoiceItem {
  id: string;
  description: string;
  price: number;
}

export interface VisitData {
  visitId: string;
  clinicId: string;
  doctorId?: string;
  date: number;
  status: VisitStatus;
  priority: Priority;
  source?: string; // e.g. "Referral", "Walk-in", "Appointment"
  reasonForVisit: string;
  
  // Doctor Output
  diagnosis?: string;
  treatment?: string; 
  prescriptions?: PrescriptionItem[]; 
  attachments?: Attachment[];
  invoiceItems?: InvoiceItem[]; // NEW: Doctor selects these
  doctorNotes?: string;
}

// The Main "Queue Item" effectively acts as the Patient + Current Visit
export interface Patient extends AuditMetadata {
  id: string; // Patient Profile ID (Unique per person)
  
  // Demographics
  name: string;
  age: number; // Or DOB in full system
  gender: Gender;
  phone: string;
  
  // Authentication (NEW - for patient portal access)
  email?: string;
  password?: string; // In real system, would be hashed
  
  // Medical Profile (Sticky data)
  medicalProfile: MedicalIntake;
  
  // The Current Active Visit
  currentVisit: VisitData;
  
  // History (Simplified for NoSQL: In real DB, this is a subcollection)
  history: VisitData[]; 
}

// --- NEW ENTITIES (Paths 1 & 2) ---

export type AppointmentStatus = 'scheduled' | 'checked-in' | 'completed' | 'cancelled' | 'no-show';

export interface Appointment extends AuditMetadata {
  id: string;
  patientId: string;
  patientName: string; // Denormalized for easier display
  clinicId: string;
  doctorId?: string;
  date: number; // Target timestamp
  status: AppointmentStatus;
  reason: string;
  notes?: string;
}

// --- NEW: Billing & Notifications ---

export interface Invoice extends AuditMetadata {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number; // For partial payments
  paymentMethod: 'cash' | 'card' | 'insurance';
  status: 'unpaid' | 'paid' | 'partial';
}

export interface Notification extends AuditMetadata {
    id: string;
    type: 'reminder' | 'system';
    title: string;
    message: string;
    targetRole?: UserRole; // Who should see this?
    relatedPatientId?: string;
    isRead: boolean;
    dueDate?: number; // When should this alert happen?
}

// --- NEW: Dental Lab Types ---
export type LabCaseStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';

export interface LabCase extends AuditMetadata {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string; // Denormalized
  doctorId: string;
  doctorName: string; // Denormalized
  caseType: string; // e.g. Zirconia Crown
  notes?: string;
  status: LabCaseStatus;
  dueDate: number;
}

// --- NEW: Implant Company Types (Logistics Only) ---
export type ImplantOrderStatus = 'PENDING' | 'IN_PRODUCTION' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface ImplantItem extends AuditMetadata {
    id: string;
    brand: string; // e.g. Straumann, Nobel
    type: string; // e.g. Bone Level, Tissue Level
    size: string; // e.g. 4.1mm x 10mm
    quantity: number;
    minThreshold: number; // For low stock alerts
}

export interface ImplantOrder extends AuditMetadata {
    id: string;
    clinicId: string;
    clinicName: string;
    doctorId: string;
    doctorName: string;
    
    // Ordered Item Snapshot
    itemId: string; // Link to inventory
    brand: string;
    type: string;
    size: string;
    quantity: number;
    
    status: ImplantOrderStatus;
    requiredDate: number;
    notes?: string;
}

// --- NEW: Beauty Academy Types (Completely Separate) ---

export type CourseStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface Course extends AuditMetadata {
    id: string;
    title: string;
    description?: string;
    duration: string; // e.g. "3 Months"
    price: number;
    instructorName: string;
    hasCertificate: boolean;
    status: CourseStatus;
}

export interface CourseStudent extends AuditMetadata {
    id: string;
    name: string;
    phone: string;
    gender: Gender;
    
    // Enrollment Details
    courseId: string;
    courseName: string; // Snapshot
    enrollmentDate: number;
    
    // Financials
    totalFees: number;
    paidAmount: number;
    paymentStatus: PaymentStatus;
    
    // Academic
    isCertified: boolean;
}

export interface CourseSession extends AuditMetadata {
    id: string;
    courseId: string;
    courseName: string;
    date: number; // Timestamp
    topic: string;
    instructor: string;
    notes?: string;
}

// --- NEW: System Settings for White-Labeling ---
export interface SystemSettings {
    clinicName: string;
    logoUrl: string; // Base64 or URL
    address: string;
    phone: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}
