# Street Soccer

A fast 5v5 arcade street football match against the AI, played right inside a Reddit post. Pixel-art players, a broadcast-style camera, goalkeeper dives and jump saves, and a daily leaderboard for every post.

## How it works

- **In the feed**, the post shows a live AI-vs-AI preview match with the match info and a **PLAY** button.
- **PLAY** opens the game full-screen and starts a match against the AI: 90 seconds by default, golden goal if level. Pass to kick off.
- **After the match**, the result screen shows today's top 3 for this post. Players can choose **POST MY SCORE** to share their result. The popup says it posts from their own account and shows their username. A score on its own is posted as a reply to the post's pinned **Scores** comment (made by the app with each post); a score with the player's own words is posted as a comment on the post. Sharing is always optional and never needed to play.
- The (i) button in the match explains the controls. There is a pause menu and a sound on/off switch.

## Controls

- **Joystick (left):** move; push to the edge to sprint.
- **PASS:** tap passes to the ringed teammate; hold for a weighted pass.
- **SHOOT:** hold to charge, release to shoot; slide while holding for a chip (up), a driven shot (down) or curl (left / right).
- **TACKLE:** slide tackle (or dive, when controlling the goalkeeper).
- **SWITCH:** change the player you control.
- Keyboard on desktop: WASD or the arrow keys move, Shift sprints, J and K are the two action buttons, and T / G / F / H add chip / power / curl to a shot (all listed in the (i) help).

## For moderators

Moderators get one menu item in the subreddit menu: **Create Street Soccer match**. It opens a form to create a game post with fixed settings:

- post title and an optional challenge text;
- each team's name, jersey colour and formation;
- bot difficulty (easy / normal / hard);
- match length (0:30 to 5:00);
- goals the AI starts with (0 to 5), for comeback challenges.

Every player of that post plays those settings, and the post has its own daily leaderboard. Installing the app also creates one default game post.

## Data and permissions

- **Redis:** for each post, each player's best result of the day (Reddit username, goals for and against, shots, passes, tackles won, difficulty), kept for 8 days, plus short-lived rate-limit keys. Nothing else is stored.
- **Reddit API:** reads the current username (for the leaderboard). Posts a comment **as the player** (`SUBMIT_COMMENT`) only when the player taps POST MY SCORE and confirms the popup ("Post as u/name"); limited to one comment per player per post every 10 minutes. The app never posts a player's words from its own account; its only own comment is the pinned Scores comment on each game post.
- **Deletion:** when a game post is deleted, the app deletes that post's leaderboards and stored comment id (PostDelete trigger). Player results expire after 8 days on their own.
- **Logged-out players** can play; their results are not saved and they cannot post a comment.
- No external network requests, no payments, no data shared outside Reddit. Sound starts only after the player taps, and can be muted.

## Support

Players can report a problem from the game's (i) help screen, which tells them to message the moderators of the subreddit the game is in (modmail). For questions about the app itself, message the moderators of the game's home subreddit.

## Develop

Run these in WSL from this folder:

- `npm install`: install dependencies
- `npm start`: build and play locally at http://localhost:4173 (as a guest, outside Reddit)
- `npm run dev`: build and playtest in the dev subreddit (`r/street_soccer_dev`)
- `npm run test:local`: type check, lint, unit and logic checks, build
- `npm run art:release`: rebuild the player atlases and release art after changing a sprite sheet (needs Python Pillow)
- `npm run audio:release`: rebuild the compressed audio after changing a sound (needs `pip install lameenc miniaudio`)
- `npm run deploy`: type check, lint and upload a new version
- `npm run launch`: deploy and submit for Reddit review

## Layout

- `src/client`: the Phaser game (`main.ts`, `scenes/`, `entities/`, `systems/`, `ui/`) and the inline feed card (`splash.html`)
- `src/server`: Hono server for Reddit API calls (`/api/*`, the moderator menu and form, the install trigger)
- `src/shared`: types, match settings validation and `tuning.ts`, which holds every gameplay number
