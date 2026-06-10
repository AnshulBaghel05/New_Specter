import Nav from '@/components/marketing/nav'
import Footer from '@/components/marketing/footer'
import './print.css'

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  )
}
