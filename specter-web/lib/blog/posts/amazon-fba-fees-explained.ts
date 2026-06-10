import type { BlogPost } from '../types'

export const amazonFbaFeesExplained: BlogPost = {
  slug: 'amazon-fba-fees-explained',
  title: 'Amazon FBA Fees Explained: What You Actually Pay in 2026',
  metaTitle: 'Amazon FBA Fees Explained (2026 Breakdown)',
  metaDescription:
    'A plain-English breakdown of every Amazon FBA fee in 2026 — referral, fulfillment, storage, and the surprise charges — plus how to work out whether a product is actually profitable before you ship it in.',
  category: 'marketplace-selling',
  tags: ['amazon fba', 'fba fees', 'amazon selling', 'fulfillment fees', 'marketplace selling'],
  authorId: 'specter-research',
  datePublished: '2026-06-11',
  dateModified: '2026-06-11',
  excerpt:
    'Amazon FBA fees are death by a thousand cuts — referral, fulfillment, storage, and a stack of surprise charges. Here’s every fee that hits your margin, what it actually costs, and how to know if a product makes money before you send it in.',
  keyword: 'amazon fba fees',
  searchIntent: 'Informational/commercial — seller researching FBA costs to decide whether a product is profitable on Amazon.',
  heroAnswer:
    'Amazon FBA fees come in four main buckets: a referral fee (usually 8–15% of the sale price, most often 15%), a fulfillment fee (a per-unit charge based on size and weight, typically a few dollars), monthly storage fees (charged per cubic foot, higher in Q4), and a stack of situational fees — long-term storage, returns processing, removals, and low-inventory or aged-inventory surcharges. Together these commonly consume 30–45% of an item’s sale price, which is why a product can look profitable on cost-of-goods alone and still lose money once every FBA fee is counted.',
  toc: [
    { id: 'why-fees-matter', label: 'Why FBA fees decide your profit' },
    { id: 'four-buckets', label: 'The four core fees you always pay' },
    { id: 'surprise-fees', label: 'The surprise fees that catch sellers out' },
    { id: 'worked-example', label: 'A worked example, fee by fee' },
    { id: 'check-profit', label: 'How to check a product before you ship it' },
  ],
  sections: [
    {
      id: 'why-fees-matter',
      heading: 'Why FBA fees decide whether a product is worth selling',
      html: `
        <p>Fulfillment by Amazon is a remarkable machine: you ship your inventory to Amazon, and they pick, pack, ship, handle returns, and provide customer service. In exchange, they take a series of fees — and those fees are where most new FBA sellers quietly lose money.</p>
        <p>The trap is simple. A seller finds a product that costs $6 to make and sells for $25, calculates a "76% margin," and orders 500 units. Then the fees land: a referral fee, a fulfillment fee, storage, a return or two, and suddenly the real profit is a dollar or two per unit — or negative. Nothing went wrong operationally. The math was just never done properly in the first place.</p>
        <div class="callout"><p><strong>The core idea:</strong> on Amazon, your selling price is not your revenue. Your revenue is the selling price minus every FBA fee — and there are more of them than the headline referral and fulfillment charges most sellers know about.</p></div>
        <p>Understanding each fee isn't academic. It's the difference between sourcing a product that prints money and one that ties up your cash in inventory you'll eventually pay Amazon to dispose of.</p>
      `,
    },
    {
      id: 'four-buckets',
      heading: 'The four core fees you always pay',
      html: `
        <h3>1. The referral fee</h3>
        <p>This is Amazon's commission on every sale — a percentage of the total sale price (item + shipping). For most categories it's <strong>15%</strong>, though it ranges from roughly 8% (some electronics) to 17% (some accessories), and there's typically a minimum referral fee (around $0.30) on low-priced items. This fee is unavoidable and scales with your price, so raising your price raises this cost too.</p>
        <h3>2. The fulfillment fee</h3>
        <p>This is the per-unit charge for Amazon physically picking, packing, and shipping your item. It's driven by <strong>size tier and weight</strong>, not price — a small, light item might cost a few dollars to fulfill, while an oversize item costs substantially more. Because it's weight-and-size based, fulfillment fees punish bulky, heavy products and reward small, light ones.</p>
        <h3>3. Monthly storage fees</h3>
        <p>Amazon charges for the warehouse space your inventory occupies, billed <strong>per cubic foot per month</strong>. Critically, the Q4 rate (October–December) is several times the off-season rate, because space is scarce during the holidays. Slow-selling inventory that sits through Q4 can rack up storage costs that quietly eat the margin on the units that do sell.</p>
        <h3>4. The subscription fee</h3>
        <p>A Professional selling account is a flat monthly fee (around $39.99) regardless of volume. It's small, but it's a real fixed cost — spread it across your monthly unit volume to understand its true per-order impact when you're just starting out.</p>
        <p>These four are predictable: you can estimate them before you ever source a product. The next set is where sellers get ambushed.</p>
      `,
    },
    {
      id: 'surprise-fees',
      heading: 'The surprise fees that catch sellers out',
      html: `
        <p>Beyond the core four, Amazon levies a set of situational fees that don't show up in a naive margin calculation — and these are the ones that turn a "profitable" product into a loss:</p>
        <ul>
          <li><strong>Long-term / aged-inventory storage:</strong> inventory sitting beyond a certain age (commonly 181+ and 365+ days) incurs surcharges on top of standard storage. Dead stock isn't just unsold — it's actively billing you.</li>
          <li><strong>Low-inventory-level fee:</strong> if you consistently run thin on stock relative to your sales rate, Amazon may add a per-unit fee, on the logic that low inventory makes fulfillment less efficient. Ironically, running lean to avoid storage fees can trigger this one.</li>
          <li><strong>Returns processing fee:</strong> in many categories, customer returns cost you a processing fee — and you may not get the original referral fee fully refunded. High-return categories like apparel feel this acutely.</li>
          <li><strong>Removal and disposal fees:</strong> getting unsold inventory back (or having Amazon destroy it) costs a per-unit fee. The exit isn't free either.</li>
          <li><strong>Inbound placement / split-shipment fees:</strong> depending on how you send inventory in, Amazon may charge for distributing it across fulfillment centers.</li>
        </ul>
        <p>None of these are huge individually. But layered onto the core four, they're why the honest "all-in" FBA cost of selling an item frequently lands at <strong>30–45% of the sale price</strong> — before you've paid for the product itself or any advertising.</p>
        <div class="callout"><p><strong>Worth remembering:</strong> the fees you forget are almost always the situational ones. A product can clear the referral + fulfillment math and still lose money to storage and returns if it sells slowly or comes back often.</p></div>
      `,
    },
    {
      id: 'worked-example',
      heading: 'A worked example: where the money actually goes',
      html: `
        <p>Take a mid-size product selling for <strong>$25</strong> that costs you <strong>$6</strong> landed (manufacturing + freight to Amazon). Here's a realistic fee stack:</p>
        <table>
          <thead><tr><th>Line</th><th>Amount</th><th>Running total left</th></tr></thead>
          <tbody>
            <tr><td>Sale price</td><td>$25.00</td><td>$25.00</td></tr>
            <tr><td>Referral fee (15%)</td><td>−$3.75</td><td>$21.25</td></tr>
            <tr><td>Fulfillment fee</td><td>−$5.20</td><td>$16.05</td></tr>
            <tr><td>Storage (allocated)</td><td>−$0.40</td><td>$15.65</td></tr>
            <tr><td>Returns allowance (~5%)</td><td>−$0.90</td><td>$14.75</td></tr>
            <tr><td>Landed product cost</td><td>−$6.00</td><td>$8.75</td></tr>
          </tbody>
        </table>
        <p>That leaves roughly <strong>$8.75 of profit per unit</strong> — about a 35% net margin, which is genuinely healthy for FBA. But notice how thin the buffer is: bump the fulfillment fee a dollar (a slightly larger box), let the product sit and trip long-term storage, or sell in a 25%-return category, and that $8.75 erodes fast. The same product at a $1.50 lower price, or with a higher return rate, can drop under $5 — or below break-even once advertising is added.</p>
        <p>This is the entire reason to do the fee math <em>before</em> sourcing: the difference between a great FBA product and a cash trap is often just a few dollars of fees you didn't account for.</p>
      `,
    },
    {
      id: 'check-profit',
      heading: 'How to check a product is profitable before you ship it in',
      html: `
        <p>You never want to discover your FBA fees after you've committed cash to 500 units. The discipline is to model the full fee stack at the sourcing stage:</p>
        <ol>
          <li><strong>Start from a realistic sale price,</strong> not your hoped-for price — check what comparable in-stock listings actually sell for.</li>
          <li><strong>Subtract the referral fee</strong> (use 15% unless you know your category is different).</li>
          <li><strong>Estimate the fulfillment fee</strong> from the product's real packed size and weight — guess the size tier up, not down.</li>
          <li><strong>Allocate storage and a returns allowance,</strong> erring high for slow-moving or high-return categories.</li>
          <li><strong>Only then subtract your landed product cost</strong> to see true profit per unit — and sanity-check the margin and ROI.</li>
        </ol>
        <p>The free <a href="/tools/amazon-fba-calculator">Amazon FBA Calculator</a> runs this whole stack for you — enter your price, cost, and dimensions and it returns net profit per unit, margin, ROI, and your break-even price, so you can see at a glance whether a product survives its own fees. Pair it with a quick read on what to price at in the first place using the <a href="/tools/price-position-analyzer">Price Position Analyzer</a>.</p>
        <p>Get into the habit of running every candidate product through the full fee math, and FBA stops being a place where margin mysteriously disappears and becomes a channel you can source for with confidence.</p>
      `,
    },
  ],
  keyTakeaways: [
    'FBA fees fall into four core buckets — referral (~15%), fulfillment (size/weight), storage (per cubic foot), and the account subscription.',
    'Situational fees (long-term storage, low-inventory, returns, removals) are what turn a “profitable” product into a loss.',
    'All-in FBA fees commonly consume 30–45% of the sale price before product cost or advertising.',
    'Fulfillment and storage are driven by size and weight, so small, light, fast-selling products are structurally more profitable.',
    'Model the full fee stack at the sourcing stage — never discover your fees after committing cash to inventory.',
  ],
  faq: [
    { q: 'How much does Amazon FBA cost in total?', a: 'For a typical product, all-in FBA fees consume roughly 30–45% of the sale price. That includes the referral fee (usually 15%), a per-unit fulfillment fee based on size and weight (often a few dollars), monthly storage charged per cubic foot, and situational fees like returns and long-term storage. The exact figure depends heavily on the item’s size, weight, sell-through speed, and return rate.' },
    { q: 'What is the Amazon referral fee?', a: 'The referral fee is Amazon’s commission on each sale — a percentage of the total sale price. It’s 15% in most categories, ranging from about 8% to 17% depending on the category, with a minimum (around $0.30) on low-priced items. Because it scales with price, it’s one of the few FBA fees that rises when you raise your price.' },
    { q: 'Why are my FBA fees higher than I expected?', a: 'Usually because of the situational fees a basic margin calculation ignores: long-term or aged-inventory storage on slow sellers, returns processing in high-return categories, low-inventory-level fees, and removal/disposal costs. Fulfillment fees can also be higher than expected if your packed size pushes the item into a larger size tier than you assumed.' },
    { q: 'How do I calculate FBA profit before sourcing a product?', a: 'Start from a realistic market sale price, subtract the referral fee (15%), estimate the fulfillment fee from the real packed size and weight, allocate storage and a returns allowance, then subtract your landed product cost. What remains is true profit per unit. The free SPECTER Amazon FBA Calculator runs this whole stack and also returns your margin, ROI, and break-even price.' },
    { q: 'Are FBA storage fees really that significant?', a: 'They can be, especially in Q4 when the per-cubic-foot rate jumps several times over, and for slow-moving stock that triggers long-term storage surcharges. For a fast-selling small item, storage is a rounding error; for a bulky product that sits for months, storage alone can erase the margin. Sell-through speed is the deciding factor.' },
  ],
  internalLinks: [
    { label: 'Free tool: Amazon FBA Calculator', href: '/tools/amazon-fba-calculator' },
    { label: 'Free tool: Price Position Analyzer', href: '/tools/price-position-analyzer' },
    { label: 'Read next: Pricing Against Amazon & Marketplace Competitors', href: '/blog/pricing-against-amazon-marketplace-competitors' },
    { label: 'Read next: The Hidden Costs Killing Your Margins', href: '/blog/hidden-costs-killing-ecommerce-margins' },
  ],
  cta: {
    heading: 'Know your true FBA profit before you ship a single unit',
    body: 'The free Amazon FBA Calculator runs the full fee stack — referral, fulfillment, storage, and returns — and tells you net profit, margin, ROI, and break-even price per unit. Source products that actually make money.',
    primaryLabel: 'Try the free FBA Calculator',
    primaryHref: '/tools/amazon-fba-calculator',
    secondaryLabel: 'See plans',
    secondaryHref: '/pricing',
  },
  relatedSlugs: ['pricing-against-amazon-marketplace-competitors', 'hidden-costs-killing-ecommerce-margins', 'repricing-strategy-raise-lower-hold'],
}
