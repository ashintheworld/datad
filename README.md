# datad

Data extraction toolkit (React app + Chrome extension) focused on Tableau-first workflows.

## What this does
- Detects URLs and routes extraction through an adapter layer (`shared/adapters/*`).
- Current adapters:
  - `tableau` for Tableau view/session/VizQL extraction
  - `yahoo-finance` for quote pages like `finance.yahoo.com/quote/AAPL`
  - `html-table` for generic HTML pages with `<table>` elements
- Tableau adapter now does 3 paths:
  - grabs bootstrap/session hints from page/HTML context,
  - calls VizQL bootstrap endpoint with session context + cookies,
  - returns normalized output containing JSON + CSV data.
- Uses credentialed fetch (browser session/cookies) for authenticated Tableau pages.
- Keeps extractor logic in `shared/` so app and extension use the same code path.

## Structure
- `app/` – React UI (Vite) to test URL parsing and extraction workflows.
- `extension/` – Chrome extension (MV3) to extract from current tab using your logged-in session.
- `shared/` – shared adapters and extractor helpers.
- `server/` – Node proxy API (`/extract`) for server-side fetching (avoids browser CORS limits).

## Tableau notes
For many public dashboards, a direct CSV export endpoint is available:

`https://public.tableau.com/views/<workbook>/<sheet>.csv?:showVizHome=no`

Example test target:
`https://public.tableau.com/app/profile/john.johansson/viz/SuperstoreShippingMetrics/Superstore`

## Quick start

### 1) React app
```bash
cd app
npm install
npm run dev
```

### 2) Chrome extension
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Open a Tableau page and click the extension icon

## Security & legality
Only extract data you are authorized to access. Respect site ToS and privacy rules.
