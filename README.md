# Street Soccer

A fast, 90-second 5v5 arcade street football match against the AI, played inside a Reddit post. Built with Phaser 3 on Devvit Web.

## Develop

Run these in WSL from this folder:

- `npm install`: install dependencies
- `npm run dev`: build and playtest in the dev subreddit (`r/street_soccer_dev`)
- `npm run deploy`: type-check, lint and upload a new version
- `npm run launch`: deploy and submit for Reddit review

## Layout

- `src/client`: the Phaser game (`main.ts`, `scenes/`, `entities/`, `systems/`, `ui/`) and the inline splash (`splash.html`)
- `src/server`: Hono server for Reddit API calls (`/api/*`, menu actions, triggers)
- `src/shared`: types and `tuning.ts`, which holds every gameplay number
