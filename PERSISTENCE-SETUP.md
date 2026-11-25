# Render + Supabase setup
1. Create a free Supabase project. In SQL Editor run `supabase-setup.sql`.
2. In Render's existing service Environment settings set SUPABASE_URL (project URL), SUPABASE_SERVICE_ROLE_KEY (server-only legacy service_role JWT), ADMIN_PASSWORD (strong unique password). Keep GROQ_API_KEY and other existing settings. Never expose the service role key in client code or GitHub.
3. Deploy this version. Open the dashboard and sign in with username `admin` and your ADMIN_PASSWORD. Pair WhatsApp once. Future restarts load the saved session automatically. Explicit disconnect or pairing again deletes the saved session. Use only one bot instance; concurrent instances are unsupported.
4. Existing local WhatsApp auth files are not migrated; pair once. Existing local player state is uploaded on first startup if still present and no cloud snapshot exists. Data already lost on Render cannot be recovered by this update.
5. Verify by redeploying after pairing and checking that the bot reconnects and balances survive. Test `.play <song>` separately; upstream YouTube/yt-dlp restrictions can still cause download failures.

Storage uses server-side REST with RLS and no public access. WhatsApp auth is stored as a serialized credential/key snapshot; bot state writes are queued and retried. Abrupt shutdown or database outage can lose unsaved changes. No guarantee of uninterrupted uptime. The existing in-memory AI thread links are not persisted by this change. Keep a backup and monitor Render logs. Dashboard HTTP Basic authentication relies on HTTPS (provided by Render).
