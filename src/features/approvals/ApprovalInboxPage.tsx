import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CheckSquare, FileCheck2, XCircle } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { approvalService, type ApprovalRequestRecord } from '@/services/phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { formatUtcDate } from '@/lib/utils';

function approvalBadge(status: string) {
  switch (status) {
    case 'approved':
      return 'success' as const;
    case 'pending':
      return 'warning' as const;
    case 'rejected':
    case 'cancelled':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
}

export function ApprovalInboxPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [decisionNote, setDecisionNote] = React.useState('');
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const canAct = hasPermission('approvals.act');

  const approvalsQuery = useQuery({
    queryKey: ['approvals', activeTenantId, statusFilter],
    queryFn: () => approvalService.list(statusFilter),
    enabled: Boolean(activeTenantId) && canAct,
  });

  const items = approvalsQuery.data ?? [];
  const activeItem: ApprovalRequestRecord | null =
    items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      approvalService.approve(id, note),
    onSuccess: (res) => {
      setFeedback(
        res.already_decided
          ? 'Idempotent replay: approval was already finalized with 0 duplicate actions.'
          : 'Approved! Verified compliance artifact published and audit trail updated.',
      );
      setErrorMsg(null);
      setDecisionNote('');
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      void queryClient.invalidateQueries({ queryKey: ['tenant', 'current'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setFeedback(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      approvalService.reject(id, note),
    onSuccess: () => {
      setFeedback('Approval request rejected and linked workflow cancelled.');
      setErrorMsg(null);
      setDecisionNote('');
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      void queryClient.invalidateQueries({ queryKey: ['tenant', 'current'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setFeedback(null);
    },
  });

  if (!canAct) {
    return (
      <Alert variant="warning" title="Approver permissions required">
        Accessing the Approval Inbox requires the <code>approvals.act</code> permission.
      </Alert>
    );
  }

  const draftReport =
    activeItem && typeof activeItem.payload?.report === 'object' && activeItem.payload.report !== null
      ? (activeItem.payload.report as Record<string, unknown>)
      : null;

  const citations = Array.isArray(draftReport?.citations)
    ? (draftReport.citations as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Inspect AI-generated compliance drafts and citations before authorizing idempotent publication.
          </p>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
            <Button
              key={st}
              type="button"
              size="sm"
              variant={statusFilter === st ? 'default' : 'outline'}
              onClick={() => setStatusFilter(st)}
              className="capitalize"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {feedback && (
        <Alert variant="success" title="Decision recorded">
          {feedback}
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="error" title="Decision failed">
          {errorMsg}
        </Alert>
      )}

      {approvalsQuery.isLoading ? (
        <Skeleton className="h-52 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-6 w-6" />}
          title="No approval requests in this queue"
          description="Launch an AI Compliance Report Workflow or governed agent run to generate items for manager review."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Approval Queue List */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">Review Queue</CardTitle>
              <CardDescription>{items.length} requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((req) => (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelectedId(req.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    activeItem?.id === req.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{req.title}</span>
                    <Badge variant={approvalBadge(req.status)}>{req.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{req.summary}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Required role: {req.required_role}</span>
                    <span>{formatUtcDate(req.created_at)}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Draft Report & Citations Inspector */}
          <Card className="lg:col-span-7">
            {activeItem && (
              <>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileCheck2 className="h-4 w-4 text-primary" />
                        {activeItem.title}
                      </CardTitle>
                      <CardDescription>
                        Requested by {activeItem.requester_name ?? activeItem.requester_email ?? 'Agent'} · Role gate:{' '}
                        <span className="capitalize">{activeItem.required_role}</span>
                      </CardDescription>
                    </div>
                    <Badge variant={approvalBadge(activeItem.status)}>{activeItem.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Executive Summary
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-foreground">
                      {typeof draftReport?.executive_summary === 'string'
                        ? draftReport.executive_summary
                        : activeItem.summary}
                    </p>
                  </div>

                  {citations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Verified Source Citations ({citations.length})
                      </p>
                      <div className="space-y-2">
                        {citations.map((cit, i) => (
                          <div key={i} className="rounded-md border p-2.5 text-xs">
                            <div className="flex items-center justify-between font-medium">
                              <span>
                                [{String(cit.citation_index ?? i + 1)}] {String(cit.document_name ?? 'Policy')}
                                {cit.page_number ? ` · Page ${String(cit.page_number)}` : ''}
                              </span>
                              <Badge variant="success">Verified</Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground">{String(cit.excerpt ?? '')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeItem.status === 'pending' ? (
                    <div className="space-y-3 border-t pt-4">
                      <Input
                        aria-label="Approval rationale note"
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder="Optional approval or rejection rationale (recorded in audit trail)..."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          onClick={() =>
                            approveMutation.mutate({ id: activeItem.id, note: decisionNote.trim() })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {approveMutation.isPending ? 'Approving...' : 'Approve & Publish Report'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          onClick={() =>
                            rejectMutation.mutate({ id: activeItem.id, note: decisionNote.trim() })
                          }
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs">
                      <p className="font-semibold">
                        Decided ({activeItem.status}) by {activeItem.decider_name ?? 'Approver'}
                        {activeItem.decided_at ? ` on ${formatUtcDate(activeItem.decided_at)}` : ''}
                      </p>
                      {activeItem.decision_note && (
                        <p className="mt-1 text-muted-foreground">Note: {activeItem.decision_note}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
