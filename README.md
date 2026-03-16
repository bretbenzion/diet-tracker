# NutriTrack

A sleek, modern Progressive Web App (PWA) for tracking nutrition, macros, and weight — built with vanilla JS and designed for GitHub Pages deployment.

## Features

- **Daily nutrition tracking** — calories, protein, carbs, fat with visual ring + bars
- **Weight tracking** — with linear trendline chart
- **Nutrition targets** — set daily goals with min/max/exact direction per macro  
- **Food library** — save and reuse foods; fully editable
- **Recent foods** — auto-populated from your log history
- **Adjustable servings** — change amount when logging; macros recalculate proportionally
- **AI food search** — powered by Claude AI (requires your Anthropic API key)
- **Nutrition label scan** — photograph a label and auto-import nutrition data
- **Manual food entry** — full form with all macro fields
- **Edit / delete any entry** — for any day, any entry
- **JSON import/export** — backup and restore all your data
- **Persistent data** — all data saved to localStorage, survives browser closes
- **PWA** — installable on mobile, works offline

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files from this folder to the repo root
3. Go to **Settings → Pages → Source → Deploy from branch → main → / (root)**
4. Your app will be live at `https://yourusername.github.io/your-repo-name/`

> **HTTPS required** for camera access (label scanning). GitHub Pages provides HTTPS automatically.

## AI Features Setup

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com)
2. In the app, go to **Targets → AI Settings**
3. Paste your API key (`sk-ant-...`)
4. Your key is stored **locally only** in your browser — never on any server

## File Structure

```
nutritrack/
├── index.html          # Main app entry point
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline support)
├── css/
│   └── main.css        # All styles
├── js/
│   ├── store.js        # Data persistence (localStorage)
│   ├── ui.js           # UI utilities + rendering helpers
│   ├── charts.js       # Chart.js weight charts + trendline
│   ├── ai.js           # Anthropic API integration
│   └── app.js          # Main application logic
└── icons/
    ├── icon-192.png    # PWA icon
    └── icon-512.png    # PWA icon (large)
```

## Data Storage

All data is stored in `localStorage` under these keys:
- `nt_log` — food log by date
- `nt_weight` — weight entries
- `nt_library` — saved foods
- `nt_targets` — daily goals
- `nt_prefs` — user preferences
- `nt_apikey` — Anthropic API key

Use **Data → Export** to back up your data as JSON, and **Import** to restore.

## Browser Support

Works in all modern browsers. Camera/label scan requires HTTPS and browser camera permission.
