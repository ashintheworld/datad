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

function tableToRows(tableHtml) {
  const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  return rowMatches.map((m) => {
    const cells = [...m[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)]
    return cells.map((c) => stripTags(c[2]))
  }).filter((r) => r.length > 0)
}

function rowsToCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n')
}

export async function extractHtmlTables(url, options = {}) {
  const { fetchImpl = fetch } = options
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
  })
  if (!res.ok) throw new Error(`HTML fetch failed (${res.status})`)

  const html = await res.text()
  const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)]
  if (!tableMatches.length) throw new Error('No HTML <table> found on this page')

  const tables = tableMatches.map((m, idx) => {
    const rows = tableToRows(m[0])
    const header = rows[0] || []
    const dataRows = rows.slice(1)
    return {
      index: idx,
      header,
      rows: dataRows
    }
  })

  const primary = tables[0]
  const csvText = rowsToCsv([primary.header, ...primary.rows])

  return {
    adapter: 'html-table',
    sourceUrl: url,
    normalizedUrl: url,
    session: null,
    outputs: {
      csv: {
        url: null,
        text: csvText
      },
      json: {
        tableCount: tables.length,
        tables
      },
      vizql: null
    }
  }
}
