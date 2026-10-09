# FuelEx

Petrol station operations app (daily entry, cash, inventory, CRM, finance, reports).
Runs fully in the browser. Data is stored in the device's localStorage; use
**Settings → Share backup** to move data between devices.

## Commands
- `npm install` – install libraries
- `npm run dev` – local development
- `npm run build` – production build into `dist/`
- `npm test` – business-rule tests (meter sales, price history, inventory, top-ups, cash,
  reconciliation, Udhaar, opening stock, cash count, backup/restore, delete guards)

## GitHub Pages
`vite.config.js` uses `base: './'`, so the build works under any repo name.
Either upload the contents of `dist/`, or push the source and use the workflow in
`.github/workflows/deploy.yml` (Settings → Pages → Source: GitHub Actions).

## Change control (past-date edits)
- A completed day, or any day older than yesterday, can only be saved or deleted after
  you write a reason (at least 5 characters).
- The day is marked **Edited** (date, reason, before/after sales and cash) and the change
  is added to **Settings → Change log**. The same rule applies to top-ups, opening stock,
  cash counts, customer payments, salary payments and lubricant purchases/sales.
- Yesterday's draft can be finished without a reason (one grace day).
- The log is part of the backup file.

## Login
The app asks for an ID and password. Only a salted hash is stored (`src/auth/creds.js`), never the password.
To change it: `node tools/make-login.mjs "NEWID" "NewPassword"`, paste the output into `src/auth/creds.js`, rebuild.
This keeps casual users out. It is not bank-grade security (the app runs in the browser).
