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
    
    const users = result.map((row: any) => ({
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
    
    return users;
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
    
    console.log('[pgPatients.update] 🔄 Updating patient:', {
      id: patientId,
      updates: Object.keys(data)
    });
    
    // Build SET clause fragments with values embedded
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (data.name !== undefined) {
      setClauses.push(`full_name = $${paramIndex++}`);
      queryParams.push(data.name);
    }
    if (data.age !== undefined) {
      setClauses.push(`age = $${paramIndex++}`);
      queryParams.push(data.age);
    }
    if (data.gender !== undefined) {
      setClauses.push(`gender = $${paramIndex++}`);
      queryParams.push(data.gender);
    }
    if (data.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      queryParams.push(data.phone);
    }
    if (data.username !== undefined) {
      setClauses.push(`username = $${paramIndex++}`);
      queryParams.push(data.username || null);
    }
    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      queryParams.push(data.email || null);
    }
    if (data.password !== undefined && data.password !== '') {
      setClauses.push(`password = $${paramIndex++}`);
      queryParams.push(data.password);
    }
    if (data.hasAccess !== undefined) {
      setClauses.push(`has_access = $${paramIndex++}`);
      queryParams.push(data.hasAccess);
    }
    
    // JSON columns with ::jsonb casting
    if (data.medicalProfile !== undefined) {
      setClauses.push(`medical_profile = $${paramIndex++}::jsonb`);
      queryParams.push(JSON.stringify(data.medicalProfile));
    }
    if (data.currentVisit !== undefined) {
      setClauses.push(`current_visit = $${paramIndex++}::jsonb`);
      queryParams.push(JSON.stringify(data.currentVisit));
    }
    if (data.history !== undefined) {
      setClauses.push(`history = $${paramIndex++}::jsonb`);
      queryParams.push(JSON.stringify(data.history));
    }
    
    if (setClauses.length === 0) {
      console.log('[pgPatients.update] ⚠️ No fields to update');
      return;
    }
    
    // Build final query with WHERE clause
    const setClause = setClauses.join(', ');
    const whereParam = `$${paramIndex}`;
    queryParams.push(patientId);
    
    const query = `UPDATE patients SET ${setClause} WHERE id = ${whereParam}`;
    
    console.log('[pgPatients.update] 📝 Executing query:', {
      fields: setClauses.length,
      patientId
    });
    
    try {
      // neon() supports raw parameterized queries at runtime
      // @ts-ignore
      await sql(query, queryParams);
      console.log('[pgPatients.update] ✅ Update successful');
    } catch (error: any) {
      console.error('[pgPatients.update] ❌ Update FAILED:', {
        message: error.message,
        stack: error.stack,
        patientId: patientId,
        fields: Object.keys(data)
      });
      throw error;
    }
  },

  subscribe: (callback: (data: Patient[]) => void) => {
    let lastDataString = '';
    
    const fetchAndCompare = async () => {
      const data = await pgPatients.getAll();
      const dataString = JSON.stringify(data);
      
      // Only trigger callback if data actually changed
      if (dataString !== lastDataString) {
        console.log('[pgPatients.subscribe] Data changed, triggering callback');
        lastDataString = dataString;
        callback(data);
      }
    };
    
    // Call once immediately
    fetchAndCompare();
    
    // Poll every 3 seconds (reduced from 1s to avoid spam)
    const interval = setInterval(fetchAndCompare, 3000);
    
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
      id: row.id,
      patientId: String(row.patient_id),
      patientName: row.patient_name,
      clinicId: String(row.clinic_id),
      doctorId: row.doctor_id ? String(row.doctor_id) : undefined,
      date: new Date(row.start_time).getTime(),
      status: row.status,
      reason: row.reason || '',
      notes: '',
      createdAt: new Date(row.created_at || Date.now()).getTime(),
      createdBy: 'system',
      updatedAt: new Date(row.created_at || Date.now()).getTime(),
      updatedBy: 'system',
      isArchived: false
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
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (data.clinicId !== undefined) {
      setClauses.push(`clinic_id = $${paramIndex++}`);
      queryParams.push(data.clinicId);
    }
    if (data.doctorId !== undefined) {
      setClauses.push(`doctor_id = $${paramIndex++}`);
      queryParams.push(data.doctorId || null);
    }
    if (data.date !== undefined) {
      setClauses.push(`start_time = $${paramIndex++}`);
      queryParams.push(new Date(data.date).toISOString());
    }
    if (data.reason !== undefined) {
      setClauses.push(`reason = $${paramIndex++}`);
      queryParams.push(data.reason);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      queryParams.push(data.status);
    }

    if (setClauses.length === 0) return;

    const setClause = setClauses.join(', ');
    queryParams.push(id);
    const query = `UPDATE appointments SET ${setClause} WHERE id = $${paramIndex}`;
    
    // @ts-ignore - neon() supports raw queries
    await sql(query, queryParams);
  },

  delete: async (id: string): Promise<void> => {
    await sql`DELETE FROM appointments WHERE id = ${id}`;
  }
};


