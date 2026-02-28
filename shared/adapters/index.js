import { extractTableau, isTableauUrl } from './tableau.js'

export function pickAdapter(url) {
  if (isTableauUrl(url)) return 'tableau'
  return null
}

export async function extractDataFromUrl(url, options = {}) {
  const adapter = pickAdapter(url)
  if (!adapter) {
    throw new Error('No adapter matched this URL yet. Implement adapter for this site.')
  }

  if (adapter === 'tableau') {
    return extractTableau(url, options)
  }

  throw new Error(`Adapter ${adapter} is not implemented`)
}
