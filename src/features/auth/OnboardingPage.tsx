import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Shield } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { slugify } from '@/lib/utils';
import { tenantService } from '@/services/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/feedback';

const onboardingSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(120),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { refreshSession, selectTenant, memberships } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { name: '', slug: '' },
  });

  const nameValue = form.watch('name');
  React.useEffect(() => {
    if (!form.formState.dirtyFields.slug) {
      form.setValue('slug', slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, form]);

  const onSubmit = async (values: OnboardingValues) => {
    setServerError(null);
    try {
      const result = await tenantService.createTenant(values);
      await refreshSession();
      selectTenant(result.tenant.id);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to create organization.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Organization Onboarding</h1>
            <p className="text-sm text-muted-foreground">
              Provision an isolated tenant boundary for your knowledge bases and AI workflows.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create an organization</CardTitle>
            <CardDescription>
              You will be assigned the Owner role with default token quotas and audit logging enabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {serverError && (
              <Alert variant="error" className="mb-4">
                {serverError}
              </Alert>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Acme Financial Corp"
                  {...form.register('name')}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="org-slug">Tenant Slug</Label>
                <Input id="org-slug" placeholder="acme-financial-corp" {...form.register('slug')} />
                {form.formState.errors.slug && (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>

              <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Isolation Guarantee
                </span>
                All documents, vector embeddings, conversations, agents, and audit records are
                strictly tenant-scoped at the database and retrieval layers.
              </div>

              <div className="flex items-center justify-end gap-2">
                {memberships.length > 0 && (
                  <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Creating...' : 'Create Organization'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
