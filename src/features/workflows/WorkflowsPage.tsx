import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, GitBranch, Play, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import {
  workflowService,
  type WorkflowDefinitionRecord,
  type WorkflowRunRecord,
} from '@/services/phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { formatUtcDate } from '@/lib/utils';

function wfBadge(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'awaiting_approval':
      return 'warning' as const;
    case 'failed':
    case 'cancelled':
    case 'rejected':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
}

export function WorkflowsPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('workflows.manage');

  const [goalInput, setGoalInput] = React.useState(
    'Review organizational HR, remote work, and security policies and produce a cited compliance report.',
  );
  const [titleInput, setTitleInput] = React.useState('Q4 Enterprise Compliance Assessment');
  const [notice, setNotice] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const defsQuery = useQuery({
    queryKey: ['workflows', 'definitions', activeTenantId],
    queryFn: () => workflowService.listDefinitions(),
    enabled: Boolean(activeTenantId),
  });

  const runsQuery = useQuery({
    queryKey: ['workflows', 'runs', activeTenantId],
    queryFn: () => workflowService.listRuns(),
    enabled: Boolean(activeTenantId),
  });

  const seedMutation = useMutation({
    mutationFn: () => workflowService.seedComplianceTemplate(),
    onSuccess: (def) => {
      setNotice(`Provisioned "${def.name}" template and linked Compliance Report Agent.`);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setNotice(null);
    },
  });

  const launchMutation = useMutation({
    mutationFn: (definitionId: string) =>
      workflowService.launchRun(definitionId, {
        goal: goalInput.trim(),
        report_title: titleInput.trim(),
      }),
    onSuccess: (run) => {
      setNotice(
        `Workflow run ${run.id.slice(0, 8)} reached "${run.status}". ${
          run.approval_request_id ? 'An approval request is now ready in the Approval Inbox.' : ''
        }`,
      );
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['tenant', 'current'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setNotice(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflow Automation</h1>
          <p className="text-sm text-muted-foreground">
            Orchestrate idempotent multi-step AI workflows with human approval gates and transactional outbox tracking.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/approvals">Open Approval Inbox</Link>
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              disabled={seedMutation.isPending}
              onClick={() => seedMutation.mutate()}
            >
              <Sparkles className="h-4 w-4" />
              {seedMutation.isPending ? 'Provisioning...' : 'Seed Compliance Report Workflow'}
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <Alert variant="success" title="Workflow update">
          {notice}
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="error" title="Workflow error">
          {errorMsg}
        </Alert>
      )}

      {/* Launch Inputs */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Run Parameters</CardTitle>
            <CardDescription>
              Every launch sends a unique <code>Idempotency-Key</code> header guaranteeing 0 duplicate workflow runs under retries.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input
              aria-label="Report title"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Compliance report title"
            />
            <Input
              aria-label="Workflow objective"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="Policy scope or compliance question"
            />
          </CardContent>
        </Card>
      )}

      {/* Definitions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Workflow Definitions
        </h2>
        {defsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (defsQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={<GitBranch className="h-6 w-6" />}
            title="No workflows configured"
            description="Click 'Seed Compliance Report Workflow' to provision the signature 4-step governed compliance pipeline."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(defsQuery.data ?? []).map((def: WorkflowDefinitionRecord) => (
              <Card key={def.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{def.name}</CardTitle>
                      <CardDescription className="mt-1">{def.description}</CardDescription>
                    </div>
                    <Badge variant="secondary">Approver: {def.approver_role}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ol className="space-y-1 text-xs text-muted-foreground">
                    {def.steps_definition.map((step, i) => (
                      <li key={step.key} className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                          {i + 1}
                        </span>
                        <span>{step.name}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">{def.runs_count} runs executed</span>
                    {canManage && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={launchMutation.isPending}
                        onClick={() => launchMutation.mutate(def.id)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Launch Workflow
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Live Workflow Runs */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Workflow Run Tracker
        </h2>
        {runsQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (runsQuery.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No workflow runs launched yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(runsQuery.data ?? []).map((run: WorkflowRunRecord) => (
              <Card key={run.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {run.workflow_name ?? 'Workflow Run'}{' '}
                        <span className="font-mono text-xs text-muted-foreground">
                          #{run.id.slice(0, 8)}
                        </span>
                      </CardTitle>
                      <CardDescription>Started {formatUtcDate(run.created_at)}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={wfBadge(run.status)}>{run.status}</Badge>
                      {run.status === 'awaiting_approval' && (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/approvals">Review in Approval Inbox</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(run.steps ?? []).map((step) => (
                      <div key={step.id} className="rounded-md border p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold">
                            {step.step_order}. {step.name}
                          </span>
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          ) : step.status === 'awaiting_approval' ? (
                            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                          ) : null}
                        </div>
                        <Badge variant={wfBadge(step.status)} className="mt-1.5 text-[10px]">
                          {step.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
