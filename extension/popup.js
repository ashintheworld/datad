import { extractDataFromUrl } from '../shared/adapters/index.js'

const out = document.getElementById('out')

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

    const pageContext = await getTableauPageContext(tab.id)
    const data = await extractDataFromUrl(tab.url, { pageContext })

    out.textContent = JSON.stringify({
      adapter: data.adapter,
      sourceUrl: data.sourceUrl,
      normalizedUrl: data.normalizedUrl,
      session: data.session,
      csvUrl: data.outputs.csv.url,
      csvPreview: data.outputs.csv.text.slice(0, 1200),
      vizql: data.outputs.vizql
    }, null, 2)
  } catch (err) {
    out.textContent = `Error: ${err.message}`
  }
})
