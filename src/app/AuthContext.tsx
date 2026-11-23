import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setApiTenantId } from '@/lib/api';
import { authService } from '@/services/platform';
import type { MePayload, RoleSlug, TenantMembershipSummary } from '@/types/api';

const ACTIVE_TENANT_STORAGE_KEY = 'nexamind_active_tenant_id';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: MePayload['user'] | null;
  memberships: TenantMembershipSummary[];
  activeMembership: TenantMembershipSummary | null;
  activeTenantId: string | null;
  activeRole: RoleSlug | null;
  hasPermission: (permission: string) => boolean;
  selectTenant: (tenantId: string) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = React.useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
    retry: false,
    staleTime: 60_000,
  });

  const memberships = React.useMemo(
    () => meQuery.data?.memberships ?? [],
    [meQuery.data?.memberships],
  );

  const activeMembership = React.useMemo(() => {
    if (memberships.length === 0) return null;
    if (selectedTenantId) {
      const matched = memberships.find((m) => m.tenant.id === selectedTenantId);
      if (matched) return matched;
    }
    return memberships[0] ?? null;
  }, [memberships, selectedTenantId]);

  const activeTenantId = activeMembership?.tenant.id ?? null;

  React.useEffect(() => {
    setApiTenantId(activeTenantId);
    try {
      if (activeTenantId) {
        window.sessionStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, activeTenantId);
      } else {
        window.sessionStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
      }
    } catch {
      // ignore storage restrictions
    }
  }, [activeTenantId]);

  const selectTenant = React.useCallback(
    (tenantId: string) => {
      setSelectedTenantId(tenantId);
      setApiTenantId(tenantId);
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
    },
    [queryClient],
  );

  const refreshSession = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    await meQuery.refetch();
  }, [meQuery, queryClient]);

  const logout = React.useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setApiTenantId(null);
      setSelectedTenantId(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const hasPermission = React.useCallback(
    (permission: string) => {
      if (!activeMembership) return false;
      return activeMembership.permissions.includes(permission);
    },
    [activeMembership],
  );

  const value: AuthContextValue = {
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data?.user),
    user: meQuery.data?.user ?? null,
    memberships,
    activeMembership,
    activeTenantId,
    activeRole: activeMembership?.role ?? null,
    hasPermission,
    selectTenant,
    refreshSession,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
