import React, { useState } from 'react'
import { extractDataFromUrl } from '../../shared/adapters/index.js'
import { buildTableauCsvUrl } from '../../shared/adapters/tableau.js'

const defaultUrl = 'https://public.tableau.com/app/profile/john.johansson/viz/SuperstoreShippingMetrics/Superstore'

export default function App() {
  const [url, setUrl] = useState(defaultUrl)
  const [csvUrl, setCsvUrl] = useState('')
  const [result, setResult] = useState('')

  function handleBuild() {
    try {
      setCsvUrl(buildTableauCsvUrl(url))
    } catch (e) {
      setCsvUrl(`Invalid URL: ${e.message}`)
    }
  }

  async function handleExtract() {
    setResult('Working...')
    try {
      const data = await extractDataFromUrl(url)
      setResult(JSON.stringify({
        ...data,
        outputs: {
          ...data.outputs,
          csv: {
            ...data.outputs.csv,
            text: data.outputs.csv.text.slice(0, 3000)
          }
        }
      }, null, 2))
    } catch (e) {
      setResult(`Error: ${e.message}`)
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 980, margin: '2rem auto', lineHeight: 1.45 }}>
      <h1>datad</h1>
      <p>Adapter-based extractor playground (Tableau implemented first).</p>
      <input
        style={{ width: '100%', padding: '0.6rem' }}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button style={{ padding: '0.5rem 0.8rem' }} onClick={handleBuild}>Build CSV endpoint</button>
        <button style={{ padding: '0.5rem 0.8rem' }} onClick={handleExtract}>Extract (JSON + CSV + VizQL bootstrap)</button>
      </div>

      {csvUrl && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, background: '#f6f8fa', padding: 12 }}>
          {csvUrl}
        </pre>
      )}

      {result && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, background: '#0f172a', color: '#e2e8f0', padding: 12 }}>
          {result}
        </pre>
      )}
    </main>
  )
}
