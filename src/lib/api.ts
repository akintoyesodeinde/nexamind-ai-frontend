import type { ApiEnvelope, ApiErrorPayload } from '@/types/api';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, string[]>;
  public readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

let activeTenantId: string | null = null;
let csrfInitialized = false;

export function setApiTenantId(tenantId: string | null): void {
  activeTenantId = tenantId;
}

export function getApiTenantId(): string | null {
  return activeTenantId;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function ensureCsrfCookie(): Promise<void> {
  if (csrfInitialized && getCookie('XSRF-TOKEN')) {
    return;
  }
  const sanctumUrl = API_BASE.startsWith('http')
    ? new URL('/sanctum/csrf-cookie', API_BASE).toString()
    : '/sanctum/csrf-cookie';

  await fetch(sanctumUrl, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  csrfInitialized = true;
}

export function resetCsrfState(): void {
  csrfInitialized = false;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  tenantId?: string | null;
  skipTenantHeader?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const method = options.method ?? 'GET';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (method !== 'GET') {
    await ensureCsrfCookie();
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const xsrf = getCookie('XSRF-TOKEN');
  if (xsrf && method !== 'GET') {
    headers['X-XSRF-TOKEN'] = xsrf;
  }

  const effectiveTenantId =
    options.skipTenantHeader ? null : (options.tenantId ?? activeTenantId);
  if (effectiveTenantId) {
    headers['X-Tenant-ID'] = effectiveTenantId;
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (response.status === 204) {
    return {
      data: undefined as T,
      meta: {
        request_id: response.headers.get('X-Request-ID') ?? '',
        timestamp: new Date().toISOString(),
      },
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errPayload = payload as ApiErrorPayload | null;
    if (response.status === 419) {
      resetCsrfState();
    }
    throw new ApiError(
      response.status,
      errPayload?.error?.code ?? 'HTTP_ERROR',
      errPayload?.error?.message ?? `Request failed with status ${response.status}`,
      errPayload?.error?.details,
      errPayload?.meta?.request_id ?? response.headers.get('X-Request-ID') ?? undefined,
    );
  }

  return payload as ApiEnvelope<T>;
}

export async function apiUploadRequest<T>(
  path: string,
  formData: FormData,
): Promise<ApiEnvelope<T>> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  await ensureCsrfCookie();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const xsrf = getCookie('XSRF-TOKEN');
  if (xsrf) {
    headers['X-XSRF-TOKEN'] = xsrf;
  }

  if (activeTenantId) {
    headers['X-Tenant-ID'] = activeTenantId;
  }

  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errPayload = payload as ApiErrorPayload | null;
    if (response.status === 419) {
      resetCsrfState();
    }
    throw new ApiError(
      response.status,
      errPayload?.error?.code ?? 'UPLOAD_ERROR',
      errPayload?.error?.message ?? `Upload failed with status ${response.status}`,
      errPayload?.error?.details,
      errPayload?.meta?.request_id ?? response.headers.get('X-Request-ID') ?? undefined,
    );
  }

  return payload as ApiEnvelope<T>;
}
