# ElectroMap

ElectroMap is an EV charging-station finder. It has a map with nearby search, station pages with their chargers, user reviews, saved stations, an admin dashboard, and live charger status over Socket.IO.

| Part | Stack |
| --- | --- |
| `client/` | React 19, Vite, MapLibre, Zustand, Tailwind |
| `server/` | Express 5, Mongoose 9, Zod, JWT auth, Socket.IO, Cloudinary uploads |

## Setup

Requirements: Node.js 22.12+ or 24 LTS, and MongoDB Atlas or a MongoDB replica set.

```bash
# API
cd server
npm ci
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET at minimum
npm run dev            # http://localhost:5000

# Web client (second terminal)
cd client
npm ci
cp .env.example .env
npm run dev            # http://localhost:5173
```

You can run the UI without the API: set `VITE_USE_MOCK_DATA=true` in `client/.env` to use the bundled mock stations.

To load demo stations and accounts into a disposable database, run `npm run seed:demo -- --reset-demo-data` in `server/`. **It first deletes all stations, chargers and reviews.** The script refuses to run when `NODE_ENV=production`.

## Checks

```bash
cd server && npm test        # Node built-in test runner, no database needed
cd client && npm run lint
cd client && npm run build
```

The CI workflow defines these checks for GitHub Actions. Use a disposable database when trying the demo.

## Limitations

- Creating and deleting stations uses MongoDB transactions, so a standalone `mongod` fails. Use Atlas or a replica set.
- Map tiles need a MapTiler key (`VITE_MAPTILER_KEY`).
- Avatar and station image uploads need Cloudinary credentials. Without them, upload endpoints return 503.
- Charger status updates need an admin login, or an IoT device that sends `IOT_SECRET_TOKEN` in the `x-iot-token` header.
- The server tests cover regressions in isolation. There are no end-to-end tests against a real database.
