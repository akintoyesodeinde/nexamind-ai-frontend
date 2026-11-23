import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/AuthContext';
import { AppRoutes } from '@/app/App';
import { authService, tenantService } from '@/services/platform';
import { knowledgeService } from '@/services/knowledge';
import {
  agentService,
  analyticsService,
  approvalService,
  evaluationService,
  securityAuditService,
  workflowService,
} from '@/services/phase4';
import type { MePayload } from '@/types/api';

vi.mock('@/services/platform', () => ({
  authService: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
  },
  tenantService: {
    createTenant: vi.fn(),
    getCurrent: vi.fn(),
    updateSettings: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    updateMember: vi.fn(),
    removeMember: vi.fn(),
    listRoles: vi.fn(),
    listAuditLogs: vi.fn(),
  },
}));

vi.mock('@/services/knowledge', () => ({
  knowledgeService: {
    list: vi.fn(),
  },
  documentService: {
    list: vi.fn(),
  },
}));

vi.mock('@/services/phase4', () => ({
  agentService: {
    toolsCatalog: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    launchRun: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    cancelRun: vi.fn(),
  },
  workflowService: {
    listDefinitions: vi.fn(),
    seedComplianceTemplate: vi.fn(),
    createDefinition: vi.fn(),
    launchRun: vi.fn(),
    listRuns: vi.fn(),
  },
  approvalService: {
    list: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
  analyticsService: {
    overview: vi.fn(),
    usage: vi.fn(),
  },
  evaluationService: {
    listDatasets: vi.fn(),
    seedBenchmark: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    triggerRun: vi.fn(),
  },
  securityAuditService: {
    listAuditLogs: vi.fn(),
    listSecurityEvents: vi.fn(),
    verifyChain: vi.fn(),
  },
}));

const OWNER_ME: MePayload = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Amina Owner',
    email: 'amina@acme.test',
    job_title: 'VP Compliance',
    timezone: 'UTC',
    locale: 'en-US',
    status: 'active',
    preferences: {},
    last_login_at: null,
    created_at: '2026-11-23T00:00:00.000Z',
  },
  memberships: [
    {
      membership_id: '22222222-2222-4222-8222-222222222222',
      tenant: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Acme Enterprise',
        slug: 'acme-enterprise',
        plan: 'sandbox',
        status: 'active',
        created_at: '2026-11-23T00:00:00.000Z',
      },
      role: 'owner',
      role_name: 'Owner',
      status: 'active',
      permissions: [
        'agents.manage',
        'workflows.manage',
        'approvals.act',
        'analytics.view',
        'audit.view',
        'chat.ask',
        'users.manage',
        'tenant.settings.manage',
      ],
      joined_at: '2026-11-23T00:00:00.000Z',
    },
  ],
};

function renderAt(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Phase 4 Frontend — Agents, Workflows, Approvals, Analytics, Evaluations & Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(authService.me).mockResolvedValue(OWNER_ME);
    vi.mocked(knowledgeService.list).mockResolvedValue([]);
    vi.mocked(tenantService.listAuditLogs).mockResolvedValue({
      data: [],
      meta: { request_id: 'r1', timestamp: '2026-11-23T00:00:00.000Z' },
    });
    vi.mocked(workflowService.listDefinitions).mockResolvedValue([]);
    vi.mocked(workflowService.listRuns).mockResolvedValue([]);
    vi.mocked(analyticsService.overview).mockResolvedValue({
      window_days: 30,
      budget: {
        monthly_tokens_used: 1200,
        monthly_token_budget: 500000,
        token_utilization_pct: 0.24,
        monthly_cost_usd: '0.004500',
        monthly_cost_budget_usd: '25.000000',
        cost_utilization_pct: 0.02,
      },
      ai_usage: {
        total_requests: 8,
        total_tokens: 1200,
        total_cost_usd: '0.004500',
        avg_latency_ms: 42,
        verified_citations_count: 14,
        abstention_rate_pct: 12.5,
        positive_feedback_count: 5,
        negative_feedback_count: 0,
      },
      knowledge: { knowledge_bases_count: 2, documents_ready_count: 4, documents_total_count: 4 },
      automation: {
        agent_runs_total: 3,
        workflow_runs_total: 2,
        workflows_completed: 1,
        pending_approvals_count: 1,
        approvals_approved: 1,
        approvals_rejected: 0,
      },
      evaluation: {
        latest_run_id: 'eval-1',
        citation_correctness_pct: 100,
        groundedness_score_pct: 100,
        abstention_accuracy_pct: 100,
      },
    });
  });

  it('renders AI Agent Studio with allowlisted tools and creates a governed agent', async () => {
    vi.mocked(agentService.toolsCatalog).mockResolvedValue([
      {
        name: 'search_knowledge_base',
        description: 'ACL-enforced vector search',
        requires_approval: false,
        risk_level: 'low',
        input_schema: {},
      },
      {
        name: 'publish_approved_report',
        description: 'Requires verified approved record',
        requires_approval: true,
        risk_level: 'high',
        input_schema: {},
      },
    ]);
    vi.mocked(agentService.list).mockResolvedValue([]);
    vi.mocked(agentService.create).mockResolvedValue({
      id: 'ag-1',
      name: 'Compliance Bot',
      slug: 'compliance-bot',
      description: 'Audits policies',
      system_prompt: 'Cite everything.',
      model_alias: 'default-chat',
      allowed_kb_ids: [],
      max_steps: 8,
      max_tokens_per_run: 12000,
      require_approval: true,
      status: 'active',
      tools: [],
      created_at: '2026-11-23T00:00:00.000Z',
      updated_at: '2026-11-23T00:00:00.000Z',
    });

    const user = userEvent.setup();
    renderAt('/agents');

    expect(await screen.findByText(/Hard Tool Security Invariant Active/i)).toBeInTheDocument();
    expect(await screen.findByText('search_knowledge_base')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Agent Name/i), 'Compliance Bot');
    await user.click(screen.getByRole('button', { name: /Create Governed Agent/i }));

    await waitFor(
      () => {
        expect(agentService.create).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Compliance Bot', require_approval: true }),
        );
      },
      { timeout: 10000 },
    );
  });

  it('renders Approval Inbox with cited compliance draft and approves idempotently', async () => {
    const pendingReq = {
      id: 'app-1',
      workflow_run_id: 'wfr-1',
      agent_run_id: 'agr-1',
      requested_by: 'u1',
      requester_name: 'Amina Owner',
      requester_email: 'amina@acme.test',
      assigned_approver_id: null,
      required_role: 'manager',
      title: 'Q4 Compliance Report',
      action_type: 'publish_approved_report',
      summary: 'All remote work controls verified [1].',
      payload: {
        report: {
          executive_summary: 'All remote work controls verified [1].',
          citations: [
            {
              citation_index: 1,
              document_name: 'hr-remote-policy.txt',
              page_number: 1,
              excerpt: 'Employees may work remotely up to 3 days per week.',
            },
          ],
        },
      },
      status: 'pending' as const,
      decided_by: null,
      decider_name: null,
      decision_note: null,
      decided_at: null,
      created_at: '2026-11-23T00:00:00.000Z',
      updated_at: '2026-11-23T00:00:00.000Z',
    };

    vi.mocked(approvalService.list).mockResolvedValue([pendingReq]);
    vi.mocked(approvalService.approve).mockResolvedValue({
      approval: { ...pendingReq, status: 'approved', decider_name: 'Amina Owner' },
      already_decided: false,
      published_artifact: { published: true },
    });

    const user = userEvent.setup();
    renderAt('/approvals');

    expect(await screen.findByText(/hr-remote-policy\.txt/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Approval rationale note/i), 'Verified citations.');
    await user.click(screen.getByRole('button', { name: /Approve & Publish Report/i }));

    expect(
      await screen.findByText(/Verified compliance artifact published/i),
    ).toBeInTheDocument();
  });

  it('renders AI Evaluation Dashboard scorecard and Security Audit hash chain verification', async () => {
    vi.mocked(evaluationService.listDatasets).mockResolvedValue([
      {
        id: 'ds-1',
        name: 'Enterprise Policy & Abstention Benchmark',
        description: 'Curated QA + abstention',
        knowledge_base_ids: [],
        cases_count: 3,
        created_at: '2026-11-23T00:00:00.000Z',
        updated_at: '2026-11-23T00:00:00.000Z',
      },
    ]);
    vi.mocked(evaluationService.listRuns).mockResolvedValue([
      {
        id: 'evr-1',
        dataset_id: 'ds-1',
        dataset_name: 'Enterprise Policy & Abstention Benchmark',
        model_alias: 'default-chat',
        status: 'completed',
        total_cases: 3,
        passed_cases: 3,
        citation_correctness_pct: 100,
        groundedness_score_pct: 100,
        abstention_accuracy_pct: 100,
        meets_citation_target: true,
        avg_latency_ms: 28,
        total_cost_usd: '0.000200',
        created_at: '2026-11-23T00:00:00.000Z',
        completed_at: '2026-11-23T00:00:00.000Z',
      },
    ]);
    vi.mocked(evaluationService.getRun).mockResolvedValue({
      id: 'evr-1',
      dataset_id: 'ds-1',
      dataset_name: 'Enterprise Policy & Abstention Benchmark',
      model_alias: 'default-chat',
      status: 'completed',
      total_cases: 3,
      passed_cases: 3,
      citation_correctness_pct: 100,
      groundedness_score_pct: 100,
      abstention_accuracy_pct: 100,
      meets_citation_target: true,
      avg_latency_ms: 28,
      total_cost_usd: '0.000200',
      created_at: '2026-11-23T00:00:00.000Z',
      completed_at: '2026-11-23T00:00:00.000Z',
      case_results: [],
    });

    renderAt('/evaluations');
    expect(await screen.findByText(/>= 95% Target Met/i)).toBeInTheDocument();

    vi.mocked(securityAuditService.listAuditLogs).mockResolvedValue({
      data: [
        {
          id: 'al-1',
          action: 'approvals.approved',
          resource_type: 'approval_request',
          resource_id: 'app-1',
          actor_email: 'amina@acme.test',
          actor_name: 'Amina Owner',
          request_id: 'req-1',
          ip_address: '127.0.0.1',
          record_hash_prefix: 'a1b2c3d4e5f6',
          metadata: {},
          created_at: '2026-11-23T00:00:00.000Z',
        },
      ],
      meta: { request_id: 'req-1', timestamp: '2026-11-23T00:00:00.000Z' },
    });
    vi.mocked(securityAuditService.listSecurityEvents).mockResolvedValue({
      data: [
        {
          id: 'se-1',
          event_type: 'agent.unlisted_tool_blocked',
          severity: 'critical',
          summary: 'Blocked attempt to invoke execute_sql',
          actor_email: 'amina@acme.test',
          actor_name: 'Amina Owner',
          request_id: 'req-2',
          ip_address: '127.0.0.1',
          details: {},
          created_at: '2026-11-23T00:00:00.000Z',
        },
      ],
      meta: { request_id: 'req-2', timestamp: '2026-11-23T00:00:00.000Z' },
    });
    vi.mocked(securityAuditService.verifyChain).mockResolvedValue({
      tenant_id: '33333333-3333-4333-8333-333333333333',
      chain_valid: true,
      records_verified: 12,
      verified_at: '2026-11-23T00:00:00.000Z',
    });

    const user = userEvent.setup();
    renderAt('/security/audit');
    expect(await screen.findByText('approvals.approved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Verify Hash Chain/i }));
    expect(
      await screen.findByText(/SHA-256 Audit Chain Integrity Verified/i),
    ).toBeInTheDocument();
  });
});
