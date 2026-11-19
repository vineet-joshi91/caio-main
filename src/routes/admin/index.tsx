// src/routes/admin/index.tsx
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { api } from '@/../../convex/_generated/api'
import type { Id } from '@/../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/')({
  component: AdminPage,
})

type Tab = 'users' | 'workspaces' | 'payments' | 'invites'

function AdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const [tab, setTab] = useState<Tab>('users')
  const [grantWsId, setGrantWsId] = useState('')
  const [grantAmt, setGrantAmt] = useState('10')
  const [topUpWsId, setTopUpWsId] = useState('')
  const [msg, setMsg] = useState('')

  const users = useQuery(api.admin.listUsers)
  const workspaces = useQuery(api.admin.listWorkspaces)
  const payments = useQuery(api.admin.listPayments)
  const invites = useQuery(api.admin.listInvites)
  const grantCredits = useMutation(api.admin.grantCredits)
  const topUp = useMutation(api.admin.topUpAdminWorkspace)

  if (isLoading) return <div className="admin-center">Loading…</div>
  if (!isAuthenticated) return <div className="admin-center">Sign in first at <a href="/onboarding">/onboarding</a></div>

  // Error boundary: if any query throws NOT_ADMIN, show gate
  const isAdminError = (v: unknown) =>
    v === undefined ? false : false // queries return undefined while loading; errors bubble as thrown

  async function handleGrant() {
    try {
      await grantCredits({ workspaceId: grantWsId as Id<'workspaces'>, credits: Number(grantAmt) })
      setMsg(`✓ Granted ${grantAmt} credits to workspace`)
      setGrantWsId('')
    } catch (e: any) {
      setMsg(`✗ ${e.message}`)
    }
  }

  async function handleTopUp() {
    try {
      const res = await topUp({ workspaceId: topUpWsId as Id<'workspaces'> })
      setMsg(`✓ Topped up to ${(res as any).balance} credits`)
      setTopUpWsId('')
    } catch (e: any) {
      setMsg(`✗ ${e.message}`)
    }
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'users', label: 'Users', count: users?.length },
    { id: 'workspaces', label: 'Workspaces', count: workspaces?.length },
    { id: 'payments', label: 'Payments', count: payments?.length },
    { id: 'invites', label: 'Invite log', count: invites?.length },
  ]

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-wrap">
          <span className="admin-logo">CAIO <span className="admin-badge">Admin</span></span>
          <a href="/app" className="admin-link">← Back to app</a>
        </div>
      </header>

      <main className="admin-wrap admin-main">
        {/* Actions panel */}
        <section className="admin-card admin-actions">
          <h2 className="admin-section-title">Quick actions</h2>
          <div className="admin-action-row">
            <div className="admin-action-block">
              <label className="admin-label">Grant credits to workspace</label>
              <div className="admin-row">
                <input
                  className="admin-input"
                  placeholder="Workspace _id (from table below)"
                  value={grantWsId}
                  onChange={e => setGrantWsId(e.target.value)}
                />
                <input
                  className="admin-input admin-input-sm"
                  type="number"
                  min={1}
                  value={grantAmt}
                  onChange={e => setGrantAmt(e.target.value)}
                />
                <button className="admin-btn" onClick={handleGrant}>Grant</button>
              </div>
            </div>
            <div className="admin-action-block">
              <label className="admin-label">Top up MY workspace to 9999 credits</label>
              <div className="admin-row">
                <input
                  className="admin-input"
                  placeholder="Your workspace _id"
                  value={topUpWsId}
                  onChange={e => setTopUpWsId(e.target.value)}
                />
                <button className="admin-btn admin-btn-gold" onClick={handleTopUp}>Top up → 9999</button>
              </div>
            </div>
          </div>
          {msg && <p className="admin-msg">{msg}</p>}
        </section>

        {/* Tabs */}
        <div className="admin-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`admin-tab${tab === t.id ? ' admin-tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.count !== undefined && <span className="admin-count">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Users */}
        {tab === 'users' && (
          <div className="admin-card admin-table-wrap">
            {!users ? <p className="admin-loading">Loading…</p> : (
              <table className="admin-table">
                <thead><tr>
                  <th>Email</th><th>Name</th><th>Workspaces</th><th>Joined</th><th>_id</th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td>{u.email ?? '—'}</td>
                      <td>{u.name ?? '—'}</td>
                      <td className="admin-center-cell">{u.workspaceCount}</td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td><code className="admin-code">{u._id}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Workspaces */}
        {tab === 'workspaces' && (
          <div className="admin-card admin-table-wrap">
            {!workspaces ? <p className="admin-loading">Loading…</p> : (
              <table className="admin-table">
                <thead><tr>
                  <th>Name</th><th>Owner</th><th>Docs</th><th>Audits</th><th>Credits</th><th>Created</th><th>_id</th>
                </tr></thead>
                <tbody>
                  {workspaces.map(ws => (
                    <tr key={ws._id}>
                      <td><b>{ws.name}</b></td>
                      <td>{ws.ownerEmail}</td>
                      <td className="admin-center-cell">{ws.docCount}</td>
                      <td className="admin-center-cell">{ws.auditCount}</td>
                      <td className="admin-center-cell" style={{ color: ws.credits > 1 ? 'var(--good)' : ws.credits === 0 ? 'var(--flag)' : undefined }}>{ws.credits}</td>
                      <td>{new Date(ws.createdAt).toLocaleDateString('en-IN')}</td>
                      <td><code className="admin-code">{ws._id}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Payments */}
        {tab === 'payments' && (
          <div className="admin-card admin-table-wrap">
            {!payments ? <p className="admin-loading">Loading…</p> : (
              <table className="admin-table">
                <thead><tr>
                  <th>User</th><th>Workspace</th><th>Amount</th><th>Credits</th><th>Status</th><th>Date</th><th>Razorpay order</th>
                </tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p._id}>
                      <td>{p.userEmail}</td>
                      <td>{p.workspaceName}</td>
                      <td>₹{(p.amount / 100).toFixed(0)}</td>
                      <td className="admin-center-cell">{p.credits}</td>
                      <td>
                        <span className={`admin-status admin-status-${p.status}`}>{p.status}</span>
                      </td>
                      <td>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                      <td><code className="admin-code">{p.razorpayOrderId}</code></td>
                    </tr>
                  ))}
                  {payments.length === 0 && <tr><td colSpan={7} className="admin-empty">No payments yet</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Invites / user log */}
        {tab === 'invites' && (
          <div className="admin-card admin-table-wrap">
            <p className="admin-note">All signed-up users (chronological — these are everyone who made it through the invite gate).</p>
            {!invites ? <p className="admin-loading">Loading…</p> : (
              <table className="admin-table">
                <thead><tr>
                  <th>Email</th><th>Name</th><th>Joined</th>
                </tr></thead>
                <tbody>
                  {invites.map(u => (
                    <tr key={u._id}>
                      <td>{u.email}</td>
                      <td>{u.name}</td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      <style>{`
        .admin { min-height: 100svh; background: #0d1117; color: #e6edf3; font-family: 'Manrope', sans-serif; }
        .admin-header { background: #161b22; border-bottom: 1px solid #30363d; padding: 14px 0; }
        .admin-wrap { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .admin-logo { font-size: 1.1rem; font-weight: 800; color: #FFC400; letter-spacing: -0.02em; }
        .admin-badge { background: #1A2B5C; color: #FFC400; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 4px; vertical-align: middle; margin-left: 6px; text-transform: uppercase; }
        .admin-link { float: right; color: #8b949e; font-size: 0.85rem; text-decoration: none; }
        .admin-link:hover { color: #e6edf3; }
        .admin-main { padding: 28px 20px 60px; }
        .admin-card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .admin-section-title { font-size: 0.9rem; font-weight: 700; color: #8b949e; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 14px; }
        .admin-action-row { display: flex; gap: 20px; flex-wrap: wrap; }
        .admin-action-block { flex: 1; min-width: 280px; }
        .admin-label { display: block; font-size: 0.8rem; color: #8b949e; margin-bottom: 7px; }
        .admin-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .admin-input { background: #0d1117; border: 1px solid #30363d; border-radius: 7px; color: #e6edf3; padding: 7px 11px; font-size: 0.85rem; flex: 1; min-width: 0; outline: none; }
        .admin-input:focus { border-color: #FFC400; }
        .admin-input-sm { max-width: 72px; flex: 0 0 72px; }
        .admin-btn { background: #21262d; border: 1px solid #30363d; color: #e6edf3; border-radius: 7px; padding: 7px 14px; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .admin-btn:hover { background: #30363d; }
        .admin-btn-gold { background: #FFC400; color: #1A2B5C; border-color: #FFC400; }
        .admin-btn-gold:hover { background: #e6b000; }
        .admin-msg { margin-top: 10px; font-size: 0.85rem; color: #FFC400; }
        .admin-tabs { display: flex; gap: 4px; margin-bottom: 16px; flex-wrap: wrap; }
        .admin-tab { background: #161b22; border: 1px solid #30363d; color: #8b949e; border-radius: 8px; padding: 8px 16px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 7px; }
        .admin-tab:hover { color: #e6edf3; border-color: #8b949e; }
        .admin-tab-active { background: #1A2B5C; border-color: #FFC400; color: #FFC400; }
        .admin-count { background: #21262d; color: #8b949e; font-size: 0.7rem; padding: 1px 7px; border-radius: 20px; }
        .admin-tab-active .admin-count { background: #FFC40022; color: #FFC400; }
        .admin-table-wrap { overflow-x: auto; padding: 0; }
        .admin-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .admin-table th { text-align: left; padding: 10px 14px; font-size: 0.72rem; font-weight: 700; color: #8b949e; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #30363d; white-space: nowrap; }
        .admin-table td { padding: 10px 14px; border-bottom: 1px solid #21262d; color: #c9d1d9; }
        .admin-table tr:last-child td { border-bottom: none; }
        .admin-table tr:hover td { background: #1c2128; }
        .admin-code { font-family: monospace; font-size: 0.75rem; color: #8b949e; background: #21262d; padding: 2px 6px; border-radius: 4px; }
        .admin-center-cell { text-align: center; }
        .admin-status { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
        .admin-status-paid { background: #04805822; color: #048058; }
        .admin-status-created { background: #FFC40022; color: #FFC400; }
        .admin-status-failed { background: #ff444422; color: #ff4444; }
        .admin-loading { color: #8b949e; font-size: 0.85rem; padding: 20px; }
        .admin-empty { text-align: center; color: #8b949e; padding: 24px; }
        .admin-center { display: grid; place-items: center; height: 60vh; color: #8b949e; }
        .admin-note { font-size: 0.82rem; color: #8b949e; margin: 12px 14px 0; padding-bottom: 10px; border-bottom: 1px solid #30363d; }
      `}</style>
    </div>
  )
}
