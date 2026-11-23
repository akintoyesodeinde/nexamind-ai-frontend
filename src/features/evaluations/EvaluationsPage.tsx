import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Play, Sparkles, XCircle } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import {
  evaluationService,
  type EvaluationDatasetRecord,
  type EvaluationRunRecord,
} from '@/services/phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { formatUtcDate } from '@/lib/utils';

export function EvaluationsPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const canView = hasPermission('analytics.view');

  const datasetsQuery = useQuery({
    queryKey: ['evaluations', 'datasets', activeTenantId],
    queryFn: () => evaluationService.listDatasets(),
    enabled: Boolean(activeTenantId) && canView,
  });

  const runsQuery = useQuery({
    queryKey: ['evaluations', 'runs', activeTenantId],
    queryFn: () => evaluationService.listRuns(),
    enabled: Boolean(activeTenantId) && canView,
  });

  const activeRunId = selectedRunId ?? runsQuery.data?.[0]?.id ?? null;

  const runDetailQuery = useQuery({
    queryKey: ['evaluations', 'run-detail', activeTenantId, activeRunId],
    queryFn: () => evaluationService.getRun(activeRunId!),
    enabled: Boolean(activeTenantId && activeRunId) && canView,
  });

  const seedMutation = useMutation({
    mutationFn: () => evaluationService.seedBenchmark(),
    onSuccess: (ds) => {
      setNotice(`Seeded benchmark dataset "${ds.name}" (${ds.cases_count} cases).`);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setNotice(null);
    },
  });

  const triggerMutation = useMutation({
    mutationFn: (datasetId: string) => evaluationService.triggerRun(datasetId),
    onSuccess: (run) => {
      setNotice(
        `Evaluation completed: ${run.passed_cases}/${run.total_cases} passed · Citation Correctness ${run.citation_correctness_pct}%.`,
      );
      setErrorMsg(null);
      setSelectedRunId(run.id);
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setNotice(null);
    },
  });

  if (!canView) {
    return (
      <Alert variant="warning" title="Evaluation access restricted">
        Viewing and running AI evaluations requires the <code>analytics.view</code> permission.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Evaluation Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Measure RAG citation correctness (&ge;95% target), groundedness, and safe abstention across curated datasets.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={seedMutation.isPending}
          onClick={() => seedMutation.mutate()}
        >
          <Sparkles className="h-4 w-4" />
          {seedMutation.isPending ? 'Seeding...' : 'Seed Curated Benchmark'}
        </Button>
      </div>

      {notice && (
        <Alert variant="success" title="Evaluation completed">
          {notice}
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="error" title="Evaluation failed">
          {errorMsg}
        </Alert>
      )}

      {/* Datasets */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Evaluation Datasets
        </h2>
        {datasetsQuery.isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (datasetsQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="No evaluation datasets yet"
            description="Seed the curated Enterprise Policy & Abstention Benchmark to test citation accuracy and safe abstention."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(datasetsQuery.data ?? []).map((ds: EvaluationDatasetRecord) => (
              <Card key={ds.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{ds.name}</CardTitle>
                      <CardDescription className="mt-1">{ds.description}</CardDescription>
                    </div>
                    <Badge variant="secondary">{ds.cases_count} cases</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Created {formatUtcDate(ds.created_at)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    disabled={triggerMutation.isPending}
                    onClick={() => triggerMutation.mutate(ds.id)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {triggerMutation.isPending ? 'Running...' : 'Run Benchmark'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Runs History + Per-Case Diff Inspector */}
      {(runsQuery.data ?? []).length > 0 && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-base">Benchmark Runs</CardTitle>
              <CardDescription>Click a run to inspect per-case accuracy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(runsQuery.data ?? []).map((run: EvaluationRunRecord) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    activeRunId === run.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">
                      {run.dataset_name ?? 'Evaluation Run'}
                    </span>
                    <Badge variant={run.meets_citation_target ? 'success' : 'warning'}>
                      {run.citation_correctness_pct}% citations
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Passed: {run.passed_cases}/{run.total_cases}
                    </span>
                    <span>{run.avg_latency_ms} ms</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle className="text-base">Run Scorecard &amp; Case Diffs</CardTitle>
              <CardDescription>
                {runDetailQuery.data
                  ? `Model: ${runDetailQuery.data.model_alias} · Cost: $${runDetailQuery.data.total_cost_usd}`
                  : 'Loading run details...'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {runDetailQuery.isLoading || !runDetailQuery.data ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] text-muted-foreground">Citation Correctness</p>
                      <p className="mt-1 text-xl font-bold">
                        {runDetailQuery.data.citation_correctness_pct}%
                      </p>
                      <Badge
                        variant={runDetailQuery.data.meets_citation_target ? 'success' : 'warning'}
                        className="mt-1"
                      >
                        {runDetailQuery.data.meets_citation_target ? '>= 95% Target Met' : 'Below 95%'}
                      </Badge>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] text-muted-foreground">Groundedness</p>
                      <p className="mt-1 text-xl font-bold">
                        {runDetailQuery.data.groundedness_score_pct}%
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-[11px] text-muted-foreground">Abstention Accuracy</p>
                      <p className="mt-1 text-xl font-bold">
                        {runDetailQuery.data.abstention_accuracy_pct}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(runDetailQuery.data.case_results ?? []).map((c) => (
                      <div key={c.case_id} className="rounded-md border p-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            {c.passed ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            )}
                            <div>
                              <p className="font-semibold text-foreground">{c.question}</p>
                              <p className="mt-1 text-muted-foreground">{c.answer_preview}</p>
                            </div>
                          </div>
                          <Badge variant={c.passed ? 'success' : 'destructive'}>
                            {c.passed ? 'PASS' : 'FAIL'}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                          <span>Category: {c.category}</span>
                          <span>Citations: {c.verified_citations_count}</span>
                          <span>Groundedness: {c.groundedness_pct}%</span>
                          <span>Abstained: {c.abstained ? 'Yes' : 'No'}</span>
                          <span>{c.latency_ms} ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
