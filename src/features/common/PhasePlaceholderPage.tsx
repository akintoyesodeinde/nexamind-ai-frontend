import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PhasePlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <Badge variant="secondary">{phase}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled Module</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This enterprise screen is wired into the authenticated, tenant-scoped application shell
          and will be activated in {phase} once the Phase 1 foundation gate is signed off.
        </CardContent>
      </Card>
    </div>
  );
}
