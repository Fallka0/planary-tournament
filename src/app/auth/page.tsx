'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import type { Provider } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import PageHero from '@/components/layout/PageHero'
import PageShell from '@/components/layout/PageShell'
import { supabase } from '@/lib/supabase'
import { setRememberPreference } from '@/lib/auth-storage'
import { getOAuthRedirectUrl, redirectLocalAuthPageToApp, redirectLocalCallbackToApp, redirectToApp } from '@/lib/auth-urls'

type AuthMode = 'login' | 'signup'
type AuthFieldName = keyof AuthFormValues
type AuthMessageTone = 'error' | 'success' | 'info'

interface AuthFormValues {
  email: string
  password: string
  username: string
  full_name: string
}

const fieldClassName =
  'app-input w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400'

const modeToggleBaseClassName =
  'rounded-full border px-4 py-2 text-sm font-medium transition duration-200 hover:-translate-y-0.5 hover:shadow-sm'

const emptyTouchedState: Record<AuthFieldName, boolean> = {
  email: false,
  password: false,
  username: false,
  full_name: false,
}

function validateAuthForm(form: AuthFormValues, mode: AuthMode): Partial<Record<AuthFieldName, string>> {
  const errors: Partial<Record<AuthFieldName, string>> = {}

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (form.password.trim().length < 6) {
    errors.password = 'Use at least 6 characters.'
  }

  if (mode === 'signup') {
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(form.username.trim())) {
      errors.username = 'Use at least 3 letters, numbers, dots, dashes, or underscores.'
    }

    if (form.full_name.trim().length < 2) {
      errors.full_name = 'Enter your display name.'
    }
  }

  return errors
}

export default function AuthPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<AuthMessageTone>('info')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState<Record<AuthFieldName, boolean>>(emptyTouchedState)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [form, setForm] = useState<AuthFormValues>({
    email: '',
    password: '',
    username: '',
    full_name: '',
  })
  const fieldErrors = validateAuthForm(form, mode)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMessage('')
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  useEffect(() => {
    if (redirectLocalAuthPageToApp()) return
    if (redirectLocalCallbackToApp()) return

    if (!authLoading && isAuthenticated) {
      redirectToApp()
    }
  }, [authLoading, isAuthenticated])

  const handleOAuthSignIn = async (provider: Provider) => {
    setMessage('')
    setMessageTone('info')
    setOauthLoading(provider)
    setRememberPreference(rememberMe)

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getOAuthRedirectUrl(),
      },
    })

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
      setOauthLoading(null)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setSubmitAttempted(true)

    if (Object.values(fieldErrors).some(Boolean)) {
      setMessageTone('error')
      setMessage('Review the highlighted fields and try again.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        setRememberPreference(true)
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              username: form.username,
              full_name: form.full_name,
            },
          },
        })

        if (error) {
          setMessage(error.message)
          setMessageTone('error')
          return
        }

        if (data.user && !data.session) {
          setMessage('Account created. Check your email to confirm your account before signing in.')
          setMessageTone('success')
          return
        }

        setMessage('Account created. You are now signed in.')
        setMessageTone('success')
        redirectToApp()
        return
      }

      setRememberPreference(rememberMe)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      if (error) {
        setMessage(error.message)
        setMessageTone('error')
        return
      }

      if (!data.session) {
        setMessage('Sign-in completed, but no active session was found. Check your email if confirmation is required.')
        setMessageTone('info')
        return
      }

      redirectToApp()
    } catch (error) {
      console.error('Auth submit error:', error)
      setMessage(error instanceof Error ? error.message : 'Could not sign in. Please try again.')
      setMessageTone('error')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setMessage('')
    setMessageTone('info')
    setShowPassword(false)
    setTouched(emptyTouchedState)
    setSubmitAttempted(false)
  }

  const markFieldTouched = (field: AuthFieldName) => {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const getFieldClassName = (field: AuthFieldName) =>
    `${fieldClassName} ${((touched[field] || submitAttempted) && fieldErrors[field]) ? 'border-red-300 focus:ring-red-300' : ''}`

  const messageClassName =
    messageTone === 'error'
      ? 'app-banner-danger'
      : messageTone === 'success'
        ? 'app-banner-success'
        : 'app-banner-info'

  return (
    <PageShell>
      <PageHero
        variant="light"
        badge={
          <>
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            Social tournament accounts
          </>
        }
        title={<h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Create your player identity.</h1>}
        description="Sign in to manage your own tournaments, browse public ones from other organizers, and join public events as a participant."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        <section className="app-card rounded-[32px] p-8 md:p-10">
            <div className="mb-6 flex gap-3">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`${modeToggleBaseClassName} ${
                  mode === 'login' ? 'app-chip-selected' : 'app-button-secondary'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`${modeToggleBaseClassName} ${
                  mode === 'signup' ? 'app-chip-selected' : 'app-button-secondary'
                }`}
              >
                Create account
              </button>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleOAuthSignIn('google')}
                disabled={Boolean(oauthLoading) || loading}
                className="app-button-secondary flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <Image src="/google.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" aria-hidden="true" />
                {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
              </button>
              <button
                type="button"
                onClick={() => void handleOAuthSignIn('github')}
                disabled={Boolean(oauthLoading) || loading}
                className="app-button-secondary flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-inline-icon h-[18px] w-[18px]" fill="currentColor">
                  <path d="M12 1.8a10.2 10.2 0 0 0-3.224 19.878c.51.094.695-.221.695-.49 0-.243-.009-.887-.014-1.742-2.828.615-3.425-1.363-3.425-1.363-.463-1.176-1.13-1.489-1.13-1.489-.924-.632.07-.62.07-.62 1.022.072 1.56 1.05 1.56 1.05.908 1.557 2.383 1.107 2.964.847.092-.658.356-1.108.648-1.362-2.257-.257-4.63-1.128-4.63-5.02 0-1.11.397-2.02 1.048-2.732-.105-.257-.454-1.293.099-2.695 0 0 .854-.274 2.8 1.043A9.73 9.73 0 0 1 12 6.726c.86.004 1.726.116 2.534.34 1.944-1.317 2.797-1.043 2.797-1.043.555 1.402.206 2.438.101 2.695.653.712 1.046 1.621 1.046 2.732 0 3.902-2.377 4.76-4.642 5.012.366.315.692.937.692 1.888 0 1.362-.013 2.46-.013 2.794 0 .271.183.589.701.489A10.2 10.2 0 0 0 12 1.8Z" />
                </svg>
                {oauthLoading === 'github' ? 'Redirecting...' : 'Continue with GitHub'}
              </button>
            </div>

            <div className="mb-6 flex items-center gap-3">
              <div className="app-divider h-px flex-1" />
              <span className="app-eyebrow tracking-[0.2em]">
                Or use email
              </span>
              <div className="app-divider h-px flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="app-text-primary mb-2 block text-sm font-semibold">Username</label>
                    <input
                      name="username"
                      required
                      value={form.username}
                      onChange={handleChange}
                      onBlur={() => markFieldTouched('username')}
                      className={getFieldClassName('username')}
                      placeholder="tournamentfan"
                      autoComplete="username"
                    />
                    {(touched.username || submitAttempted) && fieldErrors.username && (
                      <p className="app-banner-danger mt-2 rounded-xl px-3 py-2 text-sm">{fieldErrors.username}</p>
                    )}
                  </div>
                  <div>
                    <label className="app-text-primary mb-2 block text-sm font-semibold">Full name</label>
                    <input
                      name="full_name"
                      required
                      value={form.full_name}
                      onChange={handleChange}
                      onBlur={() => markFieldTouched('full_name')}
                      className={getFieldClassName('full_name')}
                      placeholder="Alex Example"
                      autoComplete="name"
                    />
                    {(touched.full_name || submitAttempted) && fieldErrors.full_name && (
                      <p className="app-banner-danger mt-2 rounded-xl px-3 py-2 text-sm">{fieldErrors.full_name}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="app-text-primary mb-2 block text-sm font-semibold">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  onBlur={() => markFieldTouched('email')}
                  className={getFieldClassName('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {(touched.email || submitAttempted) && fieldErrors.email && (
                  <p className="app-banner-danger mt-2 rounded-xl px-3 py-2 text-sm">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label className="app-text-primary mb-2 block text-sm font-semibold">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={handleChange}
                    onBlur={() => markFieldTouched('password')}
                    className={`${getFieldClassName('password')} pr-24`}
                    placeholder="At least 6 characters"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="app-text-secondary absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium transition duration-200 hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {(touched.password || submitAttempted) && fieldErrors.password ? (
                  <p className="app-banner-danger mt-2 rounded-xl px-3 py-2 text-sm">{fieldErrors.password}</p>
                ) : (
                  <p className="app-text-secondary mt-2 text-sm">
                    {mode === 'signup' ? 'Use at least 6 characters for your new account.' : 'Use the password tied to your account.'}
                  </p>
                )}
              </div>

              {mode === 'login' && (
                <label className="app-chip flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-[color:var(--border-subtle)] text-cyan-500 focus:ring-cyan-400"
                  />
                  <span>
                    Remember me
                  </span>
                </label>
              )}

              {message && <p className={`rounded-2xl border px-4 py-3 text-sm ${messageClassName}`}>{message}</p>}

              <div className="flex gap-4">
                <Link
                  href="/"
                  className="app-button-secondary flex-1 rounded-xl px-4 py-3 text-center font-semibold transition duration-200 hover:-translate-y-0.5"
                >
                  Back
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="app-button-primary flex-1 rounded-xl px-4 py-3 font-semibold transition duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                >
                  {loading ? 'Working...' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </div>
            </form>
        </section>

        <aside className="space-y-4">
          <div className="app-card-elevated rounded-[28px] p-6">
            <p className="app-eyebrow">What you unlock</p>
            <ul className="app-text-secondary mt-4 space-y-3 text-sm leading-6">
              <li>Create tournaments that are tied to your account.</li>
              <li>Keep some tournaments public and others private.</li>
              <li>Join public tournaments from other organizers.</li>
              <li>See your own and joined tournaments separately on the dashboard.</li>
            </ul>
          </div>
          <div className="app-muted-panel rounded-[28px] p-6">
            <p className="app-eyebrow">Quick checks</p>
            <ul className="app-text-secondary mt-4 space-y-3 text-sm leading-6">
              <li>Username is only required when creating a new account.</li>
              <li>OAuth buttons use the same redirect flow as email sign-in.</li>
              <li>Your password can stay visible while you verify it, then be hidden again.</li>
            </ul>
          </div>
        </aside>
      </div>
    </PageShell>
  )
}
