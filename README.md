# Fish ID Bot

A Discord bot: `/identify` a photo of a catch to get an AI species ID, `/catches` to see
the server's shared log.

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications → **New Application**.
2. Name it, then go to the **Bot** tab → **Reset Token** → copy it. This is `DISCORD_TOKEN`.
   Keep it secret — anyone with it can control your bot.
3. On the **Bot** tab, no special "Privileged Gateway Intents" are needed for this bot —
   leave them off.
4. On the **General Information** tab, copy the **Application ID** — this is `DISCORD_CLIENT_ID`.
5. Go to **OAuth2 → URL Generator**. Check scopes `bot` and `applications.commands`.
   Under bot permissions, check **Send Messages**, **Embed Links**, **Attach Files**,
   **Read Message History**. Copy the generated URL, open it, and invite the bot to your server.

## 2. Get a free Google Gemini API key

From https://aistudio.google.com/apikey — sign in with any Google account, click
**Create API Key**. No credit card, no charge. This gives you the free tier: 1,500
requests per day, which is far more than a small group of friends will use.
This is `GOOGLE_API_KEY`.

## 3. Configure

```
cp .env.example .env
```
Fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `GOOGLE_API_KEY`.
For `DISCORD_GUILD_ID`: right-click your server icon in Discord (with Developer Mode on,
under User Settings → Advanced) → Copy Server ID. Paste it in while testing — it makes
slash commands appear instantly instead of waiting up to an hour.

## 4. Run it locally

```
npm install
npm run deploy-commands   # registers /identify and /catches — run again if you edit commands.js
npm start
```

Go to your server and try `/identify` with a photo attached.

## 5. Host it for free (24/7)

A Discord bot needs to stay connected all the time, which is a slightly different
requirement than hosting a website. Two solid options:

### Option A: Render (easiest if you're already using it for the site)
Render's free tier is built for web services that respond to HTTP requests and put
them to sleep after 15 minutes of no traffic — which would disconnect your bot. This
project includes a tiny built-in web server (`GET /` returns "Fish ID bot is running.")
specifically so Render treats it as a valid web service and so you can use a free
uptime pinger (e.g. UptimeRobot, pinging your Render URL every 5–10 minutes) to keep
it from sleeping. This is a common workaround, not guaranteed 100% uptime — expect
occasional brief reconnects.

Steps:
1. Push this folder to a GitHub repo.
2. Render → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add environment variables: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `GOOGLE_API_KEY`
   (leave `DISCORD_GUILD_ID` blank for global commands, or set it if you want it limited
   to your server).
5. After first deploy, register commands once from your own machine (with `.env` pointed
   at the same tokens) by running `npm run deploy-commands`, or run it as a one-off job
   in Render's dashboard.
6. Set up a free UptimeRobot monitor pinging your Render URL every 5 minutes.

### Option B: Oracle Cloud "Always Free" tier
A genuinely permanent free VM (not a trial), so no sleep/keep-alive tricks needed — but
you're managing a real Linux server yourself (SSH in, install Node, use something like
`pm2` to keep the process running and restart on crash). More setup, more reliable
once it's running.

## Current limitations to know about

- **Google renames/retires Gemini models fairly often.** This project uses the alias
  `gemini-flash-latest`, which Google keeps pointed at a current working Flash model,
  so it should self-heal through most changes. If you ever see an error like "model
  ... is no longer available," open a browser and go to:
  ```
  https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_GOOGLE_API_KEY
  ```
  (paste your real key in place of `YOUR_GOOGLE_API_KEY`). This shows every model your
  key can use right now. Pick one whose name contains "flash" and whose
  `supportedGenerationMethods` list includes `generateContent`, then set it in your
  `.env` file as `GEMINI_MODEL=that-exact-name`, save, and restart with `npm start`.
- **Catch log storage is a simple JSON file** (`data/catches.json`). On most free hosts
  the filesystem resets on redeploys/restarts, so treat the log as "good enough for a
  hobby project," not permanent. If you want catches to truly persist long-term, that
  needs a real database (e.g. Render's free Postgres) — happy to wire that up when you're
  ready, it's a small change since `storage.js` already isolates all the read/write logic.
- **Identification is an AI estimate**, not a certified ID — the bot's caution field
  flags anything venomous, spiny, or commonly inedible, but always double check before
  eating or handling anything you're unsure about.
