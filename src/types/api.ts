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

export interface KnowledgeBase {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'tenant' | 'restricted';
  status: 'active' | 'archived';
  created_by: string;
  documents_count: number;
  created_at: string;
  updated_at: string;
}

export interface AclGrant {
  id?: string;
  principal_type: 'user' | 'role';
  principal_id: string;
  permission_level: 'read' | 'write' | 'admin' | 'deny';
  created_at?: string;
}

export interface DocumentRecord {
  id: string;
  knowledge_base_id: string;
  uploaded_by: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  current_version: number;
  access_policy: 'inherit' | 'restricted';
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'deleted';
  page_count: number | null;
  chunk_count: number;
  character_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  checksum_sha256: string;
  uploaded_by: string;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  document_version_id: string;
  chunk_index: number;
  page_number: number | null;
  section_heading: string | null;
  char_start: number;
  char_end: number;
  token_estimate: number;
  content: string;
  embedding_model: string | null;
  created_at: string;
}

export interface RetrievalHit {
  chunk_id: string;
  document_id: string;
  knowledge_base_id: string;
  filename: string;
  page_number: number | null;
  section_heading: string | null;
  content: string;
  score: number;
}

export interface RetrievalSearchResponse {
  adapter: string;
  query: string;
  authorized_document_count: number;
  results: RetrievalHit[];
}

export interface AiModel {
  id: string;
  alias: string;
  provider_model_name: string;
  provider_key: string;
  capability: 'chat' | 'embedding';
  max_context_tokens: number;
  input_cost_per_1k_usd: string;
  output_cost_per_1k_usd: string;
  is_active: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  default_model_alias: string;
  knowledge_base_ids: string[];
  status: 'active' | 'archived';
  messages_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageCitation {
  index: number;
  document_id: string;
  document_name: string;
  page: number | null;
  section_heading: string | null;
  chunk_id: string;
  excerpt: string;
  similarity_score: number;
  verified: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_alias: string | null;
  status: 'streaming' | 'completed' | 'abstained' | 'failed';
  abstained: boolean;
  citations: MessageCitation[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  cost_usd: string;
  latency_ms: number;
  feedback: 'positive' | 'negative' | null;
  feedback_note: string | null;
  created_at: string;
}

export interface AskResponse {
  conversation_id: string;
  user_message_id: string;
  message_id: string;
  answer: string;
  citations: MessageCitation[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  cost_usd: string;
  latency_ms: number;
  abstained: boolean;
  status: 'completed' | 'abstained' | 'failed';
}

export interface DocumentAnalysisResponse {
  document_id: string;
  filename: string;
  action: 'summarize' | 'classify' | 'extract_structured';
  result: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
  cost_usd: string;
  latency_ms: number;
}

export interface DocumentCompareResponse {
  document_a: { id: string; filename: string };
  document_b: { id: string; filename: string };
  comparison: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
  cost_usd: string;
  latency_ms: number;
}
