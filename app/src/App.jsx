import React, { useEffect, useMemo, useState } from 'react'
import { buildTableauCsvUrl } from '../../shared/adapters/tableau.js'

const defaultUrl = 'https://public.tableau.com/app/profile/john.johansson/viz/SuperstoreShippingMetrics/Superstore'
const HISTORY_KEY = 'datad:url-history:v1'
const HISTORY_MAX = 12

function parseCsvPreview(text, maxRows = 12) {
  if (!text) return { headers: [], rows: [] }
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, maxRows + 1)
  if (!lines.length) return { headers: [], rows: [] }

  const split = (line) => line.split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'))
  const headers = split(lines[0])
  const rows = lines.slice(1).map(split)
  return { headers, rows }
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((u) => typeof u === 'string').slice(0, HISTORY_MAX)
  } catch {
    return []
  }
}

export default function App() {
  const [url, setUrl] = useState(defaultUrl)
  const [csvUrl, setCsvUrl] = useState('')
  const [result, setResult] = useState('')
  const [preview, setPreview] = useState({ headers: [], rows: [] })
  const [history, setHistory] = useState([])

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const selectedInHistory = useMemo(() => history.includes(url), [history, url])

  function persistHistory(next) {
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, HISTORY_MAX)))
  }

  function saveUrlToHistory(nextUrl) {
    const clean = String(nextUrl || '').trim()
    if (!clean) return
    const next = [clean, ...history.filter((u) => u !== clean)].slice(0, HISTORY_MAX)
    persistHistory(next)
  }

  function removeCurrentFromHistory() {
    const next = history.filter((u) => u !== url)
    persistHistory(next)
  }

  function handleBuild() {
    try {
      setCsvUrl(buildTableauCsvUrl(url))
    } catch (e) {
      setCsvUrl(`Invalid URL: ${e.message}`)
    }
  }

  async function handleExtract() {
    setResult('Working...')
    setPreview({ headers: [], rows: [] })
    try {
      const res = await fetch(`/datad/api/extract?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error(`Proxy extract failed (${res.status})`)
      const data = await res.json()
      saveUrlToHistory(url)
      setPreview(parseCsvPreview(data.outputs?.csv?.text || ''))
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
    <main style={{ fontFamily: 'system-ui', maxWidth: 1100, margin: '2rem auto', lineHeight: 1.45 }}>
      <h1>datad</h1>
      <p>Adapter-based extractor playground (Tableau, Yahoo Finance, HTML tables).</p>

      <div style={{ display: 'grid', gap: 8 }}>
        <input
          style={{ width: '100%', padding: '0.6rem' }}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={selectedInHistory ? url : ''}
            onChange={(e) => setUrl(e.target.value)}
            style={{ padding: '0.45rem', minWidth: 320, maxWidth: '100%' }}
          >
            <option value="">Recent extracted URLs</option>
            {history.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <button style={{ padding: '0.45rem 0.75rem' }} onClick={removeCurrentFromHistory} disabled={!selectedInHistory}>Delete selected</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button style={{ padding: '0.5rem 0.8rem' }} onClick={handleBuild}>Build CSV endpoint</button>
        <button style={{ padding: '0.5rem 0.8rem' }} onClick={handleExtract}>Extract (JSON + CSV + VizQL/bootstrap)</button>
      </div>

      {csvUrl && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, background: '#f6f8fa', padding: 12 }}>
          {csvUrl}
        </pre>
      )}

      {preview.headers.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>CSV preview (first rows)</h3>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={`${h}-${i}`} style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', padding: 8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {preview.headers.map((_, cIdx) => (
                      <td key={`${rIdx}-${cIdx}`} style={{ borderBottom: '1px solid #f1f5f9', padding: 8 }}>{row[cIdx] || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16, background: '#0f172a', color: '#e2e8f0', padding: 12 }}>
          {result}
        </pre>
      )}
    </main>
  )
}
