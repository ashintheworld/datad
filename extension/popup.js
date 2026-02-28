import { buildTableauCsvUrl } from '../shared/tableau.js'

const out = document.getElementById('out')

document.getElementById('extract').addEventListener('click', async () => {
  out.textContent = 'Working...'
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) throw new Error('No active tab URL')

    const csvUrl = buildTableauCsvUrl(tab.url)
    const res = await fetch(csvUrl, { credentials: 'include' })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)

    const text = await res.text()
    out.textContent = `CSV URL:\n${csvUrl}\n\nPreview:\n${text.slice(0, 2000)}`
  } catch (err) {
    out.textContent = `Error: ${err.message}`
  }
})
