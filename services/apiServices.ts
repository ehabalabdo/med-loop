import { api } from '../src/api';
import { User, Patient, Clinic, Appointment, ClinicCategory, Client, SuperAdmin, Device, DeviceResult, DeviceResultStatus } from '../types';
import { getCurrentClientId } from '../context/ClientContext';

/**
 * API Services - Calls the backend API (medloop-api on Render)
 * Drop-in replacement for pgServices.ts
 * All queries go through the authenticated backend; no direct DB access from browser.
 */

// ==================== SUPER ADMIN ====================

export const pgSuperAdmin = {
  login: async (username: string, password: string): Promise<SuperAdmin | null> => {
    try {
      const result = await api.post('/auth/super-admin/login', { username, password });
      if (!result || !result.admin) return null;
      // Store the super-admin token
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      return { id: result.admin.id, username: result.admin.username, name: result.admin.name };
    } catch {
      return null;
    }
  }
};

// ==================== CLIENTS (SaaS) ====================

function mapClientRow(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl || row.logo_url || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    status: row.status,
    trialEndsAt: row.trialEndsAt || row.trial_ends_at,
    subscriptionEndsAt: row.subscriptionEndsAt || row.subscription_ends_at,
    ownerUserId: row.ownerUserId || row.owner_user_id,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
    isActive: row.isActive !== undefined ? row.isActive : row.is_active,
    enabledFeatures: row.enabledFeatures || row.enabled_features || { dental_lab: false, implant_company: false, academy: false, device_results: false }
  };
}

export const pgClientsService = {
  getAll: async (): Promise<Client[]> => {
    const result = await api.get('/clients');
    return (result || []).map(mapClientRow);
  },

  getBySlug: async (slug: string): Promise<Client | null> => {
    try {
      const result = await api.get(`/clients/by-slug/${encodeURIComponent(slug)}`);
      if (!result) return null;
      return mapClientRow(result);
    } catch {
      return null;
    }
  },

  getById: async (id: number): Promise<Client | null> => {
    try {
      const result = await api.get(`/clients/${id}`);
      if (!result) return null;
      return mapClientRow(result);
    } catch {
      return null;
    }
  },

  create: async (data: { name: string; slug: string; phone?: string; email?: string; address?: string; trialDays?: number }): Promise<number> => {
    const result = await api.post('/clients', data);
    return result.id || result;
  },

  createOwner: async (clientId: number, data: { name: string; email: string; password: string }): Promise<number> => {
    const result = await api.post(`/clients/${clientId}/owner`, data);
    return result.userId || result.id || result;
  },

  extendTrial: async (clientId: number, days: number): Promise<void> => {
    await api.put(`/clients/${clientId}/extend-trial`, { days });
  },

  setTrialEndDate: async (clientId: number, endDate: string): Promise<void> => {
    await api.put(`/clients/${clientId}/trial-end-date`, { endDate });
  },

  extendSubscription: async (clientId: number, days: number): Promise<void> => {
    await api.put(`/clients/${clientId}/extend-subscription`, { days });
  },

  suspend: async (clientId: number): Promise<void> => {
    await api.put(`/clients/${clientId}/suspend`, {});
  },

  activate: async (clientId: number): Promise<void> => {
    await api.put(`/clients/${clientId}/activate`, {});
  },

  updateFeatures: async (clientId: number, features: Record<string, boolean>): Promise<void> => {
    await api.put(`/clients/${clientId}/features`, { features });
  },

  delete: async (clientId: number): Promise<void> => {
    await api.del(`/clients/${clientId}`);
  },

  update: async (clientId: number, data: Partial<Pick<Client, 'name' | 'phone' | 'email' | 'address' | 'logoUrl'>>): Promise<void> => {
    await api.put(`/clients/${clientId}`, data);
  },

  getStats: async (clientId: number) => {
    const result = await api.get(`/clients/${clientId}/stats`);
    return {
      patientsCount: result?.patientsCount || result?.patients_count || 0,
      usersCount: result?.usersCount || result?.users_count || 0,
      appointmentsCount: result?.appointmentsCount || result?.appointments_count || 0
    };
  }
};

// ==================== USERS ====================

function mapUserRow(row: any): User {
  let clinicIds: string[] = [];
  if (row.clinicIds) {
    clinicIds = Array.isArray(row.clinicIds) ? row.clinicIds : [];
  } else if (row.clinic_ids) {
    try {
      const parsed = typeof row.clinic_ids === 'string' ? JSON.parse(row.clinic_ids) : row.clinic_ids;
      clinicIds = Array.isArray(parsed) ? parsed : [];
    } catch {
      clinicIds = [];
    }
  }
  if (clinicIds.length === 0 && (row.clinicId || row.clinic_id)) {
    clinicIds = [String(row.clinicId || row.clinic_id)];
  }

  return {
    uid: String(row.uid || row.id),
    email: row.email,
    name: row.name || row.full_name,
    role: row.role,
    clinicIds,
    clientId: row.clientId || row.client_id || undefined,
    isActive: row.isActive !== undefined ? row.isActive : (row.is_active !== false),
    createdAt: row.createdAt || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    createdBy: row.createdBy || row.created_by || 'system',
    updatedAt: row.updatedAt || (row.updated_at ? new Date(row.updated_at).getTime() : Date.now()),
    updatedBy: row.updatedBy || row.updated_by || 'system',
    isArchived: row.isArchived || row.is_archived || false
  };
}

export const pgUsers = {
  getAll: async (clientId?: number): Promise<User[]> => {
    const result = await api.get('/users');
    return (result || []).map(mapUserRow);
  },

  findByLogin: async (identifier: string, password: string, clientId?: number): Promise<User | null> => {
    try {
      const cid = clientId || getCurrentClientId();
      const result = await api.post('/auth/login', {
        username: identifier,
        password,
        client_id: cid
      });
      if (!result || !result.user) return null;
      if (result.token) localStorage.setItem('token', result.token);
      return mapUserRow(result.user);
    } catch {
      return null;
    }
  },

  create: async (user: Omit<User, 'uid' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await api.post('/users', {
      full_name: user.name,
      email: user.email,
      password: user.password || 'password123',
      role: user.role,
      clinic_ids: user.clinicIds,
      is_active: user.isActive !== false
    });
    return String(result.id || result);
  },

  update: async (uid: string, data: Partial<Pick<User, 'name' | 'email' | 'password' | 'role' | 'clinicIds' | 'isActive'>>): Promise<void> => {
    const body: any = {};
    if (data.name !== undefined) body.full_name = data.name;
    if (data.email !== undefined) body.email = data.email;
    if (data.password !== undefined && data.password !== '') body.password = data.password;
    if (data.role !== undefined) body.role = data.role;
    if (data.clinicIds !== undefined) body.clinic_ids = data.clinicIds;
    if (data.isActive !== undefined) body.is_active = data.isActive;
    await api.put(`/users/${uid}`, body);
  },

  delete: async (uid: string): Promise<void> => {
    await api.del(`/users/${uid}`);
  }
};

// ==================== CLINICS ====================

function mapClinicRow(row: any): Clinic {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type || 'General',
    category: (row.category || 'clinic') as ClinicCategory,
    active: row.active !== false,
    clientId: row.clientId || row.client_id || undefined,
    createdAt: row.createdAt || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    createdBy: row.createdBy || row.created_by || 'system',
    updatedAt: row.updatedAt || (row.updated_at ? new Date(row.updated_at).getTime() : Date.now()),
    updatedBy: row.updatedBy || row.updated_by || 'system',
    isArchived: row.isArchived || row.is_archived || false
  };
}

export const pgClinics = {
  getAll: async (clientId?: number): Promise<Clinic[]> => {
    const result = await api.get('/clinics');
    return (result || []).map(mapClinicRow);
  },

  create: async (clinic: Omit<Clinic, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await api.post('/clinics', {
      name: clinic.name,
      type: clinic.type,
      category: clinic.category || 'clinic',
      active: clinic.active !== false
    });
    return String(result.id || result);
  },

  update: async (id: string, data: Partial<Pick<Clinic, 'name' | 'type' | 'category' | 'active'>>): Promise<void> => {
    await api.put(`/clinics/${id}`, data);
  },

  toggleStatus: async (id: string, active: boolean): Promise<void> => {
    await api.put(`/clinics/${id}/status`, { active });
  },

  delete: async (id: string): Promise<void> => {
    await api.del(`/clinics/${id}`);
  }
};

// ==================== PATIENTS ====================

function calculateAge(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function mapPatientRow(row: any): Patient {
  // The API may return camelCase or snake_case, handle both
  let medicalProfile = row.medicalProfile || row.medical_profile;
  if (typeof medicalProfile === 'string') {
    try { medicalProfile = JSON.parse(medicalProfile); } catch { medicalProfile = {}; }
  }

  let currentVisit = row.currentVisit || row.current_visit;
  if (typeof currentVisit === 'string') {
    try { currentVisit = JSON.parse(currentVisit); } catch { currentVisit = null; }
  }

  let history = row.history;
  if (typeof history === 'string') {
    try { history = JSON.parse(history); } catch { history = []; }
  }

  const dobStr = row.dateOfBirth || row.date_of_birth;
  const dobParsed = dobStr instanceof Date ? dobStr.toISOString().split('T')[0] : (dobStr ? String(dobStr).split('T')[0] : undefined);

  return {
    id: String(row.id),
    name: row.name || row.full_name,
    age: dobParsed ? calculateAge(dobParsed) : (row.age || 0),
    dateOfBirth: dobParsed || undefined,
    gender: (row.gender || 'male') as 'male' | 'female',
    phone: row.phone || '',
    username: row.username || undefined,
    email: row.email || undefined,
    hasAccess: row.hasAccess !== undefined ? row.hasAccess : (row.has_access || false),
    medicalProfile: {
      allergies: { exists: false, details: '' },
      chronicConditions: { exists: false, details: '' },
      currentMedications: { exists: false, details: '' },
      previousSurgeries: { exists: false, details: '' },
      isPregnant: false,
      notes: row.notes || '',
      ...(medicalProfile && typeof medicalProfile === 'object' ? medicalProfile : {}),
    },
    currentVisit: currentVisit && Object.keys(currentVisit).length > 0 ? currentVisit : {
      visitId: '',
      clinicId: '',
      date: Date.now(),
      status: 'waiting' as const,
      priority: 'normal' as const,
      reasonForVisit: ''
    },
    history: Array.isArray(history) ? history : [],
    createdAt: row.createdAt || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    createdBy: row.createdBy || row.created_by || 'system',
    updatedAt: row.updatedAt || (row.updated_at ? new Date(row.updated_at).getTime() : Date.now()),
    updatedBy: row.updatedBy || row.updated_by || 'system',
    isArchived: row.isArchived || row.is_archived || false
  };
}

export const pgPatients = {
  getAll: async (clientId?: number): Promise<Patient[]> => {
    const result = await api.get('/patients');
    return (result || []).map(mapPatientRow);
  },

  findByLogin: async (identifier: string, password: string, clientId?: number): Promise<Patient | null> => {
    try {
      const cid = clientId || getCurrentClientId();
      const result = await api.post('/auth/login', {
        username: identifier,
        password,
        client_id: cid,
        type: 'patient'
      });
      if (!result || !result.patient) return null;
      if (result.token) localStorage.setItem('token', result.token);
      return mapPatientRow(result.patient);
    } catch {
      return null;
    }
  },

  getById: async (id: string): Promise<Patient | null> => {
    try {
      const result = await api.get(`/patients/${id}`);
      if (!result) return null;
      return mapPatientRow(result);
    } catch {
      return null;
    }
  },

  create: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<string> => {
    const result = await api.post('/patients', {
      full_name: patient.name,
      age: patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : (patient.age || 0),
      date_of_birth: patient.dateOfBirth || null,
      gender: patient.gender || 'male',
      phone: patient.phone || '',
      username: patient.username || null,
      email: patient.email || null,
      password: patient.password || null,
      has_access: patient.hasAccess || false,
      medical_profile: patient.medicalProfile || {},
      current_visit: patient.currentVisit || {},
      history: patient.history || [],
      notes: patient.medicalProfile?.notes || ''
    });
    return String(result.id || result);
  },

  update: async (id: string, data: Partial<Patient>): Promise<void> => {
    const body: any = {};
    if (data.name !== undefined) body.full_name = data.name;
    if (data.dateOfBirth !== undefined) {
      body.date_of_birth = data.dateOfBirth;
      body.age = calculateAge(data.dateOfBirth);
    } else if (data.age !== undefined) {
      body.age = data.age;
    }
    if (data.gender !== undefined) body.gender = data.gender;
    if (data.phone !== undefined) body.phone = data.phone;
    if (data.username !== undefined) body.username = data.username || null;
    if (data.email !== undefined) body.email = data.email || null;
    if (data.password !== undefined && data.password !== '') body.password = data.password;
    if (data.hasAccess !== undefined) body.has_access = data.hasAccess;
    if (data.medicalProfile !== undefined) body.medical_profile = data.medicalProfile;
    if (data.currentVisit !== undefined) body.current_visit = data.currentVisit;
    if (data.history !== undefined) body.history = data.history;
    if (data.isArchived !== undefined) body.is_archived = data.isArchived;
    await api.put(`/patients/${id}`, body);
  },

  subscribe: (callback: (data: Patient[]) => void) => {
    let lastDataString = '';

    const fetchAndCompare = async () => {
      try {
        const data = await pgPatients.getAll();
        const dataString = JSON.stringify(data);
        if (dataString !== lastDataString) {
          lastDataString = dataString;
          callback(data);
        }
      } catch (err) {
        console.error('[apiPatients.subscribe] Error polling:', err);
      }
    };

    // Call once immediately
    fetchAndCompare();

    // Poll every 3 seconds
    const interval = setInterval(fetchAndCompare, 3000);

    const unsubscribe = () => clearInterval(interval);
    (unsubscribe as any).refresh = fetchAndCompare;
    return unsubscribe;
  }
};

// ==================== APPOINTMENTS ====================

function mapAppointmentRow(row: any): Appointment {
  return {
    id: String(row.id),
    patientId: String(row.patientId || row.patient_id),
    patientName: row.patientName || row.patient_name,
    clinicId: String(row.clinicId || row.clinic_id),
    doctorId: (row.doctorId || row.doctor_id) ? String(row.doctorId || row.doctor_id) : undefined,
    date: row.date || (row.start_time ? new Date(row.start_time).getTime() : Date.now()),
    status: row.status,
    reason: row.reason || '',
    notes: row.notes || '',
    suggestedDate: (row.suggestedDate || row.suggested_date) ? new Date(row.suggestedDate || row.suggested_date).getTime() : undefined,
    suggestedNotes: row.suggestedNotes || row.suggested_notes || undefined,
    createdAt: row.createdAt || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    createdBy: row.createdBy || row.created_by || 'system',
    updatedAt: row.updatedAt || (row.updated_at ? new Date(row.updated_at).getTime() : Date.now()),
    updatedBy: row.updatedBy || row.updated_by || 'system',
    isArchived: row.isArchived || row.is_archived || false
  };
}

export const pgAppointments = {
  getAll: async (clientId?: number): Promise<Appointment[]> => {
    const result = await api.get('/appointments');
    return (result || []).map(mapAppointmentRow);
  },

  getByPatientId: async (patientId: string): Promise<Appointment[]> => {
    const result = await api.get(`/appointments/by-patient/${patientId}`);
    return (result || []).map(mapAppointmentRow);
  },

  create: async (data: Pick<Appointment, 'id' | 'patientId' | 'patientName' | 'clinicId' | 'doctorId' | 'date' | 'reason' | 'status'>): Promise<void> => {
    await api.post('/appointments', {
      patient_id: parseInt(data.patientId) || 0,
      patient_name: data.patientName,
      clinic_id: parseInt(data.clinicId) || 0,
      doctor_id: data.doctorId ? parseInt(data.doctorId) : null,
      start_time: new Date(data.date).toISOString(),
      end_time: new Date(data.date + 3600000).toISOString(),
      status: data.status || 'scheduled',
      reason: data.reason || ''
    });
  },

  update: async (id: string, data: Partial<Pick<Appointment, 'clinicId' | 'doctorId' | 'date' | 'reason' | 'status' | 'suggestedDate' | 'suggestedNotes'>>): Promise<void> => {
    const body: any = {};
    if (data.clinicId !== undefined) body.clinic_id = parseInt(data.clinicId) || 0;
    if (data.doctorId !== undefined) body.doctor_id = data.doctorId ? parseInt(data.doctorId) : null;
    if (data.date !== undefined) body.start_time = new Date(data.date).toISOString();
    if (data.reason !== undefined) body.reason = data.reason;
    if (data.status !== undefined) body.status = data.status;
    if (data.suggestedDate !== undefined) body.suggested_date = new Date(data.suggestedDate).toISOString();
    if (data.suggestedNotes !== undefined) body.suggested_notes = data.suggestedNotes;
    await api.put(`/appointments/${id}`, body);
  },

  delete: async (id: string): Promise<void> => {
    await api.del(`/appointments/${id}`);
  }
};

// ==================== INVOICES ====================

function mapInvoiceRow(row: any): any {
  return {
    id: row.id,
    visitId: row.visitId || row.visit_id,
    patientId: row.patientId || row.patient_id,
    patientName: row.patientName || row.patient_name,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
    totalAmount: parseFloat(row.totalAmount || row.total_amount || 0),
    paidAmount: parseFloat(row.paidAmount || row.paid_amount || 0),
    paymentMethod: row.paymentMethod || row.payment_method,
    status: row.status,
    createdAt: row.createdAt || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    createdBy: row.createdBy || row.created_by || 'system',
    updatedAt: row.updatedAt || (row.updated_at ? new Date(row.updated_at).getTime() : Date.now()),
    updatedBy: row.updatedBy || row.updated_by || 'system',
    isArchived: row.isArchived || row.is_archived || false
  };
}

export const pgInvoices = {
  getAll: async (clientId?: number): Promise<any[]> => {
    const result = await api.get('/invoices');
    return (result || []).map(mapInvoiceRow);
  },

  create: async (data: any): Promise<void> => {
    await api.post('/invoices', {
      id: data.id,
      visit_id: data.visitId,
      patient_id: data.patientId,
      patient_name: data.patientName,
      items: data.items,
      total_amount: data.totalAmount,
      paid_amount: data.paidAmount || 0,
      payment_method: data.paymentMethod || 'cash',
      status: data.status
    });
  },

  update: async (id: string, data: any): Promise<void> => {
    const body: any = {};
    if (data.items !== undefined) body.items = data.items;
    if (data.totalAmount !== undefined) body.total_amount = data.totalAmount;
    if (data.paidAmount !== undefined) body.paid_amount = data.paidAmount;
    if (data.paymentMethod !== undefined) body.payment_method = data.paymentMethod;
    if (data.status !== undefined) body.status = data.status;
    await api.put(`/invoices/${id}`, body);
  },

  delete: async (id: string): Promise<void> => {
    await api.del(`/invoices/${id}`);
  }
};

// ==================== DEVICES ====================

function mapDeviceRow(row: any): Device {
  return {
    id: row.id,
    clientId: row.clientId || row.client_id,
    clinicId: String(row.clinicId || row.clinic_id),
    name: row.name,
    type: row.type,
    connectionType: row.connectionType || row.connection_type,
    ipAddress: row.ipAddress || row.ip_address || undefined,
    port: row.port || undefined,
    comPort: row.comPort || row.com_port || undefined,
    baudRate: row.baudRate || row.baud_rate || undefined,
    config: row.config || {},
    isActive: row.isActive !== undefined ? row.isActive : row.is_active,
    lastSeenAt: (row.lastSeenAt || row.last_seen_at) ? new Date(row.lastSeenAt || row.last_seen_at).toISOString() : undefined,
    createdAt: (row.createdAt || row.created_at) ? new Date(row.createdAt || row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: (row.updatedAt || row.updated_at) ? new Date(row.updatedAt || row.updated_at).toISOString() : new Date().toISOString()
  };
}

export const pgDevices = {
  getAll: async (clientId?: number): Promise<Device[]> => {
    const result = await api.get('/devices');
    return (result || []).map(mapDeviceRow);
  },

  getByClinic: async (clinicId: string, clientId?: number): Promise<Device[]> => {
    const result = await api.get(`/devices?clinicId=${clinicId}`);
    return (result || []).map(mapDeviceRow);
  },

  create: async (data: Omit<Device, 'id' | 'createdAt' | 'updatedAt' | 'lastSeenAt'>): Promise<string> => {
    const result = await api.post('/devices', {
      clinic_id: parseInt(data.clinicId) || 0,
      name: data.name,
      type: data.type,
      connection_type: data.connectionType,
      ip_address: data.ipAddress || null,
      port: data.port || null,
      com_port: data.comPort || null,
      baud_rate: data.baudRate || null,
      config: data.config || {},
      is_active: data.isActive
    });
    return result.id || result;
  },

  update: async (id: string, data: Partial<Device>): Promise<void> => {
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.type !== undefined) body.type = data.type;
    if (data.connectionType !== undefined) body.connection_type = data.connectionType;
    if (data.ipAddress !== undefined) body.ip_address = data.ipAddress;
    if (data.port !== undefined) body.port = data.port;
    if (data.comPort !== undefined) body.com_port = data.comPort;
    if (data.isActive !== undefined) body.is_active = data.isActive;
    await api.put(`/devices/${id}`, body);
  },

  updateLastSeen: async (id: string): Promise<void> => {
    await api.put(`/devices/${id}/last-seen`, {});
  },

  delete: async (id: string): Promise<void> => {
    await api.del(`/devices/${id}`);
  }
};

// ==================== DEVICE RESULTS ====================

function mapDeviceResultRow(row: any): DeviceResult {
  return {
    id: row.id,
    clientId: row.clientId || row.client_id,
    deviceId: row.deviceId || row.device_id,
    deviceName: row.deviceName || row.device_name || undefined,
    deviceType: row.deviceType || row.device_type || undefined,
    patientIdentifier: row.patientIdentifier || row.patient_identifier,
    testCode: row.testCode || row.test_code,
    testName: row.testName || row.test_name || undefined,
    value: row.value,
    unit: row.unit || undefined,
    referenceRange: row.referenceRange || row.reference_range || undefined,
    isAbnormal: row.isAbnormal || row.is_abnormal || false,
    rawMessage: row.rawMessage || row.raw_message || undefined,
    status: row.status,
    matchedPatientId: (row.matchedPatientId || row.matched_patient_id) ? String(row.matchedPatientId || row.matched_patient_id) : undefined,
    matchedPatientName: row.matchedPatientName || row.matched_patient_name || row.patient_name || undefined,
    matchedAt: (row.matchedAt || row.matched_at) ? new Date(row.matchedAt || row.matched_at).toISOString() : undefined,
    matchedBy: row.matchedBy || row.matched_by || undefined,
    errorMessage: row.errorMessage || row.error_message || undefined,
    createdAt: (row.createdAt || row.created_at) ? new Date(row.createdAt || row.created_at).toISOString() : new Date().toISOString()
  };
}

export const pgDeviceResults = {
  insert: async (clientId: number, data: {
    deviceId: string;
    patientIdentifier: string;
    testCode: string;
    testName?: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    isAbnormal?: boolean;
    rawMessage?: string;
  }): Promise<{ id: string; status: DeviceResultStatus; matchedPatientId: number | null }> => {
    const result = await api.post('/device-results', {
      device_id: data.deviceId,
      patient_identifier: data.patientIdentifier,
      test_code: data.testCode,
      test_name: data.testName || null,
      value: data.value,
      unit: data.unit || null,
      reference_range: data.referenceRange || null,
      is_abnormal: data.isAbnormal || false,
      raw_message: data.rawMessage || null
    });
    return {
      id: result.id,
      status: result.status || 'pending',
      matchedPatientId: result.matchedPatientId || result.matched_patient_id || null
    };
  },

  getPending: async (clientId: number): Promise<DeviceResult[]> => {
    const result = await api.get('/device-results?status=pending');
    return (result || []).map(mapDeviceResultRow);
  },

  getAll: async (clientId: number, statusFilter?: DeviceResultStatus): Promise<DeviceResult[]> => {
    const query = statusFilter ? `/device-results?status=${statusFilter}` : '/device-results';
    const result = await api.get(query);
    return (result || []).map(mapDeviceResultRow);
  },

  getByPatientId: async (patientId: string, clientId?: number): Promise<DeviceResult[]> => {
    const result = await api.get(`/device-results?patientId=${patientId}`);
    return (result || []).map(mapDeviceResultRow);
  },

  manualMatch: async (resultId: string, patientId: string, matchedBy: string): Promise<void> => {
    await api.put(`/device-results/${resultId}/match`, {
      patient_id: parseInt(patientId) || 0,
      matched_by: matchedBy
    });
  },

  reject: async (resultId: string): Promise<void> => {
    await api.put(`/device-results/${resultId}/reject`, {});
  },

  getPendingCount: async (clientId: number): Promise<number> => {
    const result = await api.get('/device-results/pending-count');
    return result?.count || 0;
  }
};

// ===================== CATALOG API =====================
import type { CatalogService, CatalogMedication, ImportResult } from '../types';

export const pgCatalogServices = {
  getAll: async (): Promise<CatalogService[]> => {
    return await api.get('/catalog/services') || [];
  },
  create: async (data: Partial<CatalogService>): Promise<CatalogService> => {
    return await api.post('/catalog/services', data);
  },
  update: async (id: string, data: Partial<CatalogService>): Promise<CatalogService> => {
    return await api.put(`/catalog/services/${id}`, data);
  },
  remove: async (id: string): Promise<void> => {
    await api.del(`/catalog/services/${id}`);
  },
  importBulk: async (rows: Partial<CatalogService>[]): Promise<ImportResult> => {
    return await api.post('/catalog/services/import', { rows });
  },
};

export const pgCatalogMedications = {
  getAll: async (): Promise<CatalogMedication[]> => {
    return await api.get('/catalog/medications') || [];
  },
  create: async (data: Partial<CatalogMedication>): Promise<CatalogMedication> => {
    return await api.post('/catalog/medications', data);
  },
  update: async (id: string, data: Partial<CatalogMedication>): Promise<CatalogMedication> => {
    return await api.put(`/catalog/medications/${id}`, data);
  },
  remove: async (id: string): Promise<void> => {
    await api.del(`/catalog/medications/${id}`);
  },
  importBulk: async (rows: Partial<CatalogMedication>[]): Promise<ImportResult> => {
    return await api.post('/catalog/medications/import', { rows });
  },
};
