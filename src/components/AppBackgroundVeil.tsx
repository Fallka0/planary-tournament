'use client'

export default function AppBackgroundVeil() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_34%),radial-gradient(circle_at_left,rgba(110,231,183,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.04))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_left,rgba(110,231,183,0.1),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(167,243,208,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(244,252,248,0.08))]" />
    </div>
  )
}
