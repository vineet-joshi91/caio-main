import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import {
  AlertTriangle,
  BarChart3,
  BookOpenText,
  CheckCircle2,
  Lightbulb,
  Loader2,
  PhoneCall,
  X,
  XCircle,
} from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { PageHeader, PageScroll } from '@/components/app/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CONSULTING_NAME,
  CONSULTING_PHONE,
  CONSULTING_WHATSAPP_URL,
} from '@/lib/consulting'
import { loadRazorpay, openRazorpayCheckout } from '@/lib/razorpay'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/$workspaceId/audit')({
  component: AuditPage,
})

function scoreTone(score: number) {
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

function barTone(score: number) {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-destructive'
}

function gaugeTone(score: number) {
  if (score >= 75) return 'stroke-emerald-500'
  if (score >= 50) return 'stroke-amber-500'
  return 'stroke-destructive'
}

// Semicircle meter for the overall score. Single value + reserved status
// hues; the number above it stays in text ink.
function ScoreGauge({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, score))
  return (
    <svg
      aria-label={`Overall score ${Math.round(value)} out of 100`}
      className="mt-4 w-full max-w-[210px]"
      role="img"
      viewBox="0 0 200 112"
    >
      <path
        className="stroke-muted"
        d="M 16 104 A 84 84 0 0 1 184 104"
        fill="none"
        pathLength={100}
        strokeLinecap="round"
        strokeWidth={12}
      />
      <path
        className={cn('transition-all duration-700', gaugeTone(value))}
        d="M 16 104 A 84 84 0 0 1 184 104"
        fill="none"
        pathLength={100}
        strokeDasharray={`${Math.max(value, 0.5)} 100`}
        strokeLinecap="round"
        strokeWidth={12}
      />
      <text
        className="fill-muted-foreground"
        fontSize={10}
        textAnchor="middle"
        x={16}
        y={111.5}
      >
        0
      </text>
      <text
        className="fill-muted-foreground"
        fontSize={10}
        textAnchor="middle"
        x={184}
        y={111.5}
      >
        100
      </text>
    </svg>
  )
}

function AuditPage() {
  const { workspaceId } = Route.useParams()
  const wsId = workspaceId as Id<'workspaces'>

  const audits = useQuery(api.audits.list, { workspaceId: wsId })
  const documents = useQuery(api.documents.list, { workspaceId: wsId })
  const notes = useQuery(api.notes.list, { workspaceId: wsId })
  const billing = useQuery(api.billing.status, { workspaceId: wsId })
  const runAudit = useAction(api.ai.runAudit)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)

  const audit = audits?.[0] ?? null
  const version = audit?.latestVersion ?? null
  const readyDocs = documents?.filter((d) => d.status === 'ready').length ?? 0
  const writtenDocs = notes?.length ?? 0
  const hasCorpus = readyDocs > 0 || writtenDocs > 0

  // skipCreditCheck: right after a purchase the billing subscription may not
  // have caught up yet — the server still enforces credits either way.
  async function handleRun(skipCreditCheck = false) {
    if (!skipCreditCheck && billing && !billing.canRunReport) {
      setShowPaywall(true)
      return
    }
    setRunning(true)
    setError(null)
    try {
      await runAudit({ workspaceId: wsId, auditId: audit?._id })
    } catch (caught) {
      if (caught instanceof ConvexError && caught.data === 'NO_CREDITS') {
        setShowPaywall(true)
      } else {
        setError(caught instanceof Error ? caught.message : 'Audit failed')
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <Button disabled={running || !hasCorpus} onClick={() => void handleRun()}>
            {running ? (
              <Loader2 className="mr-2 animate-spin" size={16} />
            ) : (
              <BarChart3 className="mr-2" size={16} />
            )}
            {running
              ? 'Analyzing…'
              : version
                ? 'Re-run audit'
                : 'Run audit'}
          </Button>
        }
        description="A scored, versioned analysis of your company grounded in your document corpus."
        title="Business Audit"
      />
      <PageScroll>
        <div className="mx-auto max-w-5xl space-y-6">
          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error.includes('OPENROUTER')
                ? 'The AI provider is not configured yet. Set OPENROUTER_API_KEY in the Convex deployment.'
                : error}
            </div>
          ) : null}

          {!hasCorpus ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="shrink-0" size={16} />
              Upload or write at least one document before running an audit.
            </div>
          ) : null}

          {version?.status === 'outdated' ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="shrink-0" size={16} />
              Documents changed since this audit was generated — the analysis
              below may be stale. Re-run to refresh.
            </div>
          ) : null}

          {!version ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border p-16 text-center">
              <div className="max-w-md space-y-3">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <BarChart3 size={26} />
                </div>
                <h2 className="display-title text-xl font-bold">
                  No audit yet
                </h2>
                <p className="text-sm text-muted-foreground">
                  Run your first audit to get scored findings across revenue,
                  strategy, finances, operations, marketing, product, and risk.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Score header */}
              <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Overall</CardTitle>
                    <Badge variant={version.status === 'current' ? 'default' : 'outline'}>
                      v{version.version} · {version.status}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2">
                      <span
                        className={cn(
                          'display-title text-6xl font-bold',
                          scoreTone(version.overallScore),
                        )}
                      >
                        {Math.round(version.overallScore)}
                      </span>
                      <span className="pb-2 text-sm text-muted-foreground">
                        / 100
                      </span>
                    </div>
                    <ScoreGauge score={version.overallScore} />
                    <p className="mt-3 text-xs text-muted-foreground">
                      Generated {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Section scores</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {version.sectionScores.map((section) => (
                      <div key={section.section}>
                        <div className="mb-1 flex items-baseline justify-between gap-4">
                          <span className="text-sm font-medium">
                            {section.section}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-bold',
                              scoreTone(section.score),
                            )}
                          >
                            {Math.round(section.score)}
                          </span>
                        </div>
                        <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', barTone(section.score))}
                            style={{ width: `${section.score}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {section.rationale}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Findings */}
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center gap-2">
                    <CheckCircle2 className="text-emerald-500" size={16} />
                    <CardTitle className="text-base">Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5 text-sm">
                      {version.strengths.map((item, index) => (
                        <li className="flex gap-2" key={index}>
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center gap-2">
                    <XCircle className="text-destructive" size={16} />
                    <CardTitle className="text-base">Weaknesses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5 text-sm">
                      {version.weaknesses.map((item, index) => (
                        <li className="flex gap-2" key={index}>
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center gap-2">
                    <Lightbulb className="text-amber-500" size={16} />
                    <CardTitle className="text-base">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5 text-sm">
                      {version.recommendations.map((item, index) => (
                        <li className="flex gap-2" key={index}>
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Consulting */}
              <Card className="rounded-2xl border-primary/30 bg-primary/5">
                <CardHeader className="flex flex-row items-center gap-2">
                  <PhoneCall className="text-primary" size={16} />
                  <CardTitle className="text-base">
                    Where expert consulting would help
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end justify-between gap-4">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {version.consultingNeed ??
                      'A focused session with a consultant can turn the weakest findings above into a concrete action plan for the next quarter.'}
                  </p>
                  <a
                    className="no-underline"
                    href={CONSULTING_WHATSAPP_URL}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Button>
                      <PhoneCall className="mr-2" size={15} />
                      Talk to {CONSULTING_NAME} · {CONSULTING_PHONE}
                    </Button>
                  </a>
                </CardContent>
              </Card>

              {version.citations.length > 0 ? (
                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center gap-2">
                    <BookOpenText className="text-primary" size={16} />
                    <CardTitle className="text-base">Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {version.citations.map((citation, index) => (
                        <li
                          className="rounded-xl border border-border bg-background/50 p-3"
                          key={index}
                        >
                          <p className="mb-1 text-xs font-semibold">
                            {citation.documentTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            “{citation.excerpt}”
                          </p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </PageScroll>

      {showPaywall ? (
        <PaywallDialog
          amountPaise={billing?.pack.amountPaise ?? 79900}
          credits={billing?.pack.credits ?? 10}
          onClose={() => setShowPaywall(false)}
          onPurchased={() => {
            setShowPaywall(false)
            void handleRun(true)
          }}
          workspaceId={wsId}
        />
      ) : null}
    </>
  )
}

function PaywallDialog({
  workspaceId,
  amountPaise,
  credits,
  onClose,
  onPurchased,
}: {
  workspaceId: Id<'workspaces'>
  amountPaise: number
  credits: number
  onClose: () => void
  onPurchased: () => void
}) {
  const createOrder = useAction(api.billing.createOrder)
  const verifyPayment = useAction(api.billing.verifyPayment)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rupees = Math.round(amountPaise / 100)

  async function handleBuy() {
    setPaying(true)
    setError(null)
    try {
      await loadRazorpay()
      const order = await createOrder({ workspaceId })
      const checkout = openRazorpayCheckout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'CAIO',
        description: `${order.credits} business reports`,
        handler: (response) => {
          void verifyPayment({
            workspaceId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
            .then(() => onPurchased())
            .catch(() => {
              setError(
                'We could not verify the payment. If you were charged, contact support — nothing was lost.',
              )
              setPaying(false)
            })
        },
        modal: { ondismiss: () => setPaying(false) },
      })
      checkout.on('payment.failed', (response) => {
        setError(
          response.error.description ?? 'Payment failed. Please try again.',
        )
        setPaying(false)
      })
      checkout.open()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not start payment',
      )
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="display-title text-lg font-bold">
              Get more reports
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You've used your included reports. Top up to keep auditing.
            </p>
          </div>
          <button
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-end gap-1.5">
            <span className="display-title text-4xl font-bold">₹{rupees}</span>
            <span className="pb-1 text-sm text-muted-foreground">
              / {credits} reports
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            One-time purchase · UPI, cards, and netbanking via Razorpay
          </p>
        </div>

        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" disabled={paying} onClick={() => void handleBuy()}>
            {paying ? (
              <Loader2 className="mr-2 animate-spin" size={15} />
            ) : null}
            {paying ? 'Processing…' : `Pay ₹${rupees}`}
          </Button>
          <Button onClick={onClose} variant="secondary">
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
