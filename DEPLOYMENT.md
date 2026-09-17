# DemoPulse Production Deployment Guide

## Status
- ✅ **Frontend:** Deployed to Vercel at https://demopulse-seven.vercel.app
- ✅ **Code:** All pushed to GitHub (gustavovazquezgtz/demopulse)
- ✅ **Auth Secret:** Generated and configured
- ⏳ **Database:** Needs connection string

## What's Deployed
- Next.js 16.3.5 app with TypeScript
- React 19.2 frontend with TailwindCSS
- NextAuth.js v5 authentication
- Prisma 5.22.0 ORM (schema ready)
- 21 routes (authenticated pages + API)

## Next Steps: Configure Database

### 1. Create Postgres Database
Choose one:

**Option A: Neon (Recommended - Free Tier)**
1. Go to https://neon.tech
2. Sign up (free)
3. Create a project
4. Copy the connection string (looks like: `postgresql://user:password@host:port/dbname?schema=public`)

**Option B: Supabase (Also Free)**
1. Go to https://supabase.com
2. Create project
3. Get connection string from Settings → Database

**Option C: Other Postgres Provider**
- AWS RDS, Digital Ocean, Railway, Heroku Postgres, etc.
- Get connection string

### 2. Configure Environment Variables in Vercel
1. Go to: https://vercel.com/gustavovazquezgtzs-projects/demopulse/settings/environment-variables
2. Add new variable:
   - **Key:** `DATABASE_URL`
   - **Value:** [Your connection string from step 1]
   - **Environments:** Check all (Production, Preview, Development)
3. Save

### 3. Run Database Migrations
```bash
cd /Users/gustavo/demopulse

# Pull env vars from Vercel
npx vercel env pull

# Run Prisma migrations
npx prisma migrate deploy

# (Optional) Seed with real org data
npm run db:seed
```

### 4. Re-deploy to Production
```bash
npx vercel deploy --prod
```

## Testing After Deployment
1. Visit https://demopulse-seven.vercel.app
2. Login with any manager account:
   - Email: `daniel.alcantara@demopulse.dev`
   - Password: `Password123!`
3. Verify:
   - ✅ Dashboard loads
   - ✅ People/Teams/Projects visible
   - ✅ Can create demos
   - ✅ Can record attendance

## Database Schema
Included in repo:
- `/prisma/schema.prisma` — Full ERD
- `/prisma/migrations/` — Migration history
- `/prisma/seed.ts` — Sample data (5 teams, 13 developers)

## Environment Variables Set
- ✅ `NEXTAUTH_SECRET` — Generated
- ✅ `NEXTAUTH_URL` — Set to production URL
- ⏳ `DATABASE_URL` — **YOU NEED TO ADD THIS**

## Support
- Backend: Next.js API routes (`/api/auth/[...nextauth]`)
- Frontend: All routes at `/app/(app)/`
- Deployment: Vercel (auto-deploys on git push to `main`)

## Architecture
- **Frontend:** Next.js Server Components (RSC)
- **Auth:** NextAuth.js with credentials provider
- **Database:** Prisma ORM + PostgreSQL
- **AI:** Rule-based insights (no LLM required, but optional OpenAI support)

---

**Once you add DATABASE_URL and re-deploy, the app is production-ready!**
