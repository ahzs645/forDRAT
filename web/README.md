# forDRAT browser extension

This fork adds a standalone, static browser explorer to the original BC forDRAT repository. The upstream R documentation and published data remain available at the repository root. The browser application lives in `web/`; its deployable output is committed in `docs/` for GitHub Pages.

## What runs in the browser

- Explicit selection of a BEC v11 unit and relative soil moisture regime.
- Comparison of published AET/PET across all six climate periods.
- A ten-species table retaining every published risk rating.
- An accessible numeric table alongside the period chart.
- Local CSV and source-metadata downloads.
- Exact BGC matching, with variant suffixes preserved.
- Source validation, including a SHA-256 check when the browser's Web Crypto API is available.

The app has no backend, runtime npm dependencies, external JavaScript, CDN requests or user accounts. It reads the static CSV and manifest from its own origin. Selecting and exporting results needs no further network requests. A page that has already loaded remains usable if connectivity is lost; offline page reloads are not promised. For a fully local copy, serve `docs/` from an HTTP server.

## Build and check

Node.js 22 is used in CI. TypeScript 5.9.3 is the only build dependency and is pinned in the lockfile.

```sh
cd web
npm ci
npm run build
npm run check
```

The build typechecks and compiles `src/published.ts`, then copies the static interface, immutable source CSV, manifest, licence and notice into `../docs/`. It does not download data or call an API. It removes and recreates `docs/`, which is generated output.

To view the resulting site locally, run this from the repository root:

```sh
python3 -m http.server 8080 --directory docs
```

Open `http://localhost:8080`. Opening `index.html` directly with `file://` is unsupported because browsers restrict fetch requests from file origins.

GitHub Pages can serve the repository's `master` branch, `/docs` folder. Every asset URL is relative, so the application also works at a project path such as `/forDRAT/` or another static hosting prefix. The generated `.nojekyll` file disables Jekyll processing. The workflow checks that rebuilding leaves committed `docs/` files unchanged; it does not require deployment secrets.

## Source and scope

The upstream source is pinned to [`bcgov/forDRAT@ac51aafe7b66d039c990964a9acd809a2ea73848`](https://github.com/bcgov/forDRAT/tree/ac51aafe7b66d039c990964a9acd809a2ea73848).

| Property | Value |
| --- | --- |
| Original path | `data/forDrat.csv` |
| Source size | 338,744 bytes |
| Git blob SHA | `29fcf5e9207802e3516b809418bbbe73ab96ff12` |
| SHA-256 | `abdb1a26645d6d24e6d45380f55aa555a5f69ffdad79c5f7fb47627003f0d2df` |
| Coverage | 204 BGC units × 6 periods × 5 soil regimes = 6,120 rows |
| Species | Pl, Sx, Fd, Bl, Cw, Hw, Lw, Py, Ac, At |
| Risk codes | L, M, H, VH |
| Map attribution | BEC v11 |
| Future climate | ClimateBC 6.21, RCP 4.5, 15-model ensemble |

The upstream CSV is copied byte for byte. This application does not calculate new mortality risk, adjust the published ratings or infer soil moisture from a BGC unit. The data concern mature stands and interior tree species, and do not establish species occurrence, planting suitability or regeneration performance. Matching identifiers in a later BEC map release do not verify boundary agreement.

All six actual CSV period labels are preserved. The upstream README omits `1971-2000` and inconsistently calls the final projection `2070`; the CSV uses `2080`. The projections labelled 2020, 2050 and 2080 cover 2011–2040, 2041–2070 and 2071–2100. They are climatological scenarios, not current drought monitoring.

The newer published table is separate from the older `forestDroughtTool` R calculator. This browser does not claim to reproduce the forDRAT dataset from that legacy implementation.

## Keeping PGMaps and this fork aligned

`web/src/published.ts` is an exact copy of the PGMaps adapter at `src/features/forest-drought/published.ts`. The scientific source contract and data parser are shared without a network dependency. The standalone interface is plain browser JavaScript and does not require PGMaps or React at runtime.

When changing the adapter, update its PGMaps source and focused tests, then copy it here:

```sh
cp ../PGMaps/src/features/forest-drought/published.ts web/src/published.ts
cp ../PGMaps/public/data/forest-drought/manifest.json web/static/manifest.json
cp ../PGMaps/public/data/forest-drought/NOTICE.md web/static/NOTICE.md
```

Run `npm ci`, `npm run build` and `npm run check` in `web/`, inspect the interface, and commit both source and generated `docs/` changes. The adapter's application-relative path constants are not used for loading this standalone page; its own interface uses relative URLs to the same file layout.

An upstream data update is a separate review: inspect the upstream diff, pin the new commit, verify source licensing and period/species semantics, and update the source CSV, checksum, manifest, parser contract and reference cases together. Never replace the snapshot with a moving `master` download or silently reclassify the source values.

## Attribution

Copyright 2024 Province of British Columbia. The upstream repository's Apache 2.0 licence is retained in `LICENSE.md` and copied to the published site. The browser adaptation adds validation and presentation. The full source manifest and interpretation notice are supplied with every build.
