import { z } from 'zod'

/* ─── Field model ──────────────────────────────────────────────────
 * A plan-contact form is fully described by data so PREDATOR and ECLIPSE
 * share one renderer. `half` lays a field at half width on ≥sm screens.
 */

export type FieldType = 'text' | 'email' | 'tel' | 'select' | 'multiselect' | 'textarea'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: string[] // select / multiselect
  half?: boolean
}

export interface ContactPlanConfig {
  plan: 'PREDATOR' | 'ECLIPSE'
  /** CTA label shown on the pricing card. */
  cta: string
  title: string
  subtitle: string
  priceLabel: string
  /** Tailwind text-color token matching the tier accent. */
  accent: string
  fields: FieldDef[]
}

/* ─── Validation ───────────────────────────────────────────────────
 * Build a zod schema from the field list. Required text → non-empty;
 * email → valid address; multiselect → ≥1 when required; optional text →
 * may be empty. Keeps validation in lockstep with the rendered fields.
 */
export function buildSchema(fields: FieldDef[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of fields) {
    if (f.type === 'multiselect') {
      const arr = z.array(z.string())
      shape[f.name] = f.required ? arr.min(1, `Select at least one ${f.label.toLowerCase()}`) : arr
    } else if (f.type === 'email') {
      shape[f.name] = z.string().min(1, `${f.label} is required`).email('Enter a valid email address')
    } else if (f.required) {
      shape[f.name] = z.string().trim().min(1, `${f.label} is required`)
    } else {
      shape[f.name] = z.string().optional()
    }
  }
  return z.object(shape)
}

/** Initial form values: '' for scalar fields, [] for multiselect. */
export function initialValues(fields: FieldDef[]): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const f of fields) out[f.name] = f.type === 'multiselect' ? [] : ''
  return out
}

/* ─── Shared option sets ───────────────────────────────────────────── */

const HOW_HEARD = ['Google search', 'Twitter / X', 'LinkedIn', 'Referral', 'Shopify App Store', 'Other']

/* ─── PREDATOR — fixed $1,799 plan, qualification to get access ──────── */

const PREDATOR_FIELDS: FieldDef[] = [
  { name: 'fullName', label: 'Full name', type: 'text', required: true, half: true, placeholder: 'Jane Doe' },
  { name: 'workEmail', label: 'Work email', type: 'email', required: true, half: true, placeholder: 'jane@store.com' },
  { name: 'role', label: 'Your role', type: 'select', required: true, half: true,
    options: ['Founder / CEO', 'Head of Ecommerce', 'Pricing / Merchandising', 'Marketing', 'Operations', 'Other'] },
  { name: 'phone', label: 'Phone (optional)', type: 'tel', half: true, placeholder: '+1 555 000 0000' },
  { name: 'storeName', label: 'Store name', type: 'text', required: true, half: true, placeholder: 'Acme Supply Co.' },
  { name: 'storeUrl', label: 'Store URL', type: 'text', required: true, half: true, placeholder: 'https://acme.com' },
  { name: 'platform', label: 'Platform', type: 'select', required: true, half: true,
    options: ['Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Other'] },
  { name: 'monthlyRevenue', label: 'Monthly revenue', type: 'select', required: true, half: true,
    options: ['Under $50k', '$50k – $250k', '$250k – $1M', '$1M – $5M', '$5M+'] },
  { name: 'skusToTrack', label: 'SKUs to track', type: 'text', required: true, half: true, placeholder: 'e.g. 1,500' },
  { name: 'competitorsTracked', label: 'Competitors per product', type: 'text', required: true, half: true, placeholder: 'e.g. 5' },
  { name: 'currentTool', label: 'How do you track competitor prices today? (optional)', type: 'text',
    placeholder: 'Spreadsheet, Prisync, manual checks…' },
  { name: 'howHeard', label: 'How did you hear about us? (optional)', type: 'select', half: true, options: HOW_HEARD },
  { name: 'message', label: 'Anything else? (optional)', type: 'textarea', placeholder: 'Tell us about your pricing goals…' },
]

/* ─── ECLIPSE — custom plan, gather everything to tailor it ──────────── */

const ECLIPSE_FIELDS: FieldDef[] = [
  { name: 'fullName', label: 'Full name', type: 'text', required: true, half: true, placeholder: 'Jane Doe' },
  { name: 'workEmail', label: 'Work email', type: 'email', required: true, half: true, placeholder: 'jane@company.com' },
  { name: 'role', label: 'Your role', type: 'select', required: true, half: true,
    options: ['Founder / CEO', 'VP / Head of Ecommerce', 'Pricing / Merchandising', 'Engineering', 'Operations', 'Procurement', 'Other'] },
  { name: 'phone', label: 'Phone (optional)', type: 'tel', half: true, placeholder: '+1 555 000 0000' },
  { name: 'companyName', label: 'Company / store name', type: 'text', required: true, half: true, placeholder: 'Acme Inc.' },
  { name: 'storeUrl', label: 'Store URL', type: 'text', required: true, half: true, placeholder: 'https://acme.com' },
  { name: 'platform', label: 'Platform', type: 'select', required: true, half: true,
    options: ['Shopify Plus', 'Shopify', 'WooCommerce', 'Magento', 'BigCommerce', 'Custom / headless', 'Other'] },
  { name: 'monthlyRevenue', label: 'Monthly revenue', type: 'select', required: true, half: true,
    options: ['Under $1M', '$1M – $5M', '$5M – $20M', '$20M – $100M', '$100M+'] },
  { name: 'catalogSize', label: 'Catalog size (total SKUs)', type: 'select', required: true, half: true,
    options: ['Under 5k', '5k – 50k', '50k – 500k', '500k+'] },
  { name: 'desiredCadence', label: 'Desired scrape cadence', type: 'select', required: true, half: true,
    options: ['Every 15 min', 'Every 10 min', 'Every 5 min', 'Real-time / custom'] },
  { name: 'competitorsAndMarketplaces', label: 'Which competitors & marketplaces?', type: 'text', required: true,
    placeholder: 'Amazon, Walmart, specific rivals…' },
  { name: 'integrations', label: 'Integrations needed', type: 'multiselect', required: true,
    options: ['Slack', 'Klaviyo', 'Custom webhooks', 'REST API', 'Data warehouse / BI', 'SSO / SAML'] },
  { name: 'budget', label: 'Monthly budget', type: 'select', required: true, half: true,
    options: ['Under $2k/mo', '$2k – $5k/mo', '$5k – $15k/mo', '$15k+/mo', 'Not sure yet'] },
  { name: 'timeline', label: 'Timeline to launch', type: 'select', required: true, half: true,
    options: ['ASAP', 'Within 1 month', '1 – 3 months', 'Just exploring'] },
  { name: 'teamSize', label: 'Team size (optional)', type: 'select', half: true, options: ['1 – 5', '6 – 20', '21 – 100', '100+'] },
  { name: 'currentTool', label: 'What are you using today? (optional)', type: 'text', half: true,
    placeholder: 'In-house, Prisync, Wiser…' },
  { name: 'slaRequirements', label: 'SLA, security & compliance needs (optional)', type: 'textarea',
    placeholder: 'SOC 2, uptime SLA, data residency…' },
  { name: 'howHeard', label: 'How did you hear about us? (optional)', type: 'select', half: true, options: HOW_HEARD },
  { name: 'message', label: 'Anything else? (optional)', type: 'textarea', placeholder: 'Tell us about your requirements…' },
]

export const CONTACT_PLANS: Record<'PREDATOR' | 'ECLIPSE', ContactPlanConfig> = {
  PREDATOR: {
    plan: 'PREDATOR',
    cta: 'Contact us',
    title: 'Get PREDATOR',
    subtitle: 'Tell us about your store and our team will get you set up on PREDATOR.',
    priceLabel: '$1,799/mo · fixed',
    accent: 'text-rose-400',
    fields: PREDATOR_FIELDS,
  },
  ECLIPSE: {
    plan: 'ECLIPSE',
    cta: 'Contact sales',
    title: 'Design your ECLIPSE plan',
    subtitle: 'Share your requirements and we’ll tailor a dedicated, custom-SLA plan for you.',
    priceLabel: 'Custom pricing',
    accent: 'text-violet-400',
    fields: ECLIPSE_FIELDS,
  },
}
