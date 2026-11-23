export type RoleSlug = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface ApiMeta {
  request_id: string;
  timestamp: string;
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: ApiMeta;
}

export interface UserPreferences {
  density?: 'comfortable' | 'compact';
  citations_expanded_by_default?: boolean;
  email_approvals_digest?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  job_title: string | null;
  timezone: string;
  locale: string;
  status: 'active' | 'suspended';
  preferences: UserPreferences;
  last_login_at: string | null;
  created_at: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface TenantMembershipSummary {
  membership_id: string;
  tenant: TenantSummary;
  role: RoleSlug;
  role_name: string;
  status: 'active' | 'invited' | 'suspended';
  permissions: string[];
  joined_at: string | null;
}

export interface MePayload {
  user: User;
  memberships: TenantMembershipSummary[];
}

export interface TenantSettings {
  default_chat_model: string;
  default_embedding_model: string;
  max_upload_mb: number;
  monthly_token_budget: number;
  monthly_cost_budget_usd: string;
  allowed_file_types: string[];
  retention_days: number;
  require_approval_for_external_actions: boolean;
  updated_at: string;
}

export interface CurrentTenantPayload {
  tenant: TenantSummary;
  settings: TenantSettings;
  current_role: RoleSlug;
  permissions: string[];
  stats: {
    members_count: number;
    audit_events_last_24h: number;
    knowledge_bases_count: number;
    documents_count: number;
    pending_approvals_count: number;
  };
}

export interface TenantMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  job_title: string | null;
  role: RoleSlug;
  role_name: string;
  status: 'active' | 'invited' | 'suspended';
  joined_at: string | null;
  created_at: string;
}

export interface RoleDefinition {
  id: string;
  slug: RoleSlug;
  name: string;
  description: string;
  permissions: string[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  request_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
