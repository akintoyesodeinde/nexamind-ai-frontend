import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { tenantService } from '@/services/platform';
import type { RoleSlug } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const addMemberSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  name: z.string().max(120).optional(),
  role_slug: z.enum(['owner', 'admin', 'manager', 'member', 'viewer']),
});

type AddMemberValues = z.infer<typeof addMemberSchema>;

export function UserRolesAdminPage() {
  const { activeTenantId, hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const membersQuery = useQuery({
    queryKey: ['tenant', 'members', activeTenantId],
    queryFn: () => tenantService.listMembers(),
    enabled: Boolean(activeTenantId),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => tenantService.listRoles(),
  });

  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '', name: '', role_slug: 'member' },
  });

  const addMutation = useMutation({
    mutationFn: (values: AddMemberValues) => tenantService.addMember(values),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Member added to organization.' });
      form.reset({ email: '', name: '', role_slug: 'member' });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'members', activeTenantId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to add member.',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role_slug }: { id: string; role_slug: RoleSlug }) =>
      tenantService.updateMember(id, { role_slug }),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Member role updated.' });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'members', activeTenantId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to update role.',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => tenantService.removeMember(id),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Member removed from organization.' });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'members', activeTenantId] });
    },
    onError: (err) => {
      setFeedback({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to remove member.',
      });
    },
  });

  if (!hasPermission('users.manage')) {
    return (
      <Alert variant="error" title="Insufficient permissions">
        Only organization Owners and Admins can manage users and RBAC roles.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User &amp; Role Administration</h1>
        <p className="text-sm text-muted-foreground">
          Manage tenant memberships and RBAC role assignments. Backend policies enforce all access rules.
        </p>
      </div>

      {feedback && (
        <Alert variant={feedback.type === 'success' ? 'success' : 'error'}>
          {feedback.text}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Add Organization Member
          </CardTitle>
          <CardDescription>
            Add an existing user by email or provision an invited member record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((v) => addMutation.mutate(v))}
            className="grid gap-4 sm:grid-cols-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="analyst@company.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-name">Name (for new user)</Label>
              <Input id="member-name" placeholder="Alex Rivera" {...form.register('name')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-role">Role</Label>
              <select
                id="member-role"
                {...form.register('role_slug')}
                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(rolesQuery.data ?? [
                  { slug: 'owner', name: 'Owner' },
                  { slug: 'admin', name: 'Admin' },
                  { slug: 'manager', name: 'Manager' },
                  { slug: 'member', name: 'Member' },
                  { slug: 'viewer', name: 'Viewer' },
                ]).map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                {addMutation.isPending ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersQuery.isLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : (membersQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No members found"
              description="Invite team members above to collaborate inside this tenant."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2.5 pr-4">User</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Role</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(membersQuery.data ?? []).map((member) => (
                    <tr key={member.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">
                          {member.name} {member.user_id === user?.id && '(You)'}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={member.status === 'active' ? 'success' : 'warning'}>
                          {member.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          aria-label={`Role for ${member.email}`}
                          value={member.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({
                              id: member.id,
                              role_slug: e.target.value as RoleSlug,
                            })
                          }
                          className="h-8 rounded-md border border-input bg-card px-2 text-xs font-medium capitalize"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={member.user_id === user?.id || removeMutation.isPending}
                          onClick={() => removeMutation.mutate(member.id)}
                          aria-label={`Remove ${member.email}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
