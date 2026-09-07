import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { useMutation } from 'convex/react'
import { ConvexError } from 'convex/values'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/lib/theme'
import { api } from '../../../convex/_generated/api'

export function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading CAIO</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Restoring your secure workspace session.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return isAuthenticated ? <Authenticated>{children}</Authenticated> : <AuthScreen />
}

function Authenticated({ children }: { children: ReactNode }) {
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser)

  useEffect(() => {
    void ensureCurrentUser()
  }, [ensureCurrentUser])

  return children
}

/**
 * `convex/auth.ts` re-throws known credential failures as a `ConvexError`
 * carrying a stable code, because Convex redacts plain `Error` messages in
 * production to an opaque "Server Error". The `mode` fallback keeps the copy
 * useful if a failure ever arrives without a code (older deploy, real outage).
 */
function authErrorMessage(caught: unknown, mode: 'signIn' | 'signUp') {
  const code = caught instanceof ConvexError ? String(caught.data) : null

  switch (code) {
    case 'InvalidAccountId':
      return 'No account exists for that email. Switch to sign up to create one.'
    case 'InvalidSecret':
      return 'Incorrect password for that email.'
    case 'AccountExists':
      return 'An account already exists for that email. Switch to sign in — or use the password you originally signed up with.'
    case 'WeakPassword':
      return 'Password must be at least 8 characters.'
    case 'InvalidEmail':
      return 'Enter a valid email address.'
  }

  return mode === 'signIn'
    ? 'Could not sign in. Check your email and password, then try again.'
    : 'Could not create the account. That email may already be registered — try signing in instead.'
}

function AuthScreen() {
  const { signIn } = useAuthActions()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: mode,
      })
    } catch (caught) {
      setError(authErrorMessage(caught, mode))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-background px-4 py-8">
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            CAIO
          </p>
          <CardTitle className="text-3xl">
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Use Convex Auth to access your isolated business workspace.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete={
                  mode === 'signIn' ? 'current-password' : 'new-password'
                }
                id="password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            {error ? (
              <p className="border border-destructive bg-background p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting
                ? 'Working...'
                : mode === 'signIn'
                  ? 'Sign in'
                  : 'Sign up'}
            </Button>
          </form>
          <Button
            className="mt-3 w-full"
            onClick={() => {
              setError(null)
              setMode(mode === 'signIn' ? 'signUp' : 'signIn')
            }}
            type="button"
            variant="ghost"
          >
            {mode === 'signIn'
              ? 'Need an account? Sign up'
              : 'Already have an account? Sign in'}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
