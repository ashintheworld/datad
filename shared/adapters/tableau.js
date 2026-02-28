function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function isTableauUrl(input) {
  try {
    const url = new URL(input)
    return /tableau/i.test(url.hostname) || url.pathname.includes('/views/') || url.pathname.includes('/viz/')
  } catch {
    return false
  }
}

export function normalizeTableauUrl(input) {
  const url = new URL(input)
  if (!url.pathname.includes('/views/') && url.pathname.includes('/viz/')) {
    const parts = url.pathname.split('/').filter(Boolean)
    const vizIdx = parts.indexOf('viz')
    if (vizIdx > -1 && parts.length >= vizIdx + 3) {
      const workbook = parts[vizIdx + 1]
      const sheet = parts[vizIdx + 2]
      return `${url.origin}/views/${workbook}/${sheet}`
    }
  }
  return `${url.origin}${url.pathname}`
}

export function buildTableauCsvUrl(input) {
  const normalized = normalizeTableauUrl(input)
  return `${normalized}.csv?:showVizHome=no`
}

function extractViewParts(normalizedUrl) {
  const u = new URL(normalizedUrl)
  const parts = u.pathname.split('/').filter(Boolean)
  const viewsIdx = parts.indexOf('views')
  if (viewsIdx < 0 || parts.length < viewsIdx + 3) return null
  return {
    origin: u.origin,
    workbook: parts[viewsIdx + 1],
    sheet: parts[viewsIdx + 2]
  }
}

function parseBootstrapFromHtml(html, normalizedUrl) {
  const sessionMatches = [...html.matchAll(/sessions\/([^\/?"'&]+)/g)]
  const sessionId = sessionMatches.length ? sessionMatches[0][1] : null

  const sheetIdMatch = html.match(/"sheet_id"\s*:\s*"?([\w-]+)"?/) || html.match(/sheet_id=([\w-]+)/)
  const sheetId = sheetIdMatch ? sheetIdMatch[1] : null

  const bootstrapPathMatch = html.match(/\/vizql\/w\/[^\s"']+\/bootstrapSession\/sessions\/[^\s"']+/)
  let bootstrapUrl = bootstrapPathMatch ? bootstrapPathMatch[0].replace(/\\u002F/g, '/') : null

  const parts = extractViewParts(normalizedUrl)
  if (!bootstrapUrl && parts && sessionId) {
    bootstrapUrl = `${parts.origin}/vizql/w/${parts.workbook}/v/${parts.sheet}/bootstrapSession/sessions/${sessionId}`
  } else if (bootstrapUrl && bootstrapUrl.startsWith('/')) {
    const u = new URL(normalizedUrl)
    bootstrapUrl = `${u.origin}${bootstrapUrl}`
  }

  return { sessionId, sheetId, bootstrapUrl }
}

async function fetchText(url, fetchImpl, includeCredentials = true, init = {}) {
  const res = await fetchImpl(url, {
    credentials: includeCredentials ? 'include' : 'omit',
    ...init
  })
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`)
  return res.text()
}

async function fetchTableauCsv(input, fetchImpl = fetch, includeCredentials = true) {
  const csvUrl = buildTableauCsvUrl(input)
  const text = await fetchText(csvUrl, fetchImpl, includeCredentials, {
    method: 'GET',
    headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8' }
  })
  return { csvUrl, text }
}

async function fetchVizqlBootstrap({ normalizedUrl, bootstrapUrl, sheetId }, fetchImpl, includeCredentials = true) {
  if (!bootstrapUrl) return null
  const body = new URLSearchParams()
  if (sheetId) body.set('sheet_id', sheetId)
  body.set('showParams', '{"checkpoint":false,"refresh":false}')

  const raw = await fetchText(bootstrapUrl, fetchImpl, includeCredentials, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      accept: 'text/plain,*/*;q=0.9'
    },
    body
  })

  const jsonCandidateMatch = raw.match(/\{[\s\S]*\}/)
  const parsed = jsonCandidateMatch ? safeJsonParse(jsonCandidateMatch[0]) : null

  return {
    endpoint: bootstrapUrl,
    request: Object.fromEntries(body.entries()),
    rawPreview: raw.slice(0, 4000),
    parsed
  }
}

function mergeContext(parsed, pageContext) {
  if (!pageContext) return parsed
  return {
    sessionId: parsed.sessionId || pageContext.sessionId || null,
    sheetId: parsed.sheetId || pageContext.sheetId || null,
    bootstrapUrl: parsed.bootstrapUrl || pageContext.bootstrapUrl || null,
    pageContext
  }
}

export async function extractTableau(input, options = {}) {
  const { fetchImpl = fetch, includeCredentials = true, pageContext = null } = options
  const normalizedUrl = normalizeTableauUrl(input)

  const viewHtml = await fetchText(`${normalizedUrl}?:showVizHome=no`, fetchImpl, includeCredentials)
  const parsedFromHtml = parseBootstrapFromHtml(viewHtml, normalizedUrl)
  const session = mergeContext(parsedFromHtml, pageContext)

  const [csv, vizqlBootstrap] = await Promise.all([
    fetchTableauCsv(input, fetchImpl, includeCredentials),
    fetchVizqlBootstrap({ normalizedUrl, bootstrapUrl: session.bootstrapUrl, sheetId: session.sheetId }, fetchImpl, includeCredentials)
  ])

  return {
    adapter: 'tableau',
    sourceUrl: input,
    normalizedUrl,
    session,
    outputs: {
      csv: {
        url: csv.csvUrl,
        text: csv.text
      },
      vizql: vizqlBootstrap
    }
  }
}
