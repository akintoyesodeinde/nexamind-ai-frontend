import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckSquare,
  Database,
  FileText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
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

  const kpis = [
    { label: 'Active Members', value: stats.members_count, icon: Users, sub: `Your role: ${current_role}` },
    { label: 'Knowledge Bases', value: stats.knowledge_bases_count, icon: Database, sub: 'Phase 2 ingestion ready' },
    { label: 'Indexed Documents', value: stats.documents_count, icon: FileText, sub: `Max upload ${settings.max_upload_mb} MB` },
    { label: 'Pending Approvals', value: stats.pending_approvals_count, icon: CheckSquare, sub: 'Human-in-the-loop gate' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name} Overview</h1>
          <p className="text-sm text-muted-foreground">
            Multi-tenant governance, AI budget guardrails, and recent security activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* KPI Cards */}
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
          <CardHeader>
            <CardTitle className="text-base">Recent Audit Trail</CardTitle>
            <CardDescription>
              Tamper-evident SHA-256 hash-chained activity ({stats.audit_events_last_24h} events in 24h)
            </CardDescription>
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
