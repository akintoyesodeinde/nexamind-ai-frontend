import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { authService } from '@/services/platform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const profileSchema = z.object({
  name: z.string().min(2).max(120),
  job_title: z.string().max(120).optional(),
  timezone: z.string().min(2).max(64),
  locale: z.string().min(2).max(16),
  citations_expanded_by_default: z.boolean(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user, refreshSession } = useAuth();
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      job_title: user?.job_title ?? '',
      timezone: user?.timezone ?? 'UTC',
      locale: user?.locale ?? 'en-US',
      citations_expanded_by_default:
        user?.preferences?.citations_expanded_by_default ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileValues) =>
      authService.updateProfile({
        name: values.name,
        job_title: values.job_title || null,
        timezone: values.timezone,
        locale: values.locale,
        preferences: {
          citations_expanded_by_default: values.citations_expanded_by_default,
        },
      }),
    onSuccess: async () => {
      await refreshSession();
      setNotice({ type: 'success', text: 'Profile and preferences updated.' });
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to update profile.',
      });
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile &amp; Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Manage your identity details and AI workspace preferences.
        </p>
      </div>

      {notice && (
        <Alert variant={notice.type === 'success' ? 'success' : 'error'}>{notice.text}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
          <CardDescription>Signed in as {user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input id="profile-name" {...form.register('name')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-job-title">Job Title</Label>
              <Input id="profile-job-title" {...form.register('job_title')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-timezone">Timezone</Label>
                <Input id="profile-timezone" {...form.register('timezone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-locale">Locale</Label>
                <Input id="profile-locale" {...form.register('locale')} />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                id="citations_expanded_by_default"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...form.register('citations_expanded_by_default')}
              />
              <Label htmlFor="citations_expanded_by_default">
                Expand verified document citations automatically in AI Chat
              </Label>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
