You are writing a Devvit web application that will be executed on Reddit.com.

**Before starting work, read `project-status.md`. After every change, update it** (changelog entry at the top of its changelog, plus "Current state", "Decisions" and "Next up").

## Tech Stack

- **Frontend**: Phaser 3 (fixed 1280x720 canvas, scaled to fit), Vite
- **Backend**: Node.js serverless environment (Devvit), Hono
- **Communication**: plain JSON endpoints under `/api/*`, request/response types in `src/shared/api.ts`
- Only Phaser.js (and later, optionally, Three.js) may be used for the game. No GameMaker.

## Layout & Architecture

- `/src/server`: **Backend Code**. This runs in a secure, serverless environment.
  - `routes/api.ts`: The `/api/*` endpoints called by the client.
  - `index.ts`: Main server entry point (Hono app).
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
- `/src/client`: **Frontend Code**. This is executed inside of an iFrame on reddit.com
  - To add an entrypoint, create a HTML file and add to the mapping inside of `devvit.json`
  - Entrypoints:
    - `index.html` (the `game` entrypoint): boots Phaser via `main.ts` (Expanded View).
    - `splash.html`: The initial entry point (Inline View). This will be shown in the reddit.com feed. Please keep it fast and keep heavy dependencies (Phaser) inside of `index.html`
  - Game code: `scenes/` (Boot, Menu, Match, Result), `entities/`, `systems/`, `ui/`
- `/src/shared`: **Shared Code**. Code to share between the client and server
  - `tuning.ts`: every gameplay number, each with a short comment

## Frontend

### Rules

- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`

### Limitations

- `window.alert`: Use `showToast` or `showForm` from `@devvit/web/client`
- File downloads: Use clipboard API with `showToast` to confirm
- Geolocation, camera, microphone, and notifications web APIs: No alternatives
- Inline script tags inside of `html` files: Use a script tag and separate js/ts file

## Commands

- `npm run test:types`: Check typescript types
- `npm run lint`: Check the linter
- `npm run test:unit`: Run unit tests (`src/**/*.test.ts`)
- `npm run test:local`: Run every check in one go (types, lint, unit, logic, build), same as CI plus `test:logic`
- `npm start`: Build, then serve the game locally at http://localhost:4173 (`npm run serve` serves the last build without rebuilding)
- `npm run dev`: Playtest in the dev subreddit (the user runs this in WSL)

## Code Style

- Prefer type aliases over interfaces when writing typescript
- Prefer named exports over default exports
- Never cast typescript types

## Global Rules

- You may find code that references blocks or `@devvit/public-api` while building a feature. Do NOT use this code as this project is configured to use Devvit web only.
- Whenever you add an endpoint for a new menu item action, ensure that you've added the corresponding mapping to `devvit.json` so that it is properly registered

Docs: https://developers.reddit.com/docs/llms.txt.
