import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/AuthContext';
import { AppRoutes } from '@/app/App';
import { authService, tenantService } from '@/services/platform';
import type { CurrentTenantPayload, MePayload } from '@/types/api';

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

describe('Phase 1 Frontend — Auth, Onboarding & Dashboard Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('validates login form inputs before submitting', async () => {
    vi.mocked(authService.me).mockRejectedValue(new Error('Unauthenticated'));
    const user = userEvent.setup();

    renderAt('/login');

    await user.click(await screen.findByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid work email/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users from /dashboard to /login', async () => {
    vi.mocked(authService.me).mockRejectedValue(new Error('Unauthenticated'));

    renderAt('/dashboard');

    expect(await screen.findByText(/sign in to your workspace/i)).toBeInTheDocument();
  });

  it('renders tenant dashboard and role-gated navigation for authenticated owner', async () => {
    const me: MePayload = {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Amina Owner',
        email: 'amina@acme.test',
        job_title: 'CTO',
        timezone: 'UTC',
        locale: 'en-US',
        status: 'active',
        preferences: { citations_expanded_by_default: true },
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
          permissions: ['users.manage', 'tenant.settings.manage', 'audit.view'],
          joined_at: '2026-11-23T00:00:00.000Z',
        },
      ],
    };

    const currentTenant: CurrentTenantPayload = {
      tenant: me.memberships[0]!.tenant,
      settings: {
        default_chat_model: 'default-chat',
        default_embedding_model: 'default-embedding',
        max_upload_mb: 20,
        monthly_token_budget: 500000,
        monthly_cost_budget_usd: '25.000000',
        allowed_file_types: ['pdf', 'docx', 'txt'],
        retention_days: 365,
        require_approval_for_external_actions: true,
        updated_at: '2026-11-23T00:00:00.000Z',
      },
      current_role: 'owner',
      permissions: ['users.manage', 'tenant.settings.manage', 'audit.view'],
      stats: {
        members_count: 3,
        audit_events_last_24h: 12,
        knowledge_bases_count: 0,
        documents_count: 0,
        pending_approvals_count: 0,
      },
    };

    vi.mocked(authService.me).mockResolvedValue(me);
    vi.mocked(tenantService.getCurrent).mockResolvedValue(currentTenant);
    vi.mocked(tenantService.listAuditLogs).mockResolvedValue({
      data: [],
      meta: { request_id: 'req-1', timestamp: '2026-11-23T00:00:00.000Z' },
    });

    renderAt('/dashboard');

    await waitFor(
      () => {
        expect(screen.getByText(/acme enterprise overview/i)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(within(nav).getByRole('link', { name: /users & roles/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /tenant settings/i })).toBeInTheDocument();
    expect(screen.getByText(/\$25\.000000 USD/i)).toBeInTheDocument();
  });

  it('hides admin navigation items for viewer role', async () => {
    const me: MePayload = {
      user: {
        id: '11111111-1111-4111-8111-111111111119',
        name: 'Victor Viewer',
        email: 'victor@acme.test',
        job_title: 'Auditor',
        timezone: 'UTC',
        locale: 'en-US',
        status: 'active',
        preferences: {},
        last_login_at: null,
        created_at: '2026-11-23T00:00:00.000Z',
      },
      memberships: [
        {
          membership_id: '22222222-2222-4222-8222-222222222229',
          tenant: {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Acme Enterprise',
            slug: 'acme-enterprise',
            plan: 'sandbox',
            status: 'active',
            created_at: '2026-11-23T00:00:00.000Z',
          },
          role: 'viewer',
          role_name: 'Viewer',
          status: 'active',
          permissions: ['chat.ask'],
          joined_at: '2026-11-23T00:00:00.000Z',
        },
      ],
    };

    vi.mocked(authService.me).mockResolvedValue(me);
    vi.mocked(tenantService.getCurrent).mockResolvedValue({
      tenant: me.memberships[0]!.tenant,
      settings: {
        default_chat_model: 'default-chat',
        default_embedding_model: 'default-embedding',
        max_upload_mb: 20,
        monthly_token_budget: 500000,
        monthly_cost_budget_usd: '25.000000',
        allowed_file_types: ['pdf'],
        retention_days: 365,
        require_approval_for_external_actions: true,
        updated_at: '2026-11-23T00:00:00.000Z',
      },
      current_role: 'viewer',
      permissions: ['chat.ask'],
      stats: {
        members_count: 3,
        audit_events_last_24h: 0,
        knowledge_bases_count: 0,
        documents_count: 0,
        pending_approvals_count: 0,
      },
    });

    renderAt('/dashboard');

    await waitFor(
      () => {
        expect(screen.getByText(/acme enterprise overview/i)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.queryByRole('link', { name: /users & roles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /tenant settings/i })).not.toBeInTheDocument();
  });
});
