import type { BlogPost } from '../types'

export const shopifyFeesExplained: BlogPost = {
  slug: 'shopify-fees-explained',
  title: 'Shopify Fees Explained: The Real Cost of Selling on Shopify in 2026',
  metaTitle: 'Shopify Fees Explained: The Real Cost (2026)',
  metaDescription:
    'Beyond the monthly plan, Shopify costs you transaction fees, payment processing, apps, and themes. A complete breakdown of every Shopify fee in 2026 and how to find your true profit per order.',
  category: 'profit-optimization',
  tags: ['shopify fees', 'shopify costs', 'payment processing', 'ecommerce costs', 'profit margin'],
  authorId: 'specter-research',
  datePublished: '2026-06-12',
  dateModified: '2026-06-12',
  excerpt:
    'Shopify’s monthly plan is the smallest cost of running a Shopify store. Here’s the full picture — processing fees, transaction fees, apps, themes — and how to work out what you actually keep per order.',
  keyword: 'shopify fees',
  searchIntent: 'Informational/commercial — Shopify merchant trying to understand the full cost of the platform and their real per-order profit.',
  heroAnswer:
    'Running a Shopify store costs more than the monthly plan fee. You pay payment processing on every order (around 2.9% + $0.30 for online card payments on standard plans), an extra transaction fee (0.5–2%) if you use a third-party gateway instead of Shopify Payments, plus recurring costs for paid apps and premium themes. For most stores the monthly plan is the smallest line item — processing fees and the app stack are what actually shape per-order profit, so you should always calculate true profit per order rather than trusting the plan price alone.',
  toc: [
    { id: 'plan-is-smallest', label: 'The plan fee is the smallest cost' },
    { id: 'processing', label: 'Payment processing — the big one' },
    { id: 'transaction-fees', label: 'Transaction fees and Shopify Payments' },
    { id: 'apps-themes', label: 'Apps, themes, and the hidden stack' },
    { id: 'true-profit', label: 'Calculating your true profit per order' },
  ],
  sections: [
    {
      id: 'plan-is-smallest',
      heading: 'Why the monthly plan is the smallest cost you’ll pay',
      html: `
        <p>When merchants compare Shopify plans, they fixate on the monthly subscription — Basic, Shopify, or Advanced. It's the most visible number, so it feels like the decision. In reality, for any store doing meaningful volume, the plan fee is usually the <em>smallest</em> of your Shopify-related costs.</p>
        <p>Here's the logic: a plan fee is fixed and spread across all your orders, so the more you sell, the smaller it gets per order. Payment processing, by contrast, is charged on <em>every single transaction</em> and scales directly with revenue. Do $50,000/mo in sales and your processing fees dwarf any plan-tier difference. The plan choice matters — but mostly because higher tiers lower your <em>processing rate</em>, not because of the subscription price itself.</p>
        <div class="callout"><p><strong>The reframe:</strong> don't ask "which plan is cheapest?" Ask "at my volume, which plan gives the lowest total cost once processing rates are included?" That answer often points to a higher-tier plan than the sticker price suggests.</p></div>
      `,
    },
    {
      id: 'processing',
      heading: 'Payment processing: the fee that scales with you',
      html: `
        <p>Every time a customer pays by card, you pay a processing fee. On Shopify Payments, standard online rates are roughly <strong>2.9% + $0.30</strong> per transaction on the Basic plan, dropping on higher plans (to around 2.7% and 2.5%). In-person and international cards carry different rates.</p>
        <p>That $0.30 fixed component matters more than it looks on small orders. On a $10 order, 2.9% + $0.30 is effectively 5.9% — double the headline rate. Stores with low average order values are hit hardest by processing, which is one reason raising AOV (through bundles or minimums) improves margin even when nothing else changes.</p>
        <p>And processing isn't fully refundable. On many setups, when a customer returns an order, you don't get the processing fee back — so a returned sale costs you the fee twice (once on the sale, once with no offsetting revenue). In high-return categories, that turns processing into a bigger drag than the headline percentage implies.</p>
      `,
    },
    {
      id: 'transaction-fees',
      heading: 'Transaction fees: the penalty for not using Shopify Payments',
      html: `
        <p>This is the fee that surprises merchants most. If you use a <strong>third-party payment gateway</strong> (anything other than Shopify Payments — e.g. an external processor), Shopify charges an <em>additional</em> transaction fee on top of that gateway's own processing fee. It runs roughly <strong>0.5% to 2%</strong> depending on your plan (lower on higher tiers).</p>
        <p>That's two cuts on the same sale: your external processor's fee <em>and</em> Shopify's transaction fee. For most stores the math clearly favors using Shopify Payments, which carries no extra Shopify transaction fee — the processing rate is the only payment cost. The main reasons to accept the penalty are if Shopify Payments isn't available in your country, or you have a specific reason to keep an existing processor.</p>
        <p>If you're paying the third-party transaction fee without a strong reason, switching to Shopify Payments is often one of the fastest no-downside margin improvements available — pure cost removal with no impact on the customer.</p>
      `,
    },
    {
      id: 'apps-themes',
      heading: 'Apps, themes, and the recurring stack nobody adds up',
      html: `
        <p>The Shopify App Store is where store costs quietly compound. A serious store typically runs a stack of paid apps:</p>
        <ul>
          <li><strong>Email & marketing</strong> — often $20–100+/mo depending on list size</li>
          <li><strong>Reviews</strong> — $10–50/mo</li>
          <li><strong>Upsells / bundles</strong> — $20–60/mo, sometimes plus a revenue share</li>
          <li><strong>Subscriptions, loyalty, SEO, page builders, analytics</strong> — $10–100/mo each</li>
        </ul>
        <p>It's easy to reach <strong>$200–500/mo</strong> in apps without noticing, because each is added individually and justified on its own. Some apps also take a percentage of the revenue they touch, which scales as you grow. Spread across your orders, the app stack is a real per-order cost that never appears in your cost-of-goods math.</p>
        <p>Themes are usually a one-time cost (premium themes run roughly $200–400), so they barely register over a store's life — but custom development, if you go that route, is not. The recurring danger is the app stack, which deserves a quarterly audit: remove anything not driving measurable revenue.</p>
        <div class="callout"><p><strong>Audit prompt:</strong> list every recurring app charge and divide the total by your monthly order count. That per-order number is a real cost of every sale — and it's usually bigger than merchants guess.</p></div>
      `,
    },
    {
      id: 'true-profit',
      heading: 'Calculating your true profit per order on Shopify',
      html: `
        <p>The only way to know whether your store actually makes money is to calculate profit per order with <em>every</em> Shopify cost included, not just cost of goods. Work top-down from the selling price:</p>
        <ol>
          <li><strong>Selling price</strong> (what the customer pays for the product)</li>
          <li><strong>− Payment processing</strong> (2.9% + $0.30, or your plan's rate)</li>
          <li><strong>− Third-party transaction fee</strong> (only if you don't use Shopify Payments)</li>
          <li><strong>− Allocated plan + app cost</strong> (monthly fixed costs ÷ monthly orders)</li>
          <li><strong>− Cost of goods, shipping, and a returns allowance</strong></li>
        </ol>
        <p>What's left is your true profit per order — almost always meaningfully lower than the "price minus product cost" figure most merchants carry in their head. The free <a href="/tools/shopify-profit-calculator">Shopify Profit Calculator</a> structures exactly this calculation, including the processing and plan-fee details that are easy to miss, and shows your real margin and break-even.</p>
        <p>Two follow-on moves usually pay off once you can see the true number: switch to Shopify Payments if you're paying the third-party penalty, and check whether you're <a href="/blog/hidden-costs-killing-ecommerce-margins">underpricing against the market</a> — the largest and most invisible margin leak of all. Knowing your real cost per order is the foundation for both.</p>
      `,
    },
  ],
  keyTakeaways: [
    'The monthly Shopify plan is usually the smallest cost — higher tiers matter mainly because they lower your processing rate.',
    'Payment processing (~2.9% + $0.30) scales with every order and hits low-AOV stores hardest; it’s often not refunded on returns.',
    'Using a third-party gateway adds a Shopify transaction fee (0.5–2%) on top of processing — switching to Shopify Payments removes it.',
    'The paid app stack quietly reaches $200–500/mo; audit it quarterly and allocate it per order.',
    'Always calculate true profit per order with every fee included — never trust “price minus product cost.”',
  ],
  faq: [
    { q: 'What fees does Shopify charge?', a: 'Shopify charges a monthly plan fee, payment processing on every card transaction (about 2.9% + $0.30 online on Basic, lower on higher plans), and — if you use a third-party payment gateway instead of Shopify Payments — an additional transaction fee of roughly 0.5–2%. On top of Shopify’s own fees, most stores pay for premium apps and a theme, which are real recurring costs.' },
    { q: 'How much does Shopify really cost per month?', a: 'Far more than the plan price. Beyond the subscription, payment processing scales with your sales, and a typical app stack adds $200–500/mo. A store doing real volume often spends more on processing and apps combined than on the plan itself, so the true monthly cost depends heavily on your revenue and how many paid apps you run.' },
    { q: 'How do I avoid Shopify transaction fees?', a: 'Use Shopify Payments as your processor. The extra transaction fee (0.5–2%) only applies when you use a third-party gateway; Shopify Payments carries no additional Shopify transaction fee, so you pay only the processing rate. If Shopify Payments is available in your country, switching is usually a pure, no-downside margin gain.' },
    { q: 'Is payment processing refunded when a customer returns an order?', a: 'Often not. On many setups the payment processing fee is not returned to you when you refund an order, so a returned sale can cost you the processing fee with no offsetting revenue — effectively paying it twice. This makes processing a larger drag in high-return categories than the headline 2.9% suggests.' },
    { q: 'How do I calculate my true profit per Shopify order?', a: 'Start from the selling price and subtract payment processing, any third-party transaction fee, your allocated plan and app costs (monthly fixed costs divided by monthly orders), cost of goods, shipping, and a returns allowance. What remains is true profit per order. The free SPECTER Shopify Profit Calculator structures this so you don’t miss the processing and plan details.' },
  ],
  internalLinks: [
    { label: 'Free tool: Shopify Profit Calculator', href: '/tools/shopify-profit-calculator' },
    { label: 'Free tool: ROAS Calculator', href: '/tools/roas-calculator' },
    { label: 'Read next: The Hidden Costs Killing Your Margins', href: '/blog/hidden-costs-killing-ecommerce-margins' },
    { label: 'Read next: When to Raise, Lower, or Hold Your Prices', href: '/blog/repricing-strategy-raise-lower-hold' },
  ],
  cta: {
    heading: 'See what you actually keep on every Shopify order',
    body: 'The free Shopify Profit Calculator accounts for processing, plan, and app fees most merchants miss — and shows your true profit per order, margin, and break-even in seconds.',
    primaryLabel: 'Try the free Profit Calculator',
    primaryHref: '/tools/shopify-profit-calculator',
    secondaryLabel: 'See how SPECTER works',
    secondaryHref: '/features',
  },
  relatedSlugs: ['hidden-costs-killing-ecommerce-margins', 'repricing-strategy-raise-lower-hold', 'roas-profitability-guide'],
}
