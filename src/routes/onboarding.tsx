import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { AuthGate } from '@/components/app/auth-gate'
import { DocStatusBadge } from '@/components/app/doc-status'
import {
  UploadDropzone,
  useDocumentUpload,
} from '@/components/app/document-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/lib/theme'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

type Step = 'company' | 'documents' | 'analyzing'

function OnboardingPage() {
  return (
    <AuthGate>
      <OnboardingWizard />
    </AuthGate>
  )
}

function OnboardingWizard() {
  const navigate = useNavigate()
  const myWorkspaces = useQuery(api.workspaces.listMine)
  const createWorkspace = useMutation(api.workspaces.create)
  const runAudit = useAction(api.ai.runAudit)

  const [step, setStep] = useState<Step>('company')
  const [companyName, setCompanyName] = useState('')
  const [workspaceId, setWorkspaceId] = useState<Id<'workspaces'> | null>(null)
  const [creating, setCreating] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const documents = useQuery(
    api.documents.list,
    workspaceId ? { workspaceId } : 'skip',
  )
  const { uploadFiles, uploading, error: uploadError } =
    useDocumentUpload(workspaceId)

  const readyCount = documents?.filter((d) => d.status === 'ready').length ?? 0
  const processingCount =
    documents?.filter(
      (d) => d.status === 'processing' || d.status === 'uploading',
    ).length ?? 0

  async function handleCreateCompany() {
    if (!companyName.trim()) return
    setCreating(true)
    try {
      const id = await createWorkspace({ name: companyName.trim() })
      setWorkspaceId(id)
      setStep('documents')
    } finally {
      setCreating(false)
    }
  }

  async function handleAnalyze() {
    if (!workspaceId) return
    setStep('analyzing')
    setAnalysisError(null)
    try {
      await runAudit({ workspaceId })
      navigate({
        to: '/app/$workspaceId/audit',
        params: { workspaceId },
      })
    } catch (caught) {
      setAnalysisError(
        caught instanceof Error ? caught.message : 'Analysis failed',
      )
      setStep('documents')
    }
  }

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
          <div className="flex items-center gap-3">
            {myWorkspaces && myWorkspaces.length > 0 ? (
              <Link to="/app">
                <Button size="sm" variant="ghost">
                  My workspaces
                </Button>
              </Link>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="page-wrap max-w-3xl py-12">
        {/* Progress */}
        <ol className="mb-10 flex items-center gap-2 text-xs font-semibold">
          {(
            [
              ['company', '1. Your company'],
              ['documents', '2. Upload documents'],
              ['analyzing', '3. Analysis'],
            ] as const
          ).map(([key, label], index) => {
            const order: Array<Step> = ['company', 'documents', 'analyzing']
            const active = order.indexOf(step) >= index
            return (
              <li className="flex items-center gap-2" key={key}>
                {index > 0 && <span className="h-px w-8 bg-border" />}
                <span
                  className={cn(
                    'rounded-full px-3 py-1',
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              </li>
            )
          })}
        </ol>

        {step === 'company' && (
          <section className="island-shell rise-in rounded-2xl p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="display-title text-2xl font-bold">
                  Tell us who you are
                </h1>
                <p className="text-sm text-muted-foreground">
                  We'll set up an isolated workspace for your company.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                autoFocus
                id="company-name"
                onChange={(event) => setCompanyName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreateCompany()
                }}
                placeholder="Acme Robotics"
                value={companyName}
              />
            </div>
            <Button
              className="mt-6"
              disabled={!companyName.trim() || creating}
              onClick={() => void handleCreateCompany()}
            >
              {creating ? (
                <Loader2 className="mr-2 animate-spin" size={16} />
              ) : null}
              Create workspace
              <ArrowRight className="ml-2" size={16} />
            </Button>
          </section>
        )}

        {step === 'documents' && workspaceId && (
          <section className="rise-in space-y-6">
            <div className="island-shell rounded-2xl p-8">
              <h1 className="display-title mb-1 text-2xl font-bold">
                Upload documents about {companyName || 'your company'}
              </h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Business plans, financial sheets, pitch decks, strategy docs —
                the more context, the sharper the analysis.
              </p>
              <UploadDropzone onFiles={(f) => void uploadFiles(f)} uploading={uploading} />
              {uploadError ? (
                <p className="mt-3 text-sm text-destructive">{uploadError}</p>
              ) : null}
              {analysisError ? (
                <p className="mt-3 text-sm text-destructive">
                  Analysis failed: {analysisError}
                </p>
              ) : null}

              {documents && documents.length > 0 ? (
                <ul className="mt-6 divide-y divide-border rounded-xl border border-border">
                  {documents.map((doc) => (
                    <li
                      className="flex items-center justify-between gap-3 px-4 py-3"
                      key={doc._id}
                    >
                      <span className="truncate text-sm font-medium">
                        {doc.filename}
                      </span>
                      <div className="flex shrink-0 items-center gap-3">
                        {doc.status === 'failed' && doc.statusReason ? (
                          <span className="max-w-56 truncate text-xs text-muted-foreground">
                            {doc.statusReason}
                          </span>
                        ) : null}
                        <DocStatusBadge status={doc.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex items-center justify-between">
              <Button
                onClick={() =>
                  navigate({
                    to: '/app/$workspaceId/chat',
                    params: { workspaceId },
                  })
                }
                variant="ghost"
              >
                Skip analysis for now
              </Button>
              <Button
                className="h-11 px-6"
                disabled={readyCount === 0 || processingCount > 0}
                onClick={() => void handleAnalyze()}
              >
                <BarChart3 className="mr-2" size={16} />
                {processingCount > 0
                  ? `Processing ${processingCount} file${processingCount > 1 ? 's' : ''}…`
                  : `Analyze my company (${readyCount} document${readyCount === 1 ? '' : 's'})`}
              </Button>
            </div>
          </section>
        )}

        {step === 'analyzing' && (
          <section className="island-shell rise-in grid place-items-center rounded-2xl p-16 text-center">
            <div className="space-y-4">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="animate-pulse" size={26} />
              </div>
              <h1 className="display-title text-2xl font-bold">
                Analyzing {companyName || 'your company'}…
              </h1>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                CAIO is reading your corpus, scoring strategy, finances,
                operations, marketing, product, and risk, and writing up
                findings with citations. This usually takes under a minute.
              </p>
              <Loader2 className="mx-auto animate-spin text-primary" size={20} />
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
