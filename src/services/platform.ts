import { apiRequest, ensureCsrfCookie, resetCsrfState } from '@/lib/api';
import type {
  AuditLogEntry,
  CurrentTenantPayload,
  MePayload,
  RoleDefinition,
  RoleSlug,
  TenantMember,
  TenantSettings,
  TenantSummary,
  User,
  UserPreferences,
} from '@/types/api';

export const authService = {
  async me() {
    const res = await apiRequest<MePayload>('/me', { skipTenantHeader: true });
    return res.data;
  },

  async register(input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    job_title?: string;
  }) {
    await ensureCsrfCookie();
    const res = await apiRequest<MePayload>('/auth/register', {
      method: 'POST',
      body: input,
      skipTenantHeader: true,
    });
    return res.data;
  },

  async login(input: { email: string; password: string; remember?: boolean }) {
    await ensureCsrfCookie();
    const res = await apiRequest<MePayload>('/auth/login', {
      method: 'POST',
      body: input,
      skipTenantHeader: true,
    });
    return res.data;
  },

  async logout() {
    await apiRequest<null>('/auth/logout', {
      method: 'POST',
      skipTenantHeader: true,
    });
    resetCsrfState();
  },

  async updateProfile(input: {
    name: string;
    job_title?: string | null;
    timezone: string;
    locale: string;
    preferences?: UserPreferences;
  }) {
    const res = await apiRequest<User>('/me/profile', {
      method: 'PATCH',
      body: input,
      skipTenantHeader: true,
    });
    return res.data;
  },
};

export const tenantService = {
  async createTenant(input: { name: string; slug?: string }) {
    const res = await apiRequest<{ tenant: TenantSummary }>('/tenants', {
      method: 'POST',
      body: input,
      skipTenantHeader: true,
    });
    return res.data;
  },

  async getCurrent() {
    const res = await apiRequest<CurrentTenantPayload>('/tenants/current');
    return res.data;
  },

  async updateSettings(input: Partial<Omit<TenantSettings, 'updated_at'>>) {
    const res = await apiRequest<TenantSettings>('/tenants/current/settings', {
      method: 'PATCH',
      body: input,
    });
    return res.data;
  },

  async listMembers() {
    const res = await apiRequest<TenantMember[]>('/tenants/current/members');
    return res.data;
  },

  async addMember(input: { email: string; name?: string; role_slug: RoleSlug }) {
    const res = await apiRequest<TenantMember>('/tenants/current/members', {
      method: 'POST',
      body: input,
    });
    return res.data;
  },

  async updateMember(
    membershipId: string,
    input: { role_slug?: RoleSlug; status?: 'active' | 'invited' | 'suspended' },
  ) {
    const res = await apiRequest<TenantMember>(
      `/tenants/current/members/${membershipId}`,
      {
        method: 'PATCH',
        body: input,
      },
    );
    return res.data;
  },

  async removeMember(membershipId: string) {
    await apiRequest<null>(`/tenants/current/members/${membershipId}`, {
      method: 'DELETE',
    });
  },

  async listRoles() {
    const res = await apiRequest<RoleDefinition[]>('/roles');
    return res.data;
  },

  async listAuditLogs(page = 1) {
    return apiRequest<AuditLogEntry[]>(`/audit-logs?page=${page}`);
  },
};
