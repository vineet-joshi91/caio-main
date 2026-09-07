import { Outlet, createFileRoute } from '@tanstack/react-router'
import type { Id } from '../../../../convex/_generated/dataModel'
import { AppShell } from '@/components/app/app-shell'

export const Route = createFileRoute('/app/$workspaceId')({
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { workspaceId } = Route.useParams()

  return (
    <AppShell workspaceId={workspaceId as Id<'workspaces'>}>
      <Outlet />
    </AppShell>
  )
}
