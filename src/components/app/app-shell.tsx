import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import {
  BarChart3,
  FileText,
  LogOut,
  MessageSquareText,
  PenLine,
  Plus,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ThemeToggle } from '@/lib/theme'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/app/$workspaceId/chat', label: 'Chat', icon: MessageSquareText },
  { to: '/app/$workspaceId/documents', label: 'Documents', icon: FileText },
  { to: '/app/$workspaceId/write', label: 'Write', icon: PenLine },
  { to: '/app/$workspaceId/audit', label: 'Audit', icon: BarChart3 },
  { to: '/app/$workspaceId/settings', label: 'Settings', icon: Settings },
] as const

export function AppShell({
  children,
  workspaceId,
}: {
  children: ReactNode
  workspaceId: Id<'workspaces'>
}) {
  const navigate = useNavigate()
  const { signOut } = useAuthActions()
  const me = useQuery(api.users.me)
  const workspaces = useQuery(api.workspaces.listMine)

  return (
    <div className="grid h-svh grid-cols-1 bg-background text-foreground lg:grid-cols-[250px_1fr]">
      <aside className="hidden h-svh flex-col border-r border-border bg-card lg:flex">
        <Link
          className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 no-underline"
          to="/"
        >
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="display-title text-sm font-bold tracking-tight text-foreground">
              CAIO
            </p>
            <p className="text-[11px] text-muted-foreground">
              Chief Intelligence Officer
            </p>
          </div>
        </Link>

        <div className="border-b border-border p-3">
          <label
            className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            htmlFor="workspace-switcher"
          >
            Workspace
          </label>
          <div className="flex items-center gap-1.5">
            <select
              className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
              id="workspace-switcher"
              onChange={(event) => {
                const value = event.target.value
                if (value === '__new__') {
                  navigate({ to: '/onboarding' })
                } else {
                  navigate({
                    to: '/app/$workspaceId/chat',
                    params: { workspaceId: value },
                  })
                }
              }}
              value={workspaceId}
            >
              {(workspaces ?? []).map((workspace) => (
                <option key={workspace._id} value={workspace._id}>
                  {workspace.name}
                </option>
              ))}
              <option value="__new__">+ New workspace…</option>
            </select>
            <Link
              aria-label="New workspace"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground no-underline hover:bg-accent hover:text-accent-foreground"
              to="/onboarding"
            >
              <Plus size={15} />
            </Link>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {navItems.map((item) => (
            <Link
              activeProps={{
                className: 'bg-accent text-accent-foreground',
              }}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground',
              )}
              key={item.to}
              params={{ workspaceId }}
              to={item.to}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {me?.name ?? me?.email ?? 'Signed in'}
              </p>
              {me?.name && me.email ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  {me.email}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ThemeToggle />
              <button
                aria-label="Sign out"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  void signOut().then(() => navigate({ to: '/' }))
                }}
                type="button"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <Link className="flex items-center gap-2 no-underline" to="/">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck size={15} />
          </div>
          <span className="display-title text-sm font-bold text-foreground">
            CAIO
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          {navItems.map((item) => (
            <Link
              activeProps={{ className: 'bg-accent text-accent-foreground' }}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground"
              key={item.to}
              params={{ workspaceId }}
              to={item.to}
            >
              <item.icon size={16} />
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>

      <main className="flex min-h-0 flex-col overflow-hidden">{children}</main>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/50 px-6 py-4">
      <div>
        <h1 className="display-title text-xl font-bold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </header>
  )
}

export function PageScroll({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
}
