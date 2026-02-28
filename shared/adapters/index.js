import { extractTableau, isTableauUrl } from './tableau.js'
import { extractHtmlTables } from './html-table.js'
import { extractYahooFinanceQuote, isYahooFinanceQuoteUrl } from './yahoo-finance.js'

export function pickAdapter(url) {
  if (isTableauUrl(url)) return 'tableau'
  if (isYahooFinanceQuoteUrl(url)) return 'yahoo-finance'
  if (/^https?:\/\//i.test(url)) return 'html-table'
  return null
}

export async function extractDataFromUrl(url, options = {}) {
  const adapter = pickAdapter(url)
  if (!adapter) {
    throw new Error('No adapter matched this URL yet. Implement adapter for this site.')
  }

  if (adapter === 'tableau') return extractTableau(url, options)
  if (adapter === 'yahoo-finance') return extractYahooFinanceQuote(url, options)
  if (adapter === 'html-table') return extractHtmlTables(url, options)

  throw new Error(`Adapter ${adapter} is not implemented`)
}
