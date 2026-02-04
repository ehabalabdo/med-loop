import sql from './db';
import { User, Patient, Clinic, Appointment, ClinicCategory } from '../types';

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
  },

  update: async (uid: string, data: Partial<Pick<User, 'name' | 'email' | 'password' | 'role' | 'clinicIds' | 'isActive'>>): Promise<void> => {
    const userId = parseInt(uid);
    const updates: any = {};
    
    if (data.name !== undefined) updates.full_name = data.name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.password !== undefined && data.password !== '') updates.password = data.password;
    if (data.role !== undefined) updates.role = data.role;
    if (data.clinicIds !== undefined && data.clinicIds.length > 0) {
      updates.clinic_id = parseInt(data.clinicIds[0]);
    }
    
    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
      const values = Object.values(updates);
      await sql`UPDATE users SET ${sql.unsafe(setClause)} WHERE id = ${userId}`;
    }
  },

  delete: async (uid: string): Promise<void> => {
    const userId = parseInt(uid);
    await sql`DELETE FROM users WHERE id = ${userId}`;
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
      category: (row.category || 'clinic') as ClinicCategory,
      active: row.active !== false,
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
    }));
  },

  create: async (clinic: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await sql`
      INSERT INTO clinics (name, type, category, active, created_at) 
      VALUES (${clinic.name}, ${clinic.type}, ${clinic.category || 'clinic'}, ${clinic.active !== false}, NOW()) 
      RETURNING id
    `;
    return String(result[0].id);
  },

  update: async (id: string, data: Partial<Pick<Clinic, 'name' | 'type' | 'category' | 'active'>>): Promise<void> => {
    const clinicId = parseInt(id);
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push(`name = $${updates.length + 1}`);
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${updates.length + 1}`);
      values.push(data.type);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${updates.length + 1}`);
      values.push(data.category);
    }
    if (data.active !== undefined) {
      updates.push(`active = $${updates.length + 1}`);
      values.push(data.active);
    }
    
    if (updates.length > 0) {
      values.push(clinicId);
      await sql`UPDATE clinics SET ${sql.unsafe(updates.join(', '))} WHERE id = ${clinicId}`;
    }
  },

  toggleStatus: async (id: string, active: boolean): Promise<void> => {
    const clinicId = parseInt(id);
    await sql`UPDATE clinics SET active = ${active} WHERE id = ${clinicId}`;
  },

  delete: async (id: string): Promise<void> => {
    const clinicId = parseInt(id);
    await sql`DELETE FROM clinics WHERE id = ${clinicId}`;
  }
};

// ==================== PATIENTS ====================

export const pgPatients = {
  getAll: async (): Promise<Patient[]> => {
    const result = await sql`SELECT * FROM patients ORDER BY id DESC`;
    return result.map((row: any) => ({
      id: String(row.id),
      name: row.full_name,
      age: row.age || 0,
      gender: (row.gender || 'male') as 'male' | 'female',
      phone: row.phone || '',
      username: row.username || undefined,
      email: row.email || undefined,
      password: row.password || undefined,
      hasAccess: row.has_access || false,
      medicalProfile: {
        allergies: { exists: false, details: '' },
        chronicConditions: { exists: false, details: '' },
        currentMedications: { exists: false, details: '' },
        isPregnant: false,
        notes: row.notes || ''
      },
      currentVisit: {
        visitId: `v_${row.id}_${Date.now()}`,
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
      INSERT INTO patients (full_name, age, gender, phone, username, email, password, has_access, notes, created_at) 
      VALUES (
        ${patient.name}, 
        ${patient.age || 0}, 
        ${patient.gender || 'male'}, 
        ${patient.phone || ''}, 
        ${patient.username || null}, 
        ${patient.email || null}, 
        ${patient.password || null}, 
        ${patient.hasAccess || false}, 
        ${patient.medicalProfile?.notes || ''}, 
        NOW()
      )
      RETURNING id
    `;
    return String(result[0].id);
  },

  update: async (id: string, data: Partial<Pick<Patient, 'name' | 'age' | 'gender' | 'phone' | 'username' | 'email' | 'password' | 'hasAccess'>>): Promise<void> => {
    const patientId = parseInt(id);
    const updates: any = {};
    
    if (data.name !== undefined) updates.full_name = data.name;
    if (data.age !== undefined) updates.age = data.age;
    if (data.gender !== undefined) updates.gender = data.gender;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.username !== undefined) updates.username = data.username || null;
    if (data.email !== undefined) updates.email = data.email || null;
    if (data.password !== undefined && data.password !== '') updates.password = data.password;
    if (data.hasAccess !== undefined) updates.has_access = data.hasAccess;
    
    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
      const values = Object.values(updates);
      await sql`UPDATE patients SET ${sql.unsafe(setClause)} WHERE id = ${patientId}`;
    }
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
    const result = await sql`SELECT * FROM appointments ORDER BY start_time DESC`;
    return result.map((row: any) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      patientName: row.patient_name || 'Unknown',
      clinicId: String(row.clinic_id),
      doctorId: row.doctor_id ? String(row.doctor_id) : undefined,
      date: new Date(row.start_time).getTime(),
      status: row.status || 'scheduled',
      reason: row.reason || '',
      notes: '',
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: row.is_archived || false
    }));
  }
};

