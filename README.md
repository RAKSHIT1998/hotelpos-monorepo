# Hotelpos (Monorepo) — API + Web (Admin & App)

This repo is ready for:
- **Render** (API) via `render.yaml` (blueprint) — one-click deploy.
- **Vercel** (Web UI) — import `web/` as a project.

## Structure
```
api/   # Node/Express + Prisma (Postgres), Dockerfile, Ed25519 invoice signing, OTA creds/mappings
web/   # Next.js (hotel app + admin console)
render.yaml  # Render blueprint for the API
```

## Deploy — Real Life

### 1) Database (Neon recommended)
- Create a project at https://neon.tech
- Copy `DATABASE_URL`

### 2) API on Render (Blueprint)
- On Render → **New → Blueprint** → connect this repo → Deploy.
- The blueprint creates a **web service** for the API using Docker.
- After deploy, open `/health` on the service URL.

**Environment variables to set in Render (post-deploy):**
- `DATABASE_URL`        (from Neon)
- `JWT_SECRET`          = `openssl rand -hex 32`
- `ROOT_ADMIN_KEY`      = `openssl rand -hex 32`
- `PII_AES_KEY`         = `openssl rand -hex 32` (64 hex chars)
- `SIGN_SEED_HEX`       = `openssl rand -hex 32` (64 hex chars)
- `PUBLIC_BASE_URL`     = e.g. `https://api.hotelpos.in`
- (optional) `AWS_REGION`, `S3_BUCKET` for logo uploads

> The **start command is pinned** in the blueprint so Render won’t try to run `"."` again.

### 3) Web UI on Vercel
- Import this GitHub repo as a new project, **Root Directory = `web`**
- Environment → `NEXT_PUBLIC_BACKEND_URL` = your Render API URL or `https://api.hotelpos.in`
- Deploy, then add domains:
  - `app.hotelpos.in`
  - `admin.hotelpos.in`

### 4) Hostinger DNS
Add **CNAME**:
- `api` → the Render service domain
- `app` → `cname.vercel-dns.com`
- `admin` → `cname.vercel-dns.com`

### 5) Bootstrap a hotel (admin + 365-day subscription)
```bash
curl -sS -X POST "$PUBLIC_BASE_URL/api/admin/issue-tenant"   -H "x-admin-key: $ROOT_ADMIN_KEY" -H "content-type: application/json"   -d '{"name":"Demo Hotel","email":"owner@hotelpos.in","baseCurrency":"INR"}'
```
Use the returned email + temp password to sign in on the web app.
