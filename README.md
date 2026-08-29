# Fomo Maintenance

Public marketing site for **Fomo Maintenance**, an independent solar operations and maintenance company in Singapore. Sister brand to FOMO Energy (the installer).

## Live site

https://juliustanch.github.io/fomo-maintenance/

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Production builds set `basePath` and `assetPrefix` to `/fomo-maintenance` for GitHub Pages.

## Pricing checks

The stepped annual tariff (SGD) lives in `lib/pricing.ts`. Required examples:

```bash
npm run verify:pricing
```

## Journal

Articles live in `lib/journal.ts`. Append to that array to publish another piece; the journal page and the homepage teaser both read from it.

## Deploy

Pushes to `main` run GitHub Actions: `npm ci`, `npm run verify:pricing`, `next build`, then publish the static `out/` folder to GitHub Pages.

GitHub Pages is enabled with **GitHub Actions** as the source. Every push to `main` updates https://juliustanch.github.io/fomo-maintenance/
