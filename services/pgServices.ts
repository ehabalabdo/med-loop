import sql from './db';
import { User, Patient, Clinic, Appointment } from '../types';

/**
 * PostgreSQL Services - Direct connection to Neon Database
 * Using @neondatabase/serverless for browser compatibility via HTTP
 */

// ==================== USERS ====================

export const pgUsers = {
  getAll: async (): Promise<User[]> => {
    const result = await sql`SELECT * FROM users ORDER BY id`;
    return result.map((row: any) => ({
      uid: String(row.id),
      email: row.email,
      password: row.password,
      name: row.full_name,
      role: row.role,
      clinicIds: row.clinic_id ? [String(row.clinic_id)] : [],
      isActive: true,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  create: async (user: Omit<User, 'uid' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const clinicId = user.clinicIds.length > 0 ? parseInt(user.clinicIds[0]) : null;
    const result = await sql`
      INSERT INTO users (full_name, email, password, role, clinic_id, created_at) 
      VALUES (${user.name}, ${user.email}, ${user.password || 'password123'}, ${user.role}, ${clinicId}, NOW()) 
      RETURNING id
    `;
    return String(result[0].id);
  }
};

// ==================== CLINICS ====================

export const pgClinics = {
  getAll: async (): Promise<Clinic[]> => {
    const result = await sql`SELECT * FROM clinics ORDER BY id`;
    return result.map((row: any) => ({
      id: String(row.id),
      name: row.name,
      type: row.type || 'General',
      category: 'clinic' as const,
      active: true,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  create: async (clinic: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await sql`
      INSERT INTO clinics (name, type, created_at) 
      VALUES (${clinic.name}, ${clinic.type}, NOW()) 
      RETURNING id
    `;
    return String(result[0].id);
  }
};

// ==================== PATIENTS ====================

export const pgPatients = {
  getAll: async (): Promise<Patient[]> => {
    const result = await sql`SELECT * FROM patients ORDER BY id DESC`;
    return result.map((row: any) => ({
      id: String(row.id),
      name: row.full_name,
      age: row.age || undefined,
      gender: row.gender as 'male' | 'female' | undefined,
      phone: row.phone || '',
      email: row.email || undefined,
      password: row.password || undefined,
      medicalProfile: {},
      currentVisit: {
        visitId: '',
        clinicId: '',
        date: Date.now(),
        status: 'waiting' as const,
        priority: 'normal' as const,
        reasonForVisit: row.notes || ''
      },
      history: [],
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  create: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await sql`
      INSERT INTO patients (full_name, phone, email, password, notes, created_at) 
      VALUES (${patient.name}, ${patient.phone || ''}, ${patient.email || null}, ${patient.password || 'patient123'}, ${patient.currentVisit?.reasonForVisit || ''}, NOW()) 
      RETURNING id
    `;
    return String(result[0].id);
  },

  subscribe: (callback: (patients: Patient[]) => void): (() => void) => {
    // For real-time updates, call once immediately
    pgPatients.getAll().then(callback);
    
    // Could implement polling here
    const interval = setInterval(() => {
      pgPatients.getAll().then(callback);
    }, 5000); // Poll every 5 seconds
    
    // Return unsubscribe function
    return () => clearInterval(interval);
  }
};

// ==================== APPOINTMENTS ====================

export const pgAppointments = {
  getAll: async (): Promise<Appointment[]> => {
    const result = await sql`SELECT * FROM appointments ORDER BY scheduled_time DESC`;
    return result.map((row: any) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      clinicId: String(row.clinic_id),
      doctorId: row.doctor_id ? String(row.doctor_id) : undefined,
      scheduledTime: new Date(row.scheduled_time).getTime(),
      status: row.status || 'scheduled',
      notes: row.notes || '',
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  }
};

