# HENAKASHA TECH & WELFARE FOUNDATION — Deploy on Render

This guide walks you through deploying both the **backend API** and the **web app** on
[Render](https://render.com) for free, and how to build the **mobile app (Android/iOS)** from
the same codebase.

---

## 1. One-time setup

1. Push this repository to your GitHub account.
2. Create a free **MongoDB Atlas** cluster ([atlas.mongodb.com](https://www.mongodb.com/atlas)).
   Whitelist `0.0.0.0/0` (Render IPs are dynamic) and create a DB user. Copy the connection
   string — it looks like `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority`.
3. Create a free account on [Render](https://render.com).

---

## 2. Deploy via Blueprint (recommended)

A `render.yaml` is already included in the repo root. It provisions **two services**:

| Service          | Type       | Purpose                                  |
|------------------|------------|------------------------------------------|
| `henakasha-api`  | Web (py)   | FastAPI backend at `/api/*`              |
| `henakasha-web`  | Static     | Expo-built web app (HTML/CSS/JS)         |

### Steps

1. In Render dashboard → **New** → **Blueprint** → connect your GitHub repo.
2. Render reads `render.yaml` and creates both services automatically.
3. On the **henakasha-api** service, set these env vars:
   - `MONGO_URL` → your MongoDB Atlas connection string
   - `APP_PUBLIC_URL` → leave blank for now; come back and set after web service deploys
4. On the **henakasha-web** service, set:
   - `EXPO_PUBLIC_BACKEND_URL` → the URL of your `henakasha-api` service
     (e.g. `https://henakasha-api.onrender.com`)
5. After first deploy:
   - Open the web URL `https://henakasha-web.onrender.com`
   - Copy that URL back into `henakasha-api` → env var `APP_PUBLIC_URL` (used in certificate QR verify links).
   - Trigger a re-deploy of the API.

That's it. Visit the web URL and log in:

- **Super Admin** — `BOSSHENA&GULAM` / `Hena&gulam`
- **Admin** — `HENAKASHABYGULAM` / `Rehankhan786@`
- **Demo Teacher** — `teacher_demo` / `Teacher@123`
- **Demo Student** — `student_demo` / `Student@123`

---

## 3. Manual deploy (alternative)

### Backend (FastAPI)

- Render dashboard → **New** → **Web Service**.
- Connect repo, set Root Directory = `backend`.
- Build: `pip install -r requirements.txt`
- Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`
- Env vars: same as Blueprint above.

### Web (Expo Web export)

- Render dashboard → **New** → **Static Site**.
- Connect repo, Root Directory = `frontend`.
- Build: `yarn install --frozen-lockfile && yarn expo export --platform web`
- Publish dir: `dist`
- Add rewrite rules:
  - `/api/*` → `https://<api-service>.onrender.com/api/:splat`
  - `/*`     → `/index.html`     (SPA fallback)
- Env: `EXPO_PUBLIC_BACKEND_URL=https://<api-service>.onrender.com`

---

## 4. Build the **mobile app** (Android / iOS)

The same Expo codebase ships as a native app. You don't need to maintain two codebases.

### On Emergent (easiest)

Click **Publish** (top-right) → generate Android/iOS build using Emergent's build pipeline.
Just provide app icon and credentials when asked.

### Locally with EAS (advanced)

```bash
cd frontend
npm install -g eas-cli
eas login
eas build --profile production --platform android
eas build --profile production --platform ios
```

Set the production backend URL in the EAS build profile:

```jsonc
// eas.json
{
  "build": {
    "production": {
      "env": { "EXPO_PUBLIC_BACKEND_URL": "https://henakasha-api.onrender.com" }
    }
  }
}
```

---

## 5. Free-tier notes

- Render free web services **sleep after 15 minutes** of inactivity. First request wakes them
  (~30s cold start). Upgrade to **Starter ($7/mo)** for always-on.
- MongoDB Atlas free (M0) gives 512MB storage — plenty for tens of thousands of users in this app.
- All file uploads (notes) are stored as base64 in MongoDB. For large libraries, swap to
  S3/Cloudinary later (the model fields already keep `file_name` + `file_type`).

---

## 6. Health check

Visit `https://<api>.onrender.com/api/` — should return:

```json
{ "app": "HENAKASHA EdTech API", "ok": true, "version": 2 }
```
