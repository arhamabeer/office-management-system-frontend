import type {
  LoginResponse,
  MeResponse,
  InviteInfoDTO,
  Paginated,
  EmployeeProfileDTO,
  EmployeeImportResultDTO,
  DepartmentDTO,
  MyAttendanceResponse,
  AttendanceDTO,
  TeamAttendanceDTO,
  AttendanceRosterDTO,
  AutoAbsentRunResultDTO,
  AttendanceReportDTO,
  PersonWeeksDTO,
  AttendancePeriod,
  AttendancePolicyDTO,
  HolidayDTO,
  RegularizationDTO,
  RegularizationKind,
  BiometricDeviceDTO,
  BiometricDeviceStatus,
  UnmappedPinDTO,
  DeviceReconcileResultDTO,
  LeaveTypeDTO,
  LeavePolicyDTO,
  LeaveBalanceDTO,
  LeaveRequestDTO,
  SalaryStructureDTO,
  EmployeeSalaryRowDTO,
  PayslipDTO,
  PayrollRunDTO,
  PayrollSettingsDTO,
  TaxCertificateDTO,
  AuditLogDTO,
  ApprovalsCountDTO,
  ExpenseCategoryDTO,
  ExpensePolicyDTO,
  ExpenseClaimDTO,
  TeamDTO,
  NotificationDTO,
  NotificationCountDTO,
  NotificationPrefsDTO,
  AnnouncementDTO,
  ComplaintCategoryDTO,
  ComplaintDTO,
  InventoryCategoryDTO,
  InventoryRequestDTO,
  RequestAction,
  BusinessCardDTO,
  CompanyProfileDTO,
  LetterTemplateDTO,
} from '@ems/types';
import { api } from './api';
import { getAccessToken } from './authToken';

const P = '/api/v1';

// Dedupe concurrent refreshes into a single in-flight request. Without this,
// React StrictMode's double-invoked effect (and multi-tab loads) would fire two
// /refresh calls with the same rotating token, tripping reuse-detection.
let refreshInFlight: Promise<LoginResponse> | null = null;

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>(`${P}/auth/login`, { email, password }),
  refresh: (): Promise<LoginResponse> => {
    if (!refreshInFlight) {
      refreshInFlight = api
        .post<LoginResponse>(`${P}/auth/refresh`)
        .finally(() => {
          refreshInFlight = null;
        });
    }
    return refreshInFlight;
  },
  logout: () => api.post<{ success: boolean }>(`${P}/auth/logout`),
  me: () => api.get<MeResponse>(`${P}/auth/me`),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ success: boolean }>(`${P}/auth/change-password`, { currentPassword, newPassword }),
  forgotPassword: (email: string) =>
    api.post<{ success: boolean; devToken?: string }>(`${P}/auth/forgot-password`, { email }),
  resetPassword: (token: string, password: string) =>
    api.post<{ success: boolean }>(`${P}/auth/reset-password`, { token, password }),
  inviteInfo: (token: string) => api.get<InviteInfoDTO>(`${P}/auth/invite/${encodeURIComponent(token)}`),
  acceptInvite: (body: { token: string; password: string; firstName?: string; lastName?: string; phone?: string }) =>
    api.post<LoginResponse>(`${P}/auth/accept-invite`, body),
};

export interface EmployeeListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  departmentId?: string;
  orgRole?: string;
  status?: string;
}

export const employeesApi = {
  list: (params: EmployeeListParams = {}) =>
    api.get<Paginated<EmployeeProfileDTO>>(
      `${P}/employees`,
      params as Record<string, string | number | boolean | undefined | null>,
    ),
  get: (id: string) => api.get<EmployeeProfileDTO>(`${P}/employees/${id}`),
  create: (body: Record<string, unknown>) =>
    api.post<{ employee: EmployeeProfileDTO; inviteToken?: string; inviteUrl?: string }>(`${P}/employees`, body),
  importCsv: (csv: string) => api.post<EmployeeImportResultDTO>(`${P}/employees/import`, { csv }),
  resendInvite: (id: string, notify: boolean) =>
    api.post<{ inviteUrl?: string; inviteToken?: string }>(`${P}/employees/${id}/resend-invite`, { notify }),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<EmployeeProfileDTO>(`${P}/employees/${id}`, body),
  assignRole: (id: string, body: { accountType?: string; orgRole?: string }) =>
    api.patch<EmployeeProfileDTO>(`${P}/employees/${id}/role`, body),
  deactivate: (id: string) => api.delete<{ success: boolean }>(`${P}/employees/${id}`),
};

export const departmentsApi = {
  list: () => api.get<DepartmentDTO[]>(`${P}/departments`),
};

export interface TeamAttendanceParams {
  month?: string;
  date?: string;
  departmentId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}

export const attendanceApi = {
  me: (month?: string) =>
    api.get<MyAttendanceResponse>(`${P}/attendance/me`, month ? { month } : undefined),
  checkIn: (source: 'SelfWeb' | 'SelfMobile' = 'SelfWeb') =>
    api.post<AttendanceDTO>(`${P}/attendance/check-in`, { source }),
  checkOut: () => api.post<AttendanceDTO>(`${P}/attendance/check-out`, {}),
  team: (params: TeamAttendanceParams = {}) =>
    api.get<Paginated<TeamAttendanceDTO>>(
      `${P}/attendance/team`,
      params as Record<string, string | number | undefined>,
    ),
  roster: (date?: string) =>
    api.get<AttendanceRosterDTO>(`${P}/attendance/roster`, date ? { date } : undefined),
  runAutoAbsent: (force = false) =>
    api.post<AutoAbsentRunResultDTO>(`${P}/attendance/auto-absent/run`, { force }),
  report: (period: AttendancePeriod) =>
    api.get<AttendanceReportDTO>(`${P}/attendance/report`, { period }),
  personWeeks: (userId: string, count = 4) =>
    api.get<PersonWeeksDTO>(`${P}/attendance/person/${userId}/weeks`, { count }),
  downloadReport: (period: AttendancePeriod, format: 'pdf' | 'xlsx') =>
    downloadBlob(
      `${P}/attendance/report/export?period=${period}&format=${format}`,
      `attendance-report-${period}.${format}`,
    ),
  adminEntry: (body: Record<string, unknown>) =>
    api.post<AttendanceDTO>(`${P}/attendance`, body),
  policy: () => api.get<AttendancePolicyDTO>(`${P}/attendance/policy`),
  updatePolicy: (body: Partial<AttendancePolicyDTO>) =>
    api.put<AttendancePolicyDTO>(`${P}/attendance/policy`, body),
  holidays: (year?: number) =>
    api.get<HolidayDTO[]>(`${P}/attendance/holidays`, year ? { year } : undefined),
  createHoliday: (body: { date: string; name: string }) =>
    api.post<HolidayDTO>(`${P}/attendance/holidays`, body),
  deleteHoliday: (id: string) => api.delete<{ success: boolean }>(`${P}/attendance/holidays/${id}`),
  regularizations: (scope: 'mine' | 'pending') =>
    api.get<RegularizationDTO[]>(`${P}/attendance/regularizations`, { scope }),
  createRegularization: (body: {
    kind?: RegularizationKind;
    date: string;
    checkInAt: string;
    checkOutAt?: string;
    reason: string;
  }) => api.post<RegularizationDTO>(`${P}/attendance/regularizations`, body),
  approveRegularization: (id: string, comment?: string) =>
    api.patch<RegularizationDTO>(`${P}/attendance/regularizations/${id}/approve`, { comment }),
  rejectRegularization: (id: string, comment?: string) =>
    api.patch<RegularizationDTO>(`${P}/attendance/regularizations/${id}/reject`, { comment }),
  // --- biometric devices (Admin/Owner) ---
  devices: () => api.get<BiometricDeviceDTO[]>(`${P}/attendance/devices`),
  updateDevice: (id: string, body: { label?: string; status?: BiometricDeviceStatus }) =>
    api.patch<BiometricDeviceDTO>(`${P}/attendance/devices/${id}`, body),
  unmappedPins: () => api.get<UnmappedPinDTO[]>(`${P}/attendance/devices/unmapped`),
  mapPin: (body: { pin: string; userId: string }) =>
    api.post<{ matched: number; derived: number }>(`${P}/attendance/devices/map`, body),
  reconcileDevices: (body: { from?: string; to?: string } = {}) =>
    api.post<DeviceReconcileResultDTO>(`${P}/attendance/devices/reconcile`, body),
  /** Download the team CSV (auth via Bearer, then a blob download). */
  downloadTeamCsv: async (params: TeamAttendanceParams = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null) qs.append(k, String(v));
    const res = await fetch(`${P}/attendance/team/export?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${params.month ?? params.date ?? 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const leavesApi = {
  types: () => api.get<LeaveTypeDTO[]>(`${P}/leaves/types`),
  createType: (body: Record<string, unknown>) => api.post<LeaveTypeDTO>(`${P}/leaves/types`, body),
  updateType: (id: string, body: Record<string, unknown>) =>
    api.patch<LeaveTypeDTO>(`${P}/leaves/types/${id}`, body),
  deactivateType: (id: string) => api.delete<{ success: boolean }>(`${P}/leaves/types/${id}`),
  policy: () => api.get<LeavePolicyDTO>(`${P}/leaves/policy`),
  updatePolicy: (body: Partial<LeavePolicyDTO>) => api.put<LeavePolicyDTO>(`${P}/leaves/policy`, body),
  balance: (year?: number) =>
    api.get<LeaveBalanceDTO[]>(`${P}/leaves/balance`, year ? { year } : undefined),
  apply: (body: { typeId: string; startDate: string; endDate: string; reason: string }) =>
    api.post<LeaveRequestDTO>(`${P}/leaves/requests`, body),
  requests: (scope: 'mine' | 'pending' | 'team', year?: number) =>
    api.get<LeaveRequestDTO[]>(`${P}/leaves/requests`, { scope, ...(year ? { year } : {}) }),
  cancel: (id: string) => api.patch<LeaveRequestDTO>(`${P}/leaves/requests/${id}/cancel`, {}),
  approve: (id: string, comment?: string) =>
    api.patch<LeaveRequestDTO>(`${P}/leaves/requests/${id}/approve`, { comment }),
  reject: (id: string, comment?: string) =>
    api.patch<LeaveRequestDTO>(`${P}/leaves/requests/${id}/reject`, { comment }),
  calendar: (month?: string) =>
    api.get<LeaveRequestDTO[]>(`${P}/leaves/calendar`, month ? { month } : undefined),
  exportRequests: (scope: 'mine' | 'pending' | 'team', year?: number) =>
    downloadBlob(
      `${P}/leaves/requests/export?scope=${scope}${year ? `&year=${year}` : ''}`,
      `leave-requests-${scope}.xlsx`,
    ),
};

async function downloadBlob(path: string, filename: string): Promise<void> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Like downloadBlob, but POSTs a JSON body (for server-rendered, non-persisted files). */
async function downloadBlobPost(path: string, body: unknown, filename: string): Promise<void> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = 'Download failed';
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const payrollApi = {
  salary: (userId?: string) =>
    api.get<SalaryStructureDTO | null>(`${P}/payroll/salary`, userId ? { userId } : undefined),
  salaries: () => api.get<EmployeeSalaryRowDTO[]>(`${P}/payroll/salaries`),
  exportSalaries: () => downloadBlob(`${P}/payroll/salaries/export`, 'salaries.xlsx'),
  setSalary: (userId: string, body: Record<string, unknown>) =>
    api.put<SalaryStructureDTO>(`${P}/payroll/salary/${userId}`, body),
  payslips: (userId?: string, year?: number) =>
    api.get<PayslipDTO[]>(`${P}/payroll/payslips`, {
      ...(userId ? { userId } : {}),
      ...(year ? { year } : {}),
    }),
  payslipPdf: (id: string, month: string) => downloadBlob(`${P}/payroll/payslips/${id}/pdf`, `payslip-${month}.pdf`),
  runs: () => api.get<PayrollRunDTO[]>(`${P}/payroll/runs`),
  run: (month: string) => api.post<PayrollRunDTO>(`${P}/payroll/runs`, { month }),
  finalize: (id: string) => api.post<PayrollRunDTO>(`${P}/payroll/runs/${id}/finalize`, {}),
  settings: () => api.get<PayrollSettingsDTO>(`${P}/payroll/settings`),
  updateSettings: (body: Partial<PayrollSettingsDTO>) => api.put<PayrollSettingsDTO>(`${P}/payroll/settings`, body),
  taxCertificate: (userId?: string, year?: number) =>
    api.get<TaxCertificateDTO>(`${P}/payroll/tax/certificate`, {
      ...(userId ? { userId } : {}),
      ...(year ? { year } : {}),
    }),
  taxCertificatePdf: (year?: number) =>
    downloadBlob(`${P}/payroll/tax/certificate/pdf${year ? `?year=${year}` : ''}`, `tax-certificate${year ? `-${year}` : ''}.pdf`),
};

export const auditApi = {
  list: (params: { page?: number; pageSize?: number; action?: string; from?: string; to?: string } = {}) =>
    api.get<Paginated<AuditLogDTO>>(
      `${P}/audit-logs`,
      params as Record<string, string | number | undefined>,
    ),
};

export const approvalsApi = {
  count: () => api.get<ApprovalsCountDTO>(`${P}/approvals/count`),
};

export const notificationsApi = {
  list: (unread = false, limit = 20) =>
    api.get<NotificationDTO[]>(`${P}/notifications`, { unread, limit }),
  count: () => api.get<NotificationCountDTO>(`${P}/notifications/count`),
  markRead: (id: string) => api.patch<NotificationDTO>(`${P}/notifications/${id}/read`, {}),
  markAllRead: () => api.post<{ updated: number }>(`${P}/notifications/read-all`, {}),
  prefs: () => api.get<NotificationPrefsDTO>(`${P}/notifications/preferences`),
  updatePrefs: (email: boolean) => api.patch<NotificationPrefsDTO>(`${P}/notifications/preferences`, { email }),
};

export const announcementsApi = {
  list: () => api.get<AnnouncementDTO[]>(`${P}/announcements`),
  create: (body: { title: string; body: string; pinned?: boolean; expiresAt?: string | null }) =>
    api.post<AnnouncementDTO>(`${P}/announcements`, body),
  update: (id: string, body: Record<string, unknown>) =>
    api.patch<AnnouncementDTO>(`${P}/announcements/${id}`, body),
  remove: (id: string) => api.delete<{ success: boolean }>(`${P}/announcements/${id}`),
  approve: (id: string) => api.post<AnnouncementDTO>(`${P}/announcements/${id}/approve`, {}),
  reject: (id: string, note?: string) => api.post<AnnouncementDTO>(`${P}/announcements/${id}/reject`, { note }),
  markAllRead: () => api.post<{ updated: number }>(`${P}/announcements/read-all`, {}),
};

export const teamsApi = {
  list: () => api.get<TeamDTO[]>(`${P}/teams`),
  create: (body: { name: string; description?: string; leadIds?: string[]; memberIds?: string[] }) =>
    api.post<TeamDTO>(`${P}/teams`, body),
  update: (id: string, body: { name?: string; description?: string | null; leadIds?: string[] }) =>
    api.patch<TeamDTO>(`${P}/teams/${id}`, body),
  remove: (id: string) => api.delete<{ success: boolean }>(`${P}/teams/${id}`),
  addMember: (id: string, userId: string) => api.post<TeamDTO>(`${P}/teams/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) => api.delete<TeamDTO>(`${P}/teams/${id}/members/${userId}`),
};

export const expensesApi = {
  categories: () => api.get<ExpenseCategoryDTO[]>(`${P}/expenses/categories`),
  createCategory: (body: Record<string, unknown>) =>
    api.post<ExpenseCategoryDTO>(`${P}/expenses/categories`, body),
  updateCategory: (id: string, body: Record<string, unknown>) =>
    api.patch<ExpenseCategoryDTO>(`${P}/expenses/categories/${id}`, body),
  deactivateCategory: (id: string) => api.delete<{ success: boolean }>(`${P}/expenses/categories/${id}`),
  policy: () => api.get<ExpensePolicyDTO>(`${P}/expenses/policy`),
  updatePolicy: (body: Partial<ExpensePolicyDTO>) =>
    api.put<ExpensePolicyDTO>(`${P}/expenses/policy`, body),
  claims: (scope: 'mine' | 'pending' | 'team', year?: number) =>
    api.get<ExpenseClaimDTO[]>(`${P}/expenses/claims`, { scope, ...(year ? { year } : {}) }),
  create: (body: Record<string, unknown>) => api.post<ExpenseClaimDTO>(`${P}/expenses/claims`, body),
  submit: (id: string) => api.patch<ExpenseClaimDTO>(`${P}/expenses/claims/${id}/submit`, {}),
  approve: (id: string, note?: string) =>
    api.patch<ExpenseClaimDTO>(`${P}/expenses/claims/${id}/approve`, { note }),
  reject: (id: string, note?: string) =>
    api.patch<ExpenseClaimDTO>(`${P}/expenses/claims/${id}/reject`, { note }),
  reimburse: (id: string) => api.patch<ExpenseClaimDTO>(`${P}/expenses/claims/${id}/reimburse`, {}),
  exportClaims: (scope: 'mine' | 'pending' | 'team', year?: number) =>
    downloadBlob(
      `${P}/expenses/claims/export?scope=${scope}${year ? `&year=${year}` : ''}`,
      `expense-claims-${scope}.xlsx`,
    ),
};

/** Scope for the routable-request lists (complaints, inventory). */
export type RequestScope = 'mine' | 'inbox' | 'all';

export const complaintsApi = {
  categories: () => api.get<ComplaintCategoryDTO[]>(`${P}/complaints/categories`),
  createCategory: (body: Record<string, unknown>) =>
    api.post<ComplaintCategoryDTO>(`${P}/complaints/categories`, body),
  updateCategory: (id: string, body: Record<string, unknown>) =>
    api.patch<ComplaintCategoryDTO>(`${P}/complaints/categories/${id}`, body),
  deactivateCategory: (id: string) => api.delete<{ success: boolean }>(`${P}/complaints/categories/${id}`),
  list: (scope: RequestScope) => api.get<ComplaintDTO[]>(`${P}/complaints`, { scope }),
  get: (id: string) => api.get<ComplaintDTO>(`${P}/complaints/${id}`),
  create: (body: { categoryId: string; subject: string; reason: string; details?: string }) =>
    api.post<ComplaintDTO>(`${P}/complaints`, body),
  decide: (id: string, body: { action: RequestAction; note?: string }) =>
    api.patch<ComplaintDTO>(`${P}/complaints/${id}/decide`, body),
  exportList: (scope: RequestScope) =>
    downloadBlob(`${P}/complaints/export?scope=${scope}`, `complaints-${scope}.xlsx`),
};

export const inventoryApi = {
  categories: () => api.get<InventoryCategoryDTO[]>(`${P}/inventory-requests/categories`),
  createCategory: (body: Record<string, unknown>) =>
    api.post<InventoryCategoryDTO>(`${P}/inventory-requests/categories`, body),
  updateCategory: (id: string, body: Record<string, unknown>) =>
    api.patch<InventoryCategoryDTO>(`${P}/inventory-requests/categories/${id}`, body),
  deactivateCategory: (id: string) => api.delete<{ success: boolean }>(`${P}/inventory-requests/categories/${id}`),
  list: (scope: RequestScope) => api.get<InventoryRequestDTO[]>(`${P}/inventory-requests`, { scope }),
  get: (id: string) => api.get<InventoryRequestDTO>(`${P}/inventory-requests/${id}`),
  create: (body: { categoryId: string; itemName: string; quantity: number; neededBy?: string; reason: string; details?: string }) =>
    api.post<InventoryRequestDTO>(`${P}/inventory-requests`, body),
  decide: (id: string, body: { action: RequestAction; note?: string }) =>
    api.patch<InventoryRequestDTO>(`${P}/inventory-requests/${id}/decide`, body),
  exportList: (scope: RequestScope) =>
    downloadBlob(`${P}/inventory-requests/export?scope=${scope}`, `inventory-requests-${scope}.xlsx`),
};

export const businessCardApi = {
  myCard: () => api.get<BusinessCardDTO>(`${P}/business-card`),
  company: () => api.get<CompanyProfileDTO>(`${P}/business-card/company`),
  updateCompany: (body: Partial<CompanyProfileDTO>) => api.put<CompanyProfileDTO>(`${P}/business-card/company`, body),
  downloadVcard: () => downloadBlob(`${P}/business-card/vcard`, 'contact.vcf'),
  downloadPdf: () => downloadBlob(`${P}/business-card/pdf`, 'business-card.pdf'),
};

/**
 * Owner/Admin letters. Reusable templates are saved; a letter is produced by
 * filling a template in for a recipient, then downloaded or emailed (not saved).
 */
export const lettersApi = {
  listTemplates: () => api.get<LetterTemplateDTO[]>(`${P}/letters/templates`),
  getTemplate: (id: string) => api.get<LetterTemplateDTO>(`${P}/letters/templates/${id}`),
  createTemplate: (body: Record<string, unknown>) => api.post<LetterTemplateDTO>(`${P}/letters/templates`, body),
  updateTemplate: (id: string, body: Record<string, unknown>) => api.patch<LetterTemplateDTO>(`${P}/letters/templates/${id}`, body),
  removeTemplate: (id: string) => api.delete<{ success: boolean }>(`${P}/letters/templates/${id}`),
  render: (body: Record<string, unknown>, filename: string) => downloadBlobPost(`${P}/letters/render`, body, filename),
  email: (body: Record<string, unknown>) => api.post<{ success: boolean }>(`${P}/letters/email`, body),
};

/** Format a money amount as "PKR 123,456". */
export function fmtMoney(amount: number | null | undefined, currency = 'PKR'): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `${currency} ${new Intl.NumberFormat('en-US').format(Math.round(amount))}`;
}

/** Format minutes as "8h 05m". */
export function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
