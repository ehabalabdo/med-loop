import sql from './db';
import { User, Patient, Clinic, Appointment, ClinicCategory } from '../types';

// Debug mode (match services.ts)
const DEBUG_MODE = false;
const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) console.log(...args);
};

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
    const patients = result.map((row: any) => {
      // Parse JSON columns
      let medicalProfile = row.medical_profile;
      if (typeof medicalProfile === 'string') {
        try { medicalProfile = JSON.parse(medicalProfile); } catch { medicalProfile = {}; }
      }
      
      let currentVisit = row.current_visit;
      if (typeof currentVisit === 'string') {
        try { currentVisit = JSON.parse(currentVisit); } catch { currentVisit = null; }
      }
      
      let history = row.history;
      if (typeof history === 'string') {
        try { history = JSON.parse(history); } catch { history = []; }
      }
      
      return {
        id: String(row.id),
        name: row.full_name,
        age: row.age || 0,
        gender: (row.gender || 'male') as 'male' | 'female',
        phone: row.phone || '',
        username: row.username || undefined,
        email: row.email || undefined,
        password: row.password || undefined,
        hasAccess: row.has_access || false,
        medicalProfile: medicalProfile && Object.keys(medicalProfile).length > 0 ? medicalProfile : {
          allergies: { exists: false, details: '' },
          chronicConditions: { exists: false, details: '' },
          currentMedications: { exists: false, details: '' },
          isPregnant: false,
          notes: row.notes || ''
        },
        currentVisit: currentVisit && Object.keys(currentVisit).length > 0 ? currentVisit : {
          visitId: `v_${row.id}_${Date.now()}`,
          clinicId: '',
          date: Date.now(),
          status: 'waiting' as const,
          priority: 'normal' as const,
          reasonForVisit: row.notes || ''
        },
        history: Array.isArray(history) ? history : [],
        createdAt: new Date(row.created_at || Date.now()).getTime(),
        createdBy: 'system',
        updatedAt: new Date(row.created_at || Date.now()).getTime(),
        updatedBy: 'system',
        isArchived: false
      };
    });
    
    // DEBUG: Log what we're getting from database
    console.log('[pgPatients.getAll] Raw DB data:', patients.map(p => ({
      id: p.id,
      name: p.name,
      visitId: p.currentVisit?.visitId,
      visitIdLength: p.currentVisit?.visitId?.length,
      visitIdType: typeof p.currentVisit?.visitId
    })));
    
    return patients;
  },

  create: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const medicalProfileJson = JSON.stringify(patient.medicalProfile || {});
    const currentVisitJson = JSON.stringify(patient.currentVisit || {});
    const historyJson = JSON.stringify(patient.history || []);
    
    const result = await sql`
      INSERT INTO patients (
        full_name, age, gender, phone, username, email, password, has_access, 
        notes, medical_profile, current_visit, history, created_at
      ) 
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
        ${medicalProfileJson}::jsonb,
        ${currentVisitJson}::jsonb,
        ${historyJson}::jsonb,
        NOW()
      )
      RETURNING id
    `;
    return String(result[0].id);
  },

  update: async (id: string, data: Partial<Patient>): Promise<void> => {
    const patientId = parseInt(id);
    
    // Build update object for direct SQL construction
    const updateParts: string[] = [];
    
    if (data.name !== undefined) {
      updateParts.push(`full_name = '${data.name.replace(/'/g, "''")}'`);
    }
    if (data.age !== undefined) {
      updateParts.push(`age = ${data.age}`);
    }
    if (data.gender !== undefined) {
      updateParts.push(`gender = '${data.gender}'`);
    }
    if (data.phone !== undefined) {
      updateParts.push(`phone = '${data.phone.replace(/'/g, "''")}'`);
    }
    if (data.username !== undefined) {
      const username = data.username || null;
      updateParts.push(username ? `username = '${username.replace(/'/g, "''")}'` : `username = NULL`);
    }
    if (data.email !== undefined) {
      const email = data.email || null;
      updateParts.push(email ? `email = '${email.replace(/'/g, "''")}'` : `email = NULL`);
    }
    if (data.password !== undefined && data.password !== '') {
      updateParts.push(`password = '${data.password.replace(/'/g, "''")}'`);
    }
    if (data.hasAccess !== undefined) {
      updateParts.push(`has_access = ${data.hasAccess}`);
    }
    if (data.medicalProfile !== undefined) {
      updateParts.push(`medical_profile = '${JSON.stringify(data.medicalProfile).replace(/'/g, "''")}'::jsonb`);
    }
    if (data.currentVisit !== undefined) {
      updateParts.push(`current_visit = '${JSON.stringify(data.currentVisit).replace(/'/g, "''")}'::jsonb`);
    }
    if (data.history !== undefined) {
      updateParts.push(`history = '${JSON.stringify(data.history).replace(/'/g, "''")}'::jsonb`);
    }
    
    if (updateParts.length > 0) {
      await sql.unsafe(`UPDATE patients SET ${updateParts.join(', ')} WHERE id = ${patientId}`);
    }
  },

  subscribe: (callback: (patients: Patient[]) => void): (() => void) => {
    let lastDataString = '';
    
    const fetchAndCompare = async () => {
      const data = await pgPatients.getAll();
      const dataString = JSON.stringify(data.map(p => ({ id: p.id, visitId: p.currentVisit?.visitId, status: p.currentVisit?.status })));
      
      // Only call callback if data actually changed
      if (dataString !== lastDataString) {
        debugLog('[pgPatients.subscribe] Data changed, triggering callback');
        lastDataString = dataString;
        callback(data);
      }
    };
    
    // Call once immediately
    fetchAndCompare();
    
    // Poll every 1 second for faster updates (with comparison to prevent unnecessary re-renders)
    const interval = setInterval(fetchAndCompare, 1000);
    
    // Return unsubscribe function with manual refresh capability
    const unsubscribe = () => clearInterval(interval);
    
    // Expose refresh method for manual triggering
    (unsubscribe as any).refresh = fetchAndCompare;
    
    return unsubscribe;
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
  },

  create: async (data: Pick<Appointment, 'id'|'patientId'|'patientName'|'clinicId'|'doctorId'|'date'|'reason'|'status'>): Promise<void> => {
    await sql`
      INSERT INTO appointments (id, patient_id, patient_name, clinic_id, doctor_id, start_time, status, reason)
      VALUES (
        ${data.id},
        ${data.patientId},
        ${data.patientName},
        ${data.clinicId},
        ${data.doctorId || null},
        ${new Date(data.date).toISOString()},
        ${data.status},
        ${data.reason}
      )
    `;
  },

  update: async (id: string, data: Partial<Pick<Appointment, 'clinicId'|'doctorId'|'date'|'reason'|'status'>>): Promise<void> => {
    const updateParts: string[] = [];

    if (data.clinicId !== undefined) {
      updateParts.push(`clinic_id = ${data.clinicId}`);
    }
    if (data.doctorId !== undefined) {
      const doctorId = data.doctorId || null;
      updateParts.push(doctorId ? `doctor_id = ${doctorId}` : `doctor_id = NULL`);
    }
    if (data.date !== undefined) {
      updateParts.push(`start_time = '${new Date(data.date).toISOString()}'`);
    }
    if (data.reason !== undefined) {
      updateParts.push(`reason = '${data.reason.replace(/'/g, "''")}'`);
    }
    if (data.status !== undefined) {
      updateParts.push(`status = '${data.status}'`);
    }

    if (updateParts.length === 0) return;

    await sql.unsafe(`UPDATE appointments SET ${updateParts.join(', ')} WHERE id = '${id}'`);
  },

  delete: async (id: string): Promise<void> => {
    await sql`DELETE FROM appointments WHERE id = ${id}`;
  }
};


