# pluto-world-mining

Minimal MVP scaffold for the Pluto Mining Exchange.

What I added:
- `server.js` — simple Node static file server (no external deps).
- `public/` — minimal frontend (`index.html`, `app.js`, `styles.css`).
- `package.json` — start script.
- `.gitignore`.
- `package.json` — start script and dependencies.
- `init-db.js` — database initialization script.

Run locally:

```bash
node server.js
# then open http://localhost:8080 in your browser
```

Quick usage:

```bash
npm install
npm run init-db    # creates data.db with sample listings
node server.js
# open http://localhost:8080 to view listings and create new ones
```

Frontend notes:
- The frontend is implemented as a small React app loaded via CDN + Babel for quick iteration. This is development-friendly but not production optimized.
- To productionize, replace the CDN approach with a bundler (Vite/Create React App) and build static assets to `public/`.

Docker (optional):

Build and run with Docker Compose:

```bash
docker compose build
docker compose up
```

This maps port `8080` and stores `data.db` in the repo root so listing data persists between runs.

Next steps to complete the project:
- Decide backend stack (Express, Fastify, Python, etc.) and add APIs.
- Add data storage (SQLite, Postgres, or other) and migration scripts.
- Implement frontend pages and integrate API endpoints.
- Add tests and CI configuration.
 - Add tests and CI configuration.

