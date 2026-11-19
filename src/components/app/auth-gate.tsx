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

type Screen = 'signIn' | 'signUp' | 'resetRequest' | 'resetConfirm'

function AuthScreen() {
  const { signIn } = useAuthActions()
  const [screen, setScreen] = useState<Screen>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  function resetForm() {
    setError(null)
    setPassword('')
    setCode('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      if (screen === 'signIn' || screen === 'signUp') {
        await signIn('password', {
          email: email.trim().toLowerCase(),
          password,
          flow: screen,
        })
      } else if (screen === 'resetRequest') {
        // Send reset code to email
        await signIn('password', {
          email: email.trim().toLowerCase(),
          flow: 'reset',
        })
        setResetSent(true)
        setScreen('resetConfirm')
      } else if (screen === 'resetConfirm') {
        // Submit code + new password
        await signIn('password', {
          email: email.trim().toLowerCase(),
          code,
          newPassword: password,
          flow: 'reset-verification',
        })
      }
    } catch (caught) {
      if (screen === 'signIn' || screen === 'signUp') {
        setError(authErrorMessage(caught, screen))
      } else {
        const msg = caught instanceof ConvexError ? String(caught.data) : null
        setError(
          msg === 'InvalidCode'
            ? 'That code is incorrect or expired. Request a new one.'
            : msg === 'InvalidEmail'
              ? 'Enter a valid email address.'
              : 'Something went wrong. Please try again.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset request screen ───────────────────────────────────────────────────
  if (screen === 'resetRequest') {
    return (
      <main className="relative grid min-h-screen place-items-center bg-background px-4 py-8">
        <ThemeToggle className="absolute right-4 top-4" />
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CAIO</p>
            <CardTitle className="text-3xl">Reset password</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your email and we'll send a one-time code.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>
              {error && (
                <p className="border border-destructive bg-background p-3 text-sm text-destructive">{error}</p>
              )}
              <Button className="w-full" disabled={submitting} type="submit">
                {submitting ? 'Sending…' : 'Send reset code'}
              </Button>
            </form>
            <Button
              className="mt-3 w-full"
              onClick={() => { resetForm(); setScreen('signIn') }}
              type="button"
              variant="ghost"
            >
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ── Reset confirm screen ───────────────────────────────────────────────────
  if (screen === 'resetConfirm') {
    return (
      <main className="relative grid min-h-screen place-items-center bg-background px-4 py-8">
        <ThemeToggle className="absolute right-4 top-4" />
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CAIO</p>
            <CardTitle className="text-3xl">Set new password</CardTitle>
            <p className="text-sm text-muted-foreground">
              {resetSent
                ? `A code was sent to ${email}. Enter it below with your new password.`
                : 'Enter the code from your email and choose a new password.'}
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="code">Reset code</Label>
                <Input
                  autoComplete="one-time-code"
                  id="code"
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  required
                  type="text"
                  value={code}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  autoComplete="new-password"
                  id="password"
                  minLength={8}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>
              {error && (
                <p className="border border-destructive bg-background p-3 text-sm text-destructive">{error}</p>
              )}
              <Button className="w-full" disabled={submitting} type="submit">
                {submitting ? 'Saving…' : 'Set new password'}
              </Button>
            </form>
            <Button
              className="mt-3 w-full"
              onClick={() => { resetForm(); setScreen('resetRequest') }}
              type="button"
              variant="ghost"
            >
              Resend code
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ── Sign in / Sign up screen ───────────────────────────────────────────────
  return (
    <main className="relative grid min-h-screen place-items-center bg-background px-4 py-8">
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            CAIO
          </p>
          <CardTitle className="text-3xl">
            {screen === 'signIn' ? 'Sign in' : 'Create account'}
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
                autoComplete={screen === 'signIn' ? 'current-password' : 'new-password'}
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
                : screen === 'signIn'
                  ? 'Sign in'
                  : 'Sign up'}
            </Button>
          </form>
          <Button
            className="mt-3 w-full"
            onClick={() => {
              resetForm()
              setScreen(screen === 'signIn' ? 'signUp' : 'signIn')
            }}
            type="button"
            variant="ghost"
          >
            {screen === 'signIn'
              ? 'Need an account? Sign up'
              : 'Already have an account? Sign in'}
          </Button>
          {screen === 'signIn' && (
            <Button
              className="mt-1 w-full text-muted-foreground"
              onClick={() => { resetForm(); setScreen('resetRequest') }}
              type="button"
              variant="ghost"
            >
              Forgot password?
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
