import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  MessageSquarePlus,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { aiService, conversationService } from '@/services/chat';
import { knowledgeService } from '@/services/knowledge';
import type { ChatMessage, MessageCitation } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ChatWorkspacePage() {
  const { activeTenantId } = useAuth();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedKbIds, setSelectedKbIds] = React.useState<string[]>([]);
  const [modelAlias, setModelAlias] = React.useState<string>('default-chat');
  const [includeCitations, setIncludeCitations] = React.useState<boolean>(true);
  const [promptInput, setPromptInput] = React.useState<string>('');
  const [localMessages, setLocalMessages] = React.useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = React.useState<string | null>(null);
  const [isStreaming, setIsStreaming] = React.useState<boolean>(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [activeCitation, setActiveCitation] = React.useState<MessageCitation | null>(null);

  const kbsQuery = useQuery({
    queryKey: ['knowledge-bases', activeTenantId],
    queryFn: () => knowledgeService.list(),
    enabled: Boolean(activeTenantId),
  });

  const modelsQuery = useQuery({
    queryKey: ['ai-models', activeTenantId, 'chat'],
    queryFn: () => aiService.listModels('chat'),
    enabled: Boolean(activeTenantId),
  });

  const convQuery = useQuery({
    queryKey: ['conversation', activeTenantId, conversationId],
    queryFn: () => conversationService.get(conversationId!),
    enabled: Boolean(activeTenantId && conversationId),
  });

  React.useEffect(() => {
    if (convQuery.data) {
      setLocalMessages(convQuery.data.messages);
      if (convQuery.data.conversation.knowledge_base_ids.length > 0 && selectedKbIds.length === 0) {
        setSelectedKbIds(convQuery.data.conversation.knowledge_base_ids);
      }
      setModelAlias(convQuery.data.conversation.default_model_alias);
    } else if (!conversationId) {
      setLocalMessages([]);
    }
  }, [convQuery.data, conversationId, selectedKbIds.length]);

  const feedbackMutation = useMutation({
    mutationFn: ({ messageId, feedback }: { messageId: string; feedback: 'positive' | 'negative' }) =>
      conversationService.submitFeedback(messageId, feedback),
    onSuccess: (updated) => {
      setLocalMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, feedback: updated.feedback } : m)),
      );
    },
  });

  const toggleKb = (id: string) => {
    setSelectedKbIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleNewChat = () => {
    setActiveCitation(null);
    setLocalMessages([]);
    setStreamingText(null);
    setErrorText(null);
    navigate('/chat');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = promptInput.trim();
    if (trimmed.length < 2 || isStreaming) return;

    setErrorText(null);
    setIsStreaming(true);
    setStreamingText('');
    setPromptInput('');

    try {
      let targetConvId = conversationId;
      if (!targetConvId) {
        const created = await conversationService.create({
          model: modelAlias,
          knowledge_base_ids: selectedKbIds,
        });
        targetConvId = created.id;
        navigate(`/chat/${created.id}`, { replace: true });
      }

      const optimisticUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: targetConvId,
        role: 'user',
        content: trimmed,
        model_alias: modelAlias,
        status: 'completed',
        abstained: false,
        citations: [],
        usage: { input_tokens: 0, output_tokens: 0 },
        cost_usd: '0.000000',
        latency_ms: 0,
        feedback: null,
        feedback_note: null,
        created_at: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimisticUserMsg]);

      let completedPayload = null as null | Awaited<ReturnType<typeof conversationService.sendMessage>>;

      await conversationService.streamMessage(
        targetConvId,
        {
          message: trimmed,
          knowledge_base_ids: selectedKbIds.length > 0 ? selectedKbIds : undefined,
          model: modelAlias,
          temperature: 0.2,
          include_citations: includeCitations,
        },
        {
          onDelta: (delta) => {
            setStreamingText((prev) => (prev ?? '') + delta);
          },
          onCompleted: (result) => {
            completedPayload = result;
          },
          onError: (msg) => {
            setErrorText(msg);
          },
        },
      );

      if (completedPayload) {
        const assistantMsg: ChatMessage = {
          id: completedPayload.message_id,
          conversation_id: completedPayload.conversation_id,
          role: 'assistant',
          content: completedPayload.answer,
          model_alias: modelAlias,
          status: completedPayload.status,
          abstained: completedPayload.abstained,
          citations: completedPayload.citations,
          usage: completedPayload.usage,
          cost_usd: completedPayload.cost_usd,
          latency_ms: completedPayload.latency_ms,
          feedback: null,
          feedback_note: null,
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, assistantMsg]);
        if (completedPayload.citations.length > 0) {
          setActiveCitation(completedPayload.citations[0] ?? null);
        }
        queryClient.invalidateQueries({ queryKey: ['conversations', activeTenantId] });
      }
    } catch (err) {
      setErrorText(err instanceof ApiError ? err.message : 'Unable to generate AI response.');
    } finally {
      setIsStreaming(false);
      setStreamingText(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Chat Panel */}
      <div className="flex flex-col space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Knowledge Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Grounded RAG answers with pre-retrieval ACL enforcement, SSE streaming, and verified citations.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleNewChat}>
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Scope & Model Controls */}
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Knowledge Base Scope (leave empty for all permitted KBs)</Label>
              <div className="flex flex-wrap gap-1.5">
                {(kbsQuery.data ?? []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">No knowledge bases created yet.</span>
                ) : (
                  (kbsQuery.data ?? []).map((kb) => {
                    const selected = selectedKbIds.includes(kb.id);
                    return (
                      <button
                        key={kb.id}
                        type="button"
                        onClick={() => toggleKb(kb.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'bg-card text-foreground hover:bg-accent'
                        }`}
                      >
                        {kb.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chat-model" className="text-xs">Model Alias</Label>
              <select
                id="chat-model"
                value={modelAlias}
                onChange={(e) => setModelAlias(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs"
              >
                {(modelsQuery.data ?? [{ alias: 'default-chat', provider_key: 'mock' }]).map((m) => (
                  <option key={m.alias} value={m.alias}>
                    {m.alias} ({m.provider_key})
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeCitations}
                  onChange={(e) => setIncludeCitations(e.target.checked)}
                />
                Enforce verified citations
              </label>
            </div>
          </CardContent>
        </Card>

        {errorText && <Alert variant="error">{errorText}</Alert>}

        {/* Messages Thread */}
        <Card className="flex min-h-[420px] flex-1 flex-col">
          <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
            {convQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : localMessages.length === 0 && streamingText === null ? (
              <EmptyState
                title="Ask a grounded question"
                description="NexaMind AI retrieves only documents you are authorized to access and abstains safely if supporting evidence is absent."
              />
            ) : (
              <>
                {localMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg border p-4 text-sm ${
                      msg.role === 'user'
                        ? 'ml-8 border-primary/20 bg-primary/5'
                        : 'mr-4 bg-card shadow-sm'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold capitalize text-foreground">
                        {msg.role === 'user' ? 'You' : 'NexaMind AI'}
                      </span>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2">
                          {msg.abstained ? (
                            <Badge variant="warning">Abstained</Badge>
                          ) : (
                            <Badge variant="success">Grounded</Badge>
                          )}
                          <span>
                            {msg.usage.input_tokens + msg.usage.output_tokens} tok · ${msg.cost_usd}
                          </span>
                        </div>
                      )}
                    </div>

                    {msg.abstained && (
                      <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Insufficient authorized evidence — safe abstention triggered.
                      </div>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {msg.role === 'assistant' && msg.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2.5">
                        {msg.citations.map((cit) => (
                          <button
                            key={cit.chunk_id}
                            type="button"
                            onClick={() => setActiveCitation(cit)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            [{cit.index}] {cit.document_name}
                            {cit.page ? ` · p.${cit.page}` : ''}
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.role === 'assistant' && !msg.id.startsWith('temp-') && (
                      <div className="mt-2 flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={msg.feedback === 'positive' ? 'secondary' : 'ghost'}
                          aria-label="Helpful response"
                          onClick={() =>
                            feedbackMutation.mutate({ messageId: msg.id, feedback: 'positive' })
                          }
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={msg.feedback === 'negative' ? 'secondary' : 'ghost'}
                          aria-label="Unhelpful response"
                          onClick={() =>
                            feedbackMutation.mutate({ messageId: msg.id, feedback: 'negative' })
                          }
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {streamingText !== null && (
                  <div className="mr-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-blue-700">
                      <span>NexaMind AI</span>
                      <Badge variant="secondary">Streaming SSE...</Badge>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {streamingText || 'Retrieving authorized evidence...'}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>

          <form onSubmit={handleSend} className="flex gap-2 border-t p-4">
            <Input
              aria-label="Ask NexaMind AI"
              placeholder="Ask a question about your authorized organizational policies..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              disabled={isStreaming}
            />
            <Button type="submit" disabled={isStreaming || promptInput.trim().length < 2}>
              <Send className="h-4 w-4" />
              {isStreaming ? 'Streaming...' : 'Send'}
            </Button>
          </form>
        </Card>
      </div>

      {/* Verified Citation Inspector Drawer */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Verified Source Citation
          </CardTitle>
          <CardDescription>
            Every citation is cryptographically matched against chunks retrieved for your tenant and ACL scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!activeCitation ? (
            <p className="text-sm text-muted-foreground">
              Select any numbered citation pill in an assistant answer to inspect the exact source document, page number, similarity score, and verbatim excerpt.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="success">Verified Source [{activeCitation.index}]</Badge>
                <Badge variant="outline">
                  Cosine {(activeCitation.similarity_score * 100).toFixed(1)}%
                </Badge>
              </div>
              <div>
                <p className="font-semibold text-foreground">{activeCitation.document_name}</p>
                <p className="text-xs text-muted-foreground">
                  {activeCitation.page ? `Page ${activeCitation.page}` : 'Page 1'}
                  {activeCitation.section_heading ? ` · ${activeCitation.section_heading}` : ''}
                </p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                {activeCitation.excerpt}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">
                Chunk ID: {activeCitation.chunk_id}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
