import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/AuthContext';
import { AppRoutes } from '@/app/App';
import { authService, tenantService } from '@/services/platform';
import { documentService, knowledgeService, retrievalService } from '@/services/knowledge';
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
    create: vi.fn(),
    update: vi.fn(),
    listPermissions: vi.fn(),
    syncPermissions: vi.fn(),
  },
  documentService: {
    list: vi.fn(),
    upload: vi.fn(),
    versions: vi.fn(),
    chunks: vi.fn(),
    downloadUrl: vi.fn(),
    getPermissions: vi.fn(),
    syncPermissions: vi.fn(),
    remove: vi.fn(),
  },
  retrievalService: {
    search: vi.fn(),
  },
}));

const ownerMe: MePayload = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Amina Owner',
    email: 'amina@acme.test',
    job_title: 'CTO',
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
      permissions: ['knowledge.create', 'documents.upload', 'chat.ask'],
      joined_at: '2026-11-23T00:00:00.000Z',
    },
  ],
};

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Phase 2 Frontend — Knowledge Bases, Documents & Intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(authService.me).mockResolvedValue(ownerMe);
    vi.mocked(tenantService.listRoles).mockResolvedValue([]);
  });

  it('renders Knowledge Base list and visibility badges', async () => {
    vi.mocked(knowledgeService.list).mockResolvedValue([
      {
        id: 'kb-1',
        name: 'Compliance Vault',
        slug: 'compliance-vault',
        description: 'Approved SOC2 policies',
        visibility: 'restricted',
        status: 'active',
        created_by: ownerMe.user.id,
        documents_count: 4,
        created_at: '2026-11-23T00:00:00.000Z',
        updated_at: '2026-11-23T00:00:00.000Z',
      },
    ]);

    renderAt('/knowledge-bases');

    await waitFor(
      () => {
        expect(screen.getByText('Compliance Vault')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
    expect(screen.getByText('4 docs')).toBeInTheDocument();
  });

  it('runs vector retrieval search on Document Intelligence Workspace', async () => {
    vi.mocked(documentService.list).mockResolvedValue([
      {
        id: 'doc-1',
        knowledge_base_id: 'kb-1',
        uploaded_by: ownerMe.user.id,
        filename: 'loan-policy.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 2048,
        checksum_sha256: 'abc123',
        current_version: 1,
        access_policy: 'inherit',
        status: 'ready',
        page_count: 2,
        chunk_count: 1,
        character_count: 120,
        error_message: null,
        metadata: {},
        processed_at: '2026-11-23T00:00:00.000Z',
        created_at: '2026-11-23T00:00:00.000Z',
        updated_at: '2026-11-23T00:00:00.000Z',
      },
    ]);
    vi.mocked(documentService.chunks).mockResolvedValue([
      {
        id: 'chunk-1',
        document_id: 'doc-1',
        document_version_id: 'ver-1',
        chunk_index: 0,
        page_number: 1,
        section_heading: 'Loan Limits',
        char_start: 0,
        char_end: 80,
        token_estimate: 20,
        content: 'Loans over $250,000 require Credit Committee approval.',
        embedding_model: 'mock:default-embedding',
        created_at: '2026-11-23T00:00:00.000Z',
      },
    ]);
    vi.mocked(retrievalService.search).mockResolvedValue({
      adapter: 'sqlsrv_native_vector',
      query: 'loan limits',
      authorized_document_count: 1,
      results: [
        {
          chunk_id: 'chunk-1',
          document_id: 'doc-1',
          knowledge_base_id: 'kb-1',
          filename: 'loan-policy.pdf',
          page_number: 1,
          section_heading: 'Loan Limits',
          content: 'Loans over $250,000 require Credit Committee approval.',
          score: 0.912,
        },
      ],
    });

    const user = userEvent.setup();
    renderAt('/documents/intelligence');

    await waitFor(
      () => {
        expect(screen.getByText(/semantic chunks — loan-policy\.pdf/i)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    await user.type(screen.getByLabelText(/semantic retrieval query/i), 'loan limits');
    await user.click(screen.getByRole('button', { name: /run vector search/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/adapter: sqlsrv_native_vector/i)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
    expect(screen.getByText(/cosine 91\.2%/i)).toBeInTheDocument();
  });
});
