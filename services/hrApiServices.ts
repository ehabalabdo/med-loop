import { api } from '../src/api';
import {
  HrEmployee,
  HrAttendanceRecord,
  HrAttendanceEvent,
  HrMeProfile,
  HrMonthlyReport,
  ClinicLocation,
  HrPayrollRun,
  HrPayslip,
  HrDeduction,
  HrWarning,
  HrNotification,
  HrSocialSecuritySettings,
} from '../types';

/**
 * HR API Services — all calls go through the authenticated backend
 */

// ==================== CLINIC LOCATION ====================

export const hrClinicService = {
  getLocations: async (): Promise<ClinicLocation[]> => {
    return (await api.get('/hr/clinic/location')) || [];
  },

  updateLocation: async (data: {
    clinic_id?: number;
    latitude: number;
    longitude: number;
    allowed_radius_meters?: number;
  }): Promise<ClinicLocation> => {
    return await api.put('/hr/clinic/location', data);
  },
};

// We need PATCH support — add it to api if not already there
// For now, use PUT as a workaround (backend accepts both)
// Actually let's add a patch method:
const apiPatch = async (path: string, body?: any) => {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`https://medloop-api.onrender.com${path}`, {
    method: 'PATCH',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    throw new Error('Unauthorized');
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data as any)?.message || (data as any)?.error || 'Request failed');
  return data;
};

export const hrClinicLocationService = {
  getAll: async (): Promise<ClinicLocation[]> => {
    return (await api.get('/hr/clinic/location')) || [];
  },

  update: async (data: {
    clinic_id?: number;
    latitude: number;
    longitude: number;
    allowed_radius_meters?: number;
  }): Promise<any> => {
    return await apiPatch('/hr/clinic/location', data);
  },
};

// ==================== EMPLOYEES (Admin) ====================

export const hrEmployeesService = {
  getAll: async (): Promise<HrEmployee[]> => {
    return (await api.get('/hr/employees')) || [];
  },

  create: async (data: {
    full_name: string;
    username: string;
    password: string;
    phone?: string;
    email?: string;
    work_days?: number[];
    start_time?: string;
    end_time?: string;
    grace_minutes?: number;
    overtime_enabled?: boolean;
  }): Promise<{ id: number; username: string }> => {
    return await api.post('/hr/employees', data);
  },

  update: async (
    id: number,
    data: {
      full_name?: string;
      phone?: string;
      email?: string;
      status?: string;
      work_days?: number[];
      start_time?: string;
      end_time?: string;
      grace_minutes?: number;
      overtime_enabled?: boolean;
    }
  ): Promise<void> => {
    await api.put(`/hr/employees/${id}`, data);
  },

  deactivate: async (id: number): Promise<void> => {
    await api.del(`/hr/employees/${id}`);
  },

  resetPassword: async (id: number, password?: string): Promise<{ password: string }> => {
    return await api.post(`/hr/employees/${id}/reset-password`, { password });
  },
};

// ==================== HR AUTH (Employee Login) ====================

export const hrAuthService = {
  login: async (
    username: string,
    password: string,
    clientId: number
  ): Promise<{
    token: string;
    type: string;
    employee: { id: number; fullName: string; username: string; clientId: number };
  }> => {
    return await api.post('/auth/hr-login', {
      username,
      password,
      client_id: clientId,
    });
  },
};

// ==================== EMPLOYEE SELF (/hr/me) ====================

export const hrMeService = {
  getProfile: async (): Promise<HrMeProfile> => {
    return await api.get('/hr/me');
  },
};

// ==================== DEBUG ====================

export const hrDebugService = {
  getWebAuthnDiag: async (): Promise<{
    NODE_ENV: string;
    rpID: string;
    expectedOrigin: string;
    rpName: string;
    yourEmployeeId: number | null;
    savedCredentials: number;
    pendingChallenges: { type: string; cnt: string }[];
    serverTime: string;
  }> => {
    return await api.get('/hr/webauthn/debug');
  },
};

// ==================== WEBAUTHN ====================

export const hrWebAuthnService = {
  getRegisterOptions: async (): Promise<any> => {
    return await api.post('/hr/webauthn/register/options', {});
  },

  verifyRegistration: async (body: any): Promise<{ verified: boolean }> => {
    return await api.post('/hr/webauthn/register/verify', body);
  },

  getAuthenticateOptions: async (): Promise<any> => {
    return await api.post('/hr/webauthn/authenticate/options', {});
  },

  verifyAuthentication: async (body: any): Promise<{ verified: boolean; bioToken: string }> => {
    return await api.post('/hr/webauthn/authenticate/verify', body);
  },

  resetAll: async (): Promise<{ cleared: number }> => {
    return await api.del('/hr/webauthn/reset');
  },
};

// ==================== ATTENDANCE ====================

export const hrAttendanceService = {
  checkIn: async (data: {
    latitude: number;
    longitude: number;
    bioToken: string;
    device_info?: string;
  }): Promise<{ message: string; time: string; clinicName: string }> => {
    return await api.post('/hr/attendance/check-in', data);
  },

  checkOut: async (data: {
    latitude: number;
    longitude: number;
    bioToken: string;
    device_info?: string;
  }): Promise<{
    message: string;
    time: string;
    totalMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
  }> => {
    return await api.post('/hr/attendance/check-out', data);
  },

  breakOut: async (data: {
    latitude: number;
    longitude: number;
    bioToken: string;
    device_info?: string;
  }): Promise<{ message: string; time: string }> => {
    return await api.post('/hr/attendance/break-out', data);
  },

  breakIn: async (data: {
    latitude: number;
    longitude: number;
    bioToken: string;
    device_info?: string;
  }): Promise<{ message: string; time: string; breakMinutes: number }> => {
    return await api.post('/hr/attendance/break-in', data);
  },

  getAll: async (params: {
    from?: string;
    to?: string;
    employee_id?: number;
    status?: string;
  }): Promise<HrAttendanceRecord[]> => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.employee_id) qs.set('employee_id', String(params.employee_id));
    if (params.status) qs.set('status', params.status);
    const q = qs.toString();
    return (await api.get(`/hr/attendance${q ? '?' + q : ''}`)) || [];
  },

  getTimeline: async (employeeId: number, date: string): Promise<HrAttendanceEvent[]> => {
    return (await api.get(`/hr/attendance/${employeeId}/${date}`)) || [];
  },
};

// ==================== REPORTS ====================

export const hrReportsService = {
  monthly: async (employeeId: number, month: string): Promise<HrMonthlyReport> => {
    return await api.get(`/hr/reports/monthly?employee_id=${employeeId}&month=${month}`);
  },

  myMonthly: async (month: string): Promise<HrMonthlyReport> => {
    return await api.get(`/hr/reports/my-monthly?month=${month}`);
  },
};

// ==================== SOCIAL SECURITY SETTINGS ====================

export const hrSocialSecurityService = {
  get: async (): Promise<HrSocialSecuritySettings> => {
    return await api.get('/hr/social-security');
  },
  update: async (data: {
    employee_rate_percent: number;
    employer_rate_percent: number;
    enabled: boolean;
  }): Promise<HrSocialSecuritySettings> => {
    return await apiPatch('/hr/social-security', data);
  },
};

// ==================== PAYROLL ====================

export const hrPayrollService = {
  generate: async (month: string): Promise<HrPayrollRun> => {
    return await api.post(`/hr/payroll/generate`, { month });
  },

  getRun: async (month: string): Promise<HrPayrollRun & { payslips: HrPayslip[] }> => {
    return await api.get(`/hr/payroll/run?month=${month}`);
  },

  getPayslip: async (id: number): Promise<HrPayslip> => {
    return await api.get(`/hr/payslips/${id}`);
  },

  updatePayslip: async (id: number, data: {
    final_late_amount?: number;
    final_absence_amount?: number;
    final_overtime_amount?: number;
    overtime_multiplier?: number;
  }): Promise<HrPayslip> => {
    return await apiPatch(`/hr/payslips/${id}`, data);
  },

  approvePayslip: async (id: number): Promise<HrPayslip> => {
    return await api.post(`/hr/payslips/${id}/approve`, {});
  },

  rejectPayslip: async (id: number, reason: string): Promise<HrPayslip> => {
    return await api.post(`/hr/payslips/${id}/reject`, { reason });
  },

  closeMonth: async (month: string): Promise<HrPayrollRun> => {
    return await api.post(`/hr/payroll/close-month`, { month });
  },

  downloadPdf: async (id: number, filename?: string): Promise<void> => {
    const token = localStorage.getItem('token');
    const res = await fetch(`https://medloop-api.onrender.com/hr/payslips/${id}/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Download failed' }));
      throw new Error(err.detail || err.error || 'Download failed');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ? `${filename}.pdf` : `payslip-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// ==================== DEDUCTIONS (Manager-entered) ====================

export const hrDeductionsService = {
  getAll: async (params: { month?: string; employee_id?: number }): Promise<HrDeduction[]> => {
    const qs = new URLSearchParams();
    if (params.month) qs.set('month', params.month);
    if (params.employee_id) qs.set('employee_id', String(params.employee_id));
    const q = qs.toString();
    return (await api.get(`/hr/deductions${q ? '?' + q : ''}`)) || [];
  },

  create: async (data: {
    employee_id: number;
    month: string;
    amount: number;
    reason?: string;
  }): Promise<HrDeduction> => {
    return await api.post('/hr/deductions', data);
  },

  remove: async (id: number): Promise<void> => {
    await api.del(`/hr/deductions/${id}`);
  },
};

// ==================== WARNINGS (Manager-entered) ====================

export const hrWarningsService = {
  getAll: async (params: { employee_id?: number }): Promise<HrWarning[]> => {
    const qs = new URLSearchParams();
    if (params.employee_id) qs.set('employee_id', String(params.employee_id));
    const q = qs.toString();
    return (await api.get(`/hr/warnings${q ? '?' + q : ''}`)) || [];
  },

  create: async (data: {
    employee_id: number;
    level: string;
    reason?: string;
  }): Promise<HrWarning> => {
    return await api.post('/hr/warnings', data);
  },
};

// ==================== NOTIFICATIONS (Manager → Employee) ====================

export const hrNotificationsService = {
  getAll: async (params: { employee_id?: number }): Promise<HrNotification[]> => {
    const qs = new URLSearchParams();
    if (params.employee_id) qs.set('employee_id', String(params.employee_id));
    const q = qs.toString();
    return (await api.get(`/hr/notifications${q ? '?' + q : ''}`)) || [];
  },

  create: async (data: {
    employee_id: number;
    message: string;
  }): Promise<HrNotification> => {
    return await api.post('/hr/notifications', data);
  },

  getMyNotifications: async (): Promise<HrNotification[]> => {
    return (await api.get('/hr/notifications/me')) || [];
  },

  markRead: async (id: number): Promise<void> => {
    await apiPatch(`/hr/notifications/${id}/read`, {});
  },
};
