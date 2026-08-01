# Deploy MAPCO to Vercel (project name: `mapco`)

This sets up a Vercel deployment so you can visually test the real app (dealer app,
Map Studio, Client Presentation) against **MAPCO-DEV** in your browser.

> I can't create the Vercel project for you (it needs your Vercel login). Everything
> is configured — follow either option below; it takes ~3 minutes.

The app lives in the **`v2/`** subfolder, so the Vercel **Root Directory must be `v2`**.

---

## Option A — Vercel dashboard (easiest)

1. Go to **vercel.com → Add New… → Project**, and import the GitHub repo
   `rachitchaurasia17-ctrl/MAPCO`.
2. **Project Name:** `mapco`
3. **Root Directory:** click *Edit* → choose **`v2`**.
4. **Framework Preset:** Vite (auto-detected). Build command `npm run build`,
   Output directory `dist` (already in `v2/vercel.json`).
5. **Environment Variables** (add these three — they are safe to store; the anon key is
   a *publishable* key):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://lswzrkvdwirhvggtvuch.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | *(the anon/publishable key from Supabase → MAPCO-DEV → Project Settings → API)* |
   | `VITE_DATA_MODE` | `supabase` |

   > Never add the **service-role** key here — it must never reach the browser.
6. Click **Deploy**. You'll get a URL like `https://mapco.vercel.app`.

## Option B — Vercel CLI

```bash
cd "C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/v2"
npx vercel login          # one-time
npx vercel link --project mapco     # create/link the "mapco" project (Root = this v2 folder)
npx vercel env add VITE_SUPABASE_URL production      # paste the URL
npx vercel env add VITE_SUPABASE_ANON_KEY production # paste the anon key
npx vercel env add VITE_DATA_MODE production          # type: supabase
npx vercel --prod         # build + deploy
```

The anon key is already in your local `v2/.env` (`VITE_SUPABASE_ANON_KEY`) if you need to copy it.

---

## After it deploys — how to test

1. Open `https://mapco.vercel.app/admin/map-studio.html` → you'll get a **dealer sign-in**
   card (because `VITE_DATA_MODE=supabase`).
2. Sign in with the demo dealer:
   - **Email:** `demo-owner@mapco.dev`
   - **Password:** the `DEMO_PASSWORD` value in your local `supabase/.env`
     (or reset it in Supabase → MAPCO-DEV → Authentication → Users).
3. **Map Studio** loads your real map catalog. Try: filter by state, select a map,
   preview Original/3D/overlay, **Publish** a sector, **Link a plot** + **Place pin**.
4. Open `https://mapco.vercel.app/app/plotmap/index.html` (Client Presentation, same
   browser so the session is shared) → the map picker shows your **published** maps by
   city; sectors you just published now appear.

### Modes
- `VITE_DATA_MODE=supabase` → real MAPCO-DEV data (needs sign-in).
- `VITE_DATA_MODE=mock` → deterministic fixtures, **no sign-in** (handy for pure visual review).

### Notes
- This is a **preview/testing** deploy, not production. It talks only to **MAPCO-DEV**.
- Dealer login persists in the browser. To sign out / switch users, add `?signout` to any
  dealer URL (e.g. `…/admin/map-studio.html?signout`) or clear the site's data.
- `v2/.env` and `supabase/.env` are gitignored and never deployed; set env in Vercel only.
