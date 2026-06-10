import type { BlogPost } from '../types'

export const reorderPointCalculation: BlogPost = {
  slug: 'reorder-point-calculation',
  title: 'How to Calculate Your Reorder Point (So You Never Stock Out)',
  metaTitle: 'How to Calculate Your Reorder Point (Formula + Example)',
  metaDescription:
    'Stockouts cost you sales, ranking, and customers. Learn the reorder point formula, how to set safety stock, and exactly when to reorder each product — with a worked example.',
  category: 'inventory-management',
  tags: ['reorder point', 'safety stock', 'inventory management', 'stockouts', 'inventory planning'],
  authorId: 'specter-research',
  datePublished: '2026-06-13',
  dateModified: '2026-06-13',
  excerpt:
    'A stockout is demand handed to your competitors. Here’s the reorder point formula, how to set safety stock for supplier and demand variability, and how to turn it into a restock trigger for every SKU.',
  keyword: 'reorder point calculation',
  searchIntent: 'Informational — operator who wants to know when to reorder inventory to avoid stockouts.',
  heroAnswer:
    'Your reorder point is the inventory level at which you place a new order, calculated as (average daily sales × supplier lead time in days) + safety stock. The first part covers the demand you’ll sell while waiting for the new stock to arrive; safety stock is a buffer that absorbs demand spikes and supplier delays. Set it correctly and you reorder at exactly the right moment — never sitting on excess cash-tied-up inventory, and never running out and handing your demand to a competitor.',
  toc: [
    { id: 'why-it-matters', label: 'Why the reorder point matters' },
    { id: 'the-formula', label: 'The reorder point formula' },
    { id: 'safety-stock', label: 'Setting safety stock the right way' },
    { id: 'worked-example', label: 'A worked example' },
    { id: 'operationalize', label: 'Turning it into a restock trigger' },
  ],
  sections: [
    {
      id: 'why-it-matters',
      heading: 'Why the reorder point is the most important inventory number',
      html: `
        <p>A stockout feels like a single lost sale. It's far worse than that. When you run out of a product, the demand doesn't wait for you — it goes to a competitor who's in stock. On marketplaces, a stockout also costs you search ranking and Buy Box share that's expensive to rebuild. And the customer you lost may not come back. A stockout is your hard-won demand, handed to a rival, with a ranking penalty attached.</p>
        <p>The opposite error — ordering too early or too much — ties up cash in inventory and racks up storage costs. The reorder point is the number that threads this needle: it tells you the exact stock level at which to place your next order so that fresh inventory arrives <em>just</em> as your current stock runs low.</p>
        <div class="callout"><p><strong>The core idea:</strong> you don't reorder on a calendar or a hunch. You reorder when a specific SKU hits a specific number — its reorder point — that accounts for how fast it sells and how long your supplier takes to deliver.</p></div>
      `,
    },
    {
      id: 'the-formula',
      heading: 'The reorder point formula',
      html: `
        <p>The formula is simple and worth committing to memory:</p>
        <p><strong>Reorder Point = (Average Daily Sales × Lead Time in Days) + Safety Stock</strong></p>
        <p>Break it into its two jobs:</p>
        <ul>
          <li><strong>Average Daily Sales × Lead Time</strong> — this is your <em>lead-time demand</em>: the number of units you expect to sell during the time between placing an order and receiving it. If you sell 10/day and your supplier takes 14 days, you'll sell ~140 units while waiting. You must have at least that much on hand when you order, or you'll stock out before the shipment lands.</li>
          <li><strong>Safety Stock</strong> — a buffer on top, to cover the times demand runs hotter than average or the supplier runs later than promised. Without it, any above-average week or any shipping delay causes a stockout.</li>
        </ul>
        <p>Get your average daily sales from recent history (use a representative window — not your single best week), and get lead time from your supplier's real performance, not their optimistic quote. Both inputs should reflect reality, not best-case.</p>
      `,
    },
    {
      id: 'safety-stock',
      heading: 'Setting safety stock without guessing',
      html: `
        <p>Safety stock is where most merchants either wing it (too little, frequent stockouts) or panic (too much, cash tied up). The right amount depends on two kinds of variability:</p>
        <h3>Demand variability</h3>
        <p>If your daily sales are steady, you need little buffer. If they swing wildly — promotions, seasonality, a viral moment — you need more, because the lead-time demand estimate based on the average will frequently be too low.</p>
        <h3>Supply variability</h3>
        <p>If your supplier reliably delivers in exactly 14 days, your lead time is predictable. If "14 days" sometimes means 21, your buffer has to cover that gap, or a late shipment becomes a stockout.</p>
        <p>A common, practical approach is to size safety stock to cover a chosen service level — for example, enough buffer to avoid stockouts in all but the worst few percent of demand/lead-time scenarios. The higher the service level you want, the more safety stock (and tied-up cash) it costs. The right target is higher for your best-sellers and marketplace listings (where stockouts hurt most) and lower for slow, easily-replaced items.</p>
        <div class="callout"><p><strong>Rule of thumb:</strong> the more variable your demand or your supplier, the more safety stock you need. Steady sales and a reliable supplier let you run lean; volatility on either side demands a bigger buffer.</p></div>
      `,
    },
    {
      id: 'worked-example',
      heading: 'A worked example',
      html: `
        <p>Suppose you sell a product at a steady clip and want to find its reorder point:</p>
        <table>
          <thead><tr><th>Input</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Average daily sales</td><td>12 units/day</td></tr>
            <tr><td>Supplier lead time</td><td>15 days</td></tr>
            <tr><td>Safety stock (chosen buffer)</td><td>60 units</td></tr>
          </tbody>
        </table>
        <p><strong>Lead-time demand</strong> = 12 × 15 = <strong>180 units</strong>.<br>
        <strong>Reorder point</strong> = 180 + 60 = <strong>240 units</strong>.</p>
        <p>So when this SKU's on-hand inventory drops to <strong>240 units</strong>, you place your next order. You'll sell roughly 180 units over the 15-day lead time, landing you near your 60-unit safety buffer just as the new shipment arrives — and the buffer absorbs any spike or delay. Order later than 240 and you risk running dry; order much earlier and you tie up cash you didn't need to.</p>
        <p>Notice how the reorder point moves with reality: if sales accelerate to 18/day or the supplier slips to 21 days, the reorder point rises and you need to order sooner. That's why it should be recalculated as your sales rate and lead times change — a static number set once will be wrong within a season.</p>
      `,
    },
    {
      id: 'operationalize',
      heading: 'Turning the reorder point into a restock trigger',
      html: `
        <p>A reorder point only prevents stockouts if it actually triggers an order. To operationalize it:</p>
        <ol>
          <li><strong>Calculate it per SKU,</strong> prioritizing your best-sellers and any marketplace listings where a stockout costs ranking.</li>
          <li><strong>Set it as an alert threshold</strong> in your inventory system, so you're prompted the moment on-hand stock crosses the reorder point — not when someone happens to notice.</li>
          <li><strong>Recalculate periodically,</strong> especially when sales velocity changes or you switch suppliers; both inputs drift over time.</li>
          <li><strong>Tighten buffers on volatile or high-stakes SKUs</strong> and loosen them on slow movers to balance availability against tied-up cash.</li>
        </ol>
        <p>The free <a href="/tools/inventory-reorder-calculator">Inventory Reorder Calculator</a> computes your reorder point and safety stock — using the standard approach including economic order quantity — so you can set accurate restock triggers without doing the math by hand for every product. Combined with watching for competitor stockouts (their outage is your opportunity, as covered in our guide on <a href="/blog/catch-competitors-out-of-stock">catching competitors out of stock</a>), disciplined reorder points turn inventory from a recurring fire drill into a quiet, reliable system.</p>
      `,
    },
  ],
  keyTakeaways: [
    'Reorder Point = (average daily sales × lead time in days) + safety stock.',
    'The first term covers demand during the supplier lead time; safety stock buffers demand spikes and supplier delays.',
    'Size safety stock to your demand and supply variability — steady inputs run lean, volatile inputs need a bigger buffer.',
    'A stockout costs more than one sale: it hands demand to competitors and can cost marketplace ranking.',
    'Recalculate per SKU as sales velocity and lead times change, and set it as an alert threshold so it actually triggers reorders.',
  ],
  faq: [
    { q: 'What is a reorder point?', a: 'A reorder point is the inventory level at which you should place a new purchase order so that fresh stock arrives just as your current stock runs low. It’s calculated as average daily sales multiplied by supplier lead time, plus a safety stock buffer. Reaching the reorder point is the trigger to reorder — not a date on the calendar.' },
    { q: 'How do I calculate safety stock?', a: 'Safety stock is a buffer sized to your demand variability and supply variability. The more your daily sales fluctuate, or the less reliable your supplier’s lead time, the more safety stock you need to hit your target service level (the percentage of time you want to avoid stocking out). Steady sales and a reliable supplier let you run a smaller buffer; volatility on either side requires a larger one.' },
    { q: 'What is lead time in inventory management?', a: 'Lead time is the number of days between placing a purchase order and having the stock available to sell. Use your supplier’s real, observed lead time rather than their quoted best case, because reorder points built on optimistic lead times cause stockouts whenever a shipment runs late.' },
    { q: 'How often should I recalculate my reorder point?', a: 'Whenever your sales velocity or supplier lead time changes meaningfully — and at minimum each season. Both inputs drift: a product that sold 10/day in spring may sell 18/day before the holidays, which raises its reorder point. A reorder point set once and never revisited will eventually be wrong and cause either stockouts or excess inventory.' },
    { q: 'What happens if I set my reorder point too low?', a: 'You’ll stock out. If the reorder point is below your true lead-time demand plus a safety buffer, you’ll run out before the replacement shipment arrives — losing sales, handing demand to competitors, and (on marketplaces) potentially losing search ranking and Buy Box share that’s expensive to rebuild. Setting it slightly conservative is usually cheaper than setting it too aggressive.' },
  ],
  internalLinks: [
    { label: 'Free tool: Inventory Reorder Calculator', href: '/tools/inventory-reorder-calculator' },
    { label: 'Read next: How to Catch Competitors Going Out of Stock', href: '/blog/catch-competitors-out-of-stock' },
    { label: 'Free tool: Shopify Profit Calculator', href: '/tools/shopify-profit-calculator' },
    { label: 'See how SPECTER monitors competitors automatically', href: '/features' },
  ],
  cta: {
    heading: 'Never stock out on a best-seller again',
    body: 'The free Inventory Reorder Calculator computes your reorder point and safety stock per SKU, so you reorder at exactly the right moment — never tying up cash, never handing demand to a competitor.',
    primaryLabel: 'Try the free Reorder Calculator',
    primaryHref: '/tools/inventory-reorder-calculator',
    secondaryLabel: 'See plans',
    secondaryHref: '/pricing',
  },
  relatedSlugs: ['catch-competitors-out-of-stock', 'hidden-costs-killing-ecommerce-margins', 'competitor-price-monitoring-shopify'],
}
