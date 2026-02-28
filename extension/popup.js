const out = document.getElementById('out')
const statusEl = document.getElementById('status')
const API_BASE = 'http://52.174.69.5/datad/api/extract?url='

function setStatus(text, ok = true) {
  statusEl.textContent = text
  statusEl.style.color = ok ? '#22c55e' : '#f59e0b'
}

function toCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

function isYahooQuoteUrl(url) {
  try {
    const u = new URL(url)
    return /(^|\.)finance\.yahoo\.com$/i.test(u.hostname) && u.pathname.startsWith('/quote/')
  } catch {
    return false
  }
}

function resolveEffectiveUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    if ((/consent\.yahoo\.com$/i.test(u.hostname) || /guce\.yahoo\.com$/i.test(u.hostname)) && u.searchParams.get('done')) {
      const done = decodeURIComponent(u.searchParams.get('done'))
      if (/^https?:\/\//i.test(done)) return done
    }
    return rawUrl
  } catch {
    return rawUrl
  }
}

async function resolveEffectiveUrlFromTab(tab) {
  const direct = resolveEffectiveUrl(tab.url)
  if (!/consent\.yahoo\.com|guce\.yahoo\.com/i.test(direct)) return direct

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        const pick = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null)
        const fromQs = new URLSearchParams(location.search).get('done')
        if (pick(fromQs)) return fromQs

        const hidden = Array.from(document.querySelectorAll('input[type="hidden"], input[name]'))
          .map((n) => n.value)
          .find((v) => /finance\.yahoo\.com\/quote\//i.test(v))
        if (pick(hidden)) return hidden

        const html = document.documentElement?.outerHTML || ''
        const quoteRe = new RegExp('https?:\\\\/\\\\/finance\\\\.yahoo\\\\.com\\\\/quote\\\\/[A-Za-z0-9._-]+')
        const m = html.match(quoteRe)
        if (m) return m[0].replace(/\\\//g, '/')

        return location.href
      }
    })

    return resolveEffectiveUrl(result || tab.url)
  } catch {
    return direct
  }
}

function sanitizeFilename(s) {
  return String(s || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section'
}

async function fetchProxy(url) {
  const res = await fetch(`${API_BASE}${encodeURIComponent(url)}`)
  if (!res.ok) {
    let details = ''
    try {
      const t = await res.text()
      details = t?.slice(0, 160) || ''
    } catch {}
    throw new Error(`Proxy extract failed (${res.status})${details ? `: ${details}` : ''}`)
  }
  return res.json()
}

async function getYahooPageSections(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
      const sections = []
      const candidateContainers = Array.from(document.querySelectorAll('section,div'))
      for (const el of candidateContainers) {
        const rows = []
        const pairs = Array.from(el.querySelectorAll(':scope > div, :scope > li, :scope > tr'))
        for (const p of pairs) {
          const cells = Array.from(p.querySelectorAll(':scope > *')).map((n) => clean(n.textContent)).filter(Boolean)
          if (cells.length >= 2) {
            const key = cells[0]
            const value = cells.slice(1).join(' | ')
            if (key && value && key.length < 120) rows.push([key, value])
          }
        }
        if (rows.length >= 3) {
          const headingEl = el.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > header h2, :scope > header h3')
          const title = clean(headingEl?.textContent) || `module-${sections.length + 1}`
          sections.push({ title, rows })
        }
      }
      const seen = new Set()
      const deduped = []
      for (const s of sections) {
        const sig = `${s.title}::${s.rows.slice(0, 3).map((r) => r.join('=')).join('|')}`
        if (!seen.has(sig)) {
          seen.add(sig)
          deduped.push(s)
        }
      }
      return { url: location.href, title: document.title, sections: deduped.slice(0, 30) }
    }
  })
  return result
}

async function getActiveTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (active?.url && active?.id && /^https?:\/\//i.test(active.url)) return active

  const tabs = await chrome.tabs.query({ currentWindow: true })
  const candidates = tabs
    .filter((t) => t?.url && /^https?:\/\//i.test(t.url))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))

  if (candidates.length) return candidates[0]
  throw new Error('No browsable tab found (open a website tab in this window)')
}

function renderOutput(data) {
  out.textContent = JSON.stringify(data, null, 2)
}

async function extractYahoo(tab) {
  // Prefer page-context modules; fallback to server quote API to avoid blank/error cases.
  try {
    const page = await getYahooPageSections(tab.id)
    if (page?.sections?.length) {
      const tables = page.sections.map((s, i) => ({ index: i, title: s.title, header: ['field', 'value'], rows: s.rows }))
      const first = tables[0]
      const csv = toCsv([first.header, ...first.rows])
      return {
        adapter: 'yahoo-extension-page',
        sourceUrl: tab.url,
        pageTitle: page.title,
        sectionCount: tables.length,
        mode: 'browser-session',
        outputs: { csv: { url: null, text: csv.slice(0, 2000) }, json: { tables }, vizql: null }
      }
    }
  } catch {
    // fallback below
  }

  const server = await fetchProxy(tab.url)
  return {
    ...server,
    mode: 'server-fallback'
  }
}

async function exportYahooSectionsAsCsv(tab) {
  let sections = []
  try {
    const page = await getYahooPageSections(tab.id)
    sections = page?.sections || []
  } catch {
    sections = []
  }

  if (!sections.length) {
    const server = await fetchProxy(tab.url)
    const csv = server?.outputs?.csv?.text || ''
    if (!csv) throw new Error('No Yahoo data available to export')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    await chrome.downloads.download({
      url,
      filename: `datad/yahoo-${sanitizeFilename(new URL(tab.url).pathname.split('/').filter(Boolean).pop() || 'symbol')}-quote.csv`,
      saveAs: false,
      conflictAction: 'uniquify'
    })
    setTimeout(() => URL.revokeObjectURL(url), 20000)
    out.textContent = 'Exported 1 CSV (server fallback mode) to Downloads/datad/'
    return
  }

  let exported = 0
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i]
    const csv = toCsv([['field', 'value'], ...s.rows])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const filename = `datad/yahoo-${sanitizeFilename(new URL(tab.url).pathname.split('/').filter(Boolean).pop() || 'symbol')}-${String(i + 1).padStart(2, '0')}-${sanitizeFilename(s.title)}.csv`
    await chrome.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' })
    exported += 1
    setTimeout(() => URL.revokeObjectURL(url), 20000)
  }
  out.textContent = `Exported ${exported} CSV files to Downloads/datad/`
}

document.getElementById('extract').addEventListener('click', async () => {
  setStatus('Working...')
  out.textContent = 'Working...'
  let rawUrl = ''
  try {
    const tab = await getActiveTab()
    rawUrl = tab.url || ''
    const effectiveUrl = await resolveEffectiveUrlFromTab(tab)

    if (/consent\.yahoo\.com|guce\.yahoo\.com/i.test(rawUrl) && !isYahooQuoteUrl(effectiveUrl)) {
      throw new Error('Yahoo consent page detected. Please accept consent in the Yahoo tab, then run Extract again.')
    }

    let data
    if (isYahooQuoteUrl(effectiveUrl)) {
      data = await extractYahoo({ ...tab, url: effectiveUrl })
    } else {
      data = await fetchProxy(effectiveUrl)
    }
    renderOutput(data)
    setStatus('Done')
  } catch (err) {
    const msg = String(err?.message || err)
    if (/consent\.yahoo\.com|guce\.yahoo\.com/i.test(rawUrl) || /Yahoo consent page detected/i.test(msg)) {
      out.textContent = 'Yahoo consent page detected. Please click "Accept" on Yahoo, then reopen quote URL and run Extract again.'
    } else {
      out.textContent = `Error: ${msg}`
    }
    setStatus('Error', false)
  }
})

document.getElementById('exportCsvs').addEventListener('click', async () => {
  setStatus('Exporting...')
  out.textContent = 'Exporting CSV files...'
  try {
    const tab = await getActiveTab()
    const effectiveUrl = await resolveEffectiveUrlFromTab(tab)
    if (!isYahooQuoteUrl(effectiveUrl)) throw new Error('Export all sections CSV is currently enabled for Yahoo quote pages only')
    await exportYahooSectionsAsCsv({ ...tab, url: effectiveUrl })
    setStatus('Done')
  } catch (err) {
    out.textContent = `Error: ${err.message}`
    setStatus('Error', false)
  }
})
