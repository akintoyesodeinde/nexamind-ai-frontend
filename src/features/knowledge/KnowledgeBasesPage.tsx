import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Database, Lock, Plus, Shield, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { formatUtcDate } from '@/lib/utils';
import { knowledgeService } from '@/services/knowledge';
import { tenantService } from '@/services/platform';
import type { KnowledgeBase } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const createKbSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['tenant', 'restricted']),
});

type CreateKbValues = z.infer<typeof createKbSchema>;

export function KnowledgeBasesPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedKb, setSelectedKb] = React.useState<KnowledgeBase | null>(null);

  const kbsQuery = useQuery({
    queryKey: ['knowledge-bases', activeTenantId],
    queryFn: () => knowledgeService.list(),
    enabled: Boolean(activeTenantId),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => tenantService.listRoles(),
  });

  const kbPermsQuery = useQuery({
    queryKey: ['knowledge-bases', activeTenantId, selectedKb?.id, 'permissions'],
    queryFn: () => knowledgeService.listPermissions(selectedKb!.id),
    enabled: Boolean(selectedKb?.id),
  });

  const form = useForm<CreateKbValues>({
    resolver: zodResolver(createKbSchema),
    defaultValues: { name: '', description: '', visibility: 'restricted' },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateKbValues) => knowledgeService.create(values),
    onSuccess: (created) => {
      setNotice({ type: 'success', text: `Knowledge base "${created.name}" created.` });
      form.reset({ name: '', description: '', visibility: 'restricted' });
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases', activeTenantId] });
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to create knowledge base.',
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: (kb: KnowledgeBase) =>
      knowledgeService.update(kb.id, {
        visibility: kb.visibility === 'tenant' ? 'restricted' : 'tenant',
      }),
    onSuccess: (updated) => {
      setNotice({
        type: 'success',
        text: `"${updated.name}" visibility updated to ${updated.visibility}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases', activeTenantId] });
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to update visibility.',
      });
    },
  });

  const grantRoleMutation = useMutation({
    mutationFn: ({ kbId, roleId, level }: { kbId: string; roleId: string; level: 'read' | 'write' | 'admin' }) => {
      const existing = (kbPermsQuery.data ?? [])
        .filter((g) => !(g.principal_type === 'role' && g.principal_id === roleId))
        .map((g) => ({
          principal_type: g.principal_type,
          principal_id: g.principal_id,
          permission_level: g.permission_level === 'deny' ? 'read' : g.permission_level,
        }));
      return knowledgeService.syncPermissions(kbId, [
        ...existing,
        { principal_type: 'role', principal_id: roleId, permission_level: level },
      ]);
    },
    onSuccess: () => {
      setNotice({ type: 'success', text: 'Knowledge base ACL grant saved.' });
      queryClient.invalidateQueries({
        queryKey: ['knowledge-bases', activeTenantId, selectedKb?.id, 'permissions'],
      });
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to save ACL permissions.',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knowledge Base Management</h1>
        <p className="text-sm text-muted-foreground">
          Organize policies and enterprise documents inside tenant-scoped, ACL-protected knowledge collections.
        </p>
      </div>

      {notice && (
        <Alert variant={notice.type === 'success' ? 'success' : 'error'}>{notice.text}</Alert>
      )}

      {hasPermission('knowledge.create') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Create Knowledge Base
            </CardTitle>
            <CardDescription>
              Restricted knowledge bases are visible only to explicitly granted users or roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
              className="grid gap-4 sm:grid-cols-4"
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="kb-name">Name</Label>
                <Input id="kb-name" placeholder="HR & Compliance Policies" {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="kb-description">Description</Label>
                <Input
                  id="kb-description"
                  placeholder="Approved SOPs, loan manuals, and employee handbooks"
                  {...form.register('description')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kb-visibility">Visibility</Label>
                <select
                  id="kb-visibility"
                  {...form.register('visibility')}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="restricted">Restricted (ACL only)</option>
                  <option value="tenant">Tenant-wide Read</option>
                </select>
              </div>

              <div className="flex justify-end sm:col-span-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Knowledge Base'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {kbsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (kbsQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No knowledge bases yet"
              description="Create your first knowledge base above to begin ingesting enterprise documents."
            />
          ) : (
            (kbsQuery.data ?? []).map((kb) => (
              <Card
                key={kb.id}
                className={selectedKb?.id === kb.id ? 'border-primary ring-1 ring-primary' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Database className="h-4 w-4 text-primary" />
                      <div>
                        <CardTitle className="text-base">{kb.name}</CardTitle>
                        <CardDescription className="text-xs">/{kb.slug}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={kb.visibility === 'restricted' ? 'warning' : 'success'}>
                        {kb.visibility === 'restricted' ? (
                          <span className="flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Restricted
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> Tenant
                          </span>
                        )}
                      </Badge>
                      <Badge variant="secondary">{kb.documents_count} docs</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0 text-xs text-muted-foreground">
                  <p className="max-w-xl">{kb.description || 'No description provided.'}</p>
                  <div className="flex items-center gap-2">
                    <span>Updated {formatUtcDate(kb.updated_at)}</span>
                    {hasPermission('knowledge.create') && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => toggleVisibilityMutation.mutate(kb)}
                        >
                          Switch to {kb.visibility === 'tenant' ? 'Restricted' : 'Tenant'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedKb(kb)}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          ACLs
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ACL Inspector Panel */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Knowledge Base ACLs</CardTitle>
            <CardDescription>
              {selectedKb
                ? `Managing explicit grants for "${selectedKb.name}"`
                : 'Select a knowledge base to inspect or grant role permissions.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedKb ? (
              <p className="text-sm text-muted-foreground">
                Pre-retrieval ACL filters verify both KB grants and confidential document policies before running SQL Server vector search.
              </p>
            ) : kbPermsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Active Grants ({(kbPermsQuery.data ?? []).length})
                  </p>
                  {(kbPermsQuery.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No explicit grants yet.</p>
                  ) : (
                    <ul className="divide-y rounded-md border text-xs">
                      {(kbPermsQuery.data ?? []).map((grant) => (
                        <li key={grant.id ?? `${grant.principal_type}-${grant.principal_id}`} className="flex items-center justify-between px-3 py-2">
                          <span className="truncate font-mono">
                            {grant.principal_type}: {grant.principal_id.slice(0, 8)}...
                          </span>
                          <Badge variant="outline" className="capitalize">
                            {grant.permission_level}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Grant Role Access
                  </p>
                  <div className="grid gap-2">
                    {(rolesQuery.data ?? []).map((role) => (
                      <div key={role.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{role.name}</span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={grantRoleMutation.isPending}
                            onClick={() =>
                              grantRoleMutation.mutate({
                                kbId: selectedKb.id,
                                roleId: role.id,
                                level: 'read',
                              })
                            }
                          >
                            Read
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={grantRoleMutation.isPending}
                            onClick={() =>
                              grantRoleMutation.mutate({
                                kbId: selectedKb.id,
                                roleId: role.id,
                                level: 'write',
                              })
                            }
                          >
                            Write
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
