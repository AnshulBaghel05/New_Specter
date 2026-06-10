import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Design-system tokens (Dark Intelligence)
const BG = '#06070D'
const SURFACE = '#0D0F1A'
const BORDER = '#1A1D2E'
const PRIMARY = '#00E87A'
const TEXT = '#E8EAF0'
const MUTED = '#6B7280'

const SIGNAL_COLOR: Record<string, string> = {
  RAISE: '#34d399',
  LOWER: '#fb7185',
  HOLD: '#fbbf24',
}

/**
 * Branded 1200×630 share card, generated from query params so a shared result
 * gets a distinctive Open Graph image instead of a generic page preview:
 *   /tools/og?tool=Amazon%20FBA&headline=%244.20%2Funit&sub=18%25%20margin&signal=RAISE
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tool = (searchParams.get('tool') ?? 'SPECTER Free Tool').slice(0, 60)
  const headline = (searchParams.get('headline') ?? '').slice(0, 40)
  const sub = (searchParams.get('sub') ?? '').slice(0, 80)
  const signal = searchParams.get('signal')
  const signalColor = signal ? SIGNAL_COLOR[signal] : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top row: wordmark + tool badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 40, fontWeight: 800, color: TEXT }}>
            SPECTER<span style={{ color: PRIMARY }}>.</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${BORDER}`,
              background: SURFACE,
              color: MUTED,
              borderRadius: 999,
              padding: '10px 22px',
              fontSize: 24,
            }}
          >
            {tool}
          </div>
        </div>

        {/* Center: the hero answer */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {signal && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                alignSelf: 'flex-start',
                color: signalColor ?? PRIMARY,
                border: `2px solid ${signalColor ?? PRIMARY}`,
                borderRadius: 12,
                padding: '6px 18px',
                fontSize: 30,
                fontWeight: 700,
                marginBottom: 24,
              }}
            >
              {signal}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: headline.length > 18 ? 96 : 128, fontWeight: 800, color: PRIMARY, lineHeight: 1 }}>
            {headline || tool}
          </div>
          {sub && (
            <div style={{ display: 'flex', fontSize: 40, color: TEXT, marginTop: 28 }}>
              {sub}
            </div>
          )}
        </div>

        {/* Bottom: source line */}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 26, color: MUTED }}>
          Free tool · no sign-up · specterapp.io
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
