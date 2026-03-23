# L-Dashboard

A personal life dashboard for tracking daily health, habits, and supplements. Hosted on GitHub Pages with Google Sheets as the backend.

---

## Setup

### 1 · Create the Google Sheet

Open your Google Sheet:
**https://docs.google.com/spreadsheets/d/1v6q3pJNPLVdNIQVizY5qFV8ro-ZH1DrfhWVRruHhV0k/edit**

Create three tabs with **exactly** these names (case-sensitive):

| Tab name | Column headers (row 1) |
|---|---|
| `daily_checkin` | `date` · `weight` · `water_oz` · `sleep_hrs` · `sleep_quality` · `calories` · `notes` |
| `habits` | `date` · `habit_name` · `completed` |
| `supplements` | `date` · `supplement_name` · `taken` |

> **Tip:** The Apps Script will auto-create missing tabs and headers on first write, so you can skip this step and let the first check-in submission do it for you. But creating them manually first keeps things tidy.

---

### 2 · Deploy the Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**.
2. Delete any existing code in `Code.gs`.
3. Paste the entire contents of `Code.gs` from this repo.
4. Click **Save** (floppy disk icon).
5. Click **Deploy → New deployment**.
6. Set type to **Web app**.
7. Set **Execute as** → `Me`.
8. Set **Who has access** → `Anyone`.
9. Click **Deploy**.
10. Copy the **Web app URL** — it will look like:
    ```
    https://script.google.com/macros/s/AKfycb.../exec
    ```

---

### 3 · Configure the frontend

Open `config.js` and paste your URL:

```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycb.../exec",
```

While you're there, adjust any goals, supplements, or habits to match your routine.

---

### 4 · Push to GitHub

```bash
git add .
git commit -m "initial L-Dashboard setup"
git push origin main
```

---

### 5 · Enable GitHub Pages

1. Go to your repo on GitHub → **Settings → Pages**.
2. Under **Source**, select **Deploy from a branch**.
3. Choose branch `main`, folder `/ (root)`.
4. Click **Save**.

GitHub will display your live URL — typically within 60 seconds:

```
https://captnEverest.github.io/L-Dashboard
```

---

### 6 · Use the dashboard

| Page | URL |
|---|---|
| Dashboard | `/index.html` (or just `/`) |
| Daily Check-in | `/checkin.html` |

Fill out the check-in form once per day. The dashboard auto-loads the last 14 days of data on every visit.

---

## File overview

```
L-Dashboard/
├── index.html       ← Dashboard (summary cards + charts)
├── checkin.html     ← Daily Check-in form
├── config.js        ← Your Apps Script URL, goals, habits, supplements
├── css/style.css    ← All styles (light + dark via prefers-color-scheme)
├── js/app.js        ← All JS: API calls, charts, form logic
├── Code.gs          ← Google Apps Script (paste into Apps Script editor)
└── README.md        ← This file
```

---

## Updating supplements or habits

Edit the arrays in `config.js`:

```js
SUPPLEMENTS: ["Creatine", "Vitamin D3", ...],
HABITS:      ["Read 20 min", "Deep work session", ...],
```

No other changes needed — the check-in form and dashboard both read from `CONFIG` at runtime.

---

## Re-deploying after Code.gs changes

Any time you update `Code.gs`, you must create a **new deployment** (not update the existing one) for Apps Script to pick up changes:

1. Apps Script editor → **Deploy → New deployment**.
2. Copy the new URL and update `config.js`.
