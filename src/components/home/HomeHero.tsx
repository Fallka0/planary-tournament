'use client'

import BlurText from '@/components/react-bits/BlurText'
import ShinyText from '@/components/react-bits/ShinyText'
import { getDisplayTournamentStatus } from '@/lib/tournaments'
import type { Tournament } from '@/lib/types'

interface HomeHeroProps {
  tournaments: Tournament[]
}

export default function HomeHero({ tournaments }: HomeHeroProps) {
  const stats = [
    { label: 'Total', value: tournaments.length },
    { label: 'Open', value: tournaments.filter((tournament) => getDisplayTournamentStatus(tournament.status) === 'open').length },
    { label: 'Live', value: tournaments.filter((tournament) => getDisplayTournamentStatus(tournament.status) === 'live').length },
  ]

  return (
    <section className="hero-surface relative overflow-hidden rounded-[34px] border border-[color:var(--border-subtle)] px-7 py-8 shadow-[0_24px_60px_rgba(116,201,255,0.14)] md:px-9 md:py-9">
      <div className="grid gap-8 lg:grid-cols-[1.45fr_0.95fr] lg:items-stretch">
        <div>
          <span className="eyebrow-like">Tournament control</span>
          <BlurText
            text="Tournament operations with a clear, polished interface."
            delay={40}
            className="hero-title mt-5 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)] md:text-5xl"
          />
          <p className="hero-copy mt-4 max-w-2xl text-base leading-7 text-[color:var(--text-secondary)]">
            Organize brackets, participants, teams, and match flow in one place with a lighter interface,
            calmer hierarchy, and faster access to everything needed on tournament day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="app-chip rounded-full px-4 py-2 text-sm font-medium">Live brackets</span>
            <span className="app-chip rounded-full px-4 py-2 text-sm font-medium">Team management</span>
            <span className="app-chip rounded-full px-4 py-2 text-sm font-medium">Public and private events</span>
          </div>
          <div className="mt-5 text-sm font-medium text-[color:var(--text-secondary)]">
            <ShinyText
              text="Built for faster setup, cleaner handovers, and a less stressful match-day workflow."
              speed={3}
              className="hero-shiny text-sm"
              color="#64758a"
              shineColor="#152235"
            />
          </div>
        </div>

        <div className="app-card-strong flex flex-col justify-between rounded-[30px] p-6">
          <div>
            <p className="app-eyebrow">Overview</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
              Tournament activity at a glance
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
              Keep an instant view of how many tournaments are active, open for signups, or already running.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="app-hero-stat-card rounded-[24px] px-4 py-5 text-center">
                <p className="hero-stat-value text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">{stat.value}</p>
                <p className="hero-stat-label mt-1 text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
