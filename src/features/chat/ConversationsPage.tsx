import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { formatUtcDate } from '@/lib/utils';
import { conversationService } from '@/services/chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';

export function ConversationsPage() {
  const { activeTenantId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');

  const listQuery = useQuery({
    queryKey: ['conversations', activeTenantId, search],
    queryFn: () => conversationService.list(search.trim() || undefined),
    enabled: Boolean(activeTenantId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => conversationService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', activeTenantId] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversation History</h1>
          <p className="text-sm text-muted-foreground">
            Resume previous tenant-scoped grounded AI sessions and review verified citations.
          </p>
        </div>
        <Button type="button" onClick={() => navigate('/chat')}>
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Conversations</CardTitle>
          <CardDescription>Conversations are private to your account within the active tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search conversations"
              placeholder="Filter by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {listQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (listQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No conversations yet"
              description="Start a new AI Chat session to ask grounded questions against your organization's documents."
              action={
                <Button type="button" onClick={() => navigate('/chat')}>
                  Open AI Chat
                </Button>
              }
            />
          ) : (
            <ul className="divide-y rounded-md border">
              {(listQuery.data ?? []).map((conv) => (
                <li
                  key={conv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"
                >
                  <Link to={`/chat/${conv.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {conv.messages_count} messages · Last activity{' '}
                        {formatUtcDate(conv.last_message_at ?? conv.created_at)}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{conv.default_model_alias}</Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/chat/${conv.id}`}>Resume</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Archive ${conv.title}`}
                      onClick={() => deleteMutation.mutate(conv.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
