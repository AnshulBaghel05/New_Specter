// Smooth scroll (Lenis) is already provided app-wide by app/providers.tsx, which
// wraps every route group including (marketing). Mounting a second
// SmoothScrollProvider here spun up a duplicate Lenis instance — two RAF loops and
// two sets of wheel/pointer listeners fighting over the same page, which made nav
// links (Sign in / Start free) need 2–3 clicks to register. Keep this layout a
// pass-through so there is exactly one Lenis instance.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
