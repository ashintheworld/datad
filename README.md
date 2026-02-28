# datad

Data extraction toolkit (React app + Chrome extension) focused on Tableau-first workflows.

## What this does
- Detects Tableau viz URLs.
- Attempts export endpoints first (CSV/Summary) for fast structured extraction.
- Falls back to credentialed fetch (browser session/cookies) for pages requiring auth.
- Keeps extractor logic in `shared/` so app and extension use the same code path.

## Structure
- `app/` – React UI (Vite) to test URL parsing and extraction workflows.
- `extension/` – Chrome extension (MV3) to extract from current tab using your logged-in session.
- `shared/` – shared Tableau URL parsing + extractor helpers.

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
