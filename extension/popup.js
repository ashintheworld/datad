import { extractDataFromUrl } from '../shared/adapters/index.js'

const out = document.getElementById('out')

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

async function getYahooPageSections(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
      const sections = []

      // Common Yahoo quote module shape: rows with 2 spans/divs (key, value)
      const candidateContainers = Array.from(document.querySelectorAll('section,div'))
      for (const el of candidateContainers) {
        const rows = []
        const pairs = Array.from(el.querySelectorAll(':scope > div, :scope > li, :scope > tr'))
        for (const p of pairs) {
          const txt = clean(p.textContent)
          if (!txt) continue

          const cells = Array.from(p.querySelectorAll(':scope > *')).map((n) => clean(n.textContent)).filter(Boolean)
          if (cells.length >= 2) {
            const key = cells[0]
            const value = cells.slice(1).join(' | ')
            if (key && value && key.length < 80) rows.push([key, value])
          }
        }

        if (rows.length >= 3) {
          const headingEl = el.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > header h2, :scope > header h3')
          const title = clean(headingEl?.textContent) || `module-${sections.length + 1}`
          sections.push({ title, rows })
        }
      }

      // Deduplicate by title + first rows signature
      const seen = new Set()
      const deduped = []
      for (const s of sections) {
        const sig = `${s.title}::${s.rows.slice(0, 3).map((r) => r.join('=')).join('|')}`
        if (seen.has(sig)) continue
        seen.add(sig)
        deduped.push(s)
      }

      return {
        url: location.href,
        title: document.title,
        sectionCount: deduped.length,
        sections: deduped.slice(0, 20)
      }
    }
  })

  return result
}

async function getTableauPageContext(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      const html = document.documentElement?.outerHTML || ''
      const sessionMatch = html.match(/sessions\/([^\/?"'&]+)/)
      const sheetMatch = html.match(/"sheet_id"\s*:\s*"?([\w-]+)"?/) || html.match(/sheet_id=([\w-]+)/)
      const bootstrapMatch = html.match(/\/vizql\/w\/[^\s"']+\/bootstrapSession\/sessions\/[^\s"']+/)

      return {
        sessionId: sessionMatch ? sessionMatch[1] : null,
        sheetId: sheetMatch ? sheetMatch[1] : null,
        bootstrapUrl: bootstrapMatch ? bootstrapMatch[0].replace(/\\u002F/g, '/') : null,
        url: location.href
      }
    }
  })

  if (result?.bootstrapUrl?.startsWith('/')) {
    result.bootstrapUrl = new URL(result.bootstrapUrl, result.url).href
  }

  return result
}

document.getElementById('extract').addEventListener('click', async () => {
  out.textContent = 'Working...'
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !tab?.id) throw new Error('No active tab URL')

    if (isYahooQuoteUrl(tab.url)) {
      const page = await getYahooPageSections(tab.id)
      if (!page?.sections?.length) throw new Error('No Yahoo sections found from page context')

      const tables = page.sections.map((s, i) => ({
        index: i,
        title: s.title,
        header: ['field', 'value'],
        rows: s.rows
      }))

      const first = tables[0]
      const csv = toCsv([first.header, ...first.rows])

      out.textContent = JSON.stringify({
        adapter: 'yahoo-extension-page',
        sourceUrl: tab.url,
        pageTitle: page.title,
        sectionCount: tables.length,
        outputs: {
          csv: { url: null, text: csv.slice(0, 2000) },
          json: { tables },
          vizql: null
        }
      }, null, 2)
      return
    }

    const pageContext = await getTableauPageContext(tab.id)
    const data = await extractDataFromUrl(tab.url, { pageContext })

    out.textContent = JSON.stringify({
      adapter: data.adapter,
      sourceUrl: data.sourceUrl,
      normalizedUrl: data.normalizedUrl,
      session: data.session,
      csvUrl: data.outputs.csv.url,
      csvPreview: data.outputs.csv.text.slice(0, 1200),
      vizql: data.outputs.vizql,
      tables: data.outputs?.json?.tables || null
    }, null, 2)
  } catch (err) {
    out.textContent = `Error: ${err.message}`
  }
})
