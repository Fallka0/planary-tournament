import Link from 'next/link'

export default function Footer() {
  return (
    <footer id="footer" className="relative z-10 mt-auto">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 border-t border-[color:var(--footer-border)] px-4 py-6 text-sm text-[color:var(--text-muted)] sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="text-center md:text-left">
          &copy; {new Date().getFullYear()} Tournament. Built by{' '}
          <a className="transition duration-200 hover:text-[color:var(--accent-color)]" href="https://planary.ch" target="_blank" rel="noreferrer">
            Planary
          </a>
          .
        </p>
        <div className="flex items-center justify-center gap-5 md:justify-end">
          <a className="transition duration-200 hover:text-[color:var(--accent-color)]" href="https://github.com/Fallka0/Tournamount" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link href="/teams" className="transition duration-200 hover:text-[color:var(--accent-color)]">
            Teams
          </Link>
          <a className="transition duration-200 hover:text-[color:var(--accent-color)]" href="https://planary.ch/impressum">
            Impressum
          </a>
          <a className="transition duration-200 hover:text-[color:var(--accent-color)]" href="https://planary.ch/datenschutz">
            Datenschutz
          </a>
        </div>
      </div>
    </footer>
  )
}
