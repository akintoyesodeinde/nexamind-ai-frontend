import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Play, Plus, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { knowledgeService } from '@/services/knowledge';
import { agentService, type AgentRecord } from '@/services/phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AgentsStudioPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState(
    'You are an enterprise AI compliance agent. Use only authorized retrieved policies, cite every claim with [n], and require manager approval before publishing reports.',
  );
  const [maxSteps, setMaxSteps] = React.useState(8);
  const [requireApproval, setRequireApproval] = React.useState(true);
  const [selectedTools, setSelectedTools] = React.useState<string[]>([
    'search_knowledge_base',
    'extract_document_clauses',
    'draft_compliance_report',
    'create_approval_request',
    'publish_approved_report',
  ]);
  const [selectedKbIds, setSelectedKbIds] = React.useState<string[]>([]);
  const [runGoalByAgent, setRunGoalByAgent] = React.useState<Record<string, string>>({});
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const canManage = hasPermission('agents.manage');

  const toolsQuery = useQuery({
    queryKey: ['agents', 'tools', activeTenantId],
    queryFn: () => agentService.toolsCatalog(),
    enabled: Boolean(activeTenantId),
  });

  const agentsQuery = useQuery({
    queryKey: ['agents', 'list', activeTenantId],
    queryFn: () => agentService.list(),
    enabled: Boolean(activeTenantId),
  });

  const kbQuery = useQuery({
    queryKey: ['knowledge-bases', activeTenantId],
    queryFn: () => knowledgeService.list(),
    enabled: Boolean(activeTenantId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      agentService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        max_steps: maxSteps,
        require_approval: requireApproval,
        tools: selectedTools,
        allowed_kb_ids: selectedKbIds,
      }),
    onSuccess: (created) => {
      setFeedback(`Created governed agent "${created.name}" with ${selectedTools.length} allowlisted tools.`);
      setErrorMsg(null);
      setName('');
      setDescription('');
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setFeedback(null);
    },
  });

  const launchRunMutation = useMutation({
    mutationFn: ({ agentId, goal }: { agentId: string; goal: string }) =>
      agentService.launchRun(agentId, { goal }),
    onSuccess: (run) => {
      setFeedback(`Agent run ${run.id.slice(0, 8)} finished with status "${run.status}".`);
      setErrorMsg(null);
      void queryClient.invalidateQueries({ queryKey: ['agents', 'runs'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      navigate('/agents/runs');
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setFeedback(null);
    },
  });

  const toggleTool = (toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName) ? prev.filter((t) => t !== toolName) : [...prev, toolName],
    );
  };

  const toggleKb = (kbId: string) => {
    setSelectedKbIds((prev) =>
      prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agent Studio</h1>
          <p className="text-sm text-muted-foreground">
            Configure bounded, schema-validated tool-calling agents with strict allowlists and human approval gates.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/agents/runs">View Execution History</Link>
        </Button>
      </div>

      {feedback && (
        <Alert variant="success" title="Agent action completed">
          {feedback}
        </Alert>
      )}
      {errorMsg && (
        <Alert variant="error" title="Agent request blocked">
          {errorMsg}
        </Alert>
      )}

      {/* Security Invariant Banner */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-emerald-950">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            Hard Tool Security Invariant Active: Zero raw SQL, zero OS/shell execution, and zero arbitrary outbound HTTP tools.
          </div>
          <Badge variant="success">JSON Schema Enforced</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Create Controlled Agent Form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" />
              Create Governed AI Agent
            </CardTitle>
            <CardDescription>
              Select allowed knowledge bases, enable safe tools, and cap maximum execution steps (1–12).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManage ? (
              <Alert variant="warning" title="Restricted permission">
                Creating or modifying AI agents requires the <code>agents.manage</code> permission (Owner, Admin, or Manager).
              </Alert>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="agent-name">Agent Name</Label>
                  <Input
                    id="agent-name"
                    placeholder="e.g., HR Compliance Report Agent"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent-description">Description</Label>
                  <Input
                    id="agent-description"
                    placeholder="Synthesizes cited compliance briefings for manager review"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent-prompt">System Instructions</Label>
                  <textarea
                    id="agent-prompt"
                    rows={3}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-max-steps">Max Steps (1–12)</Label>
                    <Input
                      id="agent-max-steps"
                      type="number"
                      min={1}
                      max={12}
                      value={maxSteps}
                      onChange={(e) => setMaxSteps(Number(e.target.value) || 8)}
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={requireApproval}
                        onChange={(e) => setRequireApproval(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      Require Human Approval Gate
                    </label>
                  </div>
                </div>

                {/* Allowlisted Tool Toggles */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    Allowlisted Enterprise Tools
                  </Label>
                  <div className="space-y-2 rounded-md border p-3">
                    {(toolsQuery.data ?? []).map((tool) => (
                      <label
                        key={tool.name}
                        className="flex cursor-pointer items-start justify-between gap-2 text-xs"
                      >
                        <span className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedTools.includes(tool.name)}
                            onChange={() => toggleTool(tool.name)}
                            className="mt-0.5 h-4 w-4 rounded border-input"
                          />
                          <span>
                            <span className="font-mono font-semibold text-foreground">{tool.name}</span>
                            <span className="block text-muted-foreground">{tool.description}</span>
                          </span>
                        </span>
                        <Badge variant={tool.requires_approval ? 'warning' : 'secondary'}>
                          {tool.requires_approval ? 'Approval' : tool.risk_level}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Allowed Knowledge Bases */}
                {(kbQuery.data ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Allowed Knowledge Bases (empty = all user-permitted KBs)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(kbQuery.data ?? []).map((kb) => {
                        const active = selectedKbIds.includes(kb.id);
                        return (
                          <button
                            key={kb.id}
                            type="button"
                            onClick={() => toggleKb(kb.id)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                              active
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {kb.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full"
                  disabled={!name.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? 'Creating Agent...' : 'Create Governed Agent'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Configured Agents Roster */}
        <div className="space-y-4 lg:col-span-7">
          {agentsQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (agentsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Bot className="h-6 w-6" />}
              title="No AI agents configured yet"
              description="Create a governed agent on the left or seed the flagship AI Compliance Report Workflow in the Workflows tab."
            />
          ) : (
            (agentsQuery.data ?? []).map((agent: AgentRecord) => {
              const goalValue =
                runGoalByAgent[agent.id] ??
                'Audit HR and remote work compliance obligations and draft a cited report.';
              const enabledTools = agent.tools.filter((t) => t.is_enabled);

              return (
                <Card key={agent.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Bot className="h-4 w-4 text-primary" />
                          {agent.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {agent.description || agent.system_prompt.slice(0, 140)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={agent.status === 'active' ? 'success' : 'secondary'}>
                          {agent.status}
                        </Badge>
                        {agent.require_approval && (
                          <Badge variant="warning">
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Approval Gate
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {enabledTools.map((t) => (
                        <span
                          key={t.tool_name}
                          className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground"
                        >
                          {t.tool_name}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Model: {agent.model_alias}</span>
                      <span>Max Steps: {agent.max_steps}</span>
                      <span>Token Cap: {agent.max_tokens_per_run.toLocaleString()}</span>
                    </div>

                    {canManage && (
                      <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
                        <Input
                          aria-label={`Run goal for ${agent.name}`}
                          value={goalValue}
                          onChange={(e) =>
                            setRunGoalByAgent((prev) => ({ ...prev, [agent.id]: e.target.value }))
                          }
                          placeholder="Enter agent objective..."
                          className="text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={launchRunMutation.isPending || !goalValue.trim()}
                          onClick={() =>
                            launchRunMutation.mutate({ agentId: agent.id, goal: goalValue.trim() })
                          }
                        >
                          <Play className="h-3.5 w-3.5" />
                          Run Agent
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
