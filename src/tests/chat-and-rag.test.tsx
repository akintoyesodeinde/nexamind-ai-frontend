import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/AuthContext';
import { AppRoutes } from '@/app/App';
import { authService, tenantService } from '@/services/platform';
import { documentService, knowledgeService, retrievalService } from '@/services/knowledge';
import { aiService, conversationService, documentIntelligenceService } from '@/services/chat';
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

vi.mock('@/services/chat', () => ({
  aiService: {
    listModels: vi.fn(),
  },
  conversationService: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    sendMessage: vi.fn(),
    streamMessage: vi.fn(),
    submitFeedback: vi.fn(),
  },
  documentIntelligenceService: {
    analyze: vi.fn(),
    compare: vi.fn(),
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

describe('Phase 3 Frontend — AI Chat SSE Streaming, Verified Citations & History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(authService.me).mockResolvedValue(ownerMe);
    vi.mocked(tenantService.listRoles).mockResolvedValue([]);
    vi.mocked(knowledgeService.list).mockResolvedValue([]);
    vi.mocked(documentService.list).mockResolvedValue([]);
    vi.mocked(retrievalService.search).mockResolvedValue({
      adapter: 'sqlsrv_native_vector',
      query: '',
      authorized_document_count: 0,
      results: [],
    });
    vi.mocked(aiService.listModels).mockResolvedValue([
      {
        id: 'm-1',
        alias: 'default-chat',
        provider_model_name: 'nexamind-grounded-v1',
        provider_key: 'mock',
        capability: 'chat',
        max_context_tokens: 16000,
        input_cost_per_1k_usd: '0.000150',
        output_cost_per_1k_usd: '0.000600',
        is_active: true,
      },
    ]);
    vi.mocked(documentIntelligenceService.analyze).mockResolvedValue({
      document_id: 'doc-1',
      filename: 'loan-policy.md',
      action: 'summarize',
      result: { executive_summary: 'Summary' },
      usage: { input_tokens: 100, output_tokens: 40 },
      cost_usd: '0.000039',
      latency_ms: 12,
    });
  });

  it('streams grounded AI response and displays verified citation evidence drawer', async () => {
    vi.mocked(conversationService.create).mockResolvedValue({
      id: 'conv-1',
      title: 'New Conversation',
      default_model_alias: 'default-chat',
      knowledge_base_ids: [],
      status: 'active',
      messages_count: 0,
      last_message_at: null,
      created_at: '2026-11-23T00:00:00.000Z',
      updated_at: '2026-11-23T00:00:00.000Z',
    });

    const completedCitation = {
      index: 1,
      document_id: 'doc-1',
      document_name: 'Loan Policy.pdf',
      page: 12,
      section_heading: 'Credit Limits',
      chunk_id: 'chunk-008',
      excerpt: 'Commercial loans above $250,000 require Credit Committee approval.',
      similarity_score: 0.94,
      verified: true,
    };

    vi.mocked(conversationService.get).mockResolvedValue({
      conversation: {
        id: 'conv-1',
        title: 'Loan policy question',
        default_model_alias: 'default-chat',
        knowledge_base_ids: [],
        status: 'active',
        messages_count: 2,
        last_message_at: '2026-11-23T00:00:00.000Z',
        created_at: '2026-11-23T00:00:00.000Z',
        updated_at: '2026-11-23T00:00:00.000Z',
      },
      messages: [
        {
          id: 'msg-u-1',
          role: 'user',
          content: 'Summarize loan policies',
          model_alias: 'default-chat',
          status: 'completed',
          abstained: false,
          usage: { input_tokens: 0, output_tokens: 0 },
          cost_usd: '0.000000',
          latency_ms: 0,
          feedback: null,
          citations: [],
          created_at: '2026-11-23T00:00:00.000Z',
        },
        {
          id: 'msg-a-1',
          role: 'assistant',
          content: 'Loans above $250,000 require Credit Committee approval [1].',
          model_alias: 'default-chat',
          status: 'completed',
          abstained: false,
          usage: { input_tokens: 420, output_tokens: 45 },
          cost_usd: '0.000090',
          latency_ms: 42,
          feedback: null,
          citations: [completedCitation],
          created_at: '2026-11-23T00:00:01.000Z',
        },
      ],
    });

    vi.mocked(conversationService.streamMessage).mockImplementation(async (_id, _input, handlers) => {
      handlers.onStarted?.();
      handlers.onDelta?.('Loans above $250,000 require Credit Committee approval [1].');
      handlers.onCompleted?.({
        conversation_id: 'conv-1',
        user_message_id: 'msg-u-1',
        message_id: 'msg-a-1',
        answer: 'Loans above $250,000 require Credit Committee approval [1].',
        citations: [completedCitation],
        usage: { input_tokens: 420, output_tokens: 45 },
        cost_usd: '0.000090',
        latency_ms: 42,
        abstained: false,
        status: 'completed',
      });
    });

    const user = userEvent.setup();
    renderAt('/chat');

    await user.type(await screen.findByLabelText(/ask nexamind ai/i), 'Summarize loan policies');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/verified source \[1\]/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Loan Policy\.pdf/i).length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText(/Page 12/i)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  it('lists previous conversations on Conversation History screen', async () => {
    vi.mocked(conversationService.list).mockResolvedValue([
      {
        id: 'conv-99',
        title: 'Summarize loan approval policies',
        default_model_alias: 'default-chat',
        knowledge_base_ids: [],
        status: 'active',
        messages_count: 4,
        last_message_at: '2026-11-23T00:00:00.000Z',
        created_at: '2026-11-23T00:00:00.000Z',
        updated_at: '2026-11-23T00:00:00.000Z',
      },
    ]);

    renderAt('/conversations');

    await waitFor(
      () => {
        expect(screen.getByText('Summarize loan approval policies')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
    expect(screen.getByRole('link', { name: /resume/i })).toHaveAttribute('href', '/chat/conv-99');
  });
});
