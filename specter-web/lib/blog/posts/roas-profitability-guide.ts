import type { BlogPost } from '../types'

export const roasProfitabilityGuide: BlogPost = {
  slug: 'roas-profitability-guide',
  title: 'What ROAS Do You Actually Need to Be Profitable?',
  metaTitle: 'What ROAS Do You Need to Be Profitable? (Break-Even ROAS)',
  metaDescription:
    'A “good” ROAS means nothing without your margins. Learn how to calculate your break-even ROAS, why a 3x ROAS can still lose money, and the true after-cost ad profitability number that matters.',
  category: 'ecommerce-analytics',
  tags: ['roas', 'break-even roas', 'ad profitability', 'ecommerce analytics', 'paid ads'],
  authorId: 'specter-research',
  datePublished: '2026-06-14',
  dateModified: '2026-06-14',
  excerpt:
    'There’s no universal “good” ROAS — only the ROAS that clears your costs. Here’s how to calculate your break-even ROAS, why a healthy-looking number can still lose money, and the metric that actually tells you if ads are working.',
  keyword: 'break-even roas',
  searchIntent: 'Informational/commercial — advertiser trying to determine the ROAS they need to run profitable ads.',
  heroAnswer:
    'There’s no universal “good” ROAS — the only number that matters is your break-even ROAS, which is 1 ÷ your contribution margin. If your margin after product cost, fees, and shipping is 40%, your break-even ROAS is 2.5x, meaning any campaign below 2.5x loses money even if it looks successful. A 3x ROAS is great for a 50%-margin store and unprofitable for a 25%-margin one. Calculate your break-even ROAS first, then judge every campaign against that line — not against a generic benchmark.',
  toc: [
    { id: 'roas-is-relative', label: 'Why “good ROAS” is a myth' },
    { id: 'break-even-roas', label: 'How to calculate break-even ROAS' },
    { id: 'why-3x-loses', label: 'Why a 3x ROAS can lose money' },
    { id: 'target-roas', label: 'Setting a target ROAS above break-even' },
    { id: 'measure-it', label: 'Measuring true ad profitability' },
  ],
  sections: [
    {
      id: 'roas-is-relative',
      heading: 'Why there’s no universal “good” ROAS',
      html: `
        <p>Ask in any ecommerce forum "what's a good ROAS?" and you'll get answers like "aim for 3x" or "4x is healthy." These numbers are worse than useless — they're actively misleading, because <strong>ROAS means nothing without your margin</strong>.</p>
        <p>Return on ad spend (ROAS) is just revenue ÷ ad spend. A 3x ROAS means you made $3 in revenue for every $1 spent. But revenue isn't profit. If your product, fees, and shipping eat 70% of that revenue, a 3x ROAS leaves you underwater — you spent $1 to net less than $1 back after costs. Meanwhile a store with fat margins might thrive at 2x.</p>
        <div class="callout"><p><strong>The core idea:</strong> the same ROAS is profitable for one store and ruinous for another. The deciding factor isn't the ROAS — it's your margin. So the first thing to calculate isn't a target ROAS; it's the ROAS at which you break even.</p></div>
      `,
    },
    {
      id: 'break-even-roas',
      heading: 'How to calculate your break-even ROAS',
      html: `
        <p>Break-even ROAS is the point where the gross profit from a sale exactly equals the ad spend that produced it. The formula is elegantly simple:</p>
        <p><strong>Break-Even ROAS = 1 ÷ Contribution Margin</strong></p>
        <p>Where your <strong>contribution margin</strong> is the fraction of revenue left after the variable costs of fulfilling an order — product cost, payment processing, fees, and shipping (everything that scales with each sale, but not your fixed overhead).</p>
        <p>Worked through:</p>
        <ul>
          <li>Contribution margin of <strong>50%</strong> → break-even ROAS = 1 ÷ 0.50 = <strong>2.0x</strong></li>
          <li>Contribution margin of <strong>40%</strong> → break-even ROAS = 1 ÷ 0.40 = <strong>2.5x</strong></li>
          <li>Contribution margin of <strong>30%</strong> → break-even ROAS = 1 ÷ 0.30 = <strong>3.33x</strong></li>
          <li>Contribution margin of <strong>25%</strong> → break-even ROAS = 1 ÷ 0.25 = <strong>4.0x</strong></li>
        </ul>
        <p>This is the single most clarifying number in paid acquisition. The thin-margin store needs a 4x ROAS just to break even; the high-margin store is already profitable at 2x. Same ad platform, completely different reality — and a generic "aim for 3x" benchmark would bankrupt the first store while leaving money on the table for the second.</p>
      `,
    },
    {
      id: 'why-3x-loses',
      heading: 'Why a “healthy” 3x ROAS can still lose money',
      html: `
        <p>Here's the scenario that catches advertisers out. You run a campaign, the dashboard shows a 3x ROAS, and you celebrate. But your contribution margin is 30%, so your break-even ROAS is 3.33x. At 3x, you're <em>below</em> break-even — every dollar of ad spend is losing you money, even though the ROAS "looks good."</p>
        <p>The dashboard rewards you for revenue; your bank account cares about profit. ROAS is a revenue metric, so it systematically flatters thin-margin businesses. Many stores scale a campaign because the ROAS looks acceptable, and only discover months later — when the cash doesn't materialize — that they were buying revenue at a loss the entire time.</p>
        <p>There's also a hidden cost most ROAS calculations ignore: the product cost and fulfillment on the units the ads sold. A true profitability view subtracts those, not just the ad spend. A campaign can clear your break-even ROAS on paper and still disappoint once returns and the full cost stack are included — which is why the honest metric is profit after <em>all</em> costs, not ROAS alone.</p>
      `,
    },
    {
      id: 'target-roas',
      heading: 'Setting a target ROAS above break-even',
      html: `
        <p>Break-even is the floor, not the goal. You want ads to generate <em>profit</em>, plus a margin of safety, plus a contribution toward fixed costs. So your <strong>target ROAS sits above break-even</strong>:</p>
        <ol>
          <li><strong>Calculate break-even ROAS</strong> from your contribution margin (above).</li>
          <li><strong>Add a profit cushion.</strong> If you want ads to deliver real profit and cover overhead, target meaningfully above break-even — often 1.3–1.5x the break-even figure or more, depending on how much fixed cost the channel must carry.</li>
          <li><strong>Adjust for customer lifetime value.</strong> If buyers reorder, you can profitably accept a lower first-order ROAS — even near or below break-even on acquisition — because the repeat purchases pay it back. A pure one-time-purchase product has no such cushion and must be profitable on the first sale.</li>
        </ol>
        <p>This is why two smart advertisers can rationally run very different target ROAS: a subscription brand with high LTV can buy first orders aggressively, while a single-purchase store can't. Both started from break-even and adjusted for their economics — neither used a generic benchmark.</p>
        <div class="callout"><p><strong>The discipline:</strong> kill or fix any campaign that can’t clear break-even ROAS (unless LTV justifies it), and scale the ones comfortably above your target. “Prune ad waste, not ad spend.”</p></div>
      `,
    },
    {
      id: 'measure-it',
      heading: 'Measuring your true, after-cost ad profitability',
      html: `
        <p>To act on any of this, you need two numbers: your break-even ROAS, and your actual after-cost profit on ad-driven sales. Both depend on knowing your real contribution margin — which means knowing your true cost per order, fees and all.</p>
        <p>The free <a href="/tools/roas-calculator">ROAS Calculator</a> computes your break-even ROAS and your true, after-cost ad profitability from your spend, revenue, and costs — so you can see instantly whether a campaign is actually making money rather than just generating impressive-looking revenue. To get the contribution margin right in the first place, pair it with the <a href="/tools/shopify-profit-calculator">Shopify Profit Calculator</a>, which surfaces the processing and fee costs that quietly lower your margin (and therefore raise your break-even ROAS).</p>
        <p>Once you're judging campaigns against <em>your</em> break-even line instead of a forum benchmark, paid acquisition stops being a guessing game. You scale what clears the bar, cut what doesn't, and every ad dollar has a clear profit test to pass.</p>
      `,
    },
  ],
  keyTakeaways: [
    'There’s no universal “good” ROAS — the only number that matters is your break-even ROAS.',
    'Break-Even ROAS = 1 ÷ contribution margin; a 40% margin means you need 2.5x just to break even.',
    'A 3x ROAS loses money for a 30%-margin store (break-even 3.33x) even though it “looks good.”',
    'Set a target ROAS above break-even to cover profit, overhead, and a safety margin — and lower it only when LTV justifies it.',
    'Judge campaigns on true after-cost profit, not raw ROAS — kill what’s below break-even, scale what clears your target.',
  ],
  faq: [
    { q: 'What is a good ROAS for ecommerce?', a: 'There’s no universal good ROAS — it depends entirely on your margin. The meaningful number is your break-even ROAS, calculated as 1 ÷ your contribution margin. A 3x ROAS is excellent for a 50%-margin store (break-even 2x) and unprofitable for a 30%-margin store (break-even 3.33x). Always compare campaigns to your own break-even line, not a generic benchmark.' },
    { q: 'How do I calculate break-even ROAS?', a: 'Break-even ROAS = 1 ÷ contribution margin, where contribution margin is the share of revenue left after the variable costs of an order (product cost, payment processing, fees, shipping). For example, a 40% contribution margin gives a break-even ROAS of 1 ÷ 0.40 = 2.5x. Below that ROAS, a campaign loses money; above it, the campaign is profitable before fixed costs.' },
    { q: 'Why is my campaign losing money with a 3x ROAS?', a: 'Because your break-even ROAS is higher than 3x. If your contribution margin is 30%, you need a 3.33x ROAS just to break even, so a 3x campaign is actually below break-even and losing money on every dollar spent. ROAS is a revenue metric and flatters thin-margin businesses — you have to compare it to your break-even, which is set by your margin.' },
    { q: 'Should my target ROAS be the same as break-even?', a: 'No — break-even is the floor, not the goal. Set a target above break-even to generate actual profit, cover fixed overhead, and leave a safety margin (often 1.3–1.5x break-even or more). You can justify a lower first-order ROAS only when customers reorder, because lifetime value pays back the aggressive acquisition; a single-purchase product must be profitable on the first sale.' },
    { q: 'Does ROAS account for product cost?', a: 'No. Standard ROAS is just revenue ÷ ad spend — it ignores the cost of the products the ads sold, fees, and shipping. That’s why ROAS alone can’t tell you if you’re profitable. True ad profitability subtracts the full cost of the orders, not just the ad spend. The SPECTER ROAS Calculator computes both your break-even ROAS and your real after-cost profit.' },
  ],
  internalLinks: [
    { label: 'Free tool: ROAS Calculator', href: '/tools/roas-calculator' },
    { label: 'Free tool: Shopify Profit Calculator', href: '/tools/shopify-profit-calculator' },
    { label: 'Read next: The Hidden Costs Killing Your Margins', href: '/blog/hidden-costs-killing-ecommerce-margins' },
    { label: 'Read next: Shopify Fees Explained', href: '/blog/shopify-fees-explained' },
  ],
  cta: {
    heading: 'Find out if your ads actually make money',
    body: 'The free ROAS Calculator computes your break-even ROAS and your true after-cost ad profitability — so you scale the campaigns that profit and cut the ones quietly losing money.',
    primaryLabel: 'Try the free ROAS Calculator',
    primaryHref: '/tools/roas-calculator',
    secondaryLabel: 'See plans',
    secondaryHref: '/pricing',
  },
  relatedSlugs: ['hidden-costs-killing-ecommerce-margins', 'shopify-fees-explained', 'repricing-strategy-raise-lower-hold'],
}
