# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Create your local env file (see .env.example for the required keys).
#         .env.local is gitignored; production values live in the Vercel dashboard.
cp .env.example .env.local

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

The dev server runs on port **8080** (see `vite.config.ts`).

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Supabase keepalive

This repo includes a dedicated Supabase keepalive mechanism for production so a Supabase Free project does not get paused for inactivity. It does not touch any business tables, product flows, or application logic.

What was added:

- `supabase/migrations/20260421123000_supabase_keepalive.sql` creates the `api` schema if needed, a dedicated `api.supabase_keepalive` table, and an idempotent `api.keepalive()` RPC that only upserts a single fixed row.
- `.github/workflows/supabase-keepalive.yml` runs on a GitHub Actions schedule twice per day and calls the Supabase RPC directly.

Required setup:

- Add `api` to the Supabase project's exposed schemas in `Project Settings -> API` if it is not already exposed.
- Add these GitHub repository secrets:
  - `SUPABASE_PROJECT_URL`
  - `SUPABASE_ANON_KEY`

The workflow uses the anon key intentionally because only the `api.keepalive()` RPC is exposed for anon execution. The underlying table is still kept behind database-owned writes.

Manual test:

```sh
curl --silent --show-error --fail-with-body \
  -X POST \
  "${SUPABASE_PROJECT_URL%/}/rest/v1/rpc/keepalive" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: api" \
  -H "Content-Profile: api" \
  -d '{}'
```

Expected response:

```json
{"ok":true,"timestamp":"2026-04-21T12:34:56.789Z"}
```

Adjust or disable the schedule:

- Edit `.github/workflows/supabase-keepalive.yml` to change the `cron` entries.
- Disable the `Supabase Keepalive` workflow in GitHub Actions if the project no longer needs it.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
