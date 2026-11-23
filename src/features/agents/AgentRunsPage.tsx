import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Ban, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { agentService, type AgentRunRecord } from '@/services/phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { formatUtcDate } from '@/lib/utils';

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'awaiting_approval':
      return 'warning' as const;
    case 'failed':
    case 'blocked':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
}

export function AgentRunsPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ['agents', 'runs', activeTenantId],
    queryFn: () => agentService.listRuns(),
    enabled: Boolean(activeTenantId),
  });

  const activeRunId = selectedRunId ?? runsQuery.data?.[0]?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ['agents', 'run-detail', activeTenantId, activeRunId],
    queryFn: () => agentService.getRun(activeRunId!),
    enabled: Boolean(activeTenantId && activeRunId),
  });

  const cancelMutation = useMutation({
    mutationFn: (runId: string) => agentService.cancelRun(runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Execution History</h1>
          <p className="text-sm text-muted-foreground">
            Inspect step-by-step tool calls, schema validations, citations, tokens, and approval gates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/approvals">Open Approval Inbox</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/agents">Configure Agents</Link>
          </Button>
        </div>
      </div>

      {runsQuery.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : (runsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="No agent runs recorded yet"
          description="Launch an agent from AI Agent Studio or trigger the AI Compliance Report Workflow to inspect live step traces."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Runs List */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">Recent Executions</CardTitle>
              <CardDescription>{runsQuery.data?.length ?? 0} tenant-scoped runs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(runsQuery.data ?? []).map((run: AgentRunRecord) => {
                const isSelected = run.id === activeRunId;
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {run.agent_name ?? 'AI Agent'}
                      </span>
                      <Badge variant={statusBadgeVariant(run.status)}>{run.status}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.goal}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{run.step_count} steps</span>
                      <span>{run.total_tokens.toLocaleString()} tok</span>
                      <span>${run.cost_usd}</span>
                      <span>{run.latency_ms} ms</span>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Step-by-Step Trace Inspector */}
          <Card className="lg:col-span-7">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Step-by-Step Execution Trace</CardTitle>
                  <CardDescription>
                    {detailQuery.data
                      ? `${detailQuery.data.agent_name ?? 'Agent'} · Run ${detailQuery.data.id.slice(0, 8)} · ${formatUtcDate(detailQuery.data.created_at)}`
                      : 'Select an agent run to inspect steps'}
                  </CardDescription>
                </div>
                {detailQuery.data &&
                  hasPermission('agents.manage') &&
                  ['running', 'awaiting_approval', 'queued'].includes(detailQuery.data.status) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(detailQuery.data!.id)}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Cancel Run
                    </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailQuery.isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : !detailQuery.data ? (
                <p className="text-sm text-muted-foreground">Select a run from the left panel.</p>
              ) : (
                <>
                  <div className="rounded-md bg-muted/40 p-3 text-xs">
                    <p className="font-semibold text-foreground">Objective</p>
                    <p className="mt-1 text-muted-foreground">{detailQuery.data.goal}</p>
                    {detailQuery.data.error_message && (
                      <p className="mt-2 font-medium text-destructive">
                        Error: {detailQuery.data.error_message}
                      </p>
                    )}
                  </div>

                  <ol className="space-y-3">
                    {(detailQuery.data.steps ?? []).map((step) => (
                      <li key={step.id} className="rounded-lg border p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {step.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : step.status === 'awaiting_approval' ? (
                              <Clock className="h-4 w-4 text-amber-600" />
                            ) : step.status === 'blocked' ? (
                              <ShieldAlert className="h-4 w-4 text-red-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-semibold">
                              Step {step.step_number}:{' '}
                              <span className="font-mono text-primary">
                                {step.tool_name ?? step.step_type}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {step.tokens_used} tok · {step.latency_ms} ms
                            </span>
                            <Badge variant={statusBadgeVariant(step.status)}>{step.status}</Badge>
                          </div>
                        </div>

                        {step.error_message && (
                          <p className="mt-2 rounded bg-red-50 p-2 text-red-800">
                            {step.error_message}
                          </p>
                        )}

                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                            Inspect validated input &amp; structured output
                          </summary>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <pre className="max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-200">
                              {JSON.stringify(step.input, null, 2)}
                            </pre>
                            <pre className="max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-emerald-200">
                              {JSON.stringify(step.output, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
