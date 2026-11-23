import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bot,
  CheckSquare,
  Database,
  FileText,
  GitBranch,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { analyticsService } from '@/services/phase4';
import { tenantService } from '@/services/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { formatUtcDate } from '@/lib/utils';

export function DashboardPage() {
  const { activeTenantId, hasPermission } = useAuth();

  const tenantQuery = useQuery({
    queryKey: ['tenant', 'current', activeTenantId],
    queryFn: () => tenantService.getCurrent(),
    enabled: Boolean(activeTenantId),
  });

  const auditQuery = useQuery({
    queryKey: ['audit-logs', activeTenantId, 1],
    queryFn: () => tenantService.listAuditLogs(1),
    enabled: Boolean(activeTenantId) && hasPermission('audit.view'),
  });

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'overview', activeTenantId, 30],
    queryFn: () => analyticsService.overview(30),
    enabled: Boolean(activeTenantId) && hasPermission('analytics.view'),
  });

  if (tenantQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (tenantQuery.isError || !tenantQuery.data) {
    return (
      <Alert variant="error" title="Failed to load workspace overview">
        Unable to retrieve current tenant metrics. Check API connectivity and try again.
      </Alert>
    );
  }

  const { tenant, settings, stats, current_role } = tenantQuery.data;
  const analytics = analyticsQuery.data;

  const kpis = [
    {
      label: 'Active Members',
      value: stats.members_count,
      icon: Users,
      sub: `Your role: ${current_role}`,
      to: '/admin/users',
    },
    {
      label: 'Knowledge Bases',
      value: stats.knowledge_bases_count,
      icon: Database,
      sub: `${stats.documents_count} indexed documents`,
      to: '/knowledge-bases',
    },
    {
      label: 'Indexed Documents',
      value: stats.documents_count,
      icon: FileText,
      sub: `Max upload ${settings.max_upload_mb} MB`,
      to: '/documents',
    },
    {
      label: 'Pending Approvals',
      value: stats.pending_approvals_count,
      icon: CheckSquare,
      sub: 'Human-in-the-loop gate',
      to: '/approvals',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name} Overview</h1>
          <p className="text-sm text-muted-foreground">
            Multi-tenant AI knowledge, governed agents, approval workflows, and security telemetry.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/chat">AI Chat</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/workflows">
              <GitBranch className="h-4 w-4" />
              Workflows
            </Link>
          </Button>
          {hasPermission('users.manage') && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/users">Manage Members</Link>
            </Button>
          )}
          {hasPermission('tenant.settings.manage') && (
            <Button asChild size="sm">
              <Link to="/settings/tenant">
                <Settings className="h-4 w-4" />
                Tenant Settings
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="font-medium">{kpi.label}</CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Phase 4 Live AI & Automation Analytics Strip */}
      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="font-medium">30d AI Requests</CardDescription>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.ai_usage.total_requests}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Avg {analytics.ai_usage.avg_latency_ms} ms · ${analytics.ai_usage.total_cost_usd} USD
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="font-medium">Agent &amp; Workflow Runs</CardDescription>
              <Bot className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.automation.agent_runs_total} / {analytics.automation.workflow_runs_total}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {analytics.automation.workflows_completed} completed ·{' '}
                {analytics.automation.approvals_approved} approved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="font-medium">Monthly Budget Used</CardDescription>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.budget.token_utilization_pct}%</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {analytics.budget.monthly_tokens_used.toLocaleString()} /{' '}
                {analytics.budget.monthly_token_budget.toLocaleString()} tokens
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="font-medium">Eval Citation Accuracy</CardDescription>
              <Sparkles className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.evaluation.citation_correctness_pct !== null
                  ? `${analytics.evaluation.citation_correctness_pct}%`
                  : 'Not run'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {analytics.evaluation.groundedness_score_pct !== null
                  ? `Groundedness ${analytics.evaluation.groundedness_score_pct}%`
                  : 'Run benchmark in AI Evaluations'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Governance Summary + Recent Audit */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Active AI &amp; Security Guardrails
            </CardTitle>
            <CardDescription>Enforced by Laravel backend policies on every request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Default Chat Model</span>
              <Badge variant="secondary">{settings.default_chat_model}</Badge>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Monthly Token Budget</span>
              <span className="font-medium">
                {settings.monthly_token_budget.toLocaleString()} tokens
              </span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Monthly Cost Ceiling</span>
              <span className="font-medium">${settings.monthly_cost_budget_usd} USD</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">External Action Approval</span>
              <Badge variant={settings.require_approval_for_external_actions ? 'success' : 'warning'}>
                {settings.require_approval_for_external_actions ? 'Required' : 'Optional'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Audit Trail</CardTitle>
              <CardDescription>
                Tamper-evident SHA-256 hash-chained activity ({stats.audit_events_last_24h} events in 24h)
              </CardDescription>
            </div>
            {hasPermission('audit.view') && (
              <Button asChild variant="outline" size="sm">
                <Link to="/security/audit">Open Audit</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!hasPermission('audit.view') ? (
              <p className="text-sm text-muted-foreground">
                Audit log visibility requires Owner, Admin, or Manager permissions.
              </p>
            ) : auditQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (auditQuery.data?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {(auditQuery.data?.data ?? []).slice(0, 6).map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{log.action}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {log.actor_email ?? 'system'} · {log.resource_type}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatUtcDate(log.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
