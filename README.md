# Street Soccer

A fast 5v5 arcade street football match against the AI, played right inside a Reddit post. Pixel-art players, a broadcast-style camera, goalkeeper dives and jump saves, and a 7-day leaderboard for every post.

## How it works

- **In the feed**, live AI-vs-AI gameplay fills the post, with the title and match details, Play buttons, games-played count and leaderboard layered over it. The top-right header shows the configured match duration above a colour-coded difficulty badge; Casual posts show CUSTOM SETTINGS instead. Starting score sits beside the team names.
- **PLAY CHALLENGE / PLAY CLASSIC** opens the fixed match briefing. **PLAY CASUAL** opens free kit-colour, formation, difficulty and time selectors before the briefing. On first entry, review **Match Details → NEXT → How to Play → PLAY MATCH**, then pass to kick off. Both pages pause the match; the **i** button reopens them during play. Golden goal applies if level at full time.
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

Moderators choose **Create Street Soccer match** in the subreddit menu, then select **Daily Challenge**, **Classic**, or **Casual**. Daily Challenge opens a second choice: **Comeback**, **Shield**, or **Rampage**, followed by settings for that template.

Classic keeps its existing title, description, teams, colours, formations, difficulty, match length (0:30–5:00) and opponent starting goals (0–5). New Daily templates use fixed creator settings:

- **Comeback:** start 0–1 through 0–5 behind and finish ahead. The opponent protects its lead, balances when level and attacks when behind.
- **Shield:** start 1–0 through 5–0 ahead and finish ahead. The opponent attacks, goes all-out late while chasing, balances when level and defends if it takes the lead. Your AI teammates defend more cautiously while ahead, keeping one counterattacking outlet.
- **Rampage:** start 0–0 against Noob; each player-team goal raises the opponent to Easy, Normal, Hard, then Pro at the next kickoff. Creators choose **Goals to win** (1–15, default 5) and **Conceding goal limit** (1–10, default 3). Reach the goal target before the conceding limit to clear. New Rampage posts have a fixed **5:00 cap**; timing out fails even if ahead. Difficulty rises per goal until Pro; difficulty and starting score are automatic. Older saved Rampage posts retain their shorter time cap and default 5/3 limits.

Rampage uses a purple/pink **RISING AI** badge. Match Details explains the actual difficulty tiers for the saved goal target, per-goal opponent/goalkeeper upgrades, the conceding limit, timeout failure and fastest-clear ranking. Existing posts keep their stored `survival` mode ID and limits for compatibility; the name change does not edit Reddit post titles.

New Daily templates have no golden goal. Classic, Casual and older posts retain their existing rules, and old custom Daily posts are not silently converted. Tactical changes use kickoff or a short settling delay; they change positioning and risk, with identical player movement/shot physics at every difficulty. Rampage updates both the opponent's outfield decision-making and keeper reactions; your AI teammates and keeper remain Normal.

Each post has its own seven-day board. Comeback and Shield rank cleared challenges above failed attempts. Rampage’s main **Fastest Clears** board includes successful finishers only, ordered by lower live-clock elapsed time (pauses and celebrations excluded), then fewer conceded goals and username. Older saved Rampage rows are read under this same ordering; failed attempts still show results without entering the main board. The preview, in-match objective and results show the selected challenge, progression and outcome. Results and share text distinguish failed Rampage runs from ordinary match wins. Existing privacy deletion and expiry cover the extra mode/time/outcome fields.

Casual posts ask only for a title and optional description. Players tap **PLAY CASUAL**, select their own and the opponent's kit colours and formations, difficulty and duration using left/right arrows, then tap **START MATCH**. Formation choices are text-only arrow selectors, without pitch diagrams. Matching kit choices swap the teams’ colours to prevent clashes. Orange and Teal join the existing six outfield colours; 1-3 joins the existing formations. The retired 0-3-1 shape is no longer selectable; older saved settings use 1-2-1 instead. These new choices are also available in Daily Challenge and Classic creation forms. All options are free; matches start 0–0. Preferences are remembered on the device when storage is available. The compact setup fits the webview without internal scrolling, including short portrait and landscape layouts. The two-page briefing opens before the first Casual match in a page session. Results show match stats with **REMATCH**, **CHANGE SETTINGS** and **EXIT**, without ranked score submission or score sharing.

All modes use a centred, responsive pixel results card with team colours, scores and match stats. Daily Challenge and Classic results also show the 7-day top three and offer **PLAY AGAIN**, **POST MY SCORE** and **PLAY CASUAL**. Score sharing opens an explicit Reddit confirmation form.

Daily Challenge and Classic cards also offer **PLAY CASUAL**. These matches stay unranked even when launched from a ranked post. Post labels do not automatically schedule daily posts. Installation still creates one default game post.

## Goal achievements

Scoring shots show their launch speed in km/h with CHIP, CURL, ROCKET or GREAT FINISH feedback. The speed is an arcade calibration of the ball's full launch velocity, measured before flight drag; it is not a real-world pitch measurement. Passes, own goals and shots touched by another player do not qualify. Personal and ranked speed records require a shot by the human-controlled player; autonomous teammate goals do not earn records. Goal feedback uses a compact floating overlay above the scorer, without a dark headline plate: GOAL! pops in, shakes and tilts, grows into GOOOOAL! with a black outline, cyan/pink offsets and diagonal repeated text trails, then sweeps and fades away before the next kickoff. The burst stays above the scorer. A coloured tag, larger white speed digits over a borderless, translucent dark-blue backing and a personal-best badge remain steady alongside it. The overlay fades within the existing celebration pause. A brief world-camera shake and stronger celebration cue add impact; the master mute and reduced-motion preference are respected.

A new device best is celebrated immediately. Anonymous device records are separate for Casual/practice and fixed competitive matches, contain no account identifier, and can be cleared through browser site data. Storage-disabled players can still play and see match speeds.

Results highlight your fastest goal. Fixed Daily Challenge/Classic matches can also enter **Fastest Goals**, accessible beside **Match Results** in results and through **ALL** on the preview leaderboard. It keeps each player's fastest goal per post across seven UTC days; tied speeds use username order. A faster goal can improve this board even if the match score is worse than a previous result. Casual and unlocked practice matches never submit speed records. Old matches without speed data remain valid but cannot be backfilled.

The server checks integer speed bounds, a scored goal and at least one shot, applies the existing result rate limit and uses the post's fixed configuration. This limits invalid submissions; client-reported gameplay is not cheat-proof.

## Match analytics (awaiting Reddit allowlisting)

Reddit Journeys integration is **enabled by default** at the app owner’s request. The proposed map records interactive readiness, a committed match start/rematch, terminal results and explicit quits. Custom fields are limited to predefined mode, difficulty, duration, outcome, goals and elapsed match time; team names, usernames, Reddit IDs and free text are not added. Reddit supplies its standard contextual metadata. Tracking never blocks gameplay, and watching the AI preview does not start a journey.

The app declares the Journeys permission and attempts tracking, but Reddit accepts events only after map approval and app allowlisting. No second code change is needed once Reddit grants access to a deployed enabled build. To disable tracking, build both client and server with `STREET_SOCCER_JOURNEYS_ENABLED=false`. See [the review map and activation guide](docs/journeys-review-map.md). No review submission, upload or publication is performed by this change. No third-party collector is configured. Platform analytics is managed by Reddit; the existing deletion tool covers our app’s Redis data.

## Games played

Each preview card shows **GAMES PLAYED**: the number of completed matches on that post since this counter was introduced. It includes Casual and ranked matches, including rematches. Watching the AI preview, opening settings, quitting a match or refreshing the page does not increment it. This is a match count, not a count of unique people.

A real match registers a random receipt after its assets are ready. The server validates the duration and only accepts completion after a minimum elapsed time. Receipt completion and the aggregate increment happen in one watched Redis transaction, so duplicate requests and network retries count once. Receipts contain no usernames or scores, expire after 24 hours, and cannot be reused after expiry. The aggregate remains for the post's lifetime and is deleted with the post; pending receipts cannot recreate it. Unavailable counters show a dash and never block gameplay. Earlier matches cannot be reconstructed reliably.

## Data and permissions

- **Local Casual preferences:** kit colours, formations, difficulty and time are saved in browser storage on the device when available. Saved preferences contain no account identifiers and remain on the device. A match configuration is sent to the game-count endpoint for validation; the app retains only anonymous timing/completion receipts for counting. Casual results are not saved to leaderboards or shared as score comments.

- **Redis:** each post stores each player's best result of the day (Reddit username, goals for and against, shots, passes, tackles won, difficulty, optional Daily template and Rampage goal/concession limits, elapsed live-clock time, derived clear/failure outcome and fastest-goal launch speed), plus short-lived rate limits. A separate speed board stores Reddit username and fastest qualifying goal speed with the same seven-day retention. The leaderboard shows each player's best of today and the previous 6 UTC days; each day's results are deleted at the start of the 8th UTC day. Board IDs, cleanup cursors and Scores comment IDs support deletion and sharing. A deletion marker containing the username expires after 60 seconds to block concurrent result writes.
- **Reddit API:** reads usernames for leaderboards and checks account availability for cleanup. Comments use `SUBMIT_COMMENT` only after the player confirms POST MY SCORE, limited to one per player per post every 10 minutes. Custom match creation uses `SUBMIT_POST`, `runAs: 'USER'` and `userGeneratedContent` containing all moderator-entered text/settings. The form identifies that it creates a post from the moderator's account. Reddit approval of user actions is needed for attribution for all users; verify with a non-owner moderator before release. Installation still creates the default post as the app.
- **Pinned scores:** every score-only share checks the Scores comment's current pinned state, retries pinning if necessary, and fails without submitting a score if pinning cannot be verified. Pending comments are reused after a failed pin attempt.
- **Delete your data:** open the subreddit menu, select **Delete my Street Soccer data**, check the confirmation box and submit. This removes your saved match results, speed records and rate-limit records across this installation's retained leaderboards. Refresh the game afterward. Future completed matches can save new scores. Reddit comments/posts are managed through Reddit's own account controls. The game help screen includes directions to the deletion action.
- **Deleted accounts:** a scheduled task runs every 10 minutes and scans one leaderboard page (target 25 entries) per tick, rotating through boards. Results for accounts Reddit no longer exposes (including deleted or suspended accounts) are removed across retained boards. API errors stop the batch for retry; they are not treated as deletions. The full sweep time depends on leaderboard size; 10 minutes is the job interval, not a deletion deadline.
- **Migration:** before the first deletion/cleanup, the app indexes legacy boards using its app account's Reddit post history and the last 10 UTC days. If history hits Reddit's 1,000-post listing cap, deletion reports failure instead of claiming success; an administrator must migrate the remaining post IDs. Existing unindexed records expire within 8 days of their last write. New score writes register their board before storing player data.
- **Deleted posts:** the PostDelete trigger removes that post's retained leaderboards and Scores comment IDs.
- **Logged-out players** can play; their results are not saved and they cannot post a comment.
- No external network requests, no payments, no data shared outside Reddit. Sound starts only after the player taps, and can be muted.

## Support

Players can report a problem from the game's (i) help screen, which tells them to message the moderators of the subreddit the game is in (modmail). For questions about the app itself, message the moderators of the game's home subreddit.

## Develop

Run these in WSL from this folder:

- `npm ci`: install the locked dependencies and apply the glob compatibility fix
- `npm start`: build and play locally at http://localhost:4173 (as a guest, outside Reddit)
- `npm run dev`: build and playtest in the dev subreddit (`r/street_soccer_dev`)
- `npm run test:local`: type check, lint, dependency compatibility, unit and logic checks, build
- `npm run test:casual-browser`: browser interaction checks against a running local build (install Playwright Chromium first, or set `CHROMIUM_PATH` to a system Chromium)
- `npm run test:journeys`: check tracking boundaries, privacy allowlists, denial/failure handling and rematch lifecycle
- `npm run test:journeys-browser`: check a local build’s tracking hooks with mocked Reddit endpoints
- `npm run test:games`: completed-game counter regression checks for concurrent retries, failed commits, lost replies, expiry and deletion
- `npm run test:privacy`: regression checks for deletion isolation, account lookup failures and mandatory score-thread pinning
- `npm run art:release`: rebuild the player atlases and release art after changing a sprite sheet (needs Python Pillow)
- `npm run audio:release`: rebuild the compressed audio after changing a sound (needs `pip install lameenc miniaudio`)
- `npm run deploy`: type check, lint and upload a new version
- `npm run launch`: deploy and submit for Reddit review

## Dependency security

The lockfile pins patched `minimatch@11.0.3` and `tmp@0.2.7` through npm overrides. These remove the 48 npm audit findings present on 2026-10-31 without changing the stable Devvit release. Both full and production-only installs report zero known vulnerabilities at that date.

Devvit’s transitive `glob@7.2.3` expects the old minimatch matcher shape. The root `postinstall` script applies a checked, idempotent compatibility fix: use the new matcher’s public `pattern` and `test()` APIs. It retains glob’s callback/EventEmitter API and minimatch’s nonrecursive matching. Keep install scripts enabled; if an install intentionally used `--ignore-scripts`, run `npm run postinstall` afterward. Review/remove the fix when upstream glob/Devvit updates. `npm run test:dependencies` verifies actual legacy glob/filelist consumers, async/event matching, temporary-file cleanup and path traversal rejection; it also runs in `test:local`.

## Layout

- `src/client`: the Phaser game (`main.ts`, `scenes/`, `entities/`, `systems/`, `ui/`) and the inline feed card (`splash.html`)
- `src/server`: Hono server for Reddit API calls (`/api/*`, the moderator menu and form, the install trigger)
- `src/shared`: types, match settings validation and `tuning.ts`, which holds every gameplay number
