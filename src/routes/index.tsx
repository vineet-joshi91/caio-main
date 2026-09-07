import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpenText,
  Brain,
  Search,
  Sparkles,
  TrendingUp,
  UploadCloud,
} from 'lucide-react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { ThemeToggle } from '@/lib/theme'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const PERSONAS = [
  {
    img: '/landing/persona-founder.png',
    tint: 'lp-sky',
    role: 'Raising / board-prep',
    name: 'Founders',
    body: 'Walk into the room already knowing where the plan is thin.',
  },
  {
    img: '/landing/persona-operator.png',
    tint: 'lp-peach',
    role: 'Finance · ops · sales',
    name: 'Owner-operators',
    body: "One advisor across every hat you're wearing at once.",
  },
  {
    img: '/landing/persona-exec.png',
    tint: 'lp-mint',
    role: 'New engagement',
    name: 'Fractional execs',
    body: "Get fluent in a new client's business by lunch, not month two.",
  },
  {
    img: '/landing/persona-team.png',
    tint: 'lp-butter',
    role: 'Shared brain',
    name: 'Small teams',
    body: 'Turn the Drive folder nobody reads into answers everyone can.',
  },
]

const AUDIT_DIMS: Array<[string, number]> = [
  ['Revenue', 68],
  ['Strategy', 81],
  ['Finances', 64],
  ['Ops', 75],
  ['Market', 58],
  ['Product', 70],
  ['Risk', 66],
]

// Full-label rows for the hero product mock.
const AUDIT_ROWS: Array<[string, number]> = [
  ['Revenue', 68],
  ['Strategy', 81],
  ['Finances', 64],
  ['Operations', 75],
  ['Marketing', 58],
  ['Product', 70],
  ['Risk', 66],
]

// Semantic score → color (reserved status hues, not the accent).
function scoreColor(v: number) {
  return v >= 75 ? 'var(--good)' : v >= 60 ? 'var(--warn)' : 'var(--flag)'
}

function LandingPage() {
  const { isAuthenticated } = useConvexAuth()
  const appHref = isAuthenticated ? '/app' : '/onboarding'
  const skyRef = useRef<HTMLDivElement>(null)

  // Scroll-reveal for .lp-rise elements.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-rise'))
    if (reduce) {
      els.forEach((el) => el.classList.add('lp-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('lp-in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Parallax: sky layer + any [data-parallax] element drift at their own rate.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'))
    let raf = 0
    const apply = () => {
      raf = 0
      const y = window.scrollY
      if (skyRef.current) skyRef.current.style.transform = `translate3d(0, ${y * 0.32}px, 0)`
      for (const el of layers) {
        const speed = parseFloat(el.dataset.parallax || '0')
        el.style.transform = `translate3d(0, ${y * speed}px, 0)`
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    apply()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <main className="lp min-h-svh overflow-x-hidden">
      {/* ── Hero (sky wrapper: nav floats over it, no top gap) ── */}
      <div className="lp-hero relative overflow-hidden pb-40">
        <div ref={skyRef} className="lp-hero-sky lp-parallax" aria-hidden />

        {/* Nav floats over the sky */}
        <header className="absolute inset-x-0 top-0 z-40">
          <div className="lp-wrap">
            <nav
              className="mt-3.5 flex items-center justify-between rounded-full border px-4 py-2.5 backdrop-blur-md"
              style={{
                borderColor: 'var(--line)',
                background: 'color-mix(in srgb, var(--card) 80%, transparent)',
                boxShadow: 'var(--lp-shadow-sm)',
              }}
              aria-label="Primary"
            >
              <Link to="/" className="flex items-center gap-2.5 no-underline">
                <span
                  className="grid size-10 -rotate-3 place-items-center rounded-xl text-xl"
                  style={{ background: 'var(--ink)', color: 'var(--paper)', fontFamily: "'Fraunces', serif" }}
                >
                  C
                </span>
                <span className="leading-none">
                  <b className="block text-[1.28rem] font-bold lp-serif" style={{ color: 'var(--ink)' }}>CAIO</b>
                  <span className="lp-kick text-[0.6rem]" style={{ color: 'var(--ink-soft)' }}>Chief AI Officer</span>
                </span>
              </Link>
              <div className="hidden items-center gap-8 text-[0.96rem] font-medium md:flex">
                <a style={{ color: 'var(--ink-soft)' }} href="#how">How it works</a>
                <a style={{ color: 'var(--ink-soft)' }} href="#advisor">The advisor</a>
                <a style={{ color: 'var(--ink-soft)' }} href="#bento">What you get</a>
                <a style={{ color: 'var(--ink-soft)' }} href="#pricing">Pricing</a>
              </div>
              <div className="flex items-center gap-2.5">
                <ThemeToggle />
                <Link to={appHref} className="lp-btn lp-btn-accent no-underline">
                  <UploadCloud size={17} />
                  Analyze my company
                </Link>
              </div>
            </nav>
          </div>
        </header>

        {/* Hero content */}
        <div className="lp-wrap relative z-10 max-w-[900px] pt-40 text-center" style={{ color: 'var(--c-sky-ink)' }}>
          <img
            src="/landing/sticker-sparkle.png"
            alt=""
            aria-hidden
            data-parallax="-0.12"
            className="lp-sticker lp-parallax hidden w-24 sm:block"
            style={{ top: 96, right: '6%' }}
          />
          <span className="lp-pill lp-rise mb-6" style={{ background: 'var(--card)', color: 'var(--ink)', boxShadow: 'var(--lp-shadow-sm)' }}>
            <Sparkles size={14} /> For founders &amp; operators who run on documents
          </span>
          <h1 className="lp-rise text-[clamp(2.5rem,6.6vw,5rem)] leading-[1.02]">
            Your business plan knows
            <br />
            <em className="italic">what your gut doesn't.</em>
          </h1>
          <p className="lp-rise mx-auto mt-6 max-w-[640px] text-[1.18rem] opacity-90">
            Drop in your plans, financials, and decks. In minutes CAIO hands you a board-grade audit
            of your company — scored, cited, and versioned — plus an advisor that answers from{' '}
            <em>your</em> documents, not the internet.
          </p>
          <div className="lp-rise mt-8 flex flex-wrap justify-center gap-3.5">
            <Link to="/onboarding" className="lp-btn lp-btn-primary no-underline">
              <UploadCloud size={19} /> Analyze my company
            </Link>
            <a className="lp-btn lp-btn-ghost no-underline font-bold" href="#how">
              See how it works <ArrowRight className="lp-arw" size={17} />
            </a>
          </div>
          <p className="lp-rise lp-kick mt-6 text-[0.7rem] opacity-70">
            Free to start · PDF · DOCX · CSV · MD · Private isolated workspaces
          </p>
        </div>

        {/* Floating audit mock straddling the torn edge */}
        <div className="lp-wrap relative z-10 mx-auto mt-14 max-w-[720px]">
          <div className="lp-mock lp-halftone relative -rotate-[1.2deg] p-7" style={{ color: 'var(--ink)' }} aria-hidden>
            <span className="lp-tape" style={{ top: -12, left: '50%', transform: 'translateX(-50%) rotate(-2deg)' }} />
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-bold">
                <span className="grid size-8 place-items-center rounded-[9px]" style={{ background: 'var(--c-mint)', color: 'var(--c-mint-ink)' }}>
                  <TrendingUp size={15} />
                </span>
                Business Audit · Acme Robotics
              </div>
              <span className="lp-kick text-[0.6rem]" style={{ color: 'var(--ink-soft)', opacity: 0.7 }}>v3 · current</span>
            </div>
            <div className="mb-5 flex items-end gap-3.5">
              <span className="lp-serif text-[4.4rem] leading-[0.82] tabular-nums" style={{ color: 'var(--ink)' }}>72</span>
              <span className="pb-1.5 text-sm" style={{ color: 'var(--ink-soft)' }}>
                <b style={{ color: 'var(--good)' }}>▲ 9 pts</b> vs v2
                <br />/ 100 overall
              </span>
            </div>
            <div className="grid gap-2.5">
              {AUDIT_ROWS.map(([label, score]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-[124px] shrink-0 text-[0.82rem] font-semibold">{label}</span>
                  <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
                    <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor(score) }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-[0.82rem] font-bold tabular-nums" style={{ color: scoreColor(score) }}>{score}</span>
                </div>
              ))}
            </div>
            <div className="lp-kick mt-5 border-t pt-3 text-[0.58rem]" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)', opacity: 0.75 }}>
              7 factors · 14 documents · updated 2d ago
            </div>
          </div>

          <div className="lp-chip lp-floaty -bottom-6 -left-4 hidden sm:block" style={{ ['--lp-rot']: '-3deg', color: 'var(--flag)' } as CSSProperties} aria-hidden>
            <span className="lp-kick mb-1.5 flex items-center gap-1.5 text-[0.6rem]" style={{ color: 'var(--flag)' }}>
              <Search size={12} /> Searched · pricing vs margin
            </span>
            <span style={{ color: 'var(--ink-soft)' }}>
              Q3 deck pricing undercuts your 60% margin goal — <b style={{ color: 'var(--ink)' }}>pricing-strategy.pdf, p.4</b>
            </span>
          </div>
          <div className="lp-chip lp-floaty -top-5 -right-3 hidden lg:block" style={{ ['--lp-rot']: '3deg' } as CSSProperties} aria-hidden>
            <span className="lp-kick mb-1.5 flex items-center gap-1.5 text-[0.6rem]" style={{ color: 'var(--c-lilac-ink)' }}>
              <Brain size={12} /> Remembered
            </span>
            <span style={{ color: 'var(--ink-soft)' }}>
              <b style={{ color: 'var(--ink)' }}>Dual-source batteries by Q4</b> is a standing decision.
            </span>
          </div>
        </div>
      </div>

      {/* ── Thesis strip ─────────────────────────────────────── */}
      <section className="lp-wrap py-24 text-center">
        <p className="lp-rise lp-serif mx-auto max-w-[820px] text-[clamp(1.5rem,3.4vw,2.4rem)] leading-[1.25]">
          CAIO isn't another chatbot. It's the{' '}
          <span className="lp-flag">executive who read every file</span> you have — and remembers what it found.
        </p>
      </section>

      {/* ── Personas ─────────────────────────────────────────── */}
      <section className="pb-24">
        <div className="lp-wrap">
          <div className="mx-auto mb-14 max-w-[720px] text-center">
            <p className="lp-rise lp-kick">Who runs on CAIO</p>
            <h2 className="lp-rise mt-3 text-[clamp(2rem,4.2vw,3.3rem)] leading-[1.05]">
              Built for the people who actually run the company.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map((p) => (
              <article key={p.name} className={`lp-rise ${p.tint} overflow-hidden rounded-[26px]`} style={{ boxShadow: 'var(--lp-shadow-sm)' }}>
                <div className="lp-halftone relative aspect-square">
                  <img src={p.img} alt={`${p.name} using CAIO`} loading="lazy" className="absolute inset-0 size-full object-cover" />
                </div>
                <div className="p-5">
                  <p className="lp-kick mb-2 text-[0.6rem] opacity-70">{p.role}</p>
                  <h3 className="mb-1.5 text-[1.28rem]">{p.name}</h3>
                  <p className="text-[0.9rem] opacity-85">{p.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bento (image-led + a live audit visualization) ────── */}
      <section id="bento" className="py-28" style={{ background: 'var(--paper-2)' }}>
        <div className="lp-wrap">
          <div className="mx-auto mb-14 max-w-[720px] text-center">
            <p className="lp-rise lp-kick">What you get</p>
            <h2 className="lp-rise mt-3 text-[clamp(2rem,4.2vw,3.3rem)] leading-[1.05]">
              One office. Everything your documents know.
            </h2>
            <p className="lp-rise mt-4 text-[1.1rem]" style={{ color: 'var(--ink-soft)' }}>
              A living intelligence environment — not a thread you lose. Scored analysis, a memory
              that compounds, and citations on every claim.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[236px]">
            {/* Big cell — the audit visualization */}
            <div className="lp-rise lp-mint lp-halftone flex flex-col overflow-hidden rounded-[28px] p-7 sm:col-span-2 lg:row-span-2">
              <h3 className="text-[1.45rem]">Scored, versioned audits</h3>
              <p className="mt-1 text-[0.92rem] opacity-85">
                Seven factors — revenue always first — each scored and explained. Versions are
                immutable; upload new files and stale audits flag themselves outdated.
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-7 gap-y-4 pt-4">
                <AuditRadar />
                <div className="min-w-[150px] flex-1">
                  <div className="flex items-end gap-2.5">
                    <span className="lp-serif text-[3.6rem] leading-none tabular-nums">72</span>
                    <span className="pb-2 text-[0.8rem] opacity-80">
                      <b style={{ color: 'var(--good)' }}>▲ 9 pts</b> vs v2
                      <br />/ 100 overall
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 text-[0.84rem]">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: 'var(--good)' }} />
                      <span className="opacity-70">Strongest</span>
                      <b className="ml-auto">Strategy</b>
                      <span className="tabular-nums" style={{ color: 'var(--good)' }}>81</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: 'var(--flag)' }} />
                      <span className="opacity-70">Needs work</span>
                      <b className="ml-auto">Marketing</b>
                      <span className="tabular-nums" style={{ color: 'var(--flag)' }}>58</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <BentoCell tint="lp-sky" img="/landing/cutout-docs.png" title="Cited answers">
              Every claim links to the file and page it came from — never a confident guess.
            </BentoCell>
            <BentoCell tint="lp-peach" img="/landing/cutout-brain.png" title="Business memory">
              Goals, decisions, and constraints saved as facts you can review and correct.
            </BentoCell>
            <BentoCell tint="lp-lilac" img="/landing/cutout-workspaces.png" title="Isolated workspaces & roles" className="sm:col-span-2">
              Run multiple companies side by side. Owner / admin / member enforced server-side on
              every single query — never a shared black box.
            </BentoCell>
            <BentoCell tint="lp-butter" img="/landing/cutout-upload.png" title="Live documents">
              Tracked from upload to ready, with plain-English failure reasons.
            </BentoCell>
          </div>
        </div>
      </section>

      {/* ── Advisor ──────────────────────────────────────────── */}
      <section id="advisor" className="lp-butter lp-halftone py-28">
        <div className="lp-wrap grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
          <div className="lp-rise">
            <p className="lp-kick opacity-70">The advisor</p>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3.1rem)] leading-[1.06]">
              Answers grounded in <em className="italic">your</em> paperwork.
            </h2>
            <p className="mt-4 text-[1.1rem] opacity-85">
              Generic AI gives generic advice. CAIO searches your actual documents before every
              substantive answer, shows which file it's citing, and tells you when your corpus
              doesn't hold the answer — instead of inventing one.
            </p>
            <ul className="mt-6 grid gap-4">
              {(
                [
                  ['Cited, not confident-sounding', 'Every claim links back to a document you uploaded.'],
                  ['A memory that compounds', 'Decisions and constraints become structured facts you can review.'],
                  ["Knows when it doesn't know", 'Missing a model? It asks for the file rather than hallucinating one.'],
                ] as const
              ).map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full text-[0.8rem] font-extrabold" style={{ background: 'var(--c-butter-ink)', color: 'var(--c-butter)' }}>✓</span>
                  <span>
                    <b className="block text-[1rem]">{t}</b>
                    <span className="text-[0.92rem] opacity-80">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-rise relative">
          <img src="/landing/cutout-search.png" alt="" aria-hidden loading="lazy" className="lp-sticker hidden w-28 -rotate-6 sm:block" style={{ top: -54, left: -40 }} />
          <img src="/landing/cutout-docs.png" alt="" aria-hidden loading="lazy" className="lp-sticker hidden w-24 rotate-6 lg:block" style={{ bottom: -46, right: -30 }} />
          <div className="lp-mock rotate-1 p-6" style={{ color: 'var(--ink)' }} aria-hidden>
            <span className="lp-tape" style={{ top: -11, right: 26, transform: 'rotate(4deg)' }} />
            <div className="mb-4 flex items-center gap-2.5 border-b pb-4 text-[0.92rem] font-bold" style={{ borderColor: 'var(--line)' }}>
              <span className="grid size-8 place-items-center rounded-lg lp-serif" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>C</span>
              Advisor · Acme Robotics
            </div>
            <div className="ml-auto w-fit max-w-[82%] rounded-[16px_16px_4px_16px] px-3.5 py-2.5 text-[0.9rem] font-medium" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
              Can we afford to hire two engineers this quarter?
            </div>
            <div className="lp-kick my-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.62rem]" style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }}>
              <Search size={12} /> searchDocuments · “runway hiring budget”
            </div>
            <div className="max-w-[92%] rounded-[16px_16px_16px_4px] border px-4 py-3.5 text-[0.9rem] leading-relaxed" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
              Not both at once. Your <b style={{ color: 'var(--flag)' }}>2025-budget.xlsx</b> shows 11
              months of runway at current burn; two senior hires cut that to ~7. One hire in April,
              the second after the Meridian contract closes, keeps you above your 9-month floor.
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['2025-budget.xlsx', 'hiring-plan.md'].map((d) => (
                  <span key={d} className="lp-kick inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.6rem]" style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                    <BookOpenText size={10} /> {d}
                  </span>
                ))}
              </div>
            </div>
            <div className="lp-kick mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.62rem]" style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }}>
              <Brain size={12} /> saveMemoryFact · 9-month runway floor is a hard constraint
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how" className="lp-sky py-28">
        <div className="lp-wrap">
          <div className="mx-auto mb-14 max-w-[720px] text-center">
            <p className="lp-rise lp-kick opacity-70">How it works</p>
            <h2 className="lp-rise mt-3 text-[clamp(2rem,4.2vw,3.3rem)] leading-[1.05]">
              From a messy folder to a functioning intelligence office.
            </h2>
            <p className="lp-rise mt-4 text-[1.1rem] opacity-85">
              No integrations, no prompt engineering. Three steps, about ten minutes.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {(
              [
                ['01', '/landing/cutout-upload.png', 'Upload what you have', 'Plans, financials, decks, SOPs — even the outdated ones. CAIO extracts, chunks, and indexes everything into a private corpus for your company.'],
                ['02', '/landing/cutout-chart.png', 'Get your analysis', 'A scored audit across seven factors, revenue first. Every strength, weakness, and recommendation cites the document it came from.'],
                ['03', '/landing/cutout-advisor.png', 'Keep the advisor', 'Ask anything, any time. It searches your corpus before answering and quietly builds a business memory of your goals and decisions.'],
              ] as const
            ).map(([n, img, t, b]) => (
              <div key={n} className="lp-rise lp-mock p-7">
                <div className="mb-4 flex items-center justify-between">
                  <span className="lp-serif text-[2.4rem] leading-none lp-flag">{n}</span>
                  <img src={img} alt="" aria-hidden loading="lazy" className="h-24 w-24 object-contain" />
                </div>
                <h3 className="mb-2 text-[1.3rem]" style={{ color: 'var(--ink)' }}>{t}</h3>
                <p className="text-[0.95rem]" style={{ color: 'var(--ink-soft)' }}>{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ────────────────────────────────────────────── */}
      <section className="py-28">
        <div className="lp-wrap">
          <div className="lp-rise mx-auto max-w-[840px] px-4 text-center">
            <p className="lp-serif text-[clamp(1.6rem,3.4vw,2.5rem)] italic leading-[1.28]">
              “It's the only tool that gives me advice I can actually check — every answer points at
              the file it came from.”
            </p>
            <p className="lp-kick mt-6 text-[0.72rem]" style={{ color: 'var(--ink-soft)' }}>
              — Operator · seed-stage hardware company
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="py-24" style={{ background: 'var(--paper-2)' }}>
        <div className="lp-wrap">
          <div className="mx-auto mb-14 max-w-[720px] text-center">
            <p className="lp-rise lp-kick">Simple, honest pricing</p>
            <h2 className="lp-rise mt-3 text-[clamp(2rem,4.2vw,3.3rem)] leading-[1.05]">
              Your first report is free. Then pay per report — nothing else.
            </h2>
            <p className="lp-rise mt-4 text-[1.1rem]" style={{ color: 'var(--ink-soft)' }}>
              No subscriptions, no seats, no surprises. The advisor, memory, and your workspaces stay
              free — you only pay when you generate a report.
            </p>
          </div>
          <div className="mx-auto grid max-w-[840px] gap-6 md:grid-cols-2">
            <div className="lp-rise lp-mock lp-halftone p-8" style={{ color: 'var(--ink)' }}>
              <p className="lp-kick">Free</p>
              <div className="lp-serif my-2.5 text-[3rem] leading-none">
                ₹0<span className="lp-kick text-[0.8rem] opacity-60"> / to start</span>
              </div>
              <p className="text-[0.95rem]" style={{ color: 'var(--ink-soft)' }}>
                Upload your documents, meet the advisor, and run your first full scored report on us.
              </p>
              <ul className="my-6 grid gap-2.5 text-[0.92rem]">
                {['First business report included', 'Citation-backed advisor & memory', 'Write documents on the platform', 'Private isolated workspaces'].map((f) => (
                  <li key={f}><span className="lp-flag font-bold">→ </span>{f}</li>
                ))}
              </ul>
              <Link to="/onboarding" className="lp-btn lp-btn-primary no-underline">Analyze my company</Link>
            </div>
            <div className="lp-rise lp-ink lp-mock lp-halftone p-8">
              <p className="lp-kick" style={{ color: 'var(--c-butter)' }}>Report pack</p>
              <div className="lp-serif my-2.5 text-[3rem] leading-none">
                ₹799<span className="lp-kick text-[0.8rem] opacity-60"> / 10 reports</span>
              </div>
              <p className="text-[0.95rem]" style={{ color: 'var(--ink-soft)' }}>
                That's ₹80 a report — a board-grade audit for less than lunch. Buy a pack when you
                need it, straight from the app.
              </p>
              <ul className="my-6 grid gap-2.5 text-[0.92rem]">
                {['10 full scored reports', 'Every report covers revenue + 6 more factors', 'Consulting hand-off when you want a human', 'UPI, cards & netbanking via Razorpay'].map((f) => (
                  <li key={f}><span className="font-bold" style={{ color: 'var(--c-butter)' }}>→ </span>{f}</li>
                ))}
              </ul>
              <Link to="/onboarding" className="lp-btn lp-btn-accent no-underline">Get started</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="lp-mint lp-halftone relative overflow-hidden py-28 text-center">
        <img src="/landing/sticker-arrow.png" alt="" aria-hidden className="lp-sticker hidden w-28 md:block" style={{ right: '16%', bottom: 96, transform: 'rotate(8deg)' }} />
        <div className="lp-wrap relative">
          <p className="lp-rise lp-kick opacity-70">Ten minutes from now</p>
          <h2 className="lp-rise mt-3 text-[clamp(2.2rem,5vw,3.8rem)] italic leading-[1.05]">Let's get started.</h2>
          <p className="lp-rise mx-auto mt-4 mb-8 max-w-[520px] text-[1.15rem] opacity-85">
            Your documents already know what's wrong with your business. Give CAIO ten minutes with
            them and find out.
          </p>
          <Link to="/onboarding" className="lp-rise lp-btn lp-btn-primary no-underline">
            <UploadCloud size={19} /> Start your analysis — free
          </Link>
        </div>
      </section>

      {/* ── Footer (permanently dark) ────────────────────────── */}
      <footer className="lp-ink py-16">
        <div className="lp-wrap">
          <div className="mb-11 grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 -rotate-3 place-items-center rounded-xl text-lg lp-serif" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>C</span>
                <span className="leading-none">
                  <b className="block text-lg lp-serif">CAIO</b>
                  <span className="lp-kick text-[0.6rem]" style={{ color: 'var(--ink-soft)' }}>Chief AI Officer</span>
                </span>
              </div>
              <p className="mt-4 max-w-[280px] text-[0.92rem]" style={{ color: 'var(--ink-soft)' }}>
                Document-grounded intelligence for business workspaces. Upload, audit, and keep an
                advisor that answers from your own files.
              </p>
            </div>
            {(
              [
                ['Product', ['How it works', 'The advisor', 'What you get', 'Pricing']],
                ['Company', ['About', 'Security', 'Contact']],
                ['Start', ['Analyze my company', 'Sign in']],
              ] as const
            ).map(([h, links]) => (
              <div key={h}>
                <h4 className="lp-kick mb-4 text-[0.66rem]" style={{ color: 'var(--ink-soft)' }}>{h}</h4>
                {links.map((l) => (
                  <a key={l} href="#top" className="block py-1 text-[0.92rem]" style={{ color: 'var(--ink)', opacity: 0.82 }}>{l}</a>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t pt-6 text-[0.82rem]" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
            <span className="lp-kick">© {new Date().getFullYear()} CAIO — Document-grounded intelligence</span>
            <span className="lp-kick">Private · Isolated · Cited</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

/* A single-entity radar of the six audit dimensions (one series → no legend;
   the cell title names it). Recessive grid, one accent fill, direct dot marks. */
function AuditRadar() {
  const cx = 120
  const cy = 104
  const R = 74
  const ang = (i: number) =>
    ((-90 + (i * 360) / AUDIT_DIMS.length) * Math.PI) / 180
  const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]
  const ring = (f: number) => AUDIT_DIMS.map((_, i) => pt(i, R * f).join(',')).join(' ')
  const area = AUDIT_DIMS.map(([, v], i) => pt(i, R * (v / 100)).join(',')).join(' ')
  return (
    <svg viewBox="0 0 240 216" role="img" aria-label="Audit scores across six dimensions" className="w-[220px] max-w-full shrink-0">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} className="lp-radar-grid" points={ring(f)} />
      ))}
      {AUDIT_DIMS.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} className="lp-radar-axis" x1={cx} y1={cy} x2={x} y2={y} />
      })}
      <polygon className="lp-radar-area" points={area} />
      {AUDIT_DIMS.map(([label, v], i) => {
        const [dx, dy] = pt(i, R * (v / 100))
        const [lx, ly] = pt(i, R + 16)
        return (
          <g key={label}>
            <circle className="lp-radar-dot" cx={dx} cy={dy} r={3} />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: 9.5, fontWeight: 700, fontFamily: "'Manrope', sans-serif", fill: 'var(--c-mint-ink)', opacity: 0.75 }}
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function BentoCell({
  tint,
  img,
  title,
  children,
  className = '',
}: {
  tint: string
  img: string
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`lp-rise lp-halftone ${tint} ${className} flex flex-col overflow-hidden rounded-[28px] p-6`}>
      <img src={img} alt="" aria-hidden loading="lazy" className="mb-auto -ml-1 h-[104px] w-[104px] object-contain" />
      <h3 className="mb-2 mt-4 text-[1.3rem]">{title}</h3>
      <p className="text-[0.92rem] opacity-85">{children}</p>
    </div>
  )
}
