import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { securityAuditService } from '@/services/phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { formatUtcDate } from '@/lib/utils';

function severityVariant(severity: string) {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'destructive' as const;
    case 'medium':
      return 'warning' as const;
    default:
      return 'secondary' as const;
  }
}

export function SecurityAuditPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'audit' | 'security'>('audit');
  const [actionFilter, setActionFilter] = React.useState('');
  const [severityFilter, setSeverityFilter] = React.useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');

  const canView = hasPermission('audit.view');

  const auditQuery = useQuery({
    queryKey: ['security-audit', 'logs', activeTenantId, actionFilter],
    queryFn: () =>
      securityAuditService.listAuditLogs({
        page: 1,
        action: actionFilter.trim() || undefined,
      }),
    enabled: Boolean(activeTenantId) && canView,
  });

  const securityQuery = useQuery({
    queryKey: ['security-audit', 'events', activeTenantId, severityFilter],
    queryFn: () =>
      securityAuditService.listSecurityEvents({
        page: 1,
        severity: severityFilter,
      }),
    enabled: Boolean(activeTenantId) && canView,
  });

  const verifyChainMutation = useMutation({
    mutationFn: () => securityAuditService.verifyChain(),
  });

  const handleExportJson = () => {
    const payload =
      activeTab === 'audit' ? (auditQuery.data?.data ?? []) : (securityQuery.data?.data ?? []);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexamind-${activeTab}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <Alert variant="warning" title="Security audit access restricted">
        Viewing audit trails and security events requires the <code>audit.view</code> permission.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security Audit Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Search tamper-evident SHA-256 hash-chained audit logs and blocked security events across your organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportJson}
          >
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={verifyChainMutation.isPending}
            onClick={() => verifyChainMutation.mutate()}
          >
            <ShieldCheck className="h-4 w-4" />
            {verifyChainMutation.isPending ? 'Verifying Chain...' : 'Verify Hash Chain'}
          </Button>
        </div>
      </div>

      {verifyChainMutation.data && (
        <Alert
          variant={verifyChainMutation.data.chain_valid ? 'success' : 'error'}
          title={
            verifyChainMutation.data.chain_valid
              ? 'SHA-256 Audit Chain Integrity Verified'
              : 'Audit Hash Chain Tampering Detected'
          }
        >
          Verified {verifyChainMutation.data.records_verified} tenant audit records at{' '}
          {formatUtcDate(verifyChainMutation.data.verified_at)}.
        </Alert>
      )}

      {/* Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'audit' ? 'default' : 'outline'}
            onClick={() => setActiveTab('audit')}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Audit Logs ({auditQuery.data?.data.length ?? 0})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === 'security' ? 'default' : 'outline'}
            onClick={() => setActiveTab('security')}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Security Events ({securityQuery.data?.data.length ?? 0})
          </Button>
        </div>

        {activeTab === 'audit' ? (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Filter audit actions"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by action (e.g., approvals.approved)"
              className="pl-8 text-xs"
            />
          </div>
        ) : (
          <div className="flex gap-1.5">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
              <Button
                key={sev}
                type="button"
                size="sm"
                variant={severityFilter === sev ? 'default' : 'outline'}
                onClick={() => setSeverityFilter(sev)}
                className="capitalize"
              >
                {sev}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {activeTab === 'audit' ? 'Append-Only Audit Trail' : 'Detected Security Events'}
          </CardTitle>
          <CardDescription>
            {activeTab === 'audit'
              ? 'Cryptographically linked SHA-256 chain scoped to active tenant.'
              : 'Blocked prompt injections, unlisted tool calls, upload tampering, and quota/ACL denials.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeTab === 'audit' ? (
            auditQuery.isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (auditQuery.data?.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No matching audit records.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Resource</th>
                      <th className="py-2 pr-4">Actor</th>
                      <th className="py-2 pr-4">Hash Prefix</th>
                      <th className="py-2 text-right">Timestamp (UTC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(auditQuery.data?.data ?? []).map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 pr-4 font-mono font-medium">{log.action}</td>
                        <td className="py-2.5 pr-4">{log.resource_type}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {log.actor_email ?? 'system'}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-[11px] text-muted-foreground">
                          {log.record_hash_prefix ?? '—'}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {formatUtcDate(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : securityQuery.isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : (securityQuery.data?.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No security events matching this filter.
            </p>
          ) : (
            <div className="space-y-2.5">
              {(securityQuery.data?.data ?? []).map((ev) => (
                <div key={ev.id} className="rounded-md border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={severityVariant(ev.severity)} className="uppercase">
                        {ev.severity}
                      </Badge>
                      <span className="font-mono font-semibold">{ev.event_type}</span>
                    </div>
                    <span className="text-muted-foreground">{formatUtcDate(ev.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-foreground">{ev.summary}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Actor: {ev.actor_email ?? 'system'} · IP: {ev.ip_address ?? 'n/a'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
