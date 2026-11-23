import * as React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  CheckSquare,
  Database,
  FileText,
  GitBranch,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  phaseBadge?: string;
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'AI Chat', to: '/chat', icon: MessageSquare },
      { label: 'Conversations', to: '/conversations', icon: History },
    ],
  },
  {
    title: 'Knowledge',
    items: [
      { label: 'Knowledge Bases', to: '/knowledge-bases', icon: Database },
      { label: 'Documents', to: '/documents', icon: FileText },
      { label: 'Doc Intelligence', to: '/documents/intelligence', icon: Sparkles },
    ],
  },
  {
    title: 'Automation',
    items: [
      { label: 'AI Agent Studio', to: '/agents', icon: Bot, phaseBadge: 'P4' },
      { label: 'Agent Runs', to: '/agents/runs', icon: Activity, phaseBadge: 'P4' },
      { label: 'Workflows', to: '/workflows', icon: GitBranch, phaseBadge: 'P4' },
      { label: 'Approval Inbox', to: '/approvals', icon: CheckSquare, phaseBadge: 'P4' },
    ],
  },
  {
    title: 'Governance & Admin',
    items: [
      { label: 'Usage & Cost', to: '/analytics/usage', icon: BarChart3, phaseBadge: 'P4' },
      { label: 'AI Evaluations', to: '/evaluations', icon: Sparkles, phaseBadge: 'P4' },
      {
        label: 'Users & Roles',
        to: '/admin/users',
        icon: Users,
        permission: 'users.manage',
      },
      {
        label: 'Tenant Settings',
        to: '/settings/tenant',
        icon: Settings,
        permission: 'tenant.settings.manage',
      },
      {
        label: 'Security Audit',
        to: '/security/audit',
        icon: ShieldCheck,
        permission: 'audit.view',
        phaseBadge: 'P4',
      },
      { label: 'Profile', to: '/settings/profile', icon: UserCircle },
    ],
  },
];

export function AppShell() {
  const { user, memberships, activeMembership, selectTenant, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
            N
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-white">NexaMind AI</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Enterprise Platform</p>
          </div>
        </Link>
        <button
          type="button"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Organization Switcher */}
      <div className="border-b border-slate-800 p-3">
        <label
          htmlFor="org-switcher"
          className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400"
        >
          <Building2 className="h-3.5 w-3.5" />
          Organization
        </label>
        <div className="flex items-center gap-1.5">
          <select
            id="org-switcher"
            aria-label="Active Organization"
            value={activeMembership?.tenant.id ?? ''}
            onChange={(e) => selectTenant(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {memberships.map((m) => (
              <option key={m.tenant.id} value={m.tenant.id}>
                {m.tenant.name} ({m.role})
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Create organization"
            onClick={() => navigate('/onboarding')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-blue-600/20 text-blue-300'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                          )
                        }
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </span>
                        {item.phaseBadge && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                            {item.phaseBadge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center justify-between gap-2 rounded-md bg-slate-900 px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
            <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Sign out"
            className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw]">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {activeMembership?.tenant.name ?? 'No Organization Selected'}
              </p>
              <p className="text-xs text-muted-foreground">
                Tenant-isolated workspace · SQL Server + Sanctum RBAC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeMembership && (
              <Badge variant="secondary" className="capitalize">
                Role: {activeMembership.role}
              </Badge>
            )}
            <Link
              to="/settings/profile"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {user?.name}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
