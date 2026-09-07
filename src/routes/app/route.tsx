import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AuthGate } from '@/components/app/auth-gate'

export const Route = createFileRoute('/app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <AuthGate>
      <Outlet />
    </AuthGate>
  )
}
