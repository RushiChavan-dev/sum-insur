# Sum Insured Impact - React (Vite)

Quick local app to run the calculator with better UX for pasting/uploading data.

Install and run:

```bash
cd react-app
npm install
npm run dev
```

Open the printed local URL in your browser.

## Deploy

This repo is a static Vite app and is ready for free public hosting.

### Cloudflare Pages

Use these settings when importing the Git repository:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

For a manual direct upload deploy from your machine:

```bash
npm run deploy:cloudflare
```

### Cloudflare Workers

If your Cloudflare project is using a deploy command such as `npx wrangler deploy`,
this repo now includes a `wrangler.jsonc` for static SPA deployment.

Use these settings:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

For a local deploy:

```bash
npm run deploy
```
