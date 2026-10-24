# Street Soccer

A fast 5v5 arcade street football match against the AI, played right inside a Reddit post. Pixel-art players, a broadcast-style camera, goalkeeper dives and jump saves, and a 7-day leaderboard for every post.

## How it works

- **In the feed**, live AI-vs-AI gameplay fills the post, with the title and match details, Play buttons, games-played count and leaderboard layered over it. The top-right header shows the configured match duration above a colour-coded difficulty badge; Casual posts show CUSTOM SETTINGS instead. Starting score sits beside the team names.
- **PLAY CHALLENGE / PLAY CLASSIC** opens the fixed match and controls panel. **PLAY CASUAL** opens free kit-colour, formation, difficulty and time selectors before the controls panel. Tap GOT IT, then pass to kick off. Golden goal applies if level at full time.
- **After a ranked match**, players can choose **PLAY CASUAL** to open their saved Casual settings, alongside Play Again and optional score sharing. The result screen shows the top 3 of the last 7 days for this post. Players can choose **POST MY SCORE** to share their result. The popup says it posts from their own account and shows their username. A score on its own is posted as a reply to the post's pinned **Scores** comment (made by the app with each post); a score with the player's own words is posted as a comment on the post. Sharing is always optional and never needed to play.
- The (i) button in the match explains the controls. There is a pause menu and a sound on/off switch.

## Controls

- **Joystick (left):** move; push to the edge to sprint.
- **PASS:** tap passes to the ringed teammate; hold for a weighted pass.
- **SHOOT:** hold to charge, release to shoot; slide while holding for a chip (up), a driven shot (down) or curl (left / right).
- **TACKLE:** slide tackle (or dive, when controlling the goalkeeper).
- **SWITCH:** change the player you control.
- Keyboard on desktop: WASD or the arrow keys move, Shift sprints, J and K are the two action buttons, and T / G / F / H add chip / power / curl to a shot (all listed in the (i) help).

## For moderators

Moderators choose **Create Street Soccer match** in the subreddit menu, then select **Daily Challenge**, **Classic**, or **Casual** and continue to the post form.

Daily Challenge and Classic offer the same options: title, optional description, team names, jersey colours, formations, AI difficulty, match length (0:30–5:00), and opponent starting goals (0–5). These settings are fixed for ranked matches, with a separate 7-day leaderboard for each post. Existing custom posts are treated as Daily Challenges.

Casual posts ask only for a title and optional description. Players tap **PLAY CASUAL**, select their own and the opponent's kit colours and formations, difficulty and duration using left/right arrows, then tap **START MATCH**. Formation choices are text-only arrow selectors, without pitch diagrams. Matching kit choices swap the teams’ colours to prevent clashes. Orange and Teal join the existing six outfield colours; 1-3 joins the existing formations. The retired 0-3-1 shape is no longer selectable; older saved settings use 1-2-1 instead. These new choices are also available in Daily Challenge and Classic creation forms. All options are free; matches start 0–0. Preferences are remembered on the device when storage is available. The compact setup fits the webview without internal scrolling, including short portrait and landscape layouts. The controls panel opens before the first Casual match in a page session. Results show match stats with **REMATCH**, **CHANGE SETTINGS** and **EXIT**, without ranked score submission or score sharing.

All modes use a centred, responsive pixel results card with team colours, scores and match stats. Daily Challenge and Classic results also show the 7-day top three and offer **PLAY AGAIN**, **POST MY SCORE** and **PLAY CASUAL**. Score sharing opens an explicit Reddit confirmation form.

Daily Challenge and Classic cards also offer **PLAY CASUAL**. These matches stay unranked even when launched from a ranked post. Post labels do not automatically schedule daily posts. Installation still creates one default game post.

## Games played

Each preview card shows **GAMES PLAYED**: the number of completed matches on that post since this counter was introduced. It includes Casual and ranked matches, including rematches. Watching the AI preview, opening settings, quitting a match or refreshing the page does not increment it. This is a match count, not a count of unique people.

A real match registers a random receipt after its assets are ready. The server validates the duration and only accepts completion after a minimum elapsed time. Receipt completion and the aggregate increment happen in one watched Redis transaction, so duplicate requests and network retries count once. Receipts contain no usernames or scores, expire after 24 hours, and cannot be reused after expiry. The aggregate remains for the post's lifetime and is deleted with the post; pending receipts cannot recreate it. Unavailable counters show a dash and never block gameplay. Earlier matches cannot be reconstructed reliably.

## Data and permissions

- **Local Casual preferences:** kit colours, formations, difficulty and time are saved in browser storage on the device when available. Saved preferences contain no account identifiers and remain on the device. A match configuration is sent to the game-count endpoint for validation; the app retains only anonymous timing/completion receipts for counting. Casual results are not saved to leaderboards or shared as score comments.

- **Redis:** each post stores each player's best result of the day (Reddit username, goals for and against, shots, passes, tackles won, difficulty), plus short-lived rate limits. The leaderboard shows each player's best of today and the previous 6 UTC days; each day's results are deleted at the start of the 8th UTC day. Board IDs, cleanup cursors and Scores comment IDs support deletion and sharing. A deletion marker containing the username expires after 60 seconds to block concurrent result writes.
- **Reddit API:** reads usernames for leaderboards and checks account availability for cleanup. Comments use `SUBMIT_COMMENT` only after the player confirms POST MY SCORE, limited to one per player per post every 10 minutes. Custom match creation uses `SUBMIT_POST`, `runAs: 'USER'` and `userGeneratedContent` containing all moderator-entered text/settings. The form identifies that it creates a post from the moderator's account. Reddit approval of user actions is needed for attribution for all users; verify with a non-owner moderator before release. Installation still creates the default post as the app.
- **Pinned scores:** every score-only share checks the Scores comment's current pinned state, retries pinning if necessary, and fails without submitting a score if pinning cannot be verified. Pending comments are reused after a failed pin attempt.
- **Delete your data:** open the subreddit menu, select **Delete my Street Soccer data**, check the confirmation box and submit. This removes your saved results and rate-limit records across this installation's retained leaderboards. Refresh the game afterward. Future completed matches can save new scores. Reddit comments/posts are managed through Reddit's own account controls. The game help screen includes directions to the deletion action.
- **Deleted accounts:** a scheduled task runs every 10 minutes and scans one leaderboard page (target 25 entries) per tick, rotating through boards. Results for accounts Reddit no longer exposes (including deleted or suspended accounts) are removed across retained boards. API errors stop the batch for retry; they are not treated as deletions. The full sweep time depends on leaderboard size; 10 minutes is the job interval, not a deletion deadline.
- **Migration:** before the first deletion/cleanup, the app indexes legacy boards using its app account's Reddit post history and the last 10 UTC days. If history hits Reddit's 1,000-post listing cap, deletion reports failure instead of claiming success; an administrator must migrate the remaining post IDs. Existing unindexed records expire within 8 days of their last write. New score writes register their board before storing player data.
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
- `npm run test:casual-browser`: browser interaction checks against a running local build (install Playwright Chromium first, or set `CHROMIUM_PATH` to a system Chromium)
- `npm run test:games`: completed-game counter regression checks for concurrent retries, failed commits, lost replies, expiry and deletion
- `npm run test:privacy`: regression checks for deletion isolation, account lookup failures and mandatory score-thread pinning
- `npm run art:release`: rebuild the player atlases and release art after changing a sprite sheet (needs Python Pillow)
- `npm run audio:release`: rebuild the compressed audio after changing a sound (needs `pip install lameenc miniaudio`)
- `npm run deploy`: type check, lint and upload a new version
- `npm run launch`: deploy and submit for Reddit review

## Layout

- `src/client`: the Phaser game (`main.ts`, `scenes/`, `entities/`, `systems/`, `ui/`) and the inline feed card (`splash.html`)
- `src/server`: Hono server for Reddit API calls (`/api/*`, the moderator menu and form, the install trigger)
- `src/shared`: types, match settings validation and `tuning.ts`, which holds every gameplay number
