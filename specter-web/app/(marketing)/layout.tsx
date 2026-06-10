import SmoothScrollProvider from '@/components/providers/smooth-scroll'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>
}
