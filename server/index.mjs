import http from 'node:http'
import { extractDataFromUrl } from '../shared/adapters/index.js'

const PORT = Number(process.env.PORT || 8787)

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'GET' && u.pathname === '/health') {
      return sendJson(res, 200, { ok: true })
    }

    if (req.method === 'GET' && u.pathname === '/extract') {
      const targetUrl = u.searchParams.get('url')
      if (!targetUrl) return sendJson(res, 400, { error: 'Missing url query param' })

      const data = await extractDataFromUrl(targetUrl, {
        includeCredentials: false
      })

      return sendJson(res, 200, data)
    }

    return sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    return sendJson(res, 500, { error: err?.message || 'Server error' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`datad proxy listening on 127.0.0.1:${PORT}`)
})
