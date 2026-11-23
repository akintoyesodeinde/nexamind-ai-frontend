import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Coins, Cpu, Gauge, Users } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { analyticsService } from '@/services/phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Skeleton } from '@/components/ui/feedback';

export function UsageAnalyticsPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const [days, setDays] = React.useState(30);

  const canView = hasPermission('analytics.view');

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', activeTenantId, days],
    queryFn: () => analyticsService.overview(days),
    enabled: Boolean(activeTenantId) && canView,
  });

  const usageQuery = useQuery({
    queryKey: ['analytics', 'usage', activeTenantId, days],
    queryFn: () => analyticsService.usage(days),
    enabled: Boolean(activeTenantId) && canView,
  });

  if (!canView) {
    return (
      <Alert variant="warning" title="Analytics access restricted">
        Viewing AI usage and cost dashboards requires the <code>analytics.view</code> permission.
      </Alert>
    );
  }

  if (overviewQuery.isLoading || usageQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const overview = overviewQuery.data;
  const usage = usageQuery.data;

  if (!overview || !usage) {
    return (
      <Alert variant="error" title="Unable to load analytics">
        Could not retrieve AI usage and cost telemetry.
      </Alert>
    );
  }

  const maxDailyTokens = Math.max(1, ...usage.daily_trend.map((d) => d.total_tokens));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Usage &amp; Cost Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Monitor token consumption, latency, model distribution, and fixed-precision DECIMAL(18,6) USD spend.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total AI Requests ({days}d)</CardDescription>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.ai_usage.total_requests}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.ai_usage.verified_citations_count} verified citations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Monthly Token Usage</CardDescription>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.budget.monthly_tokens_used.toLocaleString()}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(overview.budget.token_utilization_pct, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.budget.token_utilization_pct}% of{' '}
              {overview.budget.monthly_token_budget.toLocaleString()} ceiling
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Monthly Cost (USD)</CardDescription>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${overview.budget.monthly_cost_usd}</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${Math.min(overview.budget.cost_utilization_pct, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.budget.cost_utilization_pct}% of ${overview.budget.monthly_cost_budget_usd} limit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Avg Latency &amp; Quality</CardDescription>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.ai_usage.avg_latency_ms} ms</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Abstention: {overview.ai_usage.abstention_rate_pct}% · Feedback: +
              {overview.ai_usage.positive_feedback_count} / -{overview.ai_usage.negative_feedback_count}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Bar Chart + Top Consumers */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">Daily Token Consumption Trend</CardTitle>
            <CardDescription>UTC daily aggregated usage across RAG, Document Intelligence, and Agents</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.daily_trend.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No AI consumption records yet in the last {days} days.
              </p>
            ) : (
              <div className="space-y-2.5">
                {usage.daily_trend.map((day) => {
                  const pct = Math.max(4, Math.round((day.total_tokens / maxDailyTokens) * 100));
                  return (
                    <div key={day.date} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-muted-foreground">{day.date}</span>
                        <span className="font-medium">
                          {day.total_tokens.toLocaleString()} tok · {day.requests} req · ${day.cost_usd}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
                        <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Top Organization Consumers
            </CardTitle>
            <CardDescription>Tenant-scoped member token consumption</CardDescription>
          </CardHeader>
          <CardContent>
            {usage.top_consumers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No user activity yet.</p>
            ) : (
              <ul className="divide-y text-xs">
                {usage.top_consumers.map((c) => (
                  <li key={c.user_id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-muted-foreground">{c.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{c.total_tokens.toLocaleString()} tok</p>
                      <p className="text-muted-foreground">${c.cost_usd}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model Distribution Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Breakdown by AI Model</CardTitle>
          <CardDescription>Provider-agnostic gateway telemetry</CardDescription>
        </CardHeader>
        <CardContent>
          {usage.by_model.length === 0 ? (
            <p className="text-sm text-muted-foreground">No model invocations recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-4">Model Alias</th>
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Requests</th>
                    <th className="py-2 pr-4">Input / Output Tokens</th>
                    <th className="py-2 pr-4">Avg Latency</th>
                    <th className="py-2 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usage.by_model.map((row) => (
                    <tr key={`${row.provider_key}-${row.model_alias}`}>
                      <td className="py-2.5 pr-4 font-mono font-medium">{row.model_alias}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="secondary">{row.provider_key}</Badge>
                      </td>
                      <td className="py-2.5 pr-4">{row.requests}</td>
                      <td className="py-2.5 pr-4">
                        {row.input_tokens.toLocaleString()} / {row.output_tokens.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4">{row.avg_latency_ms} ms</td>
                      <td className="py-2.5 text-right font-mono">${row.cost_usd}</td>
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
