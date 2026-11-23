import { apiRequest, ApiError, getApiTenantId } from '@/lib/api';
import type {
  AiModel,
  AskResponse,
  ChatMessage,
  ConversationSummary,
  DocumentAnalysisResponse,
  DocumentCompareResponse,
} from '@/types/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';

export const aiService = {
  async listModels(capability?: 'chat' | 'embedding') {
    const suffix = capability ? `?capability=${capability}` : '';
    const res = await apiRequest<AiModel[]>(`/ai/models${suffix}`);
    return res.data;
  },
};

export const conversationService = {
  async list(search?: string) {
    const suffix = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await apiRequest<ConversationSummary[]>(`/conversations${suffix}`);
    return res.data;
  },

  async create(input?: {
    title?: string;
    model?: string;
    knowledge_base_ids?: string[];
  }) {
    const res = await apiRequest<ConversationSummary>('/conversations', {
      method: 'POST',
      body: input ?? {},
    });
    return res.data;
  },

  async get(id: string) {
    const res = await apiRequest<{
      conversation: ConversationSummary;
      messages: ChatMessage[];
    }>(`/conversations/${id}`);
    return res.data;
  },

  async rename(id: string, title: string) {
    const res = await apiRequest<ConversationSummary>(`/conversations/${id}`, {
      method: 'PATCH',
      body: { title },
    });
    return res.data;
  },

  async remove(id: string) {
    await apiRequest<null>(`/conversations/${id}`, { method: 'DELETE' });
  },

  async sendMessage(
    conversationId: string,
    input: {
      message: string;
      knowledge_base_ids?: string[];
      model?: string;
      options?: { temperature?: number; include_citations?: boolean; top_k?: number };
    },
  ) {
    const res = await apiRequest<AskResponse>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: input,
    });
    return res.data;
  },

  async streamMessage(
    conversationId: string,
    input: {
      message: string;
      knowledge_base_ids?: string[];
      model?: string;
      temperature?: number;
      include_citations?: boolean;
    },
    handlers: {
      onStarted?: () => void;
      onDelta?: (delta: string) => void;
      onCompleted?: (result: AskResponse) => void;
      onError?: (message: string) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const qs = new URLSearchParams();
    qs.set('message', input.message);
    if (input.model) qs.set('model', input.model);
    if (input.temperature !== undefined) qs.set('temperature', String(input.temperature));
    if (input.include_citations !== undefined) {
      qs.set('include_citations', input.include_citations ? '1' : '0');
    }
    for (const kbId of input.knowledge_base_ids ?? []) {
      qs.append('knowledge_base_ids[]', kbId);
    }

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const tenantId = getApiTenantId();
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const response = await fetch(
      `${API_BASE}/conversations/${conversationId}/stream?${qs.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        headers,
        signal,
      },
    );

    if (!response.ok || !response.body) {
      let msg = `Streaming failed with status ${response.status}`;
      try {
        const err = (await response.json()) as { error?: { message?: string } };
        if (err.error?.message) msg = err.error.message;
      } catch {
        // ignore JSON parse errors
      }
      throw new ApiError(response.status, 'STREAM_ERROR', msg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        let dataLine = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLine += line.slice(5).trim();
          }
        }
        if (!dataLine) continue;

        const parsed = JSON.parse(dataLine) as Record<string, unknown>;
        if (currentEvent === 'message.started') {
          handlers.onStarted?.();
        } else if (currentEvent === 'message.delta') {
          handlers.onDelta?.(String(parsed.delta ?? ''));
        } else if (currentEvent === 'message.completed') {
          handlers.onCompleted?.(parsed as unknown as AskResponse);
        } else if (currentEvent === 'message.failed') {
          handlers.onError?.(String(parsed.message ?? 'Streaming error'));
        }
      }
    }
  },

  async submitFeedback(
    messageId: string,
    feedback: 'positive' | 'negative',
    note?: string,
  ) {
    const res = await apiRequest<ChatMessage>(`/messages/${messageId}/feedback`, {
      method: 'POST',
      body: { feedback, note },
    });
    return res.data;
  },
};

export const documentIntelligenceService = {
  async analyze(
    documentId: string,
    input: {
      action: 'summarize' | 'classify' | 'extract_structured';
      schema_fields?: string[];
      model?: string;
    },
  ) {
    const res = await apiRequest<DocumentAnalysisResponse>(`/documents/${documentId}/analyze`, {
      method: 'POST',
      body: input,
    });
    return res.data;
  },

  async compare(input: {
    document_a_id: string;
    document_b_id: string;
    focus?: string;
    model?: string;
  }) {
    const res = await apiRequest<DocumentCompareResponse>('/documents/compare', {
      method: 'POST',
      body: input,
    });
    return res.data;
  },
};
