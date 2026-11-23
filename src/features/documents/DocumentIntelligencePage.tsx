import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { FileText, GitCompare, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { documentIntelligenceService } from '@/services/chat';
import { documentService, retrievalService } from '@/services/knowledge';
import type {
  DocumentAnalysisResponse,
  DocumentCompareResponse,
  RetrievalSearchResponse,
} from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DocumentIntelligencePage() {
  const { activeTenantId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDocId = searchParams.get('doc') ?? '';

  const [queryText, setQueryText] = React.useState('');
  const [searchResult, setSearchResult] = React.useState<RetrievalSearchResponse | null>(null);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const [analysisResult, setAnalysisResult] = React.useState<DocumentAnalysisResponse | null>(null);
  const [compareTargetId, setCompareTargetId] = React.useState<string>('');
  const [compareResult, setCompareResult] = React.useState<DocumentCompareResponse | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);

  const docsQuery = useQuery({
    queryKey: ['documents', activeTenantId, 'ready'],
    queryFn: () => documentService.list({ status: 'ready' }),
    enabled: Boolean(activeTenantId),
  });

  React.useEffect(() => {
    if (!selectedDocId && docsQuery.data && docsQuery.data.length > 0) {
      setSearchParams({ doc: docsQuery.data[0]!.id }, { replace: true });
    }
  }, [docsQuery.data, selectedDocId, setSearchParams]);

  const chunksQuery = useQuery({
    queryKey: ['documents', activeTenantId, selectedDocId, 'chunks'],
    queryFn: () => documentService.chunks(selectedDocId),
    enabled: Boolean(activeTenantId && selectedDocId),
  });

  const searchMutation = useMutation({
    mutationFn: () => retrievalService.search({ query: queryText.trim(), top_k: 6 }),
    onSuccess: (data) => {
      setSearchError(null);
      setSearchResult(data);
    },
    onError: (err) => {
      setSearchError(err instanceof ApiError ? err.message : 'Semantic search failed.');
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (action: 'summarize' | 'classify' | 'extract_structured') =>
      documentIntelligenceService.analyze(selectedDocId, { action }),
    onSuccess: (data) => {
      setAiError(null);
      setAnalysisResult(data);
    },
    onError: (err) => {
      setAiError(err instanceof ApiError ? err.message : 'Document analysis failed.');
    },
  });

  const compareMutation = useMutation({
    mutationFn: () =>
      documentIntelligenceService.compare({
        document_a_id: selectedDocId,
        document_b_id: compareTargetId,
      }),
    onSuccess: (data) => {
      setAiError(null);
      setCompareResult(data);
    },
    onError: (err) => {
      setAiError(err instanceof ApiError ? err.message : 'Document comparison failed.');
    },
  });

  const selectedDoc = (docsQuery.data ?? []).find((d) => d.id === selectedDocId) ?? null;
  const comparableDocs = (docsQuery.data ?? []).filter((d) => d.id !== selectedDocId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Intelligence Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Summarize, classify, extract structured fields, compare policies, inspect chunks, and test ACL-enforced vector search.
        </p>
      </div>

      {/* Live Semantic Vector Retrieval Bench */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-primary" />
            ACL-Enforced Vector Retrieval Tester
          </CardTitle>
          <CardDescription>
            Queries SQL Server 2025 native VECTOR(1536) cosine similarity strictly across documents you are authorized to access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (queryText.trim().length >= 2) searchMutation.mutate();
            }}
            className="flex flex-wrap gap-2"
          >
            <Input
              aria-label="Semantic retrieval query"
              placeholder="e.g., What are our commercial loan approval thresholds?"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={queryText.trim().length < 2 || searchMutation.isPending}>
              {searchMutation.isPending ? 'Searching...' : 'Run Vector Search'}
            </Button>
          </form>

          {searchError && <Alert variant="error">{searchError}</Alert>}

          {searchResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">Adapter: {searchResult.adapter}</Badge>
                <Badge variant="outline">
                  Authorized Docs Scoped: {searchResult.authorized_document_count}
                </Badge>
                <span>{searchResult.results.length} matches returned</span>
              </div>

              {searchResult.results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No authorized chunks matched this query.</p>
              ) : (
                <div className="space-y-2">
                  {searchResult.results.map((hit) => (
                    <div key={hit.chunk_id} className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-foreground">
                          {hit.filename}
                          {hit.page_number ? ` · Page ${hit.page_number}` : ''}
                          {hit.section_heading ? ` · ${hit.section_heading}` : ''}
                        </span>
                        <Badge variant="success">Cosine {(hit.score * 100).toFixed(1)}%</Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{hit.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Selector + AI Intelligence + Chunks */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Indexed Documents</CardTitle>
            <CardDescription>Select a ready document to analyze or inspect.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {docsQuery.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (docsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No indexed documents available yet. Upload one on the Documents screen.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="doc-inspector-select" className="sr-only">
                  Select document
                </Label>
                {(docsQuery.data ?? []).map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      setAnalysisResult(null);
                      setCompareResult(null);
                      setSearchParams({ doc: doc.id });
                    }}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      doc.id === selectedDocId
                        ? 'border-primary bg-primary/5 font-semibold text-primary'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{doc.filename}</span>
                    </span>
                    <Badge variant="secondary">{doc.chunk_count}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {/* Live AI Analysis & Comparison Controls */}
          {selectedDoc && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Document Intelligence — {selectedDoc.filename}
                </CardTitle>
                <CardDescription>
                  Grounded analysis metered against tenant monthly token and USD budgets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiError && <Alert variant="error">{aiError}</Alert>}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={analyzeMutation.isPending}
                    onClick={() => analyzeMutation.mutate('summarize')}
                  >
                    Summarize
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={analyzeMutation.isPending}
                    onClick={() => analyzeMutation.mutate('classify')}
                  >
                    Classify
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={analyzeMutation.isPending}
                    onClick={() => analyzeMutation.mutate('extract_structured')}
                  >
                    Extract Structured Fields
                  </Button>
                </div>

                {comparableDocs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <GitCompare className="h-4 w-4 text-muted-foreground" />
                    <select
                      aria-label="Compare against document"
                      value={compareTargetId}
                      onChange={(e) => setCompareTargetId(e.target.value)}
                      className="h-9 rounded-md border border-input bg-card px-2.5 text-xs"
                    >
                      <option value="">Select second document to compare...</option>
                      {comparableDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!compareTargetId || compareMutation.isPending}
                      onClick={() => compareMutation.mutate()}
                    >
                      {compareMutation.isPending ? 'Comparing...' : 'Compare Policies'}
                    </Button>
                  </div>
                )}

                {analysisResult && (
                  <div className="rounded-md border bg-muted/30 p-3.5 text-xs">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="success" className="capitalize">
                        {analysisResult.action.replace('_', ' ')}
                      </Badge>
                      <span className="text-muted-foreground">
                        {analysisResult.usage.input_tokens + analysisResult.usage.output_tokens} tok · ${analysisResult.cost_usd}
                      </span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
                      {JSON.stringify(analysisResult.result, null, 2)}
                    </pre>
                  </div>
                )}

                {compareResult && (
                  <div className="rounded-md border bg-muted/30 p-3.5 text-xs">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="secondary">
                        Comparison: {compareResult.document_a.filename} vs {compareResult.document_b.filename}
                      </Badge>
                      <span className="text-muted-foreground">${compareResult.cost_usd}</span>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
                      {JSON.stringify(compareResult.comparison, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chunk Inspector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedDoc ? `Semantic Chunks — ${selectedDoc.filename}` : 'Chunk Inspector'}
              </CardTitle>
              <CardDescription>
                {selectedDoc
                  ? `${selectedDoc.chunk_count} chunks · ${selectedDoc.character_count.toLocaleString()} chars · v${selectedDoc.current_version}`
                  : 'Select an indexed document on the left.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedDocId ? (
                <EmptyState
                  title="No document selected"
                  description="Choose an indexed document to inspect semantic chunks and page offsets."
                />
              ) : chunksQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (chunksQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No chunks recorded for this document.</p>
              ) : (
                <div className="space-y-3">
                  {(chunksQuery.data ?? []).map((chunk) => (
                    <div key={chunk.id} className="rounded-md border p-3.5 text-sm">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Chunk #{chunk.chunk_index + 1}
                          {chunk.section_heading ? ` — ${chunk.section_heading}` : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          {chunk.page_number !== null && (
                            <Badge variant="outline">Page {chunk.page_number}</Badge>
                          )}
                          <Badge variant="secondary">~{chunk.token_estimate} tokens</Badge>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
