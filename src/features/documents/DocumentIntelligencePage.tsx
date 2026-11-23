import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { FileText, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { documentService, retrievalService } from '@/services/knowledge';
import type { RetrievalSearchResponse } from '@/types/api';
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
    mutationFn: () =>
      retrievalService.search({
        query: queryText.trim(),
        top_k: 6,
      }),
    onSuccess: (data) => {
      setSearchError(null);
      setSearchResult(data);
    },
    onError: (err) => {
      setSearchError(err instanceof ApiError ? err.message : 'Semantic search failed.');
    },
  });

  const selectedDoc = (docsQuery.data ?? []).find((d) => d.id === selectedDocId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Intelligence Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Inspect extracted semantic chunks, verify page references, and run pre-retrieval ACL-enforced SQL Server vector search.
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
                <p className="text-sm text-muted-foreground">
                  No authorized chunks matched this query.
                </p>
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
                        <Badge variant="success">
                          Cosine {(hit.score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {hit.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Chunk Inspector */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Indexed Documents</CardTitle>
            <CardDescription>Select a ready document to inspect its chunks.</CardDescription>
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
                    onClick={() => setSearchParams({ doc: doc.id })}
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

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {selectedDoc ? `Semantic Chunks — ${selectedDoc.filename}` : 'Chunk Inspector'}
              </CardTitle>
              <CardDescription>
                {selectedDoc
                  ? `${selectedDoc.chunk_count} chunks · ${selectedDoc.character_count.toLocaleString()} chars · v${selectedDoc.current_version}`
                  : 'Select an indexed document on the left.'}
              </CardDescription>
            </div>
            <Badge variant="outline">AI Summarize / Extract (Phase 3)</Badge>
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
  );
}
