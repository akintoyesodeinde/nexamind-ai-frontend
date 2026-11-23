import { apiRequest, apiUploadRequest } from '@/lib/api';
import type {
  AclGrant,
  DocumentChunk,
  DocumentRecord,
  DocumentVersion,
  KnowledgeBase,
  RetrievalSearchResponse,
} from '@/types/api';

export const knowledgeService = {
  async list() {
    const res = await apiRequest<KnowledgeBase[]>('/knowledge-bases');
    return res.data;
  },

  async create(input: {
    name: string;
    slug?: string;
    description?: string;
    visibility: 'tenant' | 'restricted';
  }) {
    const res = await apiRequest<KnowledgeBase>('/knowledge-bases', {
      method: 'POST',
      body: input,
    });
    return res.data;
  },

  async update(
    id: string,
    input: Partial<Pick<KnowledgeBase, 'name' | 'description' | 'visibility' | 'status'>>,
  ) {
    const res = await apiRequest<KnowledgeBase>(`/knowledge-bases/${id}`, {
      method: 'PATCH',
      body: input,
    });
    return res.data;
  },

  async listPermissions(id: string) {
    const res = await apiRequest<AclGrant[]>(`/knowledge-bases/${id}/permissions`);
    return res.data;
  },

  async syncPermissions(
    id: string,
    grants: Array<{
      principal_type: 'user' | 'role';
      principal_id: string;
      permission_level: 'read' | 'write' | 'admin';
    }>,
  ) {
    const res = await apiRequest<AclGrant[]>(`/knowledge-bases/${id}/permissions`, {
      method: 'PUT',
      body: { grants },
    });
    return res.data;
  },
};

export const documentService = {
  async list(params?: { knowledge_base_id?: string; status?: string; search?: string }) {
    const qs = new URLSearchParams();
    if (params?.knowledge_base_id) qs.set('knowledge_base_id', params.knowledge_base_id);
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiRequest<DocumentRecord[]>(`/documents${suffix}`);
    return res.data;
  },

  async upload(input: {
    knowledge_base_id: string;
    file: File;
    access_policy?: 'inherit' | 'restricted';
    document_id?: string;
  }) {
    const formData = new FormData();
    formData.append('knowledge_base_id', input.knowledge_base_id);
    formData.append('file', input.file);
    if (input.access_policy) {
      formData.append('access_policy', input.access_policy);
    }
    if (input.document_id) {
      formData.append('document_id', input.document_id);
    }
    const res = await apiUploadRequest<{ document: DocumentRecord; version: DocumentVersion }>(
      '/documents',
      formData,
    );
    return res.data;
  },

  async versions(documentId: string) {
    const res = await apiRequest<DocumentVersion[]>(`/documents/${documentId}/versions`);
    return res.data;
  },

  async chunks(documentId: string) {
    const res = await apiRequest<DocumentChunk[]>(`/documents/${documentId}/chunks`);
    return res.data;
  },

  async downloadUrl(documentId: string) {
    const res = await apiRequest<{
      download_url: string;
      expires_in_seconds: number;
      filename: string;
    }>(`/documents/${documentId}/download-url`);
    return res.data;
  },

  async getPermissions(documentId: string) {
    const res = await apiRequest<{
      access_policy: 'inherit' | 'restricted';
      grants: AclGrant[];
    }>(`/documents/${documentId}/permissions`);
    return res.data;
  },

  async syncPermissions(
    documentId: string,
    input: {
      access_policy: 'inherit' | 'restricted';
      grants: Array<{
        principal_type: 'user' | 'role';
        principal_id: string;
        permission_level: 'read' | 'write' | 'admin' | 'deny';
      }>;
    },
  ) {
    const res = await apiRequest<{
      access_policy: 'inherit' | 'restricted';
      grants: AclGrant[];
    }>(`/documents/${documentId}/permissions`, {
      method: 'PUT',
      body: input,
    });
    return res.data;
  },

  async remove(documentId: string) {
    await apiRequest<null>(`/documents/${documentId}`, { method: 'DELETE' });
  },
};

export const retrievalService = {
  async search(input: {
    query: string;
    knowledge_base_ids?: string[];
    top_k?: number;
    min_score?: number;
  }) {
    const res = await apiRequest<RetrievalSearchResponse>('/retrieval/search', {
      method: 'POST',
      body: input,
    });
    return res.data;
  },
};
