import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { tenantService } from '@/services/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const settingsSchema = z.object({
  default_chat_model: z.string().min(2).max(100),
  default_embedding_model: z.string().min(2).max(100),
  max_upload_mb: z.coerce.number().int().min(1).max(100),
  monthly_token_budget: z.coerce.number().int().min(1000).max(500_000_000),
  monthly_cost_budget_usd: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Enter a valid decimal USD amount'),
  retention_days: z.coerce.number().int().min(7).max(3650),
  require_approval_for_external_actions: z.boolean(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export function TenantSettingsPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const tenantQuery = useQuery({
    queryKey: ['tenant', 'current', activeTenantId],
    queryFn: () => tenantService.getCurrent(),
    enabled: Boolean(activeTenantId),
  });

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      default_chat_model: 'default-chat',
      default_embedding_model: 'default-embedding',
      max_upload_mb: 20,
      monthly_token_budget: 500000,
      monthly_cost_budget_usd: '25.000000',
      retention_days: 365,
      require_approval_for_external_actions: true,
    },
  });

  React.useEffect(() => {
    if (tenantQuery.data?.settings) {
      const s = tenantQuery.data.settings;
      form.reset({
        default_chat_model: s.default_chat_model,
        default_embedding_model: s.default_embedding_model,
        max_upload_mb: s.max_upload_mb,
        monthly_token_budget: s.monthly_token_budget,
        monthly_cost_budget_usd: s.monthly_cost_budget_usd,
        retention_days: s.retention_days,
        require_approval_for_external_actions: s.require_approval_for_external_actions,
      });
    }
  }, [tenantQuery.data?.settings, form]);

  const mutation = useMutation({
    mutationFn: (values: SettingsValues) => tenantService.updateSettings(values),
    onSuccess: () => {
      setNotice({ type: 'success', text: 'Tenant governance settings saved.' });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'current', activeTenantId] });
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to save settings.',
      });
    },
  });

  if (!hasPermission('tenant.settings.manage')) {
    return (
      <Alert variant="error" title="Insufficient permissions">
        Tenant settings require Owner or Admin privileges.
      </Alert>
    );
  }

  if (tenantQuery.isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tenant Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure AI model defaults, sandbox token/cost ceilings, upload limits, and human approval controls.
        </p>
      </div>

      {notice && (
        <Alert variant={notice.type === 'success' ? 'success' : 'error'}>{notice.text}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Governance &amp; Quotas</CardTitle>
          <CardDescription>
            Monetary ceilings are stored as fixed-precision DECIMAL(18,6) in SQL Server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="grid gap-5 sm:grid-cols-2"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="default_chat_model">Default Chat Model Alias</Label>
              <Input id="default_chat_model" {...form.register('default_chat_model')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="default_embedding_model">Default Embedding Model Alias</Label>
              <Input id="default_embedding_model" {...form.register('default_embedding_model')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max_upload_mb">Max Document Upload Size (MB)</Label>
              <Input id="max_upload_mb" type="number" {...form.register('max_upload_mb')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retention_days">Retention Policy (Days)</Label>
              <Input id="retention_days" type="number" {...form.register('retention_days')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monthly_token_budget">Monthly Token Budget</Label>
              <Input
                id="monthly_token_budget"
                type="number"
                {...form.register('monthly_token_budget')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monthly_cost_budget_usd">Monthly Cost Ceiling (USD)</Label>
              <Input id="monthly_cost_budget_usd" {...form.register('monthly_cost_budget_usd')} />
              {form.formState.errors.monthly_cost_budget_usd && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.monthly_cost_budget_usd.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="require_approval_for_external_actions"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...form.register('require_approval_for_external_actions')}
              />
              <Label htmlFor="require_approval_for_external_actions">
                Require human approval before AI agents execute consequential actions
              </Label>
            </div>

            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
