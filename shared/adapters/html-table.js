function stripTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function csvEscape(v) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n')
}

function tableToRows(tableHtml) {
  const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  return rowMatches.map((m) => {
    const cells = [...m[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)]
    return cells.map((c) => stripTags(c[2]))
  }).filter((r) => r.length > 0)
}

function objectArrayToTable(items) {
  const keys = [...new Set(items.flatMap((x) => Object.keys(x || {})))]
  const rows = items.map((item) => keys.map((k) => {
    const v = item?.[k]
    return typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
  }))
  return {
    header: keys,
    rows
  }
}

function extractJsonIfPossible(text, contentType = '') {
  if (!/json/i.test(contentType) && !/^\s*[\[{]/.test(text)) return null
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      const normalized = parsed.map((x) => (x && typeof x === 'object' ? x : { value: x }))
      const t = objectArrayToTable(normalized)
      return { kind: 'json-array', table: { index: 0, title: 'json-array', ...t }, raw: parsed }
    }
    if (parsed && typeof parsed === 'object') {
      const t = objectArrayToTable([parsed])
      return { kind: 'json-object', table: { index: 0, title: 'json-object', ...t }, raw: parsed }
    }
  } catch {
    return null
  }
  return null
}

function extractCards(html) {
  const blocks = [
    ...html.matchAll(/<article[^>]*class=["'][^"']*product_pod[^"']*["'][^>]*>[\s\S]*?<\/article>/gi),
    ...html.matchAll(/<div[^>]*class=["'][^"']*thumbnail[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi),
    ...html.matchAll(/<div[^>]*class=["'][^"']*country[^"']*["'][^>]*>[\s\S]*?<\/div>/gi)
  ].map((m) => m[0])

  if (!blocks.length) return null

  const rows = blocks.slice(0, 200).map((b) => {
    const title = stripTags((b.match(/<h3[^>]*>[\s\S]*?<a[^>]*title=["']([^"']+)["'][^>]*>/i)?.[1]) || (b.match(/<a[^>]*title=["']([^"']+)["']/i)?.[1]) || (b.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1]) || '')
    const price = stripTags((b.match(/class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]) || '')
    const link = (b.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1]) || ''
    const text = stripTags(b).slice(0, 280)
    return [title, price, link, text]
  })

  return {
    index: 0,
    title: 'cards',
    header: ['title', 'price', 'link', 'text'],
    rows
  }
}

export async function extractHtmlTables(url, options = {}) {
  const { fetchImpl = fetch } = options
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json,text/html,application/xhtml+xml,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  })
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`)

  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()

  const jsonExtract = extractJsonIfPossible(text, contentType)
  if (jsonExtract) {
    const t = jsonExtract.table
    return {
      adapter: 'html-table',
      sourceUrl: url,
      normalizedUrl: url,
      session: null,
      outputs: {
        csv: { url: null, text: rowsToCsv([t.header, ...t.rows]) },
        json: { tableCount: 1, tables: [t], sourceKind: jsonExtract.kind },
        vizql: null
      }
    }
  }

  const tableMatches = [...text.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)]
  let tables = []

  if (tableMatches.length) {
    tables = tableMatches.map((m, idx) => {
      const rows = tableToRows(m[0])
      return {
        index: idx,
        title: `table-${idx + 1}`,
        header: rows[0] || [],
        rows: rows.slice(1)
      }
    }).filter((t) => t.header.length || t.rows.length)
  } else {
    const cards = extractCards(text)
    if (cards) tables = [cards]
  }

  if (!tables.length) throw new Error('No extractable table/card/json structure found on this page')

  const primary = tables[0]
  return {
    adapter: 'html-table',
    sourceUrl: url,
    normalizedUrl: url,
    session: null,
    outputs: {
      csv: { url: null, text: rowsToCsv([primary.header, ...primary.rows]) },
      json: { tableCount: tables.length, tables },
      vizql: null
    }
  }
}
