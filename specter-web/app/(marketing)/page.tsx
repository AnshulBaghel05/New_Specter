import ScrollProgress from '@/components/ui/scroll-progress'
import Nav from '@/components/marketing/nav'
import Hero from '@/components/marketing/hero'
import SocialProof from '@/components/marketing/social-proof'
import Problem from '@/components/marketing/problem'
import ProductDemo from '@/components/marketing/product-demo'
import OosFeature from '@/components/marketing/oos-feature'
import AttributionFeature from '@/components/marketing/attribution-feature'
import DomainBatching from '@/components/marketing/domain-batching'
import CompetitorTable from '@/components/marketing/competitor-table'
import PricingSection from '@/components/marketing/pricing-section'
import Integrations from '@/components/marketing/integrations'
import ToolsCta from '@/components/marketing/tools-cta'
import Testimonials from '@/components/marketing/testimonials'
import Faq from '@/components/marketing/faq'
import FinalCta from '@/components/marketing/final-cta'
import Footer from '@/components/marketing/footer'

export default function HomePage() {
  return (
    <main>
      <ScrollProgress />
      <Nav />
      <Hero />
      <SocialProof />
      <Problem />
      <ProductDemo />
      <OosFeature />
      <AttributionFeature />
      <DomainBatching />
      <CompetitorTable />
      <PricingSection />
      <Integrations />
      <ToolsCta />
      <Testimonials />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  )
}
