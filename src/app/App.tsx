import * as React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/app/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Skeleton } from '@/components/ui/feedback';
import { LoginPage } from '@/features/auth/LoginPage';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { PhasePlaceholderPage } from '@/features/common/PhasePlaceholderPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DocumentIntelligencePage } from '@/features/documents/DocumentIntelligencePage';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { KnowledgeBasesPage } from '@/features/knowledge/KnowledgeBasesPage';
import { ProfilePage } from '@/features/settings/ProfilePage';
import { TenantSettingsPage } from '@/features/settings/TenantSettingsPage';
import { UserRolesAdminPage } from '@/features/settings/UserRolesAdminPage';

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
        <Route
          path="/chat"
          element={
            <PhasePlaceholderPage
              title="AI Chat Workspace"
              phase="Phase 3"
              description="Grounded RAG question answering with live SSE streaming and verifiable document citations."
            />
          }
        />
        <Route
          path="/conversations"
          element={
            <PhasePlaceholderPage
              title="Conversation History"
              phase="Phase 3"
              description="Browse and resume tenant-scoped AI conversations."
            />
          }
        />

        {/* Phase 4 screens */}
        <Route
          path="/agents"
          element={
            <PhasePlaceholderPage
              title="AI Agent Studio"
              phase="Phase 4"
              description="Configure allowlisted tool-calling agents with JSON Schema validation and human approval policies."
            />
          }
        />
        <Route
          path="/agents/runs"
          element={
            <PhasePlaceholderPage
              title="Agent Execution History"
              phase="Phase 4"
              description="Inspect step-by-step stateful agent runs, tool inputs/outputs, and audit traces."
            />
          }
        />
        <Route
          path="/workflows"
          element={
            <PhasePlaceholderPage
              title="Workflow Management"
              phase="Phase 4"
              description="Define and launch multi-step automated workflows including compliance reporting."
            />
          }
        />
        <Route
          path="/approvals"
          element={
            <PhasePlaceholderPage
              title="Approval Inbox"
              phase="Phase 4"
              description="Review, approve, or reject AI-proposed actions with idempotent execution guarantees."
            />
          }
        />
        <Route
          path="/analytics/usage"
          element={
            <PhasePlaceholderPage
              title="AI Usage & Cost Analytics"
              phase="Phase 4"
              description="Track token consumption, latency, model usage, and DECIMAL(18,6) cost ceilings."
            />
          }
        />
        <Route
          path="/evaluations"
          element={
            <PhasePlaceholderPage
              title="AI Evaluation Dashboard"
              phase="Phase 4"
              description="Benchmark citation accuracy (>=95% target), groundedness, and safe abstention."
            />
          }
        />
        <Route
          path="/security/audit"
          element={
            <PhasePlaceholderPage
              title="Security Audit Dashboard"
              phase="Phase 4"
              description="Search tamper-evident hash-chained audit logs and security events."
            />
          }
        />
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
