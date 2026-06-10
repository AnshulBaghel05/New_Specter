// Canonical schema data for all 6 tools.
// Imported by both layout.tsx (for JSON-LD injection) and page.tsx (for QuickAnswer + FAQPage schema).

export interface HowToStep {
  name: string
  text: string
}

export interface FaqItem {
  q: string
  a: string
}

export interface ToolSchemaData {
  toolName: string
  toolUrl: string
  quickAnswer: string
  howToName: string
  howToDescription: string
  steps: HowToStep[]
  faqItems: FaqItem[]
}

// ── Price Position Analyzer ────────────────────────────────────────────────

export const PRICE_POSITION_SCHEMA: ToolSchemaData = {
  toolName: 'Price Position Analyzer',
  toolUrl: 'https://specterapp.io/tools/price-position-analyzer',
  quickAnswer:
    'Enter your selling price and up to 3 competitor prices. The calculator instantly shows your market rank and a RAISE, LOWER, or HOLD signal based on your price gap to the market average.',
  howToName: 'How to analyze your competitor price position',
  howToDescription:
    'Use this free tool to see exactly where your price sits versus competitors and get a RAISE/LOWER/HOLD signal in under 30 seconds.',
  steps: [
    { name: 'Enter your price', text: 'Type your current selling price in the "My Current Price" field.' },
    { name: 'Add competitor prices', text: 'Enter up to 3 competitor product prices and optionally label each one.' },
    { name: 'Read your signal', text: 'Your RAISE / LOWER / HOLD signal appears instantly with a suggested optimal price and your rank in the market.' },
    { name: 'Check the market overview', text: 'Review the market low, high, average, and price range visualizer to understand the full competitive landscape.' },
  ],
  faqItems: [
    { q: 'What does a RAISE / LOWER / HOLD signal mean?', a: 'RAISE means your price is more than 5% below the market average — you may be leaving margin on the table. LOWER means your price is more than 5% above market average — you risk losing price-sensitive shoppers. HOLD means your price is within 5% of market average — a competitive position that balances conversion and margin.' },
    { q: 'How do I find my competitors\' prices?', a: 'Reliable methods: (1) Manual spot-checking on competitor websites; (2) Google Shopping searches; (3) Real-time tools like SPECTER that scrape competitor prices automatically; (4) Checking marketplaces like Amazon, Walmart, and eBay. For competitive categories, prices change 1–3× per week, so monitoring cadence matters.' },
    { q: 'What is a good price gap vs. the market average?', a: 'For value positioning, pricing 5–15% below market average drives volume but compresses margin. For premium positioning, 10–20% above market average is sustainable if your brand and product quality justify it. Avoid gaps over 20% without a clear strategic reason.' },
    { q: 'How often should I monitor and adjust my prices?', a: 'For competitive Amazon or marketplace categories, daily monitoring is ideal — some sellers reprice hourly. For Shopify and DTC stores, weekly checks are a reasonable minimum. Setting alerts when competitors move more than 5% keeps you competitive without constant manual checking.' },
    { q: 'Should I always match the lowest competitor price?', a: 'No — matching the lowest price is a race to the bottom that destroys category margins. Instead, target a position relative to your value. Always check your break-even price first to ensure profitability, then position competitively within a range that fits your brand.' },
  ],
}

// ── Amazon FBA Calculator ──────────────────────────────────────────────────

export const FBA_SCHEMA: ToolSchemaData = {
  toolName: 'Amazon FBA Calculator',
  toolUrl: 'https://specterapp.io/tools/amazon-fba-calculator',
  quickAnswer:
    'Enter your selling price, product cost, package dimensions, and weight. The calculator uses 2025 official Amazon FBA rates to show your exact fulfillment fee, referral fee, storage cost, and true net profit per unit.',
  howToName: 'How to calculate Amazon FBA fees and profit',
  howToDescription:
    'Use this free tool to see your exact Amazon FBA fees and true per-unit profit using 2025 official rates.',
  steps: [
    { name: 'Enter your selling price and COGS', text: 'Input your Amazon listing price and what you pay per unit (cost of goods sold).' },
    { name: 'Enter package dimensions and weight', text: 'Expand the "Package dimensions & storage" section and enter length, width, height in inches and actual weight in ounces.' },
    { name: 'Select product category', text: 'Choose your Amazon product category. This determines your referral fee percentage (8–20%).' },
    { name: 'Review your profit and fees', text: 'The results panel shows net profit, margin, ROI, break-even ACOS, and a full fee breakdown including fulfillment, referral, and storage fees.' },
  ],
  faqItems: [
    { q: 'How are Amazon FBA fulfillment fees calculated?', a: 'FBA fulfillment fees are based on your product\'s size tier and billable weight — the greater of actual weight vs. dimensional weight (L × W × H ÷ 139 in ounces). Amazon charges a per-tier rate. Referral fees (8–20% of sale price) are charged separately.' },
    { q: 'What is dimensional weight and how does it affect FBA fees?', a: 'Dimensional weight = (L × W × H) ÷ 139 for items in inches. If your DIM weight exceeds actual weight, Amazon bills you for DIM weight. Reducing even one dimension by an inch can drop you to a cheaper tier and save $2–4 per unit.' },
    { q: 'What is the break-even selling price for FBA products?', a: 'Break-even price = Product cost + Fulfillment fee + Referral fee + Monthly storage cost per unit. Any selling price below this results in a per-unit loss. Healthy FBA economics typically target 20–30% net margin above break-even.' },
    { q: 'Which Amazon FBA size tier is the cheapest?', a: 'Small Standard is cheapest (under $3.22 for items under 4 oz in 2025). The jump from Small to Large Standard can add $2–4 per unit. Minor packaging changes to stay in a cheaper tier compound at volume.' },
    { q: 'What aged inventory fees does Amazon charge?', a: 'Amazon charges aged inventory surcharges for units stored over 180 days: $1.50/cu ft for 181–270 days, $6.90/cu ft for 271+ days. Running promotions before the 180-day mark prevents significant fee accumulation.' },
  ],
}

// ── Shopify Profit Calculator ─────────────────────────────────────────────

export const SHOPIFY_SCHEMA: ToolSchemaData = {
  toolName: 'Shopify True Profit Calculator',
  toolUrl: 'https://specterapp.io/tools/shopify-profit-calculator',
  quickAnswer:
    'Enter your monthly revenue, COGS, Shopify plan, and order count. The calculator deducts all platform fees, payment processing, app costs, returns, shipping, and ad spend to show your true monthly profit — not just gross margin.',
  howToName: 'How to calculate your true Shopify profit margin',
  howToDescription:
    'Use this free tool to see your actual take-home profit after all Shopify fees, processing costs, returns, and ad spend.',
  steps: [
    { name: 'Select your Shopify plan', text: 'Choose Basic, Shopify, Advanced, or Plus and toggle whether you use Shopify Payments or a third-party processor.' },
    { name: 'Enter revenue and COGS', text: 'Input your monthly revenue, cost of goods sold, and order count.' },
    { name: 'Add operating costs', text: 'Expand "Operating costs" to add app spend, outbound shipping, return rate, and restocking loss percentage.' },
    { name: 'Read your true profit', text: 'The profit waterfall shows exactly how revenue flows through each cost to your true monthly profit and margin.' },
  ],
  faqItems: [
    { q: 'What transaction fee does Shopify charge?', a: 'Shopify charges a transaction fee if you use a third-party payment processor: 2% on Basic, 1% on Shopify, 0.5% on Advanced. With Shopify Payments, the transaction fee is waived — you only pay the card processing rate (typically 2.9% + 30¢ on Basic).' },
    { q: 'How do I calculate my true Shopify profit margin?', a: 'True profit = Revenue − COGS − Shopify plan fee − Payment processing fees − App fees − Shipping costs − Returns/refunds − Ad spend. Most merchants focus only on gross margin and miss 15–30 percentage points of real costs.' },
    { q: 'What is a good net profit margin for a Shopify store?', a: 'A healthy Shopify store typically targets 15–25% net profit margin after all fees, costs, and ad spend. Under 10% is tight. Over 30% usually indicates strong product-market fit and lean operations.' },
    { q: 'When does upgrading my Shopify plan save money?', a: 'The break-even between Basic ($39/mo) and Shopify ($105/mo) with third-party payment processing occurs around $6,600/month in revenue — the $66/mo plan difference is offset by the 1% transaction fee reduction.' },
    { q: 'Does Shopify refund the processing fee on returns?', a: 'As of 2022, Shopify Payments stopped refunding processing fees on refunded orders. A 10% return rate with 2.9% processing adds roughly 0.29% to your effective cost of sales — a silent margin drain in high-return categories like apparel.' },
  ],
}

// ── Shipping Calculator ────────────────────────────────────────────────────

export const SHIPPING_SCHEMA: ToolSchemaData = {
  toolName: 'Shipping Rate Comparator',
  toolUrl: 'https://specterapp.io/tools/shipping-calculator',
  quickAnswer:
    'Enter your package weight, dimensions, and destination zone. The calculator compares UPS, FedEx, USPS, and DHL rates — including dimensional weight — and highlights the cheapest and fastest options with landed cost for international shipments.',
  howToName: 'How to compare shipping rates across carriers',
  howToDescription:
    'Use this free tool to compare domestic and international shipping costs across all major carriers in seconds.',
  steps: [
    { name: 'Enter package weight and dimensions', text: 'Input the actual weight in pounds and the package dimensions in inches.' },
    { name: 'Select destination zone', text: 'Choose a shipping zone (Zone 2–8) based on the distance from your origin to destination.' },
    { name: 'Compare carrier rates', text: 'The results show rates from UPS, FedEx, USPS, and DHL — including dimensional weight billing where it applies.' },
    { name: 'Check international costs', text: 'Switch to the International tab for landed cost calculations including duties, VAT, and brokerage fees for UK, Canada, Australia, and New Zealand.' },
  ],
  faqItems: [
    { q: 'How do UPS, FedEx, USPS, and DHL calculate shipping rates?', a: 'All major carriers bill on the higher of actual weight vs. dimensional weight (DIM = L × W × H ÷ 139 for UPS/FedEx). They apply zone-based rates (Zones 1–8 by distance). Additional surcharges include fuel (5–25%), residential delivery ($5–6), and over-size fees.' },
    { q: 'What is dimensional weight and when does it apply?', a: 'DIM weight = (L × W × H) ÷ 139 for UPS/FedEx in inches/pounds. Applies to nearly all UPS/FedEx Ground and Express shipments. A large but light package billed on DIM weight can cost significantly more than its actual weight implies.' },
    { q: 'What is a landed cost and what does it include?', a: 'Landed cost = product cost + domestic freight + import duties (tariff on HTS code) + destination taxes (VAT/GST) + customs brokerage + international freight + insurance + last-mile delivery. For cross-border ecommerce, landed cost can add 15–40% above product cost.' },
    { q: 'How are import duties and taxes calculated?', a: 'Import duty = Declared value × duty rate (varies by product category and destination). VAT or GST is then applied to (Declared value + Duty + Shipping). UK charges 20% VAT on that total. Products under the de minimis threshold (£135 UK, $800 US, €150 EU) are often exempt from duties.' },
    { q: 'Which carrier is cheapest for my shipment?', a: 'For packages under 1 lb at short distances, USPS is usually cheapest. For 1–10 lb packages at medium distance, USPS Priority Cubic or UPS/FedEx Ground compete. For heavy packages or long distances, negotiated UPS/FedEx contract rates (40–60% off retail) beat USPS.' },
  ],
}

// ── ROAS Calculator ────────────────────────────────────────────────────────

export const ROAS_SCHEMA: ToolSchemaData = {
  toolName: 'ROAS & Ad Profitability Calculator',
  toolUrl: 'https://specterapp.io/tools/roas-calculator',
  quickAnswer:
    'Enter your ad spend, attributed revenue, COGS, and fulfillment costs. The calculator shows your ROAS, True ROAS after variable costs, break-even ROAS, and net profit — benchmarked against industry averages for your ad platform.',
  howToName: 'How to calculate ROAS and ad profitability',
  howToDescription:
    'Use this free tool to calculate your ROAS, break-even ROAS, and true profit after variable costs for any ad campaign.',
  steps: [
    { name: 'Enter campaign spend and revenue', text: 'Input your total ad spend and total attributed revenue for the period you want to analyze.' },
    { name: 'Add COGS and fulfillment', text: 'Enter your cost of goods sold and fulfillment/shipping costs to calculate true ROAS after variable costs.' },
    { name: 'Review your ROAS metrics', text: 'The results show ROAS, True ROAS, break-even ROAS (1 ÷ gross margin), and net profit from the campaign.' },
    { name: 'Compare to platform benchmarks', text: 'See how your ROAS compares to industry averages for Meta, Google Shopping, Google Search, and TikTok.' },
  ],
  faqItems: [
    { q: 'What is a good ROAS for ecommerce?', a: 'A good ROAS depends on your gross margin. Break-even ROAS = 1 ÷ gross margin (e.g., 40% margin requires a 2.5× break-even ROAS). Industry benchmarks: Meta 2–5×, Google Shopping 3–8×, Google Search 2–4×, TikTok 1.5–3×, Amazon PPC 3–8×.' },
    { q: 'How do you calculate break-even ROAS?', a: 'Break-even ROAS = 1 ÷ gross margin. If your product costs $30 to make and ships for $5, sold at $100, gross margin = 65%. Break-even ROAS = 1 ÷ 0.65 = 1.54×. Any campaign above that is profitable at the gross margin level.' },
    { q: 'What is the difference between ROAS and true ROAS?', a: 'Standard ROAS = Revenue ÷ Ad Spend. True ROAS = Gross Profit ÷ Ad Spend — it accounts for product cost and fulfillment. A 5× ROAS on a 20% margin product gives a true ROAS of just 1.0× (breakeven). True ROAS is the meaningful metric.' },
    { q: 'How does conversion rate affect my ROAS?', a: 'Doubling your conversion rate from 1% to 2% effectively doubles your ROAS without changing your bids. Small CVR improvements through better landing pages and trust signals often outperform bid optimization for improving overall ad profitability.' },
    { q: 'What is CPA and how does it relate to ROAS?', a: 'CPA = Ad Spend ÷ Conversions. ROAS and CPA are linked: ROAS = AOV ÷ CPA. Your maximum allowable CPA = AOV × gross margin. Exceeding this means the campaign is unprofitable at the gross margin level.' },
  ],
}

// ── Inventory Reorder Calculator ──────────────────────────────────────────

export const INVENTORY_SCHEMA: ToolSchemaData = {
  toolName: 'Inventory EOQ & Restock Calculator',
  toolUrl: 'https://specterapp.io/tools/inventory-reorder-calculator',
  quickAnswer:
    'Enter your average daily demand, lead time, order cost, and unit cost. The Wilson EOQ formula calculates your optimal order quantity, reorder point, and safety stock level to minimize total inventory costs.',
  howToName: 'How to calculate Economic Order Quantity (EOQ) and reorder point',
  howToDescription:
    'Use this free tool to find your optimal order quantity and reorder point using the Wilson EOQ formula.',
  steps: [
    { name: 'Enter demand and lead time', text: 'Input average daily demand (units/day), demand standard deviation, and supplier lead time in days.' },
    { name: 'Enter cost inputs', text: 'Enter order cost (cost to place one purchase order) and unit cost (COGS per unit).' },
    { name: 'Set service level', text: 'Expand "Advanced settings" and select your target service level (90%, 95%, or 99%) to control safety stock.' },
    { name: 'Read your EOQ and reorder point', text: 'The results show optimal order quantity (EOQ), reorder point, safety stock, total annual cost, and inventory turns.' },
  ],
  faqItems: [
    { q: 'What is Economic Order Quantity (EOQ)?', a: 'EOQ is the optimal order quantity that minimizes total inventory costs (ordering costs + holding costs). Formula: EOQ = √(2DS / H), where D = annual demand, S = cost per order, H = annual holding cost per unit. Ordering less than EOQ too frequently increases ordering costs; ordering more increases carrying costs.' },
    { q: 'How do I calculate my reorder point?', a: 'Reorder Point = (Average Daily Demand × Lead Time in Days) + Safety Stock. If you sell 50 units/day and your supplier takes 7 days, your base ROP is 350 units plus safety stock. Place a new order when inventory on hand drops to this level.' },
    { q: 'What is safety stock and how much do I need?', a: 'Safety stock = Z × σ_demand × √(Lead Time), where Z is the z-score for your target service level (1.645 for 95%). Higher demand variability or longer lead times require more safety stock. A 95% service level means you expect to avoid stockouts 95% of the time.' },
    { q: 'What is ABC inventory analysis?', a: 'ABC analysis classifies SKUs by annual revenue contribution: A-items (top 20% of SKUs, ~70–80% of revenue) need tight monitoring; B-items (next 30%, ~15–20%) need regular review; C-items (bottom 50%, ~5–10%) can use simpler rules. Focus EOQ optimization on A-items.' },
    { q: 'How do I reduce inventory holding costs?', a: 'Holding costs typically run 20–30% of inventory value annually. To reduce them: order more frequently in smaller quantities when ordering costs are low; increase inventory turns by reducing safety stock on slow-moving items; use ABC analysis to identify C-items tying up capital.' },
  ],
}

export const ALL_TOOL_SCHEMAS: Record<string, ToolSchemaData> = {
  'price-position': PRICE_POSITION_SCHEMA,
  fba: FBA_SCHEMA,
  shopify: SHOPIFY_SCHEMA,
  shipping: SHIPPING_SCHEMA,
  roas: ROAS_SCHEMA,
  inventory: INVENTORY_SCHEMA,
}

// ── JSON-LD builders ───────────────────────────────────────────────────────

export function buildHowToSchema(schema: ToolSchemaData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: schema.howToName,
    description: schema.howToDescription,
    tool: { '@type': 'HowToTool', name: schema.toolName },
    step: schema.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  }
}

export function buildFaqSchema(faqItems: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

// ── Blog Article JSON-LD ───────────────────────────────────────────────────

const SITE = 'https://specterapp.io'

export interface ArticleSchemaInput {
  headline: string
  description: string
  url: string // absolute
  datePublished: string
  dateModified: string
  authorName: string
  authorUrl?: string
  imageUrl?: string
}

/** schema.org/Article — the article rich-result + AI-search entity. */
export function buildArticleSchema(a: ArticleSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.url },
    datePublished: a.datePublished,
    dateModified: a.dateModified,
    author: { '@type': 'Organization', name: a.authorName, url: a.authorUrl ?? SITE },
    publisher: {
      '@type': 'Organization',
      name: 'SPECTER',
      url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/icon.png` },
    },
    ...(a.imageUrl ? { image: [a.imageUrl] } : {}),
  }
}

/** schema.org/BreadcrumbList — Home › Blog › Category › Article. */
export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}
