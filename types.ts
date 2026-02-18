
// =============================================
// SaaS Client (المركز كزبون)
// =============================================
export type ClientStatus = 'trial' | 'active' | 'expired' | 'suspended';

export interface ClientFeatures {
  dental_lab: boolean;
  implant_company: boolean;
  academy: boolean;
  device_results: boolean;
}

export interface Client {
  id: number;
  name: string;
  slug: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  status: ClientStatus;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  ownerUserId: number | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  enabledFeatures: ClientFeatures;
}

export interface SuperAdmin {
  id: number;
  username: string;
  name: string;
}

// =============================================
// User Roles & Types
// =============================================
export enum UserRole {
  ADMIN = 'admin',
  SECRETARY = 'secretary',
  DOCTOR = 'doctor',
  LAB_TECH = 'lab_tech',
  IMPLANT_MANAGER = 'implant_manager',
  COURSE_MANAGER = 'course_manager'
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
  type: string;
  category: ClinicCategory;
  active: boolean;
  clientId?: number;
}

export interface User extends AuditMetadata {
  uid: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  clinicIds: string[];
  clientId?: number; // SaaS: which client this user belongs to
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
  previousSurgeries: { exists: boolean; details: string }; // NEW: Previous surgeries
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
  id: string;
  
  // Demographics
  name: string;
  age: number;
  dateOfBirth?: string; // ISO date string YYYY-MM-DD
  gender: Gender;
  phone: string;
  
  // Authentication
  username?: string;
  email?: string;
  password?: string;
  hasAccess?: boolean;
  
  // SaaS
  clientId?: number;
  
  // Medical Profile (Sticky data)
  medicalProfile: MedicalIntake;
  
  // The Current Active Visit
  currentVisit: VisitData;
  
  // History (Simplified for NoSQL: In real DB, this is a subcollection)
  history: VisitData[]; 
}

// --- NEW ENTITIES (Paths 1 & 2) ---

export type AppointmentStatus = 'pending' | 'scheduled' | 'checked-in' | 'completed' | 'cancelled' | 'no-show' | 'suggested';

export interface Appointment extends AuditMetadata {
  id: string;
  patientId: string;
  patientName: string;
  clinicId: string;
  doctorId?: string;
  date: number;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  suggestedDate?: number;
  suggestedNotes?: string;
  clientId?: number;
}

// --- NEW: Billing & Notifications ---

export interface Invoice extends AuditMetadata {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  paymentMethod: 'cash' | 'card' | 'insurance';
  status: 'unpaid' | 'paid' | 'partial';
  clientId?: number;
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
  patientName: string;
  doctorId: string;
  doctorName: string;
  caseType: string;
  notes?: string;
  status: LabCaseStatus;
  dueDate: number;
  clientId?: number;
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

// =============================================
// Medical Device Integration Types
// =============================================

export type DeviceType = 'cbc' | 'ecg' | 'glucose' | 'chemistry' | 'xray' | 'other';
export type DeviceConnectionType = 'lan' | 'serial' | 'hl7' | 'folder' | 'api';
export type DeviceResultStatus = 'pending' | 'matched' | 'error' | 'rejected';

export interface Device {
  id: string;
  clientId: number;
  clinicId: string;
  name: string;
  type: DeviceType;
  connectionType: DeviceConnectionType;
  ipAddress?: string;
  port?: number;
  comPort?: string;
  baudRate?: number;
  config?: Record<string, any>;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceResult {
  id: string;
  clientId: number;
  deviceId: string;
  deviceName?: string;        // Joined from devices table
  deviceType?: DeviceType;    // Joined from devices table
  patientIdentifier: string;
  testCode: string;
  testName?: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal: boolean;
  rawMessage?: string;
  status: DeviceResultStatus;
  matchedPatientId?: string;
  matchedPatientName?: string; // Joined from patients table
  matchedAt?: string;
  matchedBy?: string;
  errorMessage?: string;
  createdAt: string;
}

/** Payload sent by the clinic bridge agent */
export interface DeviceResultPayload {
  clinicId: string;
  deviceId: string;
  patientIdentifier: string;
  testCode: string;
  testName?: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  rawMessage?: string;
}

/** Batch payload for sending multiple results at once */
export interface DeviceResultBatchPayload {
  clinicId: string;
  deviceId: string;
  patientIdentifier: string;
  results: Array<{
    testCode: string;
    testName?: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    isAbnormal?: boolean;
  }>;
  rawMessage?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}

// =============================================
// HR Module Types
// =============================================

export type HrEmployeeStatus = 'active' | 'inactive';
export type AttendanceStatus = 'normal' | 'late' | 'absent' | 'weekend' | 'incomplete';

export interface HrSchedule {
  workDays: number[];       // 1=Mon … 7=Sun
  startTime: string;        // "HH:MM"
  endTime: string;          // "HH:MM"
  graceMinutes: number;
  overtimeEnabled: boolean;
}

export interface HrEmployee {
  id: number;
  clientId: number;
  fullName: string;
  username: string;
  phone?: string;
  email?: string;
  status: HrEmployeeStatus;
  bioRegistered: boolean;
  schedule: HrSchedule | null;
  createdAt: string;
  updatedAt: string;
}

export interface HrAttendanceRecord {
  id: number;
  employeeId: number;
  employeeName?: string;
  workDate: string;          // YYYY-MM-DD
  checkIn: string | null;
  checkOut: string | null;
  totalMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
}

export interface HrTodayAttendance {
  checkIn: string | null;
  checkOut: string | null;
  totalMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
}

export interface HrMeProfile {
  id: number;
  fullName: string;
  username: string;
  phone?: string;
  email?: string;
  status: HrEmployeeStatus;
  bioRegistered: boolean;
  bioCount: number;
  schedule: HrSchedule | null;
  todayAttendance: HrTodayAttendance | null;
}

export interface HrMonthlyReport {
  month: string;
  employeeId: number;
  summary: {
    daysPresent: number;
    totalWorkMinutes: number;
    totalLateMinutes: number;
    totalOvertimeMinutes: number;
    totalEarlyLeaveMinutes: number;
    totalAbsences: number;
    totalLateDays: number;
    totalEarlyLeaveDays: number;
  };
  days: HrAttendanceRecord[];
}

export interface ClinicLocation {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  allowed_radius_meters: number;
}
