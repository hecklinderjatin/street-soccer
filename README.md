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

Moderators can choose **Create Street Soccer match** in the subreddit menu. It opens a form to create a game post from their Reddit account with fixed settings:

- post title and an optional challenge text;
- each team's name, jersey colour and formation;
- bot difficulty (easy / normal / hard);
- match length (0:30 to 5:00);
- goals the AI starts with (0 to 5), for comeback challenges.

Every player of that post plays those settings, and the post has its own daily leaderboard. Installing the app also creates one default game post.

## Data and permissions

- **Redis:** each post stores each player's best result of the day (Reddit username, goals for and against, shots, passes, tackles won, difficulty) for 8 days, plus short-lived rate limits. Board IDs, cleanup cursors and Scores comment IDs support deletion and sharing. A deletion marker containing the username expires after 60 seconds to block concurrent result writes.
- **Reddit API:** reads usernames for leaderboards and checks account availability for cleanup. Comments use `SUBMIT_COMMENT` only after the player confirms POST MY SCORE, limited to one per player per post every 10 minutes. Custom match creation uses `SUBMIT_POST`, `runAs: 'USER'` and `userGeneratedContent` containing all moderator-entered text/settings. The form identifies that it creates a post from the moderator's account. Reddit approval of user actions is needed for attribution for all users; verify with a non-owner moderator before release. Installation still creates the default post as the app.
- **Pinned scores:** every score-only share checks the Scores comment's current pinned state, retries pinning if necessary, and fails without submitting a score if pinning cannot be verified. Pending comments are reused after a failed pin attempt.
- **Delete your data:** open the subreddit menu, select **Delete my Street Soccer data**, check the confirmation box and submit. This removes your saved results and rate-limit records across this installation's retained leaderboards. Refresh the game afterward. Future completed matches can save new scores. Reddit comments/posts are managed through Reddit's own account controls. The game help screen includes directions to the deletion action.
- **Deleted accounts:** a scheduled task runs every 10 minutes and scans one leaderboard page (target 25 entries) per tick, rotating through boards. Results for accounts Reddit no longer exposes (including deleted or suspended accounts) are removed across retained boards. API errors stop the batch for retry; they are not treated as deletions. The full sweep time depends on leaderboard size; 10 minutes is the job interval, not a deletion deadline.
- **Migration:** before the first deletion/cleanup, the app indexes legacy boards using its app account's Reddit post history and the last 10 UTC days. If history hits Reddit's 1,000-post listing cap, deletion reports failure instead of claiming success; an administrator must migrate the remaining post IDs. Existing unindexed records expire within 8 days. New score writes register their board before storing player data.
- **Deleted posts:** the PostDelete trigger removes that post's retained leaderboards and Scores comment IDs.
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
- `npm run test:privacy`: regression checks for deletion isolation, account lookup failures and mandatory score-thread pinning
- `npm run art:release`: rebuild the player atlases and release art after changing a sprite sheet (needs Python Pillow)
- `npm run audio:release`: rebuild the compressed audio after changing a sound (needs `pip install lameenc miniaudio`)
- `npm run deploy`: type check, lint and upload a new version
- `npm run launch`: deploy and submit for Reddit review

## Layout

- `src/client`: the Phaser game (`main.ts`, `scenes/`, `entities/`, `systems/`, `ui/`) and the inline feed card (`splash.html`)
- `src/server`: Hono server for Reddit API calls (`/api/*`, the moderator menu and form, the install trigger)
- `src/shared`: types, match settings validation and `tuning.ts`, which holds every gameplay number
