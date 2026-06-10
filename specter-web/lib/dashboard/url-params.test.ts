import { describe, it, expect } from 'vitest'
import {
  parseSignalType,
  parsePage,
  parseAlertStatus,
  parseProductSort,
  parseDomainSort,
  parseDays,
  parseSource,
  parseSignalSort,
  parseMinConfidence,
  parseAlertSort,
  parseRepriceFilter,
  parseRepriceSort,
  parseSearchQuery,
  parseBreakdownSort,
  parseDay,
} from './url-params'

describe('parseSignalType', () => {
  it('accepts valid types', () => {
    expect(parseSignalType('RAISE')).toBe('RAISE')
    expect(parseSignalType('LOWER')).toBe('LOWER')
    expect(parseSignalType('HOLD')).toBe('HOLD')
  })
  it('returns undefined for unknown/null', () => {
    expect(parseSignalType('raise')).toBeUndefined()
    expect(parseSignalType(null)).toBeUndefined()
  })
})

describe('parsePage', () => {
  it('parses non-negative integers', () => {
    expect(parsePage('0')).toBe(0)
    expect(parsePage('3')).toBe(3)
  })
  it('defaults to 0 for invalid/negative/fractional/null', () => {
    expect(parsePage('-1')).toBe(0)
    expect(parsePage('x')).toBe(0)
    expect(parsePage('1.5')).toBe(0)
    expect(parsePage(null)).toBe(0)
  })
})

describe('parseAlertStatus', () => {
  it('accepts active/resolved', () => {
    expect(parseAlertStatus('active')).toBe('active')
    expect(parseAlertStatus('resolved')).toBe('resolved')
  })
  it('returns undefined otherwise', () => {
    expect(parseAlertStatus('all')).toBeUndefined()
    expect(parseAlertStatus(null)).toBeUndefined()
  })
})

describe('parseProductSort', () => {
  it('accepts valid sorts', () => {
    expect(parseProductSort('signals')).toBe('signals')
    expect(parseProductSort('updated')).toBe('updated')
    expect(parseProductSort('name')).toBe('name')
  })
  it('defaults to signals', () => {
    expect(parseProductSort('price')).toBe('signals')
    expect(parseProductSort(null)).toBe('signals')
  })
})

describe('parseDomainSort', () => {
  it('accepts valid sorts', () => {
    expect(parseDomainSort('products')).toBe('products')
    expect(parseDomainSort('oos')).toBe('oos')
    expect(parseDomainSort('name')).toBe('name')
  })
  it('defaults to products', () => {
    expect(parseDomainSort('zzz')).toBe('products')
    expect(parseDomainSort(null)).toBe('products')
  })
})

describe('parseDays', () => {
  it('accepts 7/30/90', () => {
    expect(parseDays('7')).toBe(7)
    expect(parseDays('30')).toBe(30)
    expect(parseDays('90')).toBe(90)
  })
  it('defaults to 30', () => {
    expect(parseDays('45')).toBe(30)
    expect(parseDays(null)).toBe(30)
  })
})

describe('parseSource', () => {
  it('accepts known surfaces', () => {
    expect(parseSource('overview')).toBe('overview')
    expect(parseSource('signals')).toBe('signals')
    expect(parseSource('alerts')).toBe('alerts')
  })
  it('returns null otherwise', () => {
    expect(parseSource('signal')).toBeNull()
    expect(parseSource(null)).toBeNull()
  })
})

describe('parseSignalSort', () => {
  it('accepts confidence', () => {
    expect(parseSignalSort('confidence')).toBe('confidence')
  })
  it('defaults to recent for anything else', () => {
    expect(parseSignalSort('recent')).toBe('recent')
    expect(parseSignalSort(null)).toBe('recent')
    expect(parseSignalSort('xyz')).toBe('recent')
  })
})

describe('parseMinConfidence', () => {
  it('accepts the discrete threshold values', () => {
    expect(parseMinConfidence('0.5')).toBe(0.5)
    expect(parseMinConfidence('0.7')).toBe(0.7)
    expect(parseMinConfidence('0.9')).toBe(0.9)
  })
  it('defaults to 0 for anything else', () => {
    expect(parseMinConfidence(null)).toBe(0)
    expect(parseMinConfidence('0')).toBe(0)
    expect(parseMinConfidence('0.8')).toBe(0)
    expect(parseMinConfidence('abc')).toBe(0)
  })
})

describe('parseAlertSort', () => {
  it('accepts oldest and domain', () => {
    expect(parseAlertSort('oldest')).toBe('oldest')
    expect(parseAlertSort('domain')).toBe('domain')
  })
  it('defaults to recent for anything else', () => {
    expect(parseAlertSort('recent')).toBe('recent')
    expect(parseAlertSort(null)).toBe('recent')
    expect(parseAlertSort('nope')).toBe('recent')
  })
})

describe('parseRepriceFilter', () => {
  it('accepts known values', () => {
    expect(parseRepriceFilter('needs-attention')).toBe('needs-attention')
    expect(parseRepriceFilter('needs-guardrails')).toBe('needs-guardrails')
    expect(parseRepriceFilter('auto-on')).toBe('auto-on')
    expect(parseRepriceFilter('would-clamp')).toBe('would-clamp')
  })
  it('defaults to all', () => {
    expect(parseRepriceFilter(null)).toBe('all')
    expect(parseRepriceFilter('bogus')).toBe('all')
  })
})

describe('parseRepriceSort', () => {
  it('accepts known values', () => {
    expect(parseRepriceSort('attention')).toBe('attention')
    expect(parseRepriceSort('impact')).toBe('impact')
  })
  it('defaults to default', () => {
    expect(parseRepriceSort(null)).toBe('default')
    expect(parseRepriceSort('bogus')).toBe('default')
  })
})

describe('parseSearchQuery', () => {
  it('trims and defaults to empty', () => {
    expect(parseSearchQuery(null)).toBe('')
    expect(parseSearchQuery('  hat  ')).toBe('hat')
  })
})

describe('parseBreakdownSort', () => {
  it('accepts known sorts', () => {
    expect(parseBreakdownSort('recovered')).toBe('recovered')
    expect(parseBreakdownSort('lost')).toBe('lost')
    expect(parseBreakdownSort('count')).toBe('count')
    expect(parseBreakdownSort('net')).toBe('net')
  })
  it('defaults to net for unknown/null', () => {
    expect(parseBreakdownSort(null)).toBe('net')
    expect(parseBreakdownSort('bogus')).toBe('net')
  })
})

describe('parseDay', () => {
  it('accepts a YYYY-MM-DD string', () => {
    expect(parseDay('2026-05-28')).toBe('2026-05-28')
  })
  it('rejects malformed / null', () => {
    expect(parseDay(null)).toBeNull()
    expect(parseDay('2026-5-8')).toBeNull()
    expect(parseDay('2026-05-28T00:00')).toBeNull()
    expect(parseDay('garbage')).toBeNull()
  })
})
