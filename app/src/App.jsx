import React, { useState } from 'react'
import { buildTableauCsvUrl } from '../../shared/tableau.js'

const defaultUrl = 'https://public.tableau.com/app/profile/john.johansson/viz/SuperstoreShippingMetrics/Superstore'

export default function App() {
  const [url, setUrl] = useState(defaultUrl)
  const [csvUrl, setCsvUrl] = useState('')

  function handleBuild() {
    try {
      setCsvUrl(buildTableauCsvUrl(url))
    } catch (e) {
      setCsvUrl(`Invalid URL: ${e.message}`)
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '2rem auto', lineHeight: 1.45 }}>
      <h1>datad</h1>
      <p>Tableau-first extractor playground.</p>
      <input
        style={{ width: '100%', padding: '0.6rem' }}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button style={{ marginTop: 12, padding: '0.5rem 0.8rem' }} onClick={handleBuild}>
        Build CSV endpoint
      </button>
      {csvUrl && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, background: '#f6f8fa', padding: 12 }}>
          {csvUrl}
        </pre>
      )}
    </main>
  )
}
