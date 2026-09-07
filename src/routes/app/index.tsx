import { useEffect } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowRight, Building2, Plus, ShieldCheck } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/lib/theme'

export const Route = createFileRoute('/app/')({
  component: WorkspacePicker,
})

function WorkspacePicker() {
  const navigate = useNavigate()
  const workspaces = useQuery(api.workspaces.listMine)

  // No workspaces yet → onboarding is the only sensible destination.
  useEffect(() => {
    if (workspaces && workspaces.length === 0) {
      navigate({ to: '/onboarding' })
    }
  }, [workspaces, navigate])

  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="page-wrap flex h-16 items-center justify-between">
          <Link className="flex items-center gap-3 no-underline" to="/">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck size={18} />
            </div>
            <span className="display-title text-lg font-bold tracking-tight text-foreground">
              CAIO
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="page-wrap max-w-2xl py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="display-title text-2xl font-bold">Your workspaces</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Each workspace is an isolated company environment.
            </p>
          </div>
          <Link to="/onboarding">
            <Button size="sm" variant="secondary">
              <Plus className="mr-1.5" size={14} />
              New workspace
            </Button>
          </Link>
        </div>

        <ul className="space-y-3">
          {(workspaces ?? []).map((workspace) => (
            <li key={workspace._id}>
              <Link
                className="island-shell flex items-center justify-between rounded-2xl p-5 no-underline transition-transform hover:-translate-y-0.5"
                params={{ workspaceId: workspace._id }}
                to="/app/$workspaceId/chat"
              >
                <div className="flex items-center gap-4">
                  <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {workspace.name}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {workspace.role}
                    </p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground" size={16} />
              </Link>
            </li>
          ))}
          {workspaces === undefined ? (
            <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Loading workspaces…
            </li>
          ) : null}
        </ul>
      </div>
    </main>
  )
}
