import { apiRequest } from '@/lib/api';

export interface AgentToolCatalogItem {
  name: string;
  description: string;
  requires_approval: boolean;
  risk_level: string;
  input_schema: Record<string, unknown>;
}

export interface AgentToolBinding {
  id: string;
  tool_name: string;
  is_enabled: boolean;
  requires_approval: boolean;
  config: Record<string, unknown>;
}

export interface AgentRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  system_prompt: string;
  model_alias: string;
  allowed_kb_ids: string[];
  max_steps: number;
  max_tokens_per_run: number;
  require_approval: boolean;
  status: 'active' | 'disabled';
  tools: AgentToolBinding[];
  created_at: string;
  updated_at: string;
}

export interface AgentStepRecord {
  id: string;
  step_number: number;
  step_type: string;
  tool_name: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'completed' | 'blocked' | 'failed' | 'awaiting_approval';
  tokens_used: number;
  latency_ms: number;
  error_message: string | null;
  created_at: string;
}

export interface AgentRunRecord {
  id: string;
  agent_id: string;
  agent_name: string | null;
  triggered_by: string | null;
  goal: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  step_count: number;
  total_tokens: number;
  cost_usd: string;
  latency_ms: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  steps?: AgentStepRecord[];
}

export interface WorkflowDefinitionRecord {
  id: string;
  agent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  workflow_type: string;
  steps_definition: Array<{ key: string; name: string; type: string }>;
  approver_role: string;
  is_active: boolean;
  runs_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepRecord {
  id: string;
  step_order: number;
  step_key: string;
  name: string;
  status: 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'rejected' | 'failed' | 'skipped';
  payload: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowRunRecord {
  id: string;
  workflow_definition_id: string;
  workflow_name: string | null;
  agent_run_id: string | null;
  triggered_by: string | null;
  status: 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  approval_request_id: string | null;
  approval_status: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  steps?: WorkflowStepRecord[];
}

export interface ApprovalRequestRecord {
  id: string;
  workflow_run_id: string | null;
  agent_run_id: string | null;
  requested_by: string | null;
  requester_name: string | null;
  requester_email: string | null;
  assigned_approver_id: string | null;
  required_role: string;
  title: string;
  action_type: string;
  summary: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decided_by: string | null;
  decider_name: string | null;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsOverviewPayload {
  window_days: number;
  budget: {
    monthly_tokens_used: number;
    monthly_token_budget: number;
    token_utilization_pct: number;
    monthly_cost_usd: string;
    monthly_cost_budget_usd: string;
    cost_utilization_pct: number;
  };
  ai_usage: {
    total_requests: number;
    total_tokens: number;
    total_cost_usd: string;
    avg_latency_ms: number;
    verified_citations_count: number;
    abstention_rate_pct: number;
    positive_feedback_count: number;
    negative_feedback_count: number;
  };
  knowledge: {
    knowledge_bases_count: number;
    documents_ready_count: number;
    documents_total_count: number;
  };
  automation: {
    agent_runs_total: number;
    workflow_runs_total: number;
    workflows_completed: number;
    pending_approvals_count: number;
    approvals_approved: number;
    approvals_rejected: number;
  };
  evaluation: {
    latest_run_id: string | null;
    citation_correctness_pct: number | null;
    groundedness_score_pct: number | null;
    abstention_accuracy_pct: number | null;
  };
}

export interface AnalyticsUsagePayload {
  window_days: number;
  by_model: Array<{
    model_alias: string;
    provider_key: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: string;
    avg_latency_ms: number;
  }>;
  by_operation: Array<{
    operation_type: string;
    requests: number;
    total_tokens: number;
    cost_usd: string;
  }>;
  daily_trend: Array<{
    date: string;
    requests: number;
    total_tokens: number;
    cost_usd: string;
  }>;
  top_consumers: Array<{
    user_id: string;
    name: string;
    email: string;
    requests: number;
    total_tokens: number;
    cost_usd: string;
  }>;
}

export interface EvaluationCaseRecord {
  id: string;
  category: string;
  question: string;
  expected_keywords: string[];
  expect_abstention: boolean;
  require_citations: boolean;
}

export interface EvaluationDatasetRecord {
  id: string;
  name: string;
  description: string | null;
  knowledge_base_ids: string[];
  cases_count: number;
  cases?: EvaluationCaseRecord[];
  created_at: string;
  updated_at: string;
}

export interface EvaluationCaseResult {
  case_id: string;
  category: string;
  question: string;
  expect_abstention: boolean;
  abstained: boolean;
  answer_preview: string;
  verified_citations_count: number;
  unverified_citations_stripped: number;
  citation_correct: boolean;
  groundedness_pct: number;
  passed: boolean;
  latency_ms: number;
  cost_usd: string;
}

export interface EvaluationRunRecord {
  id: string;
  dataset_id: string;
  dataset_name: string | null;
  model_alias: string;
  status: string;
  total_cases: number;
  passed_cases: number;
  citation_correctness_pct: number;
  groundedness_score_pct: number;
  abstention_accuracy_pct: number;
  meets_citation_target: boolean;
  avg_latency_ms: number;
  total_cost_usd: string;
  created_at: string;
  completed_at: string | null;
  case_results?: EvaluationCaseResult[];
}

export interface SecurityEventEntry {
  id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  actor_email: string | null;
  actor_name: string | null;
  request_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditChainVerification {
  tenant_id: string;
  chain_valid: boolean;
  records_verified: number;
  verified_at: string;
}

export interface EnhancedAuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  request_id: string | null;
  ip_address: string | null;
  record_hash_prefix?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function generateIdempotencyKey(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

export const agentService = {
  async toolsCatalog() {
    const res = await apiRequest<AgentToolCatalogItem[]>('/agents/tools');
    return res.data;
  },
  async list() {
    const res = await apiRequest<AgentRecord[]>('/agents');
    return res.data;
  },
  async create(input: {
    name: string;
    description?: string;
    system_prompt: string;
    model_alias?: string;
    allowed_kb_ids?: string[];
    max_steps?: number;
    max_tokens_per_run?: number;
    require_approval?: boolean;
    tools?: string[];
  }) {
    const res = await apiRequest<AgentRecord>('/agents', { method: 'POST', body: input });
    return res.data;
  },
  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      system_prompt: string;
      max_steps: number;
      require_approval: boolean;
      status: 'active' | 'disabled';
      tools: string[];
    }>,
  ) {
    const res = await apiRequest<AgentRecord>(`/agents/${id}`, { method: 'PATCH', body: input });
    return res.data;
  },
  async launchRun(agentId: string, input: { goal: string; report_title?: string; knowledge_base_ids?: string[] }) {
    const res = await apiRequest<AgentRunRecord>(`/agents/${agentId}/runs`, {
      method: 'POST',
      body: input,
      idempotencyKey: generateIdempotencyKey(`agent-run-${agentId}`),
    });
    return res.data;
  },
  async listRuns(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await apiRequest<AgentRunRecord[]>(`/agents/runs${query}`);
    return res.data;
  },
  async getRun(runId: string) {
    const res = await apiRequest<AgentRunRecord>(`/agents/runs/${runId}`);
    return res.data;
  },
  async cancelRun(runId: string) {
    const res = await apiRequest<AgentRunRecord>(`/agents/runs/${runId}/cancel`, { method: 'POST' });
    return res.data;
  },
};

export const workflowService = {
  async listDefinitions() {
    const res = await apiRequest<WorkflowDefinitionRecord[]>('/workflows');
    return res.data;
  },
  async seedComplianceTemplate() {
    const res = await apiRequest<WorkflowDefinitionRecord>('/workflows/templates/compliance-report', {
      method: 'POST',
    });
    return res.data;
  },
  async createDefinition(input: {
    name: string;
    description?: string;
    workflow_type?: string;
    agent_id?: string | null;
    approver_role?: string;
  }) {
    const res = await apiRequest<WorkflowDefinitionRecord>('/workflows', { method: 'POST', body: input });
    return res.data;
  },
  async launchRun(
    definitionId: string,
    input: { goal?: string; report_title?: string; knowledge_base_ids?: string[] },
  ) {
    const res = await apiRequest<WorkflowRunRecord>(`/workflows/${definitionId}/runs`, {
      method: 'POST',
      body: input,
      idempotencyKey: generateIdempotencyKey(`wf-run-${definitionId}`),
    });
    return res.data;
  },
  async listRuns() {
    const res = await apiRequest<WorkflowRunRecord[]>('/workflows/runs');
    return res.data;
  },
};

export const approvalService = {
  async list(status?: string) {
    const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    const res = await apiRequest<ApprovalRequestRecord[]>(`/approvals${query}`);
    return res.data;
  },
  async approve(id: string, note?: string, idempotencyKey?: string) {
    const res = await apiRequest<{
      approval: ApprovalRequestRecord;
      already_decided: boolean;
      published_artifact: Record<string, unknown> | null;
    }>(`/approvals/${id}/approve`, {
      method: 'POST',
      body: { note: note || null },
      idempotencyKey: idempotencyKey ?? generateIdempotencyKey(`approve-${id}`),
    });
    return res.data;
  },
  async reject(id: string, note?: string, idempotencyKey?: string) {
    const res = await apiRequest<{
      approval: ApprovalRequestRecord;
      already_decided: boolean;
    }>(`/approvals/${id}/reject`, {
      method: 'POST',
      body: { note: note || null },
      idempotencyKey: idempotencyKey ?? generateIdempotencyKey(`reject-${id}`),
    });
    return res.data;
  },
};

export const analyticsService = {
  async overview(days = 30) {
    const res = await apiRequest<AnalyticsOverviewPayload>(`/analytics/overview?days=${days}`);
    return res.data;
  },
  async usage(days = 30) {
    const res = await apiRequest<AnalyticsUsagePayload>(`/analytics/usage?days=${days}`);
    return res.data;
  },
};

export const evaluationService = {
  async listDatasets() {
    const res = await apiRequest<EvaluationDatasetRecord[]>('/evaluations/datasets');
    return res.data;
  },
  async seedBenchmark(knowledgeBaseIds: string[] = []) {
    const res = await apiRequest<EvaluationDatasetRecord>('/evaluations/datasets/seed-benchmark', {
      method: 'POST',
      body: { knowledge_base_ids: knowledgeBaseIds },
    });
    return res.data;
  },
  async listRuns() {
    const res = await apiRequest<EvaluationRunRecord[]>('/evaluations/runs');
    return res.data;
  },
  async getRun(runId: string) {
    const res = await apiRequest<EvaluationRunRecord>(`/evaluations/runs/${runId}`);
    return res.data;
  },
  async triggerRun(datasetId: string, modelAlias?: string) {
    const res = await apiRequest<EvaluationRunRecord>('/evaluations/runs', {
      method: 'POST',
      body: { dataset_id: datasetId, ...(modelAlias ? { model_alias: modelAlias } : {}) },
    });
    return res.data;
  },
};

export const securityAuditService = {
  async listAuditLogs(params: { page?: number; action?: string; resource_type?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.action) qs.set('action', params.action);
    if (params.resource_type) qs.set('resource_type', params.resource_type);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<EnhancedAuditLogEntry[]>(`/audit-logs${suffix}`);
  },
  async listSecurityEvents(params: { page?: number; severity?: string; event_type?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.severity && params.severity !== 'all') qs.set('severity', params.severity);
    if (params.event_type) qs.set('event_type', params.event_type);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<SecurityEventEntry[]>(`/security-events${suffix}`);
  },
  async verifyChain() {
    const res = await apiRequest<AuditChainVerification>('/audit-logs/verify-chain');
    return res.data;
  },
};
