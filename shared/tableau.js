export function normalizeTableauUrl(input) {
  const url = new URL(input);
  if (!url.pathname.includes('/views/') && url.pathname.includes('/viz/')) {
    // profile-style URL: /app/profile/<user>/viz/<workbook>/<sheet>
    const parts = url.pathname.split('/').filter(Boolean);
    const vizIdx = parts.indexOf('viz');
    if (vizIdx > -1 && parts.length >= vizIdx + 3) {
      const workbook = parts[vizIdx + 1];
      const sheet = parts[vizIdx + 2];
      return `${url.origin}/views/${workbook}/${sheet}`;
    }
  }
  return `${url.origin}${url.pathname}`;
}

export function buildTableauCsvUrl(input) {
  const normalized = normalizeTableauUrl(input);
  return `${normalized}.csv?:showVizHome=no`;
}

export async function fetchTableauCsv(input, fetchImpl = fetch, includeCredentials = true) {
  const csvUrl = buildTableauCsvUrl(input);
  const res = await fetchImpl(csvUrl, {
    method: 'GET',
    credentials: includeCredentials ? 'include' : 'omit',
    headers: {
      Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8'
    }
  });

  if (!res.ok) {
    throw new Error(`CSV extraction failed (${res.status}) from ${csvUrl}`);
  }

  const text = await res.text();
  return { csvUrl, text };
}
