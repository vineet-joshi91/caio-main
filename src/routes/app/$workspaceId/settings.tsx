import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Brain, Check, Loader2, X } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { PageHeader, PageScroll } from '@/components/app/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/app/$workspaceId/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { workspaceId } = Route.useParams()
  const wsId = workspaceId as Id<'workspaces'>

  return (
    <>
      <PageHeader
        description="Workspace details, business memory, and team access."
        title="Settings"
      />
      <PageScroll>
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <BusinessProfileCard workspaceId={wsId} />
            <MembersCard workspaceId={wsId} />
          </div>
          <MemoryFactsCard workspaceId={wsId} />
        </div>
      </PageScroll>
    </>
  )
}

function BusinessProfileCard({ workspaceId }: { workspaceId: Id<'workspaces'> }) {
  const profile = useQuery(api.memory.getBusinessProfile, { workspaceId })
  const updateProfile = useMutation(api.memory.updateBusinessProfile)

  const [summary, setSummary] = useState('')
  const [industry, setIndustry] = useState('')
  const [businessModel, setBusinessModel] = useState('')
  const [targetCustomers, setTargetCustomers] = useState('')
  const [goals, setGoals] = useState('')
  const [constraints, setConstraints] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (profile !== undefined && !hydrated) {
      setSummary(profile?.summary ?? '')
      setIndustry(profile?.industry ?? '')
      setBusinessModel(profile?.businessModel ?? '')
      setTargetCustomers(profile?.targetCustomers ?? '')
      setGoals(profile?.goals.join('\n') ?? '')
      setConstraints(profile?.constraints.join('\n') ?? '')
      setHydrated(true)
    }
  }, [profile, hydrated])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({
        workspaceId,
        summary,
        industry: industry || undefined,
        businessModel: businessModel || undefined,
        targetCustomers: targetCustomers || undefined,
        goals: goals.split('\n').map((g) => g.trim()).filter(Boolean),
        constraints: constraints.split('\n').map((c) => c.trim()).filter(Boolean),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Business profile</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          The advisor reads this on every conversation and audit.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-summary">Summary</Label>
          <Textarea
            id="profile-summary"
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What the company does, in a few sentences"
            rows={3}
            value={summary}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              onChange={(e) => setIndustry(e.target.value)}
              value={industry}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="business-model">Business model</Label>
            <Input
              id="business-model"
              onChange={(e) => setBusinessModel(e.target.value)}
              value={businessModel}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target-customers">Target customers</Label>
          <Input
            id="target-customers"
            onChange={(e) => setTargetCustomers(e.target.value)}
            value={targetCustomers}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goals">Goals (one per line)</Label>
          <Textarea
            id="goals"
            onChange={(e) => setGoals(e.target.value)}
            rows={3}
            value={goals}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="constraints">Constraints (one per line)</Label>
          <Textarea
            id="constraints"
            onChange={(e) => setConstraints(e.target.value)}
            rows={3}
            value={constraints}
          />
        </div>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {saving ? (
            <Loader2 className="mr-2 animate-spin" size={14} />
          ) : saved ? (
            <Check className="mr-2" size={14} />
          ) : null}
          {saved ? 'Saved' : 'Save profile'}
        </Button>
      </CardContent>
    </Card>
  )
}

const factTypeLabels: Record<string, string> = {
  company_fact: 'Fact',
  decision: 'Decision',
  goal: 'Goal',
  assumption: 'Assumption',
  preference: 'Preference',
  recurring_discussion: 'Recurring',
}

function MemoryFactsCard({ workspaceId }: { workspaceId: Id<'workspaces'> }) {
  const facts = useQuery(api.memory.listFacts, { workspaceId })
  const deactivate = useMutation(api.memory.deactivateFact)

  return (
    <Card className="h-fit rounded-2xl">
      <CardHeader className="flex flex-row items-center gap-2">
        <Brain className="text-primary" size={16} />
        <div>
          <CardTitle>Business memory</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Durable facts the advisor has learned from your conversations.
            Remove anything that's wrong or stale.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {facts === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : facts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing recorded yet. As you chat, CAIO saves durable facts,
            decisions, and goals here.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {facts.map((fact) => (
              <li
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/50 p-3"
                key={fact._id}
              >
                <div className="min-w-0 space-y-1">
                  <Badge variant="secondary">
                    {factTypeLabels[fact.type] ?? fact.type}
                  </Badge>
                  <p className="text-sm">{fact.fact}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Confidence {(fact.confidence * 100).toFixed(0)}% ·{' '}
                    {new Date(fact.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  aria-label="Remove fact"
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    void deactivate({ workspaceId, factId: fact._id })
                  }
                  type="button"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function MembersCard({ workspaceId }: { workspaceId: Id<'workspaces'> }) {
  const members = useQuery(api.workspaces.listMembers, { workspaceId })

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Member</TableHead>
              <TableHead className="pr-6 text-right">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members === undefined ? (
              <TableRow>
                <TableCell className="pl-6 text-muted-foreground" colSpan={2}>
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member._id}>
                  <TableCell className="pl-6">
                    <p className="text-sm font-medium">
                      {member.user?.name ?? member.user?.email ?? 'Unknown'}
                    </p>
                    {member.user?.name && member.user.email ? (
                      <p className="text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Badge className="capitalize" variant="outline">
                      {member.role}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
