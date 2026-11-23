import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Download,
  FileText,
  History,
  Lock,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { ApiError } from '@/lib/api';
import { formatUtcDate } from '@/lib/utils';
import { documentService, knowledgeService } from '@/services/knowledge';
import type { DocumentRecord } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label } from '@/components/ui/label';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentsPage() {
  const { activeTenantId, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [selectedKbId, setSelectedKbId] = React.useState<string>('');
  const [accessPolicy, setAccessPolicy] = React.useState<'inherit' | 'restricted'>('inherit');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedDocForVersions, setSelectedDocForVersions] = React.useState<DocumentRecord | null>(null);
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const kbsQuery = useQuery({
    queryKey: ['knowledge-bases', activeTenantId],
    queryFn: () => knowledgeService.list(),
    enabled: Boolean(activeTenantId),
  });

  React.useEffect(() => {
    if (!selectedKbId && kbsQuery.data && kbsQuery.data.length > 0) {
      setSelectedKbId(kbsQuery.data[0]!.id);
    }
  }, [kbsQuery.data, selectedKbId]);

  const docsQuery = useQuery({
    queryKey: ['documents', activeTenantId, selectedKbId],
    queryFn: () =>
      documentService.list(selectedKbId ? { knowledge_base_id: selectedKbId } : undefined),
    enabled: Boolean(activeTenantId),
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return list.some((d) => d.status === 'pending' || d.status === 'processing') ? 3000 : false;
    },
  });

  const versionsQuery = useQuery({
    queryKey: ['documents', activeTenantId, selectedDocForVersions?.id, 'versions'],
    queryFn: () => documentService.versions(selectedDocForVersions!.id),
    enabled: Boolean(selectedDocForVersions?.id),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedKbId || !selectedFile) {
        throw new Error('Select a knowledge base and file before uploading.');
      }
      return documentService.upload({
        knowledge_base_id: selectedKbId,
        file: selectedFile,
        access_policy: accessPolicy,
      });
    },
    onSuccess: (result) => {
      setNotice({
        type: 'success',
        text: `Uploaded "${result.document.filename}" (v${result.document.current_version}) — status: ${result.document.status}.`,
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['documents', activeTenantId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases', activeTenantId] });
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : (err as Error).message,
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (docId: string) => documentService.downloadUrl(docId),
    onSuccess: (res) => {
      window.open(res.download_url, '_blank', 'noopener,noreferrer');
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to issue signed download URL.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentService.remove(docId),
    onSuccess: () => {
      setNotice({ type: 'success', text: 'Document and its vector chunks deleted.' });
      queryClient.invalidateQueries({ queryKey: ['documents', activeTenantId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases', activeTenantId] });
    },
    onError: (err) => {
      setNotice({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Unable to delete document.',
      });
    },
  });

  const statusBadgeVariant = (status: DocumentRecord['status']) => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'pending':
      case 'processing':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents &amp; Ingestion Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Upload validated PDF, DOCX, TXT, MD, or CSV files into private Azure Blob Storage for semantic chunking and SQL Server vector indexing.
        </p>
      </div>

      {notice && (
        <Alert variant={notice.type === 'success' ? 'success' : 'error'}>{notice.text}</Alert>
      )}

      {hasPermission('documents.upload') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UploadCloud className="h-4 w-4" />
              Upload Document
            </CardTitle>
            <CardDescription>
              Files undergo magic-byte validation, DOCX archive safety scanning, SHA-256 checksumming, and async vector embedding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="upload-kb">Knowledge Base</Label>
                <select
                  id="upload-kb"
                  value={selectedKbId}
                  onChange={(e) => setSelectedKbId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  {(kbsQuery.data ?? []).map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="upload-policy">Document Access Policy</Label>
                <select
                  id="upload-policy"
                  value={accessPolicy}
                  onChange={(e) => setAccessPolicy(e.target.value as 'inherit' | 'restricted')}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="inherit">Inherit Knowledge Base ACL</option>
                  <option value="restricted">Confidential (Explicit ACL only)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="upload-file">Document File</Label>
                <input
                  id="upload-file"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  className="w-full"
                  disabled={!selectedKbId || !selectedFile || uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload & Ingest'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authorized Documents</CardTitle>
          <CardDescription>
            Showing documents permitted by your tenant membership, knowledge base permissions, and document ACLs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {docsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (docsQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No documents found"
              description="Upload a policy PDF, Word document, or Markdown SOP above to start vector ingestion."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2.5 pr-4">Document</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">ACL</th>
                    <th className="py-2.5 pr-4">Chunks / Pages</th>
                    <th className="py-2.5 pr-4">Version</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(docsQuery.data ?? []).map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{doc.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(doc.file_size_bytes)} · {formatUtcDate(doc.created_at)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusBadgeVariant(doc.status)} className="capitalize">
                          {doc.status}
                        </Badge>
                        {doc.error_message && (
                          <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={doc.error_message}>
                            {doc.error_message}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={doc.access_policy === 'restricted' ? 'warning' : 'outline'}>
                          {doc.access_policy === 'restricted' ? (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Restricted
                            </span>
                          ) : (
                            'Inherit'
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        {doc.chunk_count} chunks · {doc.page_count ?? 1} pg
                      </td>
                      <td className="py-3 pr-4 text-xs font-mono">v{doc.current_version}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost" title="Inspect in Document Intelligence">
                            <Link to={`/documents/intelligence?doc=${doc.id}`}>
                              <Sparkles className="h-4 w-4 text-primary" />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Version history"
                            onClick={() => setSelectedDocForVersions(doc)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Temporary SAS download"
                            onClick={() => downloadMutation.mutate(doc.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Delete document"
                            onClick={() => deleteMutation.mutate(doc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDocForVersions && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Version History — {selectedDocForVersions.filename}
              </CardTitle>
              <CardDescription>Immutable SHA-256 checksummed version snapshots</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelectedDocForVersions(null)}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {versionsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <ul className="divide-y text-xs">
                {(versionsQuery.data ?? []).map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-semibold">
                      v{v.version_number} — {v.filename} ({formatBytes(v.file_size_bytes)})
                    </span>
                    <span className="font-mono text-muted-foreground">
                      SHA-256: {v.checksum_sha256.slice(0, 16)}... · {formatUtcDate(v.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
