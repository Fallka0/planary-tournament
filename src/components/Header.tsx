'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Planary Home">
        <Image
          src="/brand-icon.svg"
          alt="Tournamount"
          width={58}
          height={58}
          className="brand-logo"
          priority
        />
        <span className="brand-copy">
          <span className="brand-title">Tournamount</span>
          <span className="brand-subtitle">By Planary</span>
        </span>
      </Link>

      <div className="header-actions">
        <button
          type="button"
          className={`menu-toggle-btn${isMenuOpen ? ' is-open' : ''}`}
          onClick={() => setIsMenuOpen((value) => !value)}
          aria-expanded={isMenuOpen}
          aria-controls="primary-navigation"
          aria-label="Toggle Navigation Menu"
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="primary-navigation"
          className={`site-nav${isMenuOpen ? ' is-open' : ''}`}
          aria-label="Primary Navigation"
        >
          <Link href="/" onClick={() => setIsMenuOpen(false)}>Projects</Link>
          <Link href="/teams" onClick={() => setIsMenuOpen(false)}>Team</Link>
          <a href="#footer" onClick={() => setIsMenuOpen(false)}>Contact</a>
        </nav>

      </div>
    </header>
  )
}
