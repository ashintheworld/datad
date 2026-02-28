function csvEscape(v) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function isYahooFinanceQuoteUrl(input) {
  try {
    const u = new URL(input)
    return /(^|\.)finance\.yahoo\.com$/i.test(u.hostname) && u.pathname.startsWith('/quote/')
  } catch {
    return false
  }
}

function extractSymbol(input) {
  const u = new URL(input)
  const parts = u.pathname.split('/').filter(Boolean)
  const idx = parts.indexOf('quote')
  if (idx < 0 || !parts[idx + 1]) throw new Error('Could not parse symbol from Yahoo quote URL')
  return decodeURIComponent(parts[idx + 1]).toUpperCase()
}

function pickLastValid(values = []) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

export async function extractYahooFinanceQuote(url, options = {}) {
  const { fetchImpl = fetch } = options
  const symbol = extractSymbol(url)

  // v8 chart endpoint is generally public and avoids some 401 issues seen on /v7/quote.
  const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`

  const res = await fetchImpl(apiUrl, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 (datad-proxy)'
    }
  })

  if (!res.ok) throw new Error(`Yahoo chart API failed (${res.status})`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error('No Yahoo chart data returned for symbol')

  const meta = result.meta || {}
  const quote = result.indicators?.quote?.[0] || {}

  const row = {
    symbol: meta.symbol || symbol,
    currency: meta.currency || '',
    exchange: meta.exchangeName || '',
    marketState: meta.marketState || '',
    regularMarketPrice: meta.regularMarketPrice ?? '',
    previousClose: meta.previousClose ?? '',
    open: pickLastValid(quote.open),
    dayHigh: pickLastValid(quote.high),
    dayLow: pickLastValid(quote.low),
    volume: pickLastValid(quote.volume)
  }

  const headers = Object.keys(row)
  const csv = `${headers.join(',')}\n${headers.map((h) => csvEscape(row[h])).join(',')}`

  return {
    adapter: 'yahoo-finance',
    sourceUrl: url,
    normalizedUrl: url,
    session: null,
    outputs: {
      csv: { url: apiUrl, text: csv },
      json: { apiUrl, symbol: row.symbol, meta, quote },
      vizql: null
    }
  }
}
