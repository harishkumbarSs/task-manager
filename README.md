# Task Manager (full stack)

Full-stack task management app: **React (Vite)** frontend, **Node.js / Express** REST API, **MongoDB** (Mongoose), **JWT** authentication, and task **CRUD** with **priority**, **status workflow**, **due dates**, list **filters/sort**, and UI updates via React hooks.

| | |
| --- | --- |
| **Stack** | React 18, React Router, Vite, Express 4, Mongoose, bcrypt, JWT |
| **Live demo** | Add your Netlify URL after deploy |
| **API** | Add your Render URL after deploy |

## Repository layout

- `client/` — React SPA (Netlify)
- `server/` — Express API (Render)

## Local development

### Prerequisites

- Node.js 18+
- MongoDB running locally, or a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) connection string

### 1. Backend

```bash
cd server
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN=http://localhost:5173
npm install
npm run dev
```

API runs at `http://localhost:5000`. Health check: `GET /api/health`.

### 2. Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Vite dev server proxies `/api` to `http://localhost:5000`, so you do **not** need `VITE_API_URL` for local work.

Open `http://localhost:5173` — register, sign in, create tasks.

## Security (API)

- **Helmet** sets safer HTTP headers (with `cross-origin` resource policy so browsers can call the API from your Netlify origin).
- **Rate limiting** applies to `/api/*` (except `GET /api/health`) and stricter limits on `/api/auth/login` and `/api/auth/register`.
- Behind Render/Railway, **`trust proxy`** is enabled so the client IP is correct for rate limits.

## API overview

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create user, returns JWT |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Bearer JWT | Current user |
| GET | `/api/tasks` | Bearer JWT | List tasks. Query: `status`, `priority`, `sort` (`dueDate` or `priority`) |
| POST | `/api/tasks` | Bearer JWT | Create: `title`, optional `description`, `priority`, `status`, `dueDate` |
| PATCH | `/api/tasks/:id` | Bearer JWT | Update any of those fields; `completed` syncs with `status` |
| DELETE | `/api/tasks/:id` | Bearer JWT | Delete task |

## Deploy backend on [Render](https://render.com)

1. Create a **Web Service**, connect this repo.
2. Set **Root Directory** to `server`.
3. **Build command:** `npm install`  
   **Start command:** `npm start`
4. Add environment variables:

   | Variable | Example |
   | --- | --- |
   | `MONGODB_URI` | Atlas SRV connection string |
   | `JWT_SECRET` | Long random string |
   | `CLIENT_ORIGIN` | Your Netlify site URL, e.g. `https://your-app.netlify.app` |
   | `PORT` | Optional; Render sets `PORT` automatically |

5. After deploy, copy the service URL (e.g. `https://task-manager-api.onrender.com`).

## Deploy frontend on [Netlify](https://www.netlify.com)

This repo includes `netlify.toml` so Netlify builds from the `client` folder.

1. **New site from Git** → pick the repo.
2. Netlify should detect: base `client`, publish `dist`, build `npm install && npm run build`.
3. Under **Site configuration → Environment variables**, add:

   | Key | Value |
   | --- | --- |
   | `VITE_API_URL` | Your Render API origin **without** trailing slash, e.g. `https://task-manager-api.onrender.com` |

4. Redeploy after saving env vars (Vite bakes `VITE_*` at build time).

CORS on the API allows the origin(s) in `CLIENT_ORIGIN`. Use a comma-separated list if you need preview deploy URLs too, for example:

`https://your-app.netlify.app,https://deploy-preview-123--your-app.netlify.app`

## GitHub

```bash
git init
git add .
git commit -m "Initial Task Manager full-stack app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Replace the remote URL with your repository.

## License

MIT
