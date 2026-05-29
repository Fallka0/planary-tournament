import PageHero from '@/components/layout/PageHero'

interface TournamentFormHeroProps {
  title: string
  subtitle?: string
}

export default function TournamentFormHero({ title, subtitle }: TournamentFormHeroProps) {
  return (
    <PageHero
      variant="light"
      title={<h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>}
      description={subtitle}
    />
  )
}
