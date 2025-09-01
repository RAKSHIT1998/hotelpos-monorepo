# HotelPOS Monorepo (Backend API + Web UI & Admin)

This repo contains:
- `api/` — Node/Express + Prisma API (Render-ready, PostgreSQL, Ed25519 invoice signatures, OTA stubs)
- `web/` — Next.js (pages router) with **Hotel App** and **Admin Console**

## Deploy Overview (production, zero guesswork)

### Database (Neon)
1. Create a project at https://neon.tech → copy **DATABASE_URL**.

### Backend (Render)
1. Connect this repo → New Web Service.
2. **Environment:** Docker · **Root Directory:** `api` · Build/Start commands: leave **blank**.
3. Set env vars (Render → Environment):
   - `DATABASE_URL` (from Neon)
   - `JWT_SECRET` = `openssl rand -hex 32`
   - `ROOT_ADMIN_KEY` = `openssl rand -hex 32`
   - `PII_AES_KEY` = `openssl rand -hex 32` (64 hex chars)
   - `SIGN_SEED_HEX` = `openssl rand -hex 32` (64 hex chars)
   - `PUBLIC_BASE_URL` = `https://api.hotelpos.in` (or Render URL first)
   - (optional) `AWS_REGION`, `S3_BUCKET` for logo uploads
4. Deploy → open `/health` to verify.

### Frontend (Vercel)
1. Import **`web/`** as a project (Root Directory = `web`).
2. Add env:
   - `NEXT_PUBLIC_BACKEND_URL` = `https://api.hotelpos.in` (or your Render URL)
3. Deploy.
4. Add domains in Vercel → `app.hotelpos.in`, `admin.hotelpos.in` (both pointing to same project).

### Hostinger DNS
Add **CNAME** records:
- `api` → Render’s domain for your API
- `app` → `cname.vercel-dns.com`
- `admin` → `cname.vercel-dns.com`

### Bootstrap first tenant
```bash
curl -sS -X POST "$PUBLIC_BASE_URL/api/admin/issue-tenant"   -H "x-admin-key: $ROOT_ADMIN_KEY" -H "content-type: application/json"   -d '{"name":"Demo Hotel","email":"owner@hotelpos.in","baseCurrency":"INR"}'
```

Login:
- Admin console → `https://admin.hotelpos.in/admin`
- Hotel app → `https://app.hotelpos.in/`

Use the email + temp password returned in the bootstrap call.
