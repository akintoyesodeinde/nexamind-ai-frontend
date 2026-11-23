import * as React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/app/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Skeleton } from '@/components/ui/feedback';
import { AgentRunsPage } from '@/features/agents/AgentRunsPage';
import { AgentsStudioPage } from '@/features/agents/AgentsStudioPage';
import { UsageAnalyticsPage } from '@/features/analytics/UsageAnalyticsPage';
import { ApprovalInboxPage } from '@/features/approvals/ApprovalInboxPage';
import { SecurityAuditPage } from '@/features/audit/SecurityAuditPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ChatWorkspacePage } from '@/features/chat/ChatWorkspacePage';
import { ConversationsPage } from '@/features/chat/ConversationsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DocumentIntelligencePage } from '@/features/documents/DocumentIntelligencePage';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { EvaluationsPage } from '@/features/evaluations/EvaluationsPage';
import { KnowledgeBasesPage } from '@/features/knowledge/KnowledgeBasesPage';
import { ProfilePage } from '@/features/settings/ProfilePage';
import { TenantSettingsPage } from '@/features/settings/TenantSettingsPage';
import { UserRolesAdminPage } from '@/features/settings/UserRolesAdminPage';
import { WorkflowsPage } from '@/features/workflows/WorkflowsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({
  children,
  requireTenant = true,
}: {
  children: React.ReactNode;
  requireTenant?: boolean;
}) {
  const { isLoading, isAuthenticated, memberships } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Skeleton className="h-32 w-96" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireTenant && memberships.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireTenant={false}>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin/users" element={<UserRolesAdminPage />} />
        <Route path="/settings/tenant" element={<TenantSettingsPage />} />
        <Route path="/settings/profile" element={<ProfilePage />} />

        {/* Phase 2 screens */}
        <Route path="/knowledge-bases" element={<KnowledgeBasesPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/intelligence" element={<DocumentIntelligencePage />} />

        {/* Phase 3 screens */}
        <Route path="/chat" element={<ChatWorkspacePage />} />
        <Route path="/chat/:conversationId" element={<ChatWorkspacePage />} />
        <Route path="/conversations" element={<ConversationsPage />} />

        {/* Phase 4 screens */}
        <Route path="/agents" element={<AgentsStudioPage />} />
        <Route path="/agents/runs" element={<AgentRunsPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/approvals" element={<ApprovalInboxPage />} />
        <Route path="/analytics/usage" element={<UsageAnalyticsPage />} />
        <Route path="/evaluations" element={<EvaluationsPage />} />
        <Route path="/security/audit" element={<SecurityAuditPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
