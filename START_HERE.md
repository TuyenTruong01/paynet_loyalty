# Start here - ArcPay Loyalty POS

This zip is based on the original project folder. I only fixed the run/startup files so it can run without changing the whole project structure.

## Run on Windows

1. Open this project folder.
2. Double click `RUN_LOCAL_WINDOWS.bat`.

Or open CMD in this folder and run:

```bat
npm run dev
```

The script now calls Vite directly through Node:

```bat
node ./node_modules/vite/bin/vite.js --host 0.0.0.0
```

This avoids the `vite is not recognized` problem.

## Important

- Do not run `npm install` unless `node_modules` is missing.
- Do not push `.env`, `node_modules`, or `dist` to GitHub.
- Keep product/staff/logo images under `public/png/...` and store only paths in Supabase.
