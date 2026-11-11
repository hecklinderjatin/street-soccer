# Street Soccer: Project Status

Hand-off notes for any developer or AI model picking up this project. **Update this file after every change**: add a changelog entry at the top of the changelog, and keep "Current state", "Decisions" and "Next up" accurate.

- **Source plan:** `Street Soccer MVP Plan.md` (by @ketan, Oct 12, 2026; kept outside the repo in the user's Downloads). It defines scope, tuning numbers, controls, AI and the 5-week build plan.
- **Repo rules:** see `AGENTS.md` (Devvit rules, code style: type aliases, named exports, no type casts).
- **Look target:** the user wants the camera angle of a FIFA-style TV broadcast camera: elevated beside the near touchline, perspective, touchlines horizontal, side lines converging. The rendering is built around this (see "Broadcast camera" below), in a retro pixel-art style ("Mode 7"-like).

## Current state

**Main merge (2026-11-11):** fast-forwarded `codex/already-joined` through `af2af47` into main at the user’s request. Includes Retry Join removal, clearer permission failure wording and manual Already Joined suppression per account/community/device. Existing types/lint and focused community API/browser checks pass. Automatic player membership detection remains unavailable through current SDK access. No application build or deployment performed.

**Already Joined preference (2026-11-11):** verified SDK docs: subscribeToCurrentSubreddit is a no-op for members; getSubscribedSubredditsForCurrentUser executes as the app account and requires Reddit approval for user access, so it cannot safely establish player membership. Add an explicit Already Joined option to the shared prompt; it skips consent/subscription, opens results and stores a separate self-confirmed preference per account/community/device. Suppress later prompts using that preference or a confirmed in-game join. Never label the preference as a verified membership check or thank users for a subscription that did not occur. Keep no Retry button. Types/lint and focused API/browser checks pass, including no subscription from Already Joined, future suppression and community/account isolation. Exact production permission failure still requires reference 6e20b303 logs. No application build or live Reddit writes performed.

**Remove Join Retry (2026-11-11):** remove the Retry Join results button and its styles, as requested. Keep safe join diagnostics/references and confirmed-success thanks. Remove retry instructions from join errors; suggest joining from the subreddit page. Wording now identifies a permission issue without claiming the player denied consent. User screenshot reference 6e20b303 came from the permission-classified server failure path; its exact SDK cause remains available only in the corresponding community_join_failed log. Types/lint and community API/browser checks pass, including no Retry button on failure. No application build, live joins or production log access performed.

**Main merge (2026-11-11):** fast-forwarded `codex/join-diagnostics` through `bb1009b` into main at the user’s request. Includes actionable join errors/references, correlated SDK logs, Retry Join and required Free Kick Restart. Existing types/lint and focused community/restart browser/API checks pass. Production join cause still requires a reproduced reference and server logs. No application build or deployment performed.

**Join diagnostics and required Free Kick Restart (2026-11-11):** join failures now return safe reason/code and short reference. Log community_join_failed with the matching reference, deployed app version, SDK error code and bounded message (no request headers/account identifiers). Distinguish permission and rate-limit errors; client displays server details/reference with HTTP fallback and requires joined:true before thanking/storing success. Add a trusted-click Retry Join button on results. Verify live failures by reproducing while running `npx devvit logs street_soccer_dev street-soccer --since 15m`, then matching the screenshot reference to its SDK message. Existing catch swallowed the error, so no exact production cause is claimed. Free Kick Restart was already present in main; make its overlay callback required and always render its control. Actual source-only browser checks verify/click Restart in Play, Challenge and Practice and confirm settings/reset/record isolation; Challenge pause screenshot inspected. Types/lint and community API/browser and pause-restart checks pass. No application build, live Reddit joins or production log access performed.

**Main merge (2026-11-11):** fast-forwarded `codex/pause-restart` through `e4a24ed` into main at the user’s request. Includes the community consent explanation, immediate result transition/confirmed thanks, and Restart across every pause menu. Existing types/lint and focused community/Free Kick/restart checks pass. No application build or Reddit deployment performed.

**Pause Restart in every game mode (2026-11-11):** add orange Restart between Resume and Quit on touch normal-match pause, and below Key Bindings on desktop. Release input, record abandonment, stop the paused match and start a fresh match with the same config (Classic, Custom/Casual and Daily); reset the HUD duplicate-click guard on each init. Free Kick Play, Challenge and Practice use their existing fresh-run reset from Pause, preserving challenge settings/chosen practice level, resetting progress/lives and renewing record IDs. Practice retains New Spot. Re-space pause controls and position the trusted DOM Quit below Restart via shared pauseLayout. Types/lint and 32 Free Kick rules/panel/API checks pass. Actual callback checks cover every normal mode and desktop/touch layout; source-only WebGL checks click Restart in all three Free Kick entries and verify resets, preserved settings, renewed IDs, no partial saves and pause UI cleanup. No application build or live Reddit writes performed.

**Community consent note and result thanks (2026-11-11):** add the requested explanation before the Join button: Reddit asks for permission, joining posts nothing, and denial still allows play. Join immediately reveals the last match details while native permission runs; show waiting/joining status there, then a themed Thanks for joining message only after subscription succeeds. Denied consent and errors show accurate messages on results without a false thank-you. Applies through the shared popup to normal and Free Kick; preserve landscape/portrait layouts and local successful-join suppression. Disposal prevents pending consent from initiating a join or updating another scene after results exit. Types/lint and focused Hono/Chromium checks pass (note, immediate transition, pending consent, denial/error/success, suppression, account isolation and cleanup). No application build or live Reddit writes performed.

**Main merge (2026-11-11):** fast-forwarded `codex/freekick-challenge-boards` through `465d60e` into main at the user’s request. Includes optional community popup, Free Kick illustrated help/raised feedback/result alignment, and Challenge score/speed leaderboards. Existing types/lint and focused rules/API/source-browser checks pass; no application build or Reddit deployment performed. Membership detection limitation and stale older Free Kick flow harness remain documented below.

**Free Kick Challenge result boards (2026-11-11):** show both Highest Score and Fastest Goals tabs below the stats on every completed Free Kick run, including Challenge wins/losses. Challenge now registers on its first shot and saves its completed snapshot using a distinct challenge mode. Validate terminal goals/lives, no great-save exemptions and the actual final-round level against server-owned post settings; reuse timing/immutable receipts, best-only seven-day post boards and existing privacy/deletion handling. Score uses completed-run points; speed still counts scored-shot launches only. Practice and quit runs remain unranked; challenge score-sharing remains disabled. Update info Records to seven days. Types/lint, 32 Free Kick rules/panel/API checks and source-only UI checks pass, including challenge save dispatch, both leaderboard tabs and responsive aligned results. No application build or live Reddit writes performed.

**Free Kick UI cleanup (2026-11-11):** how-to-play now pairs concise descriptions with HUD-like power meter, actual ball/contact and life art, swipe/aim guide, wall and xG examples. Space the six rows to prevent text collisions. Move result feedback from 64% to 28% down the view, reduce title size and remove its full-width bordered plate and subtitle box so the kicker stays visible. Align the portrait results to one content column and full-width actions; challenge stats use a complete six-tile grid (Shots replaces inapplicable Great Saves), and Goals shows the challenge target. Types/lint and 31 Free Kick rules/panel/API checks pass. New source-only WebGL UI check verifies illustrated help, text fit, raised unboxed feedback and results alignment at 320x480, 390x600 and 844x390; screenshots inspected. No application build or live Reddit writes performed.

**Post-match community prompt (2026-11-11):** add an optional themed Join Community / Continue to Results dialog before normal match results (Classic, Custom/Casual and Daily) and Free Kick ranked/challenge results. Wide layout with side-by-side actions for normal matches; portrait card with stacked actions for Free Kick. Practice has no completed-match screen. Results save in the background and remain hidden/inert until dismissal. Explicit trusted Join click requests native user consent then POSTs the current-community subscription API; deny/error leaves Continue available. Add SUBSCRIBE_TO_SUBREDDIT permission. Remember confirmed joins in device storage scoped to user/community; SDK cannot detect memberships created earlier/outside the game, so those users may still see the prompt. Continue never claims membership. Support Escape, focus containment, cleanup, reduced motion and short-height scrolling. Types/lint and focused mocked Hono/Chromium checks pass (portrait/landscape fit, consent, failure/retry, join suppression and account isolation). Existing full Free Kick flow harness stops at its stale START label (current controls say PLAY), before results; this is not claimed as a passing check. No application build or live Reddit joins performed.

**Main merge (2026-11-11):** fast-forwarded `codex/tactics-help-buttons` through `99bfe78` into main at the user’s request. Includes shared live/info tactics buttons, active-state synchronization and the revised below-Shoot layout. Types/lint and source-only touch/desktop preview checks passed. Join-community popup is not implemented: existing membership detection remains unresolved in the current SDK. No application build or deployment performed.

**Tactics below Shoot (2026-11-11):** group the shared tactics examples directly below shooting controls in the left column, under a TACTICS section heading. Arrange Attack / Normal / Defend side by side with two short explanatory lines below; retain desktop top-row numbers and the live active highlight. Expand both column tiles, tighten keyboard rows, and place report/data instructions below goalkeeper controls in the right column. Types/lint and temporary source-only touch/desktop preview checks pass; screenshots inspected. No application build performed.

**Consistent tactics help buttons (2026-11-11):** replace the cramped text-only tactics strip with the same 144x44 pixel buttons as live gameplay via shared TacticButton helpers. Show the current active highlight when info opens, explain each mode alongside its button and retain top-row keyboard numbers on desktop. Help examples are noninteractive while paused. Keep examples clear of Back/Play navigation; move report/data text inside the card and tighten desktop column spacing to reserve room. Types/lint pass. A temporary source-only Vite/Chromium preview verifies touch and desktop button bounds, noninteractive examples and no horizontal/navigation overlap; screenshots inspected. No application build or live Reddit writes performed.

**Main merge (2026-11-11):** fast-forwarded `codex/minor-package-updates` through `ffaeb0e` into `main` at the user’s request. Includes visible tactics controls help, adaptive opponent tactics and compatible patch/minor dependency updates. Existing types/lint, compatibility, gameplay, Free Kick/Daily and source-preview checks pass. No application build or deployment performed.

**Patch/minor package updates (2026-11-11):** update Devvit analytics/start/web/CLI together to 0.15.3, Hono 4.13.17, Hono Node server 2.1.6, Vite 8.3.8, typescript-eslint 8.72.2, Playwright 1.65.0, globals 17.14.0 and minimatch override 11.0.7. Regenerate the lockfile and install; retain the glob compatibility patch. Phaser 3.90.0, TypeScript 6.0.3 and Node 24 typings remain on their current major versions. npm outdated now lists only those three major upgrades, npm ls reports a consistent tree. Types, lint, dependency compatibility, 72 gameplay checks, 31 Free Kick checks/panels/API, Daily regressions and source-only WebGL live-preview browser checks pass. Unit runner finds zero tests. No application build or deployment performed.

**Opponent match tactics (2026-11-11):** opponents select Attack when trailing, Defend when leading in the last minute/final 30% (whichever is shorter), and Normal otherwise. Require three seconds of stable intent and at least twelve live seconds between switches. Selection time freezes during stoppages, frozen kickoff and pause; fresh matches reset to Normal. Apply the mirrored manual formation offset plus attacking/defensive passing and pressing plans; Normal restores the last applied baseline Daily/standard plan. Preserve Daily plan reaction timing and Rampage difficulty progression, home manual selection, existing movement and accuracy. Selection reads only score/clock, never player tactics or input. Types/lint, 72 gameplay checks and Daily rules/forms regressions pass. No application build or browser playtest performed.

**Visible tactics controls help (2026-11-11):** replace the two long tactics footer lines with a dedicated three-column highlighted tactics strip on the normal match info controls page, showing each mode and its formation effect. Desktop Controls/key bindings now explicitly list fixed top-row 8 Defend / 9 Normal / 0 Attack and explain that these are not numpad keys. Attempted remapping to those keys explains the reserved shortcuts. Types and lint pass; no application build or browser playtest performed.

**Main merge (2026-11-11):** fast-forwarded `codex/match-tactics` through `4ce0ed5` into `main` at the user’s request. Includes manual Attack/Normal/Defend tactics, top-row shortcuts and feedback/help, plus exact 8%/15% possession speed penalties. Types and lint pass; the tactics change passed 71 logic checks. No application build or deployment performed.

**Dribbling speed penalties (2026-11-11):** normal movement with the ball is 202.4 units/s (8% below 220), sprinting with the ball is 280.5 units/s (15% below 330). Shared player movement applies these values to human and AI carriers. Off-ball speeds remain unchanged.

**Manual match tactics (2026-11-11):** right-side Attack / Normal / Defend selector, Normal selected by default, active green state and marker, plus brief rising/fading mode feedback. Top-row Digit8 / Digit9 / Digit0 select Defend / Normal / Attack; reserve those keys from action remapping. Tactics are blocked/hidden in pause and info overlays. Home outfield formation targets shift forward so the back line reaches halfway in Attack, or back 16% of pitch length in Defend; normal targeting is preserved, positions remain clamped, players move naturally and the human/keeper remain under their existing control. Selection survives kickoff and automatic Daily style changes, resets on a new match, and never changes opponent AI. Controls page explains positioning and shortcuts. Types, lint and 71 logic checks pass, including every formation across attack/defend/loose phases. No application build or browser playtest run.

**Free Kick posts: Challenge settings chosen by the post's creator; only Challenge and Practice (2026-11-11, `main`, uncommitted; user request).**
- **Post form** (Create Street Soccer match > Free Kick): kicker's and wall's team colours (any two different kits), lives (1-10), goals to win (1-20), shot distance (20 / 25 / 30 / 35 m), wall distance from goal (6-26 m, every 2 m; must be at least `challengeWallGapM` 9 m in front of the shot distance) and difficulty (noob-pro). Saved as postData `freeKick` (`shared/freeKickChallenge.ts`: type, `parseFreeKickChallenge`, `postFreeKickChallenge` with `FREE_KICK_CHALLENGE_DEFAULT` for older posts: pink vs blue, 3 lives, 5 goals, 25 m, wall 14 m, normal). Invalid answers reopen the form with the reason (same kit twice, wall too near the ball).
- **Lobby:** CHALLENGE and PRACTICE only. The ranked PLAY button and the card's leaderboard are gone (the `freekick` entrypoint, its server routes and boards still exist, unused by new cards). The card shows lives, goals to win, difficulty and distance, and a line with the wall distance.
- **Challenge rules** (replace "3 in a row from 5 kicks"): score the post's goals before its lives run out (`challengeOutcome`); every miss costs a life (no great-save exemption) and retries the spot. Each goal starts a new round (`challengeKick`): a new angle, the spot within `challengeDistanceRangeM` 5 m of the post's distance (never nearer than `challengeNearestM` 15 m, never beyond `maxDistance` 37.5 m), the wall at the post's distance from goal along the shot line (pulled toward goal if that would leave under 9 m to the ball), and one level harder (`challengeRoundLevel`: from the difficulty's first level to its top: noob 1-3, easy 2-5, normal 3-7, hard 5-9, pro 7-10, `FREE_KICK.challengeLevels`). The level sets wall men, jump, keeper and the widest angle. HUD: `ROUND n LEVEL l  D M`, `GOALS g/t`, lives wrap to a second row past five. Results card: settings line, goals vs target, level reached.
- **Kits:** `startingConfig()` returns the post's kicker / wall kits as home / away on Free Kick posts, so early downloads, the game, Practice and the feed preview use them.
- **Checks:** `test:freekick` rewritten for the challenge (form fields and rejections, saved settings and defaults, round levels, spot and wall placement over every distance/wall choice). The browser checks (`freekick-post-browser`, `freekick-live-browser`) were updated for the two buttons but not run. Not playtested.

**Free Kick run-up fixed: facing, sideways travel, new first poses (2026-11-11, `main`, uncommitted; user: the kicker barely moved sideways, which made the shot look weird).**
- **New poses 1-2** of `player-freekick-authored.png` from the user's updated sheet (side-on set stance, first running stride), same scale (1.7546) and row ground as the rest; new splits for both.
- **Facing:** every pose in the strike sheet faces screen-left, but the kicker on the ball's right (the default) was drawn mirrored, so he ran in facing away from the ball. He is now unmirrored on the right and mirrored on the left (`flip = side < 0`; the preview, always on the right, is unmirrored). The left-curl flip at the strike is unchanged (relative to the run-up).
- **Path:** waits wider and less far back (`kickerStartBack` 56 to 44, `kickerStartSide` -40 to -60), and comes round in a curve: the sideways share leads (`runupShares`: side `1 - (1 - t)^runupSideLead` with `runupSideLead` 2, back `t^runupAccel`), so he travels across during the side-on poses and in during the back-view ones. After the strike he carries on `kickerFollow` 34 toward the goal (was: along the straight run line). The camera fits the new waiting spot, so the view may be slightly smaller.
- Not seen in a live game.

**Free Kick wall men animation (2026-11-11, branch `freekick-strike-animation`, uncommitted; user-supplied 4-pose sheet).** The wall no longer borrows celebration frames. New `public/art/player-wall-authored.png` (4 x 352 x 724 cells like idle): poses stand, crouch (take-off), in the air, crouch (landing); scaled 1.134 so the standing pose is as tall as idle (643 px), head centred, every pose's boots on ground 681 (the source's own small lift dropped). Plain `waist` / `shortsEnd` per pose (398/450/400/427, 505/525/495/515), `outfieldOnly`. `WALL_FRAMES` (`wall1`..`4`); atlases now 114 frames (15 rows, 1792 x 1920, still under 2048). Release art 4.00 MiB (pink 326 KiB).
- **Stage:** `Figure.draw` takes an optional `z` lift. A wall that jumps shows wall2 from the strike, wall3 in the air, wall4 for the landing (until `wallLandUntil` 1.3 of `wallJumpSec`), switching at `wallAirFrom` 0.15 / 0.85 of the jump; it is lifted by `wallTop(wall, t) - wallHeight` (16-24 px at the top), so the head is where the rules' reach is. A wall that stays down stays in wall1. The feet are drawn lower than the rules' `wallFeetLift` 40, so a shot slipping under may look like it clips the boots; the frame's baked shadow rises with the man. Not seen in a live game.

**Free Kick strike: one sheet for both curls, mirrored at the shot for left curl (2026-11-11, branch `freekick-strike-animation`, uncommitted on top of 807f674; user request).** The user supplied a second 12-pose sheet as the right-curl strike and asked to play it mirrored from the moment of the shot for left curl. It replaces `public/art/player-freekick-authored.png` (same cut: scale 1.755, head centred, row's lowest boot on 681; the first four poses match the earlier sheet), so frame names, atlas size and code paths are unchanged. New poses: 1 set, 2-3 turn, 4-5 run, 6 backswing, 7 strike, 8-9 follow-through, 10-11 recover, 12 stand. Splits re-read (only pose 4's raised leg needs `socksAlso`). `kickerFrame(run, play, curlLeft)` now returns `{ frame, mirror }`: `mirror` is true from pose 7 on when the kick curls left (the rules' `strike.contact.x > 0`, which also covers a curved swipe). The sprite's flip is `side > 0` (mirrored on the ball's right) XOR `mirror`, so the strike always turns the other way from the run-up for a left curl; the goal celebration keeps the run-up's flip. The feed-card preview cycles left / straight / right kicks, so it shows both. Release art 3.86 MiB (pink 313 KiB). Not seen in a live game.

**Free Kick strike animation (2026-11-11, user-supplied 12-pose sheet):** the free kick taker now uses his own animation instead of the run up-diagonal / run up poses. New `public/art/player-freekick-authored.png` (4 x 3 cells of 640 x 724, the usual layout): poses cut from the transparent WebP, one uniform nearest-neighbour scale (1.752, the source's median figure height to the run sheet's 625.5 px), head centred in each cell (clamped inside it), the lowest boot of each source row on ground 681. Per-pose `splits` read off a shirt / shorts / socks preview, with `socksAlso` for the raised kicking legs (poses 4, 6, 9). `FREEKICK_FRAMES` (`freekick1`..`12`) are `outfieldOnly` (keeper atlases skip them). Atlases now hold 110 frames (14 rows, 1792 x 1792). Re-baked with `art:bake` and `optimize_art.py`: each outfield kit WebP grew 45-55 KiB (pink 251 to 306 KiB), keepers unchanged; release art 3.79 MiB. Checked baked in blue, red and white kits.
- **Use (`freekick/kickerFrames.ts`, shared by the scene and the feed-card preview):** pose 1 (set, facing the camera) while aiming; poses 2-7 spread over the 0.55 s run-up (turn, run, plant); after the strike 8-12 (contact, follow-through, recover, stand) at `FREE_KICK.strikePoseSec` 0.1 each, then pose 12 holds. A goal still switches to the celebration after 0.3 s. Unflipped the sheet is a right-footer on the ball's left; on the right he is mirrored, as before.
- Not seen in a live game (no browser gameplay tests, per the user). Note: the source draws the last back-view poses about 10% taller than the first, which the uniform scale keeps.

**Free Kick: angled camera, cinematic flight, result animations, Challenge (2026-11-10, branch `freekick-cinematic`, not merged, uncommitted; user request: the view was square on to the goal, the wall behind the goal looked wrong, ball flight / trail / swipe path looked off, wanted goal and miss animations with sound, and a "3 in a row from 5 kicks" challenge). Sprites and the ball art are untouched (the user will supply new ones).**
- **Camera (`KickCamera.ts`, tuning `FREE_KICK.camera*`), second pass the same day:** the first angled camera (340 back, 235 high, 15 degrees round, everything framed small) was rejected by the user as awful; they supplied four reference shots of mobile free-kick games (`claude-ss/`, untracked). It now copies those: low and close (`cameraBack` 290, `cameraHeight` 128, `cameraPitchDeg` 1.5; lowered and levelled at the user's request: 158 / 5 looked like watching with a bent neck), swung `cameraOrbitDeg` 7.5 to the left of the shot line and turned (a real yaw) to look 80% of the way to the goal. The kicker stands to the ball's right, big in the foreground and drawn mirrored (`kickerStartSide` / `kickerContactSide` are negative; `Stage` flips his sprite), clear of the left controls; the wall is large in front of the goal, which is up and to the left; the chalk runs at an angle. The swing is the same from every spot, so left, centre and right kicks share the composition. Framing: the ball at `ballScreenX` 0.52 / `ballScreenY` 0.76, crossbar no higher than `barScreenY` 0.2, focal length capped so both posts stay `cameraEdgePx` inside the view. `nearX()` gives the lowest ground x in view (replaces `cam.x + 150`). The feed card's live preview uses the same camera.
- **Goal clear of the power slider, and a SIDE switch (later the same day; the user's screenshot showed the slider covering the goal's post, and they asked to be able to swap the players' side):** the goal is framed `cameraControlsPx` 150 inside the edge that holds the controls (the view shows more, so everything is a little smaller on narrow phones), and the ball slides between `ballScreenX` 0.5 and 0.66 of the way across, only as far as the goal needs. A SIDE button under pause (`switchSide`, aiming only, kept in localStorage `street-soccer-freekick-side`) moves only the kicker, to the ball's left (unmirrored sprite) and back; the camera and controls do not move (the user asked for that after first mirroring everything). `freeKickControls` and `KickCamera.frame` still take an unused-by-the-scene `side` argument, default 1. On the left the kicker can sit partly behind the power slider. The user also set `cameraHeight` 105, `cameraPitchDeg` 3.5, `cameraOrbitDeg` 10, `cameraLookAt` 0.72 and `cameraEdgePx` 24 by hand: those are the current values, whatever the bullet above says.
- **Curved swipes are the ball's path (later the same day; the user drew a curve to the right and the ball went straight, then right):** the swipe used to give only a heading (the line between its ends); curl came only from the ball dot, and a curling ball was launched at the aim point and then bent away from it. Now `rules.ts` `swipeBow` measures how far the swipe bends off that line (share of its length, sign = side) and `curvedStrike` turns a bend of at least `swipeBowMin` 0.05 into curl (full at `swipeBowFull` 0.28, replacing the dot's side; its chip / low-drive height stays) and turns the launch heading so the curling ball still crosses the goal line where the swipe pointed. Both sides read alike. Straight swipes are unchanged, so a dot-only curl still bends away from the arrow, and xG (average kicks use the old strike) is unaffected. The launch arrow still shows the straight aim, not the curve.
- **Diagonal run-up (later the same day, user request: run in at an angle like a professional):** the kicker waits at the screen edge (back 62, side -46) and runs to a plant beside the ball (back 4, side -17), about 27 degrees off the shot line, over `runupSec` 0.55 (was 0.3; the server's minimum-run-time estimate uses it too) with `runupAccel` 1.5 (speeding up) and the diagonal run cycle twice over the run; after the strike he carries on `kickerFollow` 34 along the same diagonal, easing to a stop (it used to go straight along the shot line). A wider start (side -78 and out) was tried: on this close camera he is then fully off screen while aiming, so the angle is limited by what stays in view. While aiming he is half cropped by the right edge.
- **3D goal, no walls behind it (later the same day; user: the goal looks 2D, remove the walls behind the net):** the brick recess behind the net is gone, and so are the brick end walls either side of the goal (visual in `Stage.buildCourt`, and the end-wall bounce in `rules.ts` `stepPlay`, so a wide ball now just crosses the line, ends as wide / over / post and rolls on; an over-the-wall-height ball outside a post now reads 'over' instead of 'wide'). The far end shows the facade only, standing on the ground (no brick base). The goal is drawn as a box: a darkened back, side and roof panels, thinner white rear posts, rear crossbar, ground bars and roof rails (`Stage.drawGoal`), and a stronger net. The Free Kick net is now `FREE_KICK.goalDepth` 150 px deep (the match keeps `PITCH.goalDepth` 69; rules.ts `holdInNet` and the roof slope use the Free Kick value), because at 69 px the goal still looked flat from the centre and wide spots; the ball runs on deeper into the net after a goal (the outcome is decided at the line, so xG and points are unchanged). The long far wall along the touchline is unchanged. The match scene's end walls are untouched.
- **Ball dot = curl direction, from either side (user request, after the "foot follows SIDE" attempt was rejected; the user chose this rule):** the half of the ball you pick is the way it curls (left half curls left, right half curls right) whichever side the kicker stands (`FreeKickScene.footContact` mirrors the dot for the rules, whose contact point is physical: right side bends the ball left). The kicker would use the leg that reaches that half (right leg for the inside half, left for the outside); no sprite exists for it, so it is the same run and strike. CURL LEFT / RIGHT label and the green power guide follow. A curved swipe still curls the way it is drawn and overrides the dot.
- **Striker always in frame (user request; first a plain zoom-out, `cameraZoom` 0.8, which still cropped him on some spots):** `KickCamera.frame` now fits the kicker too: his waiting and plant positions on BOTH sides of the ball (so SIDE needs no camera move), with his sprite's half width (`KICKER_HALF` 28), must lie inside the view's edges, and the focal length is capped to make that so. `cameraZoom` is back to 1 (a spare extra zoom-out). The cost: on a narrow phone the goal and wall are about a third smaller than before, since goal, ball and kicker have to share the width beside the power slider; the left-hand kicker can sit partly behind the slider.
- **Aim:** `aimAtGoalLine` takes each goal-line point's camera distance (`d`) and corrects for perspective, so the arrow and the shot still agree. The goal is now up and to the left of the ball, so a straight-up swipe aims toward the right-hand post. Labels and help say "swipe at the goal".
- **Behind the goal (`Stage.ts` `buildCourt`):** the goal stands in a brick recess closed just behind the net (`RECESS_X`, shaded end-wall texture, coping on top), so the view through the net is a shadowed wall, not the car park. A night-sky gradient and a taller, darker far skyline (the facade texture, 2.6x, 900 px beyond the street end) fill what the wider view shows above the buildings.
- **Draw order:** people sort by `-x` and then by camera depth, so the wall's men overlap correctly from the side.
- **Flight (looks only; the flight model in `rules.ts` is unchanged, so xG, points and the 25 older rule checks are unaffected):** play speed is eased (`timeEaseRate`), never cut: it dips to `approachScale` 0.6 for the last `approachSec` 0.16 s before the goal line (the save or finish) and to `slowMoScale` after a goal. The push-in is `flightZoom` 1.22 over `flightZoomSec` with a smooth start, about a point beyond the goal so the goal moves toward the middle and stays in view (`flightCentre`). The ball's spin frames change at most 30 times a second (as the match).
- **Trail and swipe path (`ribbon.ts` `drawRibbon`, `smoothLine`):** both are one continuous strip with shared joint normals (the old per-segment quads left gaps and darker overlaps), tapered and faded toward the tail, with a round head. The flight trail is additive (glow, streak, core), reaches the ball as drawn between sim steps, and fades out fully `trailFadeSec` 1.1 s after the result (it used to stay at 35%). The swipe is corner-smoothed twice; the launch arrow's shaft tapers.
- **Result animations (`resultFx.ts` `ResultFx`, replaces the banner text):** goal: white flash, a slanted plate wiping across, the title slamming in and stretching GOAL! to GOOOAL! (the match's outline and blue / pink offsets), confetti from both bottom corners, the existing shake and `goal` sound. Miss: tinted flash, the title dropping onto its plate with a bounce and a shudder, a small shake and the `goal-miss` sound. Points / xGOT / tags sit on a dark plate under it. All drawn from the result's age (pauses with the game, nothing survives a restart); reduced motion shows the static plate only. It sits at 64% of the height so the goal stays visible. `resultSec` 1.6 -> 1.9.
- **Challenge mode (new entrypoint `freekick-challenge` -> `freekick-challenge.html`, CHALLENGE button on the Free Kick card):** score `challengeStreak` 3 in a row within `challengeKicks` 5 kicks, every kick at `challengeLevel` 3. Every kick uses one of the five (shown as the ball icons); a miss retries the spot and resets the streak; there is no great-save exemption. `rules.ts` `challengeState(streak, kicksLeft)` ends it: won on the streak, lost as soon as the kicks left cannot complete one (goal, goal, miss = lost). Points are the normal xG x xGOT x streak points. The result card says CHALLENGE COMPLETE / FAILED with points, goals, xG and finishing. Unranked: no run start, save, boards, sharing, device best or play metrics.
- **Checks:** types, lint, `test:freekick` (28 rule checks: new challenge, angled-aim and curved-swipe ones; panels; server), unit, logic (70) and the production build pass. `freekick-post-browser` and `freekick-live-browser` pass with Chrome (`CHROMIUM_PATH`). `freekick-flow-browser` fails on `main` too ("Missing button START", stale since the UI commit `923d049`). Looked at in headless Chrome at 390x844 and 1280x720 from source and from the build: three spots, flight, goal and miss animations, swipe, the challenge start to a failed card, the won card, the feed card at 320 and 390 wide. Not playtested on a phone: the aim feel with the goal off to the right, the slow-motion dip and the challenge difficulty need a real try.

**Free Kick xG scoring (2026-11-09, on `main`, uncommitted):** `rules.ts` `SpotXg` / `spotXg`, `shotXgot`, `retryXg`, `goalPoints`, `greatSavePoints`, `streakMultiplier`; tuning under `FREE_KICK` (`pointsPerXg`, `xgSamples`, `xgStepSamples`, `xgotSamples`, `xgMin` 0.01, `xgMax` 0.5, `xgRetryScale`, `xgRetryMax`, `finishBase`, `greatSaveXgot`, `greatSavePoints`; `bonusPoints` removed). Measured spot xG: about 0.12 at level 1, 0.06 at 4, 0.03 at 8, 0.01-0.02 at 10, so goals are worth roughly 50-110 early and 300-1,500 late. `shared/freeKick.ts` adds `greatSaves` and `xg` (hundredths) to `FreeKickStats`, both optional for older runs; shots = goals + lives + great saves; per-goal bounds `freeKickGoalMin` / `freeKickGoalMax`. The Fastest Goal board is unchanged. Not playtested: check the xG ... -> value delay on a phone and whether xGOT numbers feel fair.

**Playtest feedback fixes (2026-11-09, on `main`, uncommitted):** beaten human no longer suppresses the AI presser (`ai.ts` `pickPresser`); SWITCH on the opponent's ball prefers goal-side teammates (`playerSwitch.ts` `switchOrder`); PASS/TACKLE button enlarged to the SHOOT button's size (`ActionButtons.ts`). Still open from the same feedback: the joystick base is clamped 124 px from the left/bottom edges, so a thumb landing near the corner reads as a push (`Joystick.ts` `onDown`); and nothing explains that opponents jockey at walking pace (help text).

**Main merge (2026-11-09):** fast-forwarded `movement_changes_main` through `50446b2` into `main` at the user's request. It brings in the smoother sprites and legs (`68dab02`), the playtest note (`e696a11`), and the back line, poke/slide tackles, sweeper keepers and smoother AI steering (`50446b2`). Types, lint, logic (69) and the build passed before the merge. Not playtested on a phone yet.

**Defence lines, two tackles, sweeper keepers, smoother AI steering (2026-11-09, branch `movement_changes_main`, not merged; user request: movement and gameplay still not smooth enough, CPU defenders crowd their box, tackling is one-dimensional, keepers (both sides) should come out without conceding, scoring must stay fair both ways, harder levels should tackle and chase more):**
- **Back line (`ai.ts` `lineDepth` / `notDeeper`; `AI.lineBehindBall` 190, `lineMin` 150, `lineMax` 420):** defending, zones and the cover defender hold a line a little goal-side of the ball and never drop deep into the box; markers follow their man down to `lineMin` only. Nobody marks an opponent right by the ball (`AI.markFromBall` 190: the presser and cover have him). The cover defender is dropped when it would stand under `AI.backupMinGap` (now 200, was 120) from the carrier, so near the box the line covers. The Hard/Pro near-goal compaction (`dangerSpacingScale`) is removed: every level keeps `AI.mateMinGap`.
- **No goal-hanging:** attacking runners (give-and-go bursts too) stop `AI.runnerDepth` 170 short of the goal line, other supporters `AI.supportDepth` 380.
- **Two tackles (`tackle.ts`, `TACKLE.poke`), human and AI:** TACKLE with an opponent's ball within `poke.range` 60 px is a standing poke at the ball (quick, short reach, nobody falls). A clean win from the front rolls the ball to the tackler; otherwise it is deflected 30-75 degrees off to one side. A miss leaves the tackler off balance for 0.3 s on its feet. Further away it is the slide as before, but 30% of won slides now knock the ball loose for anyone (`looseShare`). Both get up to +20% against a carrier whose touch has the ball away from its feet (`exposedBonus`). The poke uses the shoot wind-up / contact / recover poses. AI pressers poke when the ball will be close and slide at a moving carrier from further (`LEVELS.slideShare` x the chance). They now read a straight-running carrier on (`readSec` plus the lunge) instead of lunging where it was: two thirds of AI slides used to touch nothing.
- **Harder levels press and tackle more:** new `LEVELS` fields `tackleCooldownSec` (noob to pro 1.6 / 1.3 / 1 / 0.8 / 0.65 s), `pressScale` (x the presser's gap: 1.15 / 1.07 / 1 / 0.9 / 0.82) and `slideShare` (0.4 / 0.45 / 0.5 / 0.85 / 0.6).
- **Sweeper keepers (CPU by level; ours at normal):** with play far away the keeper stands `LEVELS.keeperSweep` off its line (60 / 90 / 130 / 150 / 165 px), dropping back to `KEEPER.maxOut` 60 as the ball comes within `outNearDist` 350 (it used to go from 30 px to 60 px, further out the closer the ball). It claims a loose ball up to keeperSweep beyond its box when first by `KEEPER.sweepClaimMargin` 0.3 s. Rushing out at a through carrier is capped by `LEVELS.keeperRushDepth` (90 / 130 / 190 / 210 / 230). Within shooting range it stays under `AI.chipKeeperOut`, so AI chips are no more frequent.
- **Smoother AI movement:**
  - The presser's and cover defender's spots glide (`AI.activeEaseRate` 8/s) instead of jumping at each think.
  - Every role but the chaser has a start deadband (`activeRestartDist` 22, calm jobs `restartDist` 45).
  - The chaser's meeting point slides continuously (`interceptPoint` interpolates between prediction steps).
  - Standing players and keepers turn to the ball at `PLAYER.pivotRate` instead of snapping.
  - Legs switch between run and idle with hysteresis: start above 14 px, stop below 6.
- **Measured** with a headless simulator: a scratch tool outside the repo, with a scripted human in our team, 40-60 matches per level. Goals per match, human-CPU, before -> after:
  - Normal: 3.60-1.02 -> about 3.1-3.4 / 1.0-1.4.
  - Hard: 0.45-3.67 -> about 0.9-1.0 / 3.0-3.4. Old Hard was nearly as hard as Pro; it now sits between Normal and Pro.
  - Pro: 0.30-3.98 -> about 0.4 / 4.5.
  - Near the CPU box, defenders within 150 px of the carrier went from about 1.67 to 1.5, and "3+ within 250 px" from 69-77% to 60-66% of the time.
  - CPU tackles that touch the ball went from 35% to about 75%.
  - The menu's AI-vs-AI demo scores less than before (about 0.8 a side at normal, was 1.5).
- **Help:** touch help says "CLOSE: POKE  FURTHER: SLIDE", desktop "TACKLE: POKE OR SLIDE".
- **Checks:** types, lint, logic (69; new: poke outcomes, AI tackle kind, back line, no goal-hanging, keeper sweeping, difficulty table) and the build pass. Not playtested on a phone.

**Smoother match movement (2026-11-09, branch `movement_changes_main`, not merged; user request: 5v5 movement felt choppy, wanted eFootball / EA FC Mobile smoothness):** the choppiness came from how sprites were drawn, not from the simulation (the fixed 60 Hz step with render interpolation and the smooth-damp camera were already right). Match only; Free Kick keeps its look.
- **Filtered player and ball textures:** a `smooth sprites` step at the end of `PREPARE_STEPS` (`gameAssets.ts`) sets LINEAR filtering on `PLAYER_ATLAS_KEYS` (kit atlases plus the skin and hair layers), the ball and its shadow. Players are drawn at about 82 px from 128 px frames and the ball at about 20 px from 64 px, at sub-pixel positions, so nearest sampling picked a different set of art pixels every frame (shimmer). Court, scenery and HUD textures stay nearest.
- **Smooth canvas scaling:** `#game canvas` in `style.css` no longer has `image-rendering: pixelated`. The 1280x720 canvas is scaled by a non-integer factor (about 1.6 device px per canvas px on a 3x phone), and nearest scaling moved everything in uneven 1- and 2-pixel steps. HUD text looks slightly softer. The Free Kick stylesheets keep pixelated.
- **Legs follow the ground actually covered:** `Player.render` drives the run cycle from the distance moved per step, smoothed over `MOVED_SMOOTH_SEC` 0.08, not from the intended speed: a player held back by another body no longer runs on the spot. The stride rate never drops below 0.6 of the authored rate (`MIN_STRIDE_RATE`; slow positioning used to play the 4- and 6-pose cycles at 2-4 frames a second).
- **No leg hitch when the run changes:** run, sprint and view runs all cover a half-second stride, so `Player.playStride` starts the new cycle at the same point of the stride instead of on its first pose (turns, sprint on/off).
- **Ball spin cap:** the rolling frames change at most 30 times a second (`MAX_ROLL_FPS` in `Ball.ts`); a hard pass flipped them 60+ times a second, which strobed against the screen refresh.
- **Frame pacing readout:** the debug overlay (tap the FPS readout) adds `FRAME x MS SLOW n/m WORST y MS`: the typical (median) frame time, how many of the last 600 frames took over 1.5x that (missed screen refreshes) and the worst gap.
- **Generated in-between poses: tried, not shipped.** Optical-flow in-betweening (OpenCV DIS and Farneback, forward splatting) of the four-pose view runs and the ball frames ghosted badly where the limbs cross, so no poses were added. Smoother legs need more authored poses (see Next up).
- **Checks:** types, lint, unit, logic (62), Free Kick (23), privacy, games, speed, Daily, journeys and the production build pass. `test:dependencies` fails on Windows on `main` too (glob assertion at `checks/dependency-check.mjs:72`), so `test:local` stops there; not caused by this branch. Not playtested on a phone yet.

**Main merge (2026-11-08):** fast-forwarded `codex/freekick-preview-consistency` through `243d418` into `main` at the user’s request. Includes the shipped blank-preview fix, shared match-card action styling and compact leaderboard footer with an ALL sheet. Existing types, lint and source-only browser checks pass; no application build or Reddit deployment performed.

**Free Kick preview cleanup (2026-11-08):** fix the blank shipped preview: `Phaser.Math.Linear` is absent from `tools/phaser-trim.cjs`; interpolate the kicker positions directly. Reuse normal-match responsive Play/secondary button styling, header spacing, settings row and gradient layout. Replace the LIVE badge with the life count, condense mode copy and move both leaderboard tabs/full results into an ALL sheet with close, Escape and focus handling; the feed shows the same compact seven-day Top 3 footer. Source-only WebGL checks deliberately remove Linear to reproduce the shipped API and verify repeated shots, four viewport sizes and off-screen sleep/resume. Types, lint, feed DOM checks and the full Free Kick intro/results/sharing/pause/Practice browser flow pass. Screenshot inspected at 390x600. No application build or live Reddit writes performed.

**Main merge (2026-11-08):** fast-forwarded `codex/freekick-results-boards` through `2a1b719` into `main` at the user’s request, including the live Free Kick feed preview, two-page intro, results/sharing, dedicated score/speed boards and pause Quit. Existing type, lint, logic, API and source-only Chromium checks pass. No application build or live Reddit deployment performed.

**Free Kick intro, results and records (2026-11-08):** default to paused Match Details → Controls → Start, with both pages available from info/pause and a trusted native Quit link. Completed Play runs show a responsive run summary, optional native score-sharing confirmation and dedicated per-post seven-UTC-day Highest Score/Fastest Goal boards on results and feed cards. Capture launch speed at strike and count only scored goals; Practice, previews and quit runs stay unranked. Server validates terminal run statistics, launch bounds, registered start timing and immutable completion; concurrent best-only board writes reuse WATCH guards. Receipts and both board types join existing privacy retention/erasure and post deletion. Score-only shares reply to pinned Scores; personal comments post as USER. TypeScript, lint, 23 Free Kick rules/control checks, scene panels, mocked Hono/Redis API checks and source-only Chromium flows pass. Browser checks cover both intro pages, frozen mid-flight pause, results, both boards, native score confirmation/cancel, responsive sizing, replay and trusted Quit. Existing privacy, speed, Daily and 62 gameplay checks also pass. No application build or live Reddit writes performed.

**Live Free Kick post preview (2026-11-08):** replace static CSS artwork with a silent auto-playing Free Kick renderer using the real Stage, player art, ball physics, wall/keeper reactions and trails. Cycle demonstration attempts without player sessions, analytics, score writes or audio. Lazily create the preview when visible and sleep its loop off-screen/hidden; dispose it when the lobby is rebuilt. Match the normal post’s full-canvas preview, pixel heading/mode tag, dark gradient panel and Play/Practice button treatment. Frame the shot above the lower action panel. TypeScript, lint, 22 Free Kick rule/control checks and practice/panel regressions pass. Source-only DOM checks pass at four viewport sizes. Actual WebGL preview checks through a temporary Vite development server verify repeated physics-driven shots, mobile/desktop framing, off-screen sleep/resume, Play/Practice routes, no demo API/audio requests and unchanged best scores; Reddit host calls are mocked. Screenshot inspected at 390x600. No application build or live Reddit writes performed.

**Main merge (2026-11-08):** fast-forwarded `codex/standalone-freekick-posts` through `0224d90` into `main` at the user’s request. Includes standalone Free Kick post creation, dedicated Play/Practice feed actions and selected-level unlimited Practice. Existing type/lint/rules/posting/scene checks and mocked source-only Chromium checks pass. No application build or live Reddit deployment performed.

**Standalone Free Kick posts and Practice (2026-11-08):** add Free Kick to native post-type creation with title/description/flair only. Save its own post type without match settings or a normal Scores thread; reject normal match result submissions on these posts. The default feed entry detects this type and shows a dedicated Free Kick card with Play and Practice, without loading the normal match preview. Remove the Free Kick shortcut from normal match cards. Practice has its own registered expanded entry, level selection, unlimited same-spot retries, fixed difficulty and Pause → New Spot; no normal best-score writes or normal run telemetry. Existing Play retains lives, progression and device bests. TypeScript, lint, 22 Free Kick rule/control cases, practice/panel scene checks, Daily posting/leaderboard checks and all 62 gameplay logic checks pass. Source-only Chromium checks verify safe descriptions, Play/Practice expansion targets and visible actions at 320x400, 320x480, 390x600 and 720x1100, plus forwarding the chosen practice level; SDK/game startup are mocked. No application build or live Reddit writes performed.

**Main merge (2026-11-08):** fast-forwarded `codex/freekick-info-pause` through `1c4bc49` into `main` at the user’s request. Includes Free Kick info/pause icons, portrait instructions and safe pause/help/resume behaviour. Existing TypeScript, lint, 20 Free Kick checks and actual-scene panel logic checks pass. No application build/browser checks or deployment performed.

**Free Kick info and pause (2026-11-08):** add normal-match-style info/pause icons beside sound, with life icons shifted left to avoid overlap. A portrait navy info card explains current level/distance/lives, left power/contact controls, swipe shooting, wall/keeper reads, run rules and scoring. Pause offers Resume and How to Play; help opened from pause returns there, while direct help resumes. Escape/Tab mirror pause/info shortcuts. Both panels freeze simulation, phase time, camera/trails and tweens; clear active input; pause music; preserve state on resize; and avoid resuming music while hidden. TypeScript, lint, all 20 Free Kick rule/control checks and actual-scene pause/help logic checks pass. The scene harness injects display/audio stand-ins; no application build or browser checks run.

**Main merge (2026-11-08):** fast-forwarded `codex/freekick-left-controls` through `46ca4c4` into `main` at the user’s request. Includes fixed left-side power/shot-type controls, clear-pitch shooting swipes and a fading gesture trail. Existing TypeScript, lint and all 20 Free Kick checks pass. No application build/browser checks or deployment performed.

**Free Kick left controls and swipe trail (2026-11-08):** detach the ball-dot selector from the world ball and place a fixed ball control below the left power slider. Compact shot-style labels wrap within the left column. Clear pitch to the right accepts shooting swipes; gestures retain their starting control, so setting drags cannot fire shots and swipes preserve selected power/contact. Show a bounded sampled swipe trail with a short release fade; retain the launch arrow on the actual world ball. Clear gesture/trail state on retry/new kick, resize, cancellation and hiding, and remove resize/visibility callbacks on shutdown. Replace the bottom boxed pad with a simple swipe instruction. TypeScript, lint and all 20 Free Kick rules/control checks pass. No application build or browser checks run, as requested.

**Free Kick controls (2026-11-08):** The contact frame over the ball sets shot type, the left slider sets power and a separate pad below the ball starts the shooting swipe. An upward swipe shows a straight launch arrow and highlights the pad when the shot is ready to release. Gestures stay with the control where they start. The retry retains the selected settings and the orange power tick. Types, lint, production build and all 18 Free Kick rules checks pass. Headless Chromium checked the gesture boundaries, launch direction and trail reset at two phone sizes with touch and at desktop size with a mouse.

**Desktop key bindings (2026-11-08):** The desktop pause menu opens a remapping panel for movement, sprint, shot/pass styles and match shortcuts. The defaults are WASD, either Shift, I/J/L/K for chip/curls/power, N/B/V/M for pass/lob/curls, Escape for pause, Tab for info and Space for mute. The panel applies edits immediately, rejects duplicate keys and restores defaults. Local browser storage remembers the layout across matches and reloads, and desktop help displays the active keys. Types, lint, production build and 61 logic checks pass. Mocked Chromium verified desktop editing, reload, reset, all four pass keys and the touch-only pause menu.

**Forgiving keeper pressure (2026-11-08):** Noob covers a dribbler's lane from 90 px off the goal line and reads the actual ball within 110 px. Easy uses 130 px for both. The lane depth also caps how far the keeper rushes out. Normal through Pro retain 170 px lane coverage and a 150 px smother read that can anticipate the ball's path. The match simulation shows a near-post sprint can beat Noob after the keeper is pulled across, while Easy and Normal smother the same run. Central runs are smothered at all three levels.

**Keeper difficulty timing (2026-11-08):** Separate base delays for dribbles and shots. Noob through Pro use dribble delays of 0.30 / 0.22 / 0.19 / 0.15 / 0.12 seconds and shot delays of 0.68 / 0.55 / 0.40 / 0.32 / 0.26 seconds. Easy closes down a straight dribble faster and gives a shot a longer reaction window. The player's AI keeper uses Normal. The keeper and Chaos logic checks, types, lint and production build pass.

**Chaos bot balance (2026-11-08):** Power Surge bots move closer under reduced power and check their chosen charge against the real shot flight. They adjust if it would stop short or go over the bar. Goal Resize bots read lanes from the ball, use the smaller opening to judge placement and aim error, and adjust shot height for the lower bar. AI keepers cover wider goals earlier and have extra reach on airborne saves in taller goals. Gameplay regressions cover both teams at 50% and 150% power, Easy finishing at 50% goal size, and high and wide saves at 150% goal size. Types, lint, the production build and all six mocked Chromium Chaos scenarios pass. Live balance review remains pending.

**Free Kick wall and keeper variety (2026-11-08):** Two of the gameplay improvements from the Free Kick review.
- **Wall:** it no longer always jumps. At the strike it jumps with `wallJumpChance` (85% at level 1 down to 60%) and otherwise stays down, unseen until then.
  - A jumping wall's feet rise up to `wallFeetLift` (40 px). A ball wholly below them goes under, if it was driven (slider power at least `underWallMinPower` 0.15). A softer roller meets the men's boots as they land.
  - At higher levels a man may lie behind the wall (`wallLyerChance` 0 to 40%, visible before the kick; drawn with the lying hurt pose). He stops low balls along the wall's span, and with him the wall always jumps.
  - New tag UNDER THE WALL (+50).
- **Keeper:**
  - Some keepers visibly cheat toward the wall (`keeperCheatChance` 15 to 35%, 0.35 more of the open part).
  - Some guess a corner at the strike (`keeperGuessChance` 10 to 30%, unseen): they drift there at 230 px/s from 0.08 s and read the real shot 0.1 s later.
  - Its read now allows for part of the curl and dip (`keeperCurlRead` 0 at level 1 up to 0.6).
- **Hints:** the aim hint names a lying man or cheating keeper. Retry tips explain a wall that stayed down, the lying man, the under-wall option and a right guess.
- **Checks:** `test:freekick` has 18 checks (6 new: under the jumping wall but not a standing one, the lying man, variety by level, the cheating stance, the guess drift, the curl read).
- Not playtested.

**New side run and sprint animations (2026-11-08):** Two user-supplied sheets replace and extend the side-on running:
- **Run:** six poses replace the old eight-pose `player-run-authored.png` (`RUN_FRAMES` = 6, `RUN_FPS` 12, the same half-second stride).
- **Sprint:** twelve poses in a new `player-sprint-authored.png` (`SPRINT_FRAMES`, `SPRINT_FPS` 24, same stride). `Player` plays it when sprinting with the side view. Up/down/diagonal views keep their four-pose runs at a fixed 8 fps (`VIEW_RUN_FPS`).

Both sheets were cut from their transparent WebP sources into the usual 640x724 cells, 4 per row. They use one uniform scale matching the old run sheet's median figure height (625.5 px), with the head and torso centred in each cell and the lowest boot of each source row on ground 681, so the authored bounce stays. Per-pose `waist` / `shortsEnd` lines were read from a ruler overlay, and a baked preview checked blue, white, red and keeper kits.

Atlases now hold 98 frames (13 rows, 1792x1664). Re-baked with `art:bake` and `optimize_art.py`: each kit WebP grew about 38 KiB (pink 214 to 250 KiB). The one-off cutting scripts lived in the session scratchpad and are not part of the repo. Not yet seen in a live match.

**Shorter receiver slowdown (2026-11-08):** `PASS.receiveHoldSec` halved from 1 s to 0.5 s at the user's request. A normal pass's intended receiver is held to 80 px/s with no sprint only for the first half second of the pass, or until the ball arrives. Through balls are still exempt. The passer's 0.08 s wind-up and 0.25 s regain lock are unchanged.

**Air pass: chip height, pass flight (2026-11-08):** The user wanted the aerial pass as high as a chip shot, but still an aerial pass to a teammate (a first attempt copied the chip shot's pace too, and was reverted the same day). The aerial pass (PASS swiped up, B key, or a held curl) now launches with the chip shot's lift, from `SHOOT.chipMinLift` for short passes up to `chipMaxLift` at `PASS.airFullDist` (800 px). Its pace is fitted, air drag included, so the first bounce lands at the receiver's lead spot, capped at `PASS.airMaxSpeed` (1300). Tap or hold, it goes to the receiver. The logic check confirms chip-range lift and a landing at the receiver for tapped and held air passes and for the aerial curl.

**Match info fills the card (2026-11-08):** After a second Reddit screenshot showed dead space: page 1 now sizes its team cards, stat tiles and objective to the room between the title and the buttons (more room when there are no Chaos/Rampage lines), with bigger team names, VS and tile values. Page 2 (desktop keys) lays each column out from a list of sections; spare height goes to the gaps between sections and then the rows, so both columns fill their tiles. Descriptions and notes line up just past each column's widest key cap instead of a fixed offset. Not yet re-checked on Reddit.

**How-to-play per device (2026-11-08):** The i button's page 2 now shows only keyboard controls on desktop (fine pointer + hover) and only touch controls elsewhere. Desktop lists every action as a navy key cap showing the current binding (remaps update it): move, sprint, N ground pass (hold sets pace), B air pass, V/M curl passes (held past half = aerial, tap = ground), chip/curl/power shots, tackle, switch, keeper dive/throw/kick, pause/info/mute. Touch spells out the PASS swipes (up air, down ground, left/right curl, hold hard = aerial curl). A separate Ground Pass key (C) was tried and removed at the user's request: N is both the normal and the ground pass. Saved layouts missing an action now load that action's default key (if free) instead of resetting everything; a logic check covers it. Types, lint, build and 62 logic checks pass; not playtested.

**Match info spacing fix (2026-11-08):** After a Reddit desktop screenshot showed overlaps and garbled small text: all info-page text now uses whole-pixel font sizes (2, 3, 4, 5, 7 px per font pixel); `fit()` steps the font size down instead of fractional scaling. Page 1 has taller team cards (caption, name, formation and start score no longer touch), a wider VS gap and taller stat tiles. Page 2 has bigger button discs (radius 44) so their labels are crisp, full-size THROW/KICK discs, tighter section spacing, and clear gaps between the panels, footer lines and buttons. Not yet re-checked on Reddit.

**Match info screens (2026-11-08):** The i button's two landscape canvas pages now share the full-time results card look (`ui/infoCard.ts`): navy card with a coloured top edge, mode tag and "MATCH INFO 1/2 · 2/2" in the header, kit-striped team cards, green stat tiles, orange primary and navy secondary buttons. Page 1 (match details) shows team cards with start score, tiles for time / difficulty / rule, the objective, and buttons START GAME (RESUME mid-match; skips how-to-play and kicks off) and NEXT; desktop adds CONTROLS, which opens key bindings and returns to page 1. Page 2 (how to play) keeps its content, now on two column tiles with BACK / PLAY MATCH. Not playtested.

**Aerial / ground passes (2026-11-08):** Slide up on PASS for an aerial pass: a chip whose lift grows with distance and whose pace is fitted (air drag included) to land at the receiver's lead spot, instead of the old low hop that rolled on. Slide down for a ground pass, which never auto-chips. Curl passes fly when PASS is held to at least `PASS.curlAirWeight` (0.5 charge) and roll on the ground when tapped or held lightly. Labels now read AIR / GROUND, and the overhead label shows AIR CURL or LOW CURL. New tuning: `PASS.airLoft`, `airMinVz`, `airMaxVz`, `airMaxSpeed`, `curlMin`, `curlAirWeight` (`lobVz` removed). The logic check now confirms aerial and hard-curl passes land at the receiver and ground and soft-curl passes stay down. Types, lint, build and 61 logic checks pass; not playtested.

**Pass swipes (2026-11-08):** Slide up on PASS to lob, down to drive on the ground, or left/right to curl. Swipe distance scales the effect and diagonals blend it. The joystick still chooses the ringed teammate and holding sets the base pace. The button and overhead label show the selected effect. Types, lint, the production build and match, Daily and Free Kick logic pass. Simulated touch input on the built canvas confirmed all four swipes and an ordinary tap, including receiver handoff.

**Match goalkeeper (2026-11-08):** AI keepers cover straight dribble lanes near the goal line and use one earlier, difficulty-scaled read of a carrier. They tackle a ball already in reach or dive ahead of the carrier. The regression reproduces a near-post walk-in with the previous keeper and covers both goals, three lanes and walk/sprint at Noob with the slowest reaction roll. Match logic, Daily and Free Kick checks, types and the production build pass. Live balance review remains pending.

**Post analytics (2026-11-08):** Added a moderator-only report on playable posts. It shows seven UTC days of aggregate Play taps, ready and load metrics, kickoff, first shot and home goal, completions, explicit quits, rematch taps and score-share actions. The copyable CSV groups by post, build, coarse device, mode and available match settings. Includes Classic, Daily, Custom and Free Kick. Types, lint, production build, gameplay and server regressions passed. Mocked Hono and Redis checks covered access, validation, CSV and post deletion. A mocked Chromium run verified readiness, completion, rematch and quit across Journey success and failure cases. Live Reddit verification remains pending.

**Free Kick mode (2026-11-05):** a new portrait game mode on its own expanded entrypoint (`freekick` -> `freekick.html`, code in `src/client/freekick/`). A green PLAY FREE KICK button under the lobby's play buttons opens it (`requestExpandedMode(event, 'freekick')` from the feed card; off Reddit it is a plain link). It uses the same street court, kits, keeper, ball, sounds and music as the match; no new art or downloads.
- Camera: behind the kicker on the goal-ball line, looking straight down the pitch so the goal faces it square on. Focal length and lens shift are solved per kick (ball 80% down, crossbar 25% down, goal at most 86% of the width), and it pushes in during the flight.
- Move the contact dot, set the power slider and swipe up to shoot along the swipe's heading. Side contact curves the ball away from that heading.
- The slider's green guide estimates wall clearance and bar height with the selected contact.
- The launch arrow appears during the shooting swipe. The yellow-green trail appears during the actual flight and is split into depth bands so the wall, keeper and frame cover it correctly. An orange tick shows the previous power on a retry.
- Wall: 2-4 men by level; it jumps.
- Keeper: reacts after a level-scaled delay (later when screened by the wall), cannot read curl or dip, shuffles, then stands, jumps or dives.
- Lives and scoring: 3 lives; a miss retakes the same kick with a tip. A goal scores 100 plus 50 per style tag (top bins, over the wall, curler, off the post, long range), times the streak multiplier. Level up every 2 goals; best score kept on the device.
- Checks: types, lint, unit, logic, the new `test:freekick` (12 rules checks), privacy, games, speed, daily, journeys and build all pass.
- Played in headless Chrome at 390x844, 360x640 and 1280x720: goals, wall blocks, saves, over the bar, the retry ghost and the results card all render. The lobby fits at 320x480 to 1280x720.
- Not done: no server code, leaderboard or Reddit playtest. Committed and pushed to `main` (2026-11-05).

**Main merge (2026-11-02):** fast-forwarded `feat/post-flair` through `c61061f` into local `main` at the user's request. Includes optional post flair selection/validation for all game creation forms and expanded handler tests. Prior strict changed-server types, lint, logic/Daily and form-handler checks passed. Preserve the existing uncommitted package whitespace edit. No push, build or deployment performed.

**Post flair in game creation (2026-11-02):** on `feat/post-flair`, add an optional Post flair dropdown to final Daily/Classic/Custom forms using the current community's templates (including moderator-only templates) plus No flair. Fetch again on submission, reject stale/malformed selections before posting and preserve valid selection on other validation retries. Apply the selected ID atomically through `submitCustomPost.flairId`, outside gameplay postData; installation posts remain unchanged. Empty/failed lookups provide explanatory help and allow no-flair posting. Strict type checks for the changed server files/import graph, lint/formatting, 55 logic cases, Daily rules/rankings and actual Hono form-handler mocks pass. Handler tests cover all templates/modes, no flair, retries, invalid/deleted IDs and lookup failures. Tests use the existing TypeScript transpilation workaround for missing Windows Rolldown binding. Full server types remain blocked by missing analytics imports in journeys/index. No live Reddit post, build, merge or deployment performed.

**Main merge (2026-11-01):** fast-forwarded `fix/desktop-preview-layout` through `dde3c58` into local `main` at the user's request. Full-width responsive desktop lobby controls and the existing-browser-suite width assertion are included. The 21 focused layout scenarios passed before merging. Preserve the uncommitted package whitespace edit. No push, build or deployment performed.

**Responsive desktop preview controls (2026-11-01):** on `fix/desktop-preview-layout`, remove the 580 px desktop controls cap so team/score, action buttons, game count and ranking use the full card width. Match header/control gutters and use bounded fluid desktop text/button sizes; the scrim now follows the full-width panel directly. Preserve portrait/short-height overrides. Rendered the actual `createMobileLobby` DOM and stylesheet in Chrome for Classic, Chaos and Custom at seven sizes (320–1920 px), including 875x640: panel/scrim widths, button bounds/labels, vertical fit and desktop gutter alignment pass. Reviewed the 875x640 render (`F:\code ball\output\desktop-preview-layout.png`); its neutral background isolates the UI. Add full-width panel assertion to the existing browser suite. No full application build, full browser suite or live Reddit test performed.

**Main merge (2026-11-01):** fast-forwarded `game-updates` through `87c5158` into local `main` at the user's request. Includes full-width desktop lobby gradient, outfield-only switching and secondary target marker, Custom display naming and the new desktop keyboard layout. Prior client types/lint, 55 logic cases, game-count and focused layout/renderer/keyboard checks passed. Existing local `package.json` whitespace edit remains uncommitted. No push, build or deployment performed.

**Desktop keyboard remap (2026-11-01):** WASD/arrows move, Left Shift holds sprint; N pass/tackle (keeper throw/dive); I chip, J left curl, L right curl and K power shot/switch (keeper kick). Space replaces I for match info/briefing, M shares the sound-button toggle, Escape closes overlays or pauses, Enter advances briefing. HUD shortcuts ignore repeat/duplicate events. Keep charge/release behavior and touch controls. Update help, README and the existing Chaos browser info shortcut. Client types, lint and all 55 logic checks pass, including actual Controls mapping/hold/release/sprint tests. Isolated real Phaser/Chrome keyboard checks verify shot keys and Left Shift, with a passing shortcut check for Space/M/Escape/repeats/no I conflict. No full application build or gameplay playthrough performed.

**Custom mode naming (2026-11-01):** rename player-facing Casual labels to Custom in preview buttons/tags, setup, briefing, results, moderator forms and API errors; update README and existing browser selectors. Keep internal `casual` mode/post/scene IDs, entrypoint and storage keys compatible with existing posts/preferences. Client types, lint, 53 logic cases and game-count checks pass using the existing TypeScript-hook workaround; no build or browser playthrough performed.

**Secondary SWITCH marker (2026-11-01):** add a smaller, thin, 45%-opacity light-gray dashed ground ring beneath the next eligible SWITCH target, with no disc, arrow, gauge or pulse. Hide when SWITCH is unavailable (possession, near-ball action buffering, kickoff, goal/fulltime) and in demos. Preview and button use the same read-only selection planner, including AI priority, lost-ball ordering, cycle expiry and repeated-tap wraparound; skip the current player and keepers. Client types, lint and all 53 logic checks pass; isolated actual-renderer checks cover eight arcs, depth and visibility states. Full gameplay visual review remains pending; no application build/deployment performed.

**Outfield-only switching (2026-11-01):** SWITCH never selects a goalkeeper: remove keeper entries from the candidate cycle, the incoming-shot keeper override and the held-SWITCH shortcut. Keep AI presser/chaser priority, interception ordering, cooldown and lost-ball chase assist. Keeper possession/goal-kick control remains available. Update help text and remove obsolete tuning/state. Lint and all 51 logic checks pass, including keeper exclusion and switching out of keeper control. Logic checks ran through TypeScript's CommonJS transpilation hook because local Rolldown lacks its Windows native binding. Full types are blocked by missing `@devvit/analytics/server/reddit` in two existing server imports. No build or gameplay playtest performed.

**Desktop lobby gradient fix (2026-11-01):** on `game-updates`, extend the lower lobby scrim to the full viewport width rather than the capped controls panel plus 80 px. This removes the hard vertical cutoff visible on wide Reddit feed cards. Controls keep their existing width and position. Headless Chrome checks using the actual stylesheet pass at seven desktop/mobile sizes (320–1920 px), including the screenshot's 875x640 card size; no application build or live Reddit check performed.

**Main merge (2026-10-31):** fast-forwarded `codex/rampage-upgrade-after-goal` through `335ebe3` into `main` at the user’s request. The quieter, single-line Rampage upgrade feedback now starts after goal celebration ends at the actual difficulty change. Existing TypeScript/lint/Daily checks pass; no application build/browser checks run.

**Post-goal Rampage upgrade feedback (2026-10-31):** remove the outlined two-line level-up graphic from the goal celebration. Show one small LEVEL UP > tier line beneath the HUD only after the goal finishes and the actual new difficulty is applied at kickoff. A gentle short slide/fade lasts 1.6 active seconds across kickoff/live; reduced motion uses a steady line. No feedback for opponent goals, final clear goals or the Pro cap. Active-time state resets on rematch and pauses with the scene. TypeScript, lint and Daily rules/posting checks pass, including goal-to-kickoff timing boundaries. No application build/browser checks run.

**Main merge (2026-10-31):** fast-forwarded `codex/subtle-difficulty-label` through `f6dd497` into `main` at the user’s request. Includes the smaller, muted/translucent Rampage tier badge and softer text. Existing TypeScript/lint checks pass; no application build/browser checks run.

**Subtle difficulty label (2026-10-31):** soften the persistent Rampage tier badge with muted, translucent tier colours, a smaller borderless fill and regular off-white pixel lettering without the heavy outline. Level-up celebration styling and gameplay remain unchanged. TypeScript and lint checks pass; no application build/browser checks run.

**Main merge (2026-10-31):** fast-forwarded `codex/rampage-level-up-kits` through `4c61b5e` into `main` at the user’s request. Includes the unboxed Rampage counters, borderless readable tier badge, level-up feedback and Yellow/Cyan/Maroon kits. Existing type/lint/49-case logic and Daily checks passed; no application build or browser checks run.

**Rampage HUD refinement and three kits (2026-10-31):** remove the black goals/lives strip and tier border, retain a compact coloured tier fill with larger white outlined lettering. Add a pooled, phase-age-driven LEVEL UP / old-to-new tier animation late in a player-goal celebration; final clearing goals, unchanged tiers and the Pro cap do not announce upgrades. Respects reduced motion and pauses without timers. Add Yellow, Cyan and Maroon kit palettes, selectable/shared validation options, swatches and shipped WebP atlases; existing assets are preserved. TypeScript, lint, all 49 logic checks and Daily rules/posting checks pass. New texture dimensions/alpha/colour error and Python script syntax are verified. No application build or browser checks run, as requested.

**Main merge (2026-10-31):** fast-forwarded `codex/rampage-difficulty-badge` through `91426db` into `main` at the user’s request. Includes Rampage badge/readability changes, clearer Chaos match settings, and stronger Hard/Pro near-goal defending. TypeScript, lint and all 48 logic checks passed on the application changes. No application build or browser checks run, as requested.

**Hard/Pro near-goal defence (2026-10-31):** reduce pressing stand-off near the defended goal (Hard 80%, Pro 65%) and relax teammate separation for marking/backup/rest-cover roles (Hard 67%, Pro 53% of the normal gap). Both adjustments fade between 330 and 560 px from goal centre and retain delayed carrier observations. Lower levels, general shape spacing, movement physics and goalkeeper settings stay unchanged. TypeScript, lint and all 48 logic checks pass, including the new near-goal cases. No application build run.

**Chaos match briefing (2026-10-31):** the info screen now explains the selected effect with its exact percentage of normal and relative increase/decrease, including goal width/height and end-wall height for Goal Resize. It states that one fixed effect applies to both teams for the whole match, 100% is normal, and the player must finish ahead with draws failing and no extra time. Start-score ordering and opponent AI labels are explicit. TypeScript and lint checks pass; build/browser checks remain skipped per user instruction.

**Rampage difficulty badges (2026-10-31):** renamed RISING AI to RAMPAGE in feed previews, results and briefing. Live Rampage HUD separates goal progress, actual current AI tier and remaining lives, with a tier-coloured badge and compact dark backing. All three hide during goal celebrations. Gameplay progression and stored survival IDs remain unchanged. TypeScript and lint checks pass. Build/browser checks intentionally skipped at the user’s request.

**Chaos Daily (2026-10-31):** merged `codex/chaos-daily` through `ca9cb2d` into `main` by fast-forward at the user’s request, including the Journeys integration enabled by default. Creators choose one fixed Power Surge/Slippery Street/Goal Resize effect and whole-number strength (100 normal). Power/goals accept 50–150%; Slippery accepts 100–150%. Chaos defaults to 0–0, with configurable conceded goals, duration, skill, kits and formations. Per-match rules scale both teams’ shots/kicks or speed/tackle lunge/reach; goal resizing updates rendered posts/nets/end walls, scoring/crossbars, player bounds, keeper coverage/boxes, chalk lines and minimap. Side walls/pitch size remain fixed. Graphics reuse the ball trail plus one weather buffer: boosted-shot pixel flames, faint low-power trails, capped sparse rain/foot splashes, goal-frame kickoff highlight; mobile rain density is halved and reduced motion removes extra rain/flames. Preview, briefing, HUD, results and score sharing show effect/percent. Regulation-only Daily ranking is retained; Chaos speed bounds extend to 300 km/h only on Chaos posts and device bests use a separate bucket. Full local checks (46 logic cases, posting handler mocks, privacy/count/speed/Journeys regressions, types/lint/build), six actual-shot/goal Chaos browser scenarios, all existing Daily scenarios and the complete Casual/legacy browser suite pass. Screenshots/geometry probes verify walls/openings and mobile no-scroll results at 320x480, 390x600 and 844x390; replay/Casual isolation and reduced motion pass. npm audit is zero. Live Reddit/Redis and on-device balance review remain outstanding.

**Journeys enabled by default (2026-10-31):** the user explicitly requested enabling now. Normal client/server builds attempt tracking; Reddit’s allowlist still controls actual ingestion. Set `STREET_SOCCER_JOURNEYS_ENABLED=false` to disable. No deployment or review submission performed. Types, lint, Journeys boundary/lifecycle checks, normal-enabled and explicit-disabled browser flows, all Daily scenarios and the full Casual/legacy suite pass on `codex/match-journeys`. The final local client/server build is enabled.

**Match Journeys (2026-10-31):** implemented on `codex/match-journeys` with official @devvit/analytics 0.15.1 and an allowlisted Hono adapter. The minimal map covers interactive ready (once/page), committed match start/rematch, terminal results and explicit quit. `STREET_SOCCER_JOURNEYS_ENABLED` now defaults on in both client/server builds at the user’s request; explicit `false` disables it; Journeys permission is declared for review. Custom metadata contains only fixed mode/difficulty/duration/outcome/goals/time fields, not names/IDs/free text. Reddit supplies standard SDK context. Per-attempt IDs stay in memory; requests time out after two seconds with no retries and never block gameplay. No preview starts, passive quit inference or per-input tracking. Rematch markers are kept outside match settings. Clean npm ci, full local checks/build, actual Hono/SDK-boundary tests with a mock transport, default-off browser checks, all Daily scenarios and the full Casual/legacy/goal-achievement browser suite pass. Enabled mocked browser tests cover passive preview exclusion, committed release, result/rematch/quit, denied approval, offline and timed-out requests; no page errors. npm audit remains zero; no PostHog code is present in the browser bundle. The local build now follows the enabled-by-default choice described above. Review map and activation instructions are in docs/journeys-review-map.md. No live telemetry, review submission, upload or publication was performed.

**Dependency security fixes (2026-10-31):** fixed all 48 npm audit findings; merged `codex/shield-mode-name` through `a97f467` into `main` by fast-forward at the user’s request, including the Shield rename. Pin patched minimatch 11.0.3 and tmp 0.2.7 through overrides; keep stable Devvit 0.15.1. Because glob 7 expects old RegExp matcher internals, a checked/idempotent postinstall adapts its field lookup to `pattern` and matching to `test()` without changing the nonrecursive security fix or callback/EventEmitter API. Resolve through production dependencies so both full and --omit=dev installs work. Clean full/production npm ci, both audits (zero findings), full local checks/build, Devvit version/upload/playtest/publish help and all Daily browser scenarios pass. New dependency checks exercise sync/async/event glob, braces/extglobs/dotfiles/ignore/nocase, filelist, editor temp cleanup and traversal rejection; included in test:local. Reddit/Redis integration uses mocks; no live upload/publish was performed.

**Shield naming (2026-10-31):** renamed the visible Hold the Lead mode to Shield, now merged into `main`, including creator choices, match briefing, preview, HUD, results, share text and validation messages. Stored `hold-lead` IDs, rules and leaderboard data stay compatible. Types, lint, Daily rule/form/leaderboard checks and build pass; Reddit/Redis tests use mocks.

**Rampage and goal burst (2026-10-31):** merged into `main` through `2e53db0` by fast-forward at the user’s request. Survival is now named Rampage in creator forms, previews, results, shares and validation messages; existing stored `survival` IDs/limits remain compatible. Purple/pink RISING AI badges replace the static Noob/range label. The info briefing explains your-goal opponent/keeper upgrades, the actual tiers for the goal target, concession limit, timeout failure and fastest-clear ranking. Goal text now pops, shakes, tilts and expands with black outlines, cyan/pink offsets and diagonal repeated text trails; it sweeps/fades before the existing kickoff, without a background box. Speed/record feedback stays steady and the burst remains in the upper pitch area. Full local checks, Daily mode browser suite and existing Casual/legacy/achievement browser suite pass. Focused Chromium checks and desktop/portrait/landscape screenshots cover animation phases, bounded placement, fade, consecutive-goal reset, reduced motion and real kickoff cleanup. Reddit/Redis checks use mocks; live playtesting remains outstanding.

**Main merge (2026-10-31):** merged `codex/daily-challenge-modes` through `8ce99b7` into `main` by fast-forward at the user’s request. Includes the three Daily templates, minimal goal-speed backing, configurable Survival limits/time leaderboard and two-page briefing. Existing local and browser checks passed on this exact application code; live Reddit testing remains outstanding.

**Survival time board and briefing (2026-10-31):** implemented on `codex/daily-challenge-modes`. Survival creators select goals to win (1–15) and conceding limit (1–10); new posts have a fixed five-minute cap. The main board includes finishers only, fastest live-clock time first, with fewer conceded then username breaking ties. Older stored rows are re-ranked on read, and watched transactions preserve personal bests during concurrent submissions/deletion. Match Details → How to Play → Play Match stays paused on first entry; the info button reopens both pages. All local checks and Daily browser scenarios pass, including custom 7/4 limits, fixed cap, progression, clear/failure/timeout and replay. Focused desktop/portrait/landscape screenshots and midgame info navigation pass. The full existing Casual/legacy/goal-achievement browser suite also passes. All Reddit/Redis integration checks use mocks; live playtesting remains outstanding.

**Daily challenge templates (2026-10-31):** creator-selected Comeback, Hold the Lead and Survival are implemented on `codex/daily-challenge-modes`, based on the pending minimal speed badge. Creation now follows Match type → Daily template → relevant settings, with a registered native form callback. Comeback recovers an AI head start; Hold the Lead defends a player head start; Survival starts 0–0, advances Noob/Easy/Normal/Hard/Pro after home goals at kickoff, and clears at goal five or fails at concession three/time limit. New templates have no golden goal. Score-aware Defensive/Attacking/Balanced/late All-out plans are independent of skill and physics; opponent keeper progression shares the current difficulty. Preview, HUD, results and score-sharing text reflect objectives; server derives outcomes and ranks cleared runs first, with Survival progress/concessions/live elapsed time. Short terminal runs use a compatible minimum receipt/cooldown. Types, lint, 41 existing logic checks, privacy/counter/speed regressions, new Daily rule tests, real Hono form-handler tests with a mock SDK and build pass. New mode browser flows and the entire existing Casual/legacy/achievement suite pass with mocked Reddit host/APIs, including mobile previews/results, kickoff progression, late tactical delay, fifth-goal clear, three-concession failure while ahead, timeout, replay reset and Casual separation. Live Reddit/Redis playtesting and gameplay balance review remain outstanding.

**Goal speed visibility (2026-10-31):** enlarged the goal-speed digits by 35% and unit by 25%, adding a compact dark-blue badge with white digits and yellow units. The latest refinement removes its border and uses a 45% opaque background for a lighter look. Re-spaced the goal tag to keep every badge separate above the scorer; the headline remains unboxed. Types, lint and build pass. Focused Chromium checks and reviewed screenshots cover maximum 200 km/h, with/without a device best, desktop/portrait/landscape, animation/reset, reduced motion and kickoff cleanup on `codex/goal-speed-visibility`. Live Reddit playtesting remains outstanding.

**Clear scorer celebration (2026-10-31):** removed the dark headline strip/border and wide metric backing, moved smaller animated lettering beneath the scoreboard and grouped compact tag/speed/personal-best feedback in one shallow row above the scorer on `codex/clear-goal-overlay`. Tightened text shadow, impact and stretch; team colour now accents the small scorer label. Hide the redundant golden-goal indicator during celebrations to avoid header overlap. Types, lint, 41 logic checks, privacy/counter/speed regressions and build pass. Focused Chromium checks and screenshots verify the actual near-goal celebrating scorer stays visible at desktop, landscape and portrait sizes (1280×720, 844×390, 390×600, 320×480), plus animation stages, reset, untagged goals, reduced motion and kickoff cleanup. Live Reddit playtesting remains outstanding.

**Arcade goal celebration (2026-10-31):** large goal overlay now hits and shakes briefly, expands GOAL! into GOOOOAL!, stretches the final L!, then reveals a coloured goal tag, large speed readout and personal-best ribbon. Team accents and a translucent strip keep the celebration in the game style. Goal phase time drives the sequence within the existing 2.8-second pause; reduced motion shows steady text/metrics. Types, lint, 41 logic checks, privacy/counter/speed regressions and build pass. Focused browser checks verify animation stages, bounded stretch, desktop/portrait/landscape framing, consecutive-goal reset, untagged goals, fade, reduced motion and kickoff cleanup; actual ranked and Casual keyboard-shot/goal/results flows pass. Screenshots reviewed on `codex/goal-achievements`; live Reddit playtesting remains outstanding.

**Goal achievements (2026-10-31):** launch-speed goal badges (CHIP/CURL/ROCKET/GREAT FINISH), separate local practice/ranked device bests, stronger goal audio and reduced-motion-aware camera impact are implemented on `codex/goal-achievements`, based on the package refresh. Results highlight the fastest human-controlled goal; fixed ranked matches submit to a separate per-post seven-day Fastest Goals board, available through results tabs and the preview ALL dialog. Independent transactional speed updates preserve records from lower-scoring matches and use existing account/post erasure and retention. Types, lint, 41 logic checks, privacy/counter/speed regressions and build pass (unit runner finds zero tests). Full mocked Chromium suite passes, including actual keyboard strike → goal → device best → results, ranked/Casual isolation, speed-board failure, preview tab switching, share consent, rematches and guest play. Strict layout checks pass for all three modes at 390×844, 320×480, 844×390, 640×320 and 1280×720 with speed highlights and top-three boards. Real Reddit/Redis playtesting remains outstanding.

**Dependency refresh (2026-10-31):** Devvit CLI/start/web updated together to 0.15.1, Hono to 4.13.14, ESLint to 10.14.0 and typescript-eslint to 8.72.1 on `codex/package-refresh`; lockfile refreshed. Clean `npm ci`, types, lint, 39 gameplay checks, privacy/counter regressions, build and CLI version check pass. Unit runner finds zero tests. Full Chromium desktop/mobile browser suite passes, covering settings persistence, gameplay/results, ranked sharing consent, rematches, feed routes, short screens and guest storage fallback with mocked Reddit host/APIs; live Reddit playtesting remains outstanding. Retain Phaser 3.90.0 and TypeScript 6.0.3 for renderer and lint compatibility. Audit changes from 50 affected packages (4 high) to 48 (1 high): remaining high is `tmp@0.0.33` through Devvit CLI → inquirer → external-editor; latest stable CLI retains this chain. Moderate upstream minimatch advisories also remain; do not force breaking overrides or audit-suggested downgrades.

**Retired formation (2026-10-24):** remove 0-3-1 from all selectors and gameplay shapes. Older posts and saved Casual preferences migrate that shape to 1-2-1 during shared validation, preserving their other settings. Types, lint, 39 logic checks, privacy/counter regressions and build pass.

**Responsive results UI (2026-10-24):** Daily Challenge, Classic and Casual now share a centred pixel-styled native card with coloured team panels, score, difficulty/time, stat tiles and consistent actions. Ranked results retain the 7-day board, result saving, consent-based score sharing and Play Casual. Browser checks pass across desktop, portrait and landscape, including 320×480 and 640×320, with visible touch targets and no internal scrolling at the tested sizes. Sharing cancellation, submission and late-form responses are covered with mocked Reddit APIs; live Reddit playtesting remains outstanding.

**Casual from ranked results (2026-10-24):** adding PLAY CASUAL below Play Again and Post My Score on Daily Challenge/Classic results. It opens Casual setup with remembered preferences; the ranked result is still saved normally. Existing result buttons move up slightly to keep every action inside the canvas. Types, lint, build and browser checks pass for Daily Challenge and Classic on desktop, portrait mobile and landscape mobile. Real canvas clicks open saved Casual settings and start an unranked 0–0 match, with exactly one ranked result submission.

**Difficulty label (2026-10-24):** the highest difficulty is now displayed as PRO across the preview, settings, results and creation form. Its stored `pro` ID and gameplay tuning remain the same.

**Preview match information (2026-10-24):** moving configured match duration and a difficulty-coloured badge into the top-right header, replacing LIVE PREVIEW. The lower team row keeps starting score only; Casual shows CUSTOM SETTINGS instead of fixed values. Types, lint, 39 gameplay checks, privacy/counter regressions and build pass. Browser checks verify all five badge colours, configured duration, no duplicate fields, Casual handling and non-overlapping header placement down to 320px, plus existing gameplay/settings flows.

**Overlay preview revision (2026-10-24):** restoring full-card live gameplay with native controls layered over a lower gradient, replacing the separate preview/panel layout. Reworking Casual setup without pitch diagrams; formation selectors remain. Adding Orange and Teal kits, kit selectors for both Casual teams, and 1-3 / 0-3-1 formations. Matching kit choices swap the teams’ colours to avoid clashes; saved preferences retain kit choices. Art baking and WebP alpha/colour validation passed; only the two new atlases are added, preserving existing release art. Types, lint, 39 gameplay checks, privacy/counter regressions, build and desktop/mobile browser flows pass, including saved kits, both new formations, overlay geometry and no-scroll safe-area layouts. Live Reddit playtesting remains outstanding.

**Modern pixel match card and game count (2026-10-24):** replacing duplicated preview layouts with a responsive pixel-styled match card and a properly framed live gameplay stage. Casual setup uses compact two-column controls sized to the visual viewport. Adding anonymous per-post completed-match counts with expiring receipts and transactional deduplication, separate from rankings. Types, lint, 37 gameplay checks, privacy regressions, transactional-counter regressions and build pass. Browser checks cover desktop/mobile feed entry routes, completion-only counting, no-scroll setup at 320×480 / 390×600 / 360×640 / 844×390 / 640×320, safe-area padding, rotation, and counter failure fallback. Browser host/API calls are mocked; real Redis and Reddit playtesting remain outstanding.

**Casual mode and post types (2026-10-24):** implementing Daily Challenge, Classic and Casual posts. Daily and Classic share creator-defined fixed settings; the Casual entry point opens formation/difficulty/time arrow selectors with device-local preferences and unranked results. Legacy custom posts remain Daily Challenges. Local types, lint, 37 logic checks, privacy checks and build pass. Browser checks pass at 390px and 1280px for settings, help-before-play, match/result transitions, rematch, change settings, exit, all post-type feed routes and legacy posts; guest play also works with storage disabled. Browser checks mock Reddit host messages and API responses; native forms, actual post creation and live expansion still need Reddit playtesting.

**Dependency refresh (2026-10-24):** updating Devvit together to 0.15.0, Hono Node adapter to 2.1.5, ESLint to 10.13.0, Prettier to 3.9.10, typescript-eslint to 8.72.0 and Vite to 8.3.5; refreshing Playwright to ^1.64.1 and Node 24 types to ^24.19.2 and reconciling the lockfile. All Devvit packages are pinned exactly to 0.15.0. A clean `npm ci`, type check, lint, 31 gameplay logic checks, privacy regressions, build and Chromium gameplay smoke check pass. The unit runner discovers zero tests; Reddit playtesting remains outstanding.

**Remotion promo video (2026-10-20):** a separate Remotion project at `F:\code ball\promo` (not part of the game or the Devvit upload) edits recorder clips into a vertical 1080x1920 and a landscape 1920x1080 promo, cut to the beat of `bgm.mp3` (164 BPM), in the game's pixel font. Clips come from `node tools/trailer/trailer.mjs render tools/trailer/promo-plan.json`, then `node scripts/import-clips.mjs` in the promo folder.

**How-to-play panel at game start (2026-10-18):** a match opened from the post's PLAY (expanded Reddit, `BootScene` sets registry `helpAtStart`) starts with the (i) help panel open; the match waits paused until GOT IT. Once per page load (the flag is cleared), not on localhost or matches started from the menu / lobby, and not remembered across visits. Type check, lint and build pass; not yet seen on Reddit.

**Hard minimum gap between AI teammates (2026-10-18):** user: "in defence sometimes it gets too crowded, make a hard rule of minimum distance among cpu players". `TeamBrain.steer` now runs every AI player's target through `keepApart` (ai.ts): pushed out of a `AI.mateMinGap` (120 px) circle round each teammate (3 passes, clamped to the pitch), for every job except going for the ball (`chase`, `press`), which still run straight in. A player already inside the gap moves off even when settled (the calm stand-still hysteresis is skipped). Applies to both AI teams (the CPU and our AI teammates); the human-controlled player is not moved, but teammates keep away from it. Before this only calm jobs (cover / support / run / show) had the soft `spaceDist` push; markers, rest defence, backup and recovery runs could bunch up. New logic check (3 attackers bunched at our goal, 4 s of steering): bound players stay over 105 px apart; with the rule off they end 77 px apart. `npm run test:local` passes. Not yet playtested by hand.

**Five difficulty levels (2026-10-18):** user: "add 5 lvls of difficulty from very easy to very hard: noob, easy, amateur, hard, professional". `Difficulty` is now `'noob' | 'easy' | 'normal' | 'hard' | 'pro'` (`DIFFICULTIES` easiest first); players see `DIFFICULTY_LABEL` (NOOB / EASY / AMATEUR / HARD / PROFESSIONAL) on the menu, mobile lobby, feed card, result screen, the moderator form and the posted score line ("Amateur AI"). New `LEVELS.noob` (slower than easy on every number: think 0.4 s, read 0.5 s, tackle 12%, keeper react 0.6 s, dive error 45 px, wide spots and marking) and `LEVELS.pro` (think 0.08 s, read 0.1 s, tackle 80%, keeper react 0.26 s, dive error 2 px, tight marking, no recovery slack); still same physics and movement. Menu: the three level buttons became one `< LEVEL >` selector (arrows step and stop at the ends, tapping the middle cycles), because five names don't fit side by side. The logic check now requires every level to be strictly sharper than the one before. `npm run test:local` passes; menu checked in a local screenshot (AMATEUR -> HARD -> PROFESSIONAL). Not yet balanced by playing: noob and pro numbers are first guesses.

**Easier scoring, keeper still saves the obvious (2026-10-18):** user: "very hard to score, whenever we shoot it sticks to the goalkeeper"; keeper should still make obvious saves. Measured with a scratch Monte Carlo of the real code (kickShot, stepFreeBall, collideBall, keeper AI at normal; script kept outside the repo) before changing anything: a straight shot at goal from 200-400 px scored 0-2%, an 8-way keyboard aim 19-28%, a shot aimed at a corner 59-90%; 1-on-1 against a rushing keeper 0-39%. Causes: shots leave exactly along the stick (straight = at the keeper), the keeper side-stepped the instant the ball was struck, and its rush-out stopped 80 px from the shooter, where its reach covers every angle. Changes: (1) **finishing assist** for human shots only (`assistedShotDirection` in actions.ts, `SHOOT.assist*`): within 700 px (full under 400), a shot crossing in or near the mouth is pulled 10-90% (random per shot) of the way to a spot 45 px inside the post on the open side (the side the stick picked vs the keeper, or the bigger gap when aimed at it); the aim arrow shows the middle strength; wide shots, shots away from goal and long range are untouched. (2) Keeper: `KEEPER.shuffleDelay` 0.1 s read before side-stepping (new `Player.shuffleAt`, set by cpuKeeperReact; `keeperStick` now takes `time`), `reach` 40 -> 38, `rushGap` 80 -> 110. After: from 200 px straight 54% / keyboard 77% / aimed 99%; from 350 px 22% / 53% / 80%; rushing keeper 11-57%; from 500-600 px still 2-5% (keeper keeps long shots, weak taps and shots at it from distance). The CPU gets no assist, but the keeper change is shared, so CPU shots score a little more too. New logic checks for the assist and the read delay; `npm run test:local` passes. Not yet playtested by hand.

**Continuous teaser revision (2026-10-18):** user found the first workspace teaser choppy and disconnected. New `output/teaser/street-soccer-teaser-smooth-v2.mp4` is 19 s, 1280 x 720, 60 fps, H.264 + AAC. One uninterrupted seed-15 real-game passage: passing/dribble, turnover, dive save, second save, third attempt scores, celebration. No scene cuts, flashes or replay jumps; title fades over continuing celebration. Recorder reprojects known camera/player/ball coordinates between the original 30 Hz replay frames for smooth 60 fps output without changing the match. Existing soundtrack/effects mixed continuously from event timestamps. Full 1,140-frame decode passes, both saves and goal confirmed, interior has no black frames, gameplay duplicate-frame fraction 0.24%, audio peak -4.5 dBFS. Original teaser and other trailer exports preserved. Sources/review stills/verification in workspace `output/teaser/smooth/` and its parent; no game source changes.

**Gameplay trailer v2 (2026-10-18):** `tools/trailer/out/street-soccer-trailer-v2.mp4` (19.6 s, 12.2 MB; v1 kept in out/v1). Recorded with both AIs at normal (trailer.mjs CONFIG) so the real scoreboard stays (early-match moments only: 0-0 / 0-1); seeds 11-18. Cut: slide-tackle cold open (seed 13), title slam with white flash, dribble past repeated tackles (seed 14), dive save then REPLAY in 0.4x slow motion zoomed on the keeper (seed 15), 6-pass move into the first goal, freeze + flash on the goal, celebration push-in (seed 12), end card. edit.py gained per-cut `zoom` [from, to, cx, cy, span] (window kept below the HUD strip, score / clock panels pasted unscaled), `flash`, `flashAt`, `tag` (REPLAY); `coverScore` is now optional. Plans: out/plan-render.json, plan-render2.json, plan-edit.json.

**Gameplay trailer, first cut (2026-10-18):** 20 s landscape trailer at `tools/trailer/out/street-soccer-trailer.mp4` (1280 x 720, 30 fps, H.264 + AAC, 13 MB; out/ is git-ignored). Dev-only recorder in `tools/trailer/` (never shipped): `harness.js` (Playwright init script: seeded Math.random, virtual clock, Phaser loop stopped and `game.step` driven with exact 1/30 s frames, because Phaser's TimeStep smoothing / unfocused clamping made replays differ; event log of kicks, passes, shots, saves, tackles, goals; hides touch controls, minimap, FPS, top-right buttons and the controlled-player markers; frames read with canvas.toDataURL in the same task, since page screenshots timed out), `trailer.mjs` (`search <from> <to>`: AI-vs-AI matches without drawing, ranks passing moves / dribbles / dive saves / goals; `render <plan> [segment]`; `check <seed> <frames>`: determinism, verified identical), `edit.py` (cuts, title / end cards in the game's pixel font, freeze frame, slow motion, score box replaced by RED VS BLUE because the hard-vs-normal AI scores are lopsided, soundtrack rebuilt from the event logs with ffmpeg). Only game change: `?film` also exposes window.__game (game.ts). Playwright 1.49.1 added as a devDependency; Chromium unpacked by hand into ~/.cache/ms-playwright (its own unzip stalled) and launched as channel 'chromium' with SwiftShader WebGL. Red vs blue, end card R/STREETSOCCERGAME. Needs `npm run build` + `node scripts/serve.mjs` running.

**Landscape teaser (2026-10-17):** created workspace `output/teaser/street-soccer-teaser-landscape.mp4`: 22 seconds, 1280 x 720, 30 fps, H.264 + stereo AAC. Directed in-engine montage includes a dive parry, jump-save parry, dribbling, missed tackle, passing exchange, goal and celebration. Approved copy ends STREET SOCCER / EARN EVERY GOAL. / PLAY INSIDE REDDIT; no match-duration marketing copy. Existing game music/effects mixed with original synthesized percussion. Separate output-folder director uses the game's current physics and art; no shipped source/assets changed. Reviewed key frames, confirmed both parry events and goal, and decoded all 660 final frames with no errors; audio peak -4.2 dBFS. Editable sources and reproduction notes saved beside the MP4.

**Slim desktop banner v3 (2026-10-17):** reworked composition to 1072:128 aspect ratio, exported at 2144 x 256 and 1072 x 128 in workspace output/branding/street-soccer-desktop-v3-*.png. Single-line STREET SOCCER title, thinner brick/asphalt backdrop. Background/title edited using built-in imagegen; exact pink shoot_contact (atlas index 12), mirrored blue run frame (index 5), and authored ball composited from game files with nearest-neighbour sampling. Both exports visually inspected, full sprites and title visible. Reproducible export-desktop-banner.mjs and complete generation prompt saved beside exports.


**Subreddit banner v2 (2026-10-17):** improved the supplied banner with built-in imagegen using the current clean-shaven shoot/run sheets and blue atlas as references. Stronger central pixel title, worn brick wall, balanced pink kicker / blue runner, one ball. Cropped generated letterboxing and exported at 1920 x 384 plus native 2170 x 434 in workspace output/branding/street-soccer-banner-v2*.png. Prompt notes and export script are beside the images. Final crop visually inspected. This is a separate branding artifact; no game assets replaced.


**Review of the full head replacement + compliance follow-up (2026-10-17, main, uncommitted):** every authored sheet with a visible face now has the clean-shaven head (run up / run up-diagonal are back views and were left as they are). Atlases were rebaked after the last sheet (hold); release art 1.75 MiB. `npm run test:local` passes (types, lint, unit, 28 logic checks, privacy/pinned-score checks, build). Full atlases inspected in blue and home keeper kits: kits split cleanly on every frame, one face throughout. Cosmetic only: a few dark-pink pixels stay pink on the black keeper shorts in the lying tackle/hurt frames (too dark for the pink rule), and the keeper jump poses are drawn smaller than keeper idle (same as before the redraw, not new). Before `npm run launch`: commit, playtest the new delete-my-data menu item / form, the 10-minute privacy-cleanup scheduler and SUBMIT_POST on Reddit (new permissions need a fresh upload).

**Compliance follow-up (2026-10-17, main):** implemented confirmed self-service leaderboard deletion from the subreddit menu, legacy board discovery, a 10-minute rotating deleted/unavailable-account sweep, fail-closed Scores pin verification with reusable pending comments, and moderator custom posts as USER with SUBMIT_POST and reportable UGC. Help and README document deletion scope and migration limits. Privacy/pinning regressions, 28 game logic checks, TypeScript, lint and production build passed. All current source sprites rebaked into 10 atlases and 12 release images (1.75 MiB). Reddit playtest v0.0.2.2 installed successfully in r/street_soccer_dev; browser access to Reddit was declined, so native forms, non-owner moderator attribution and scheduled execution still need Reddit verification. Local help spacing adjusted after inspection.

**Clean-shaven keeper static hold replacement (2026-10-17, main):** replaced public/art/player-hold-authored.png with supplied clean-shaven four-pose standing hold sheet, including blink. Restored alpha with imagegen from RGB black backdrop, uniformly scaled to previous standing body height and fitted to four 640 x 724 cells (2560 x 724), previous horizontal centres and ground 681. Intermediate saved in workspace output/sprites/player-keeper-hold-transparent-v1.png. Existing metadata and timing retained. No colour checks, bake or build per preference. Both bearded sheets identified by the last audit (tackle and hold) are now replaced in source; release atlases still need rebaking.

**Supplied side-tackle replacement (2026-10-17, main):** user explicitly chose the four-pose clean-shaven falling/hurt sheet for side tackle. Imported into player-tackle-authored.png using existing 4096 x 1448 layout (4 x 2 of 1024 x 724), one uniform nearest-neighbour scale, centred complete silhouettes and boots/ground at 681. Existing eight-frame timing retained by mapping supplied poses 1,2,3,4,4,3,2,1 (fall then reverse recovery). Clothing split lines transferred from corresponding existing hurt poses using placement transforms, preserving prior metadata elsewhere. No colour checks, bake or build per preference. Only bearded source now known remaining is keeper static hold.

**Clean-shaven keeper standing block replacement (2026-10-17, main):** supplied three-pose hand-block sheet replaces public/art/player-keeper-block-authored.png. Imagegen restored alpha from RGB black background; nearest-neighbour fitted to existing 2160 x 724 canvas (three 720 x 724 cells), opaque centres matched to previous frames and boots at 681. Existing block keys, timing and metadata retained. Transparent intermediate saved to workspace output/sprites/player-keeper-block-transparent-v1.png. No colour checks, rebake or build per user preference.

**Clean-shaven keeper jump replacement (2026-10-17, main):** replaced public/art/player-keeper-jump-authored.png from supplied four-pose overhead save. RGB black backdrop extracted with imagegen; transparent intermediate saved in workspace output/sprites/player-keeper-jump-transparent-v1.png. Uniform nearest-neighbour scale fits tallest overhead pose within existing cell, each pose centred against previous opaque bounds with boots at 681; existing 2880 x 724 sheet, four 720 x 724 cells and animation order retained. No colour checks, atlas bake or build, per user preference.

**Clean-shaven keeper idle replacement (2026-10-17, main):** supplied three-pose gloved idle sheet replaces public/art/player-keeper-idle-authored.png. RGB black backdrop extracted with imagegen, then fitted nearest-neighbour to 2160 x 724 (three 720 x 724 cells), opaque centres aligned to previous cells and boots aligned to 681. Metadata retained. Transparent intermediate saved in workspace output/sprites/player-keeper-idle-transparent-v1.png. No colour checks, atlas bake or build per user preference.

**Keeper carry replacement (2026-10-17, main):** supplied six-pose glove/ball-carry running sheet replaces public/art/player-carry-authored.png. Input was RGB with a solid black backdrop; imagegen background extraction restored alpha, saved separately in workspace output/sprites/player-keeper-carry-transparent-v1.png, then nearest-neighbour fitted to existing 1920 x 1448 source (3 x 2 of 640 x 724). Existing carry frame ordering, ground 681 and metadata retained. No colour checks, rebake or build, per user preference. Static hold remains separate.

**Keeper hold sheet supplied (2026-10-17, main):** copied user attachment directly to public/art/player-hold-authored.png. Four 640 x 724 cells already match existing dimensions and opaque bounds exactly, so no resizing or metadata changes. User explicitly requested no colour checks, atlas rebake or production build; skipped all three.

**Clean-shaven goalkeeper dive (2026-10-17, main):** replaced public/art/player-dive-authored.png with supplied six-frame clean-shaven dive. Attachment 1938 x 812 resized with nearest-neighbour to existing 3456 x 1448 (3 x 2 of 1152 x 724). Opaque pose bounds match the original within 4 source pixels; existing ground 681, animation order and slanted kit splits retained. All six poses visually compared before/after in home green and away gold baked kits; beard removed, gloves and dive shapes preserved. Rebuilt atlases/look layers and release art. Prior uncommitted source replacements preserved.

**New celebration heads: all three sets (2026-10-17, main):** imported the three user-supplied clean-shaven celebration sheets. Image 1 jump -> player-celebrate-authored (a), Image 3 knee-slide -> player-celebrate2-authored (b), Image 2 dance -> player-celebrate3-authored (c). Normalized 1532 x 1027 attachments to existing 2160 x 1448 sheets (3 x 2 cells of 720 x 724), nearest-neighbour scale 1.4, same row ground 681, previous lower-body anchors and relative jump lift. Low-alpha specks outside each opaque character bounding box excluded; original RGBA edges retained nearby. Existing kit split metadata fits the replacement bodies. Rebaked all kits/look layers and optimized release art (1.87 MiB); all 18 frames visually inspected in pink/blue/red contact sheet. Type check passed. Other existing uncommitted head replacements preserved.

**New player head, sheets 5 and 6 of 18: shoot + hurt (2026-10-17):** `player-shoot-authored.png` (scale 1.28, 4 x 640 x 724) and `player-hurt-authored.png` (scale 1.38, 2 x 2 of 1152 x 724) replaced from the user's sheets; poses centred on their whole outline like the old sheets (`BBOX=1 sheetbuild.py`), so the kick still meets the ball where it did. Both now use per-pose `splits`. New optional `socksAlso` line in `KitSplit` (a second sock line, for a leg the shorts line can't reach: the swung-back and kicking legs of shoot poses 1 to 3, the raised knee of hurt pose 2); the lying hurt poses split left to right with vertical lines. Checked in the baked blue and home keeper atlases. Release art 1.63 MiB. Done so far: idle, run, run down, run down-diagonal, shoot, hurt.

**New player head, sheets 3 and 4 of 18: run down + run down-diagonal (2026-10-17):** `player-run-down-authored.png` (scale 1.26) and `player-run-down-diagonal-authored.png` (scale 1.25) replaced from the user's 4-pose sheets (2000 x 667 WebP), same 4 x 640 x 724 layout, boots on y 681. Both now have their own entries instead of `runView()` (run up and run up-diagonal still use it): run down waist 378/372/386/375, shorts end 470/465/480/460; run down-diagonal uses `splits` with slanted shorts lines on poses 1 and 3 (raised back leg). Checked on blue/green test kits and in the baked red / home keeper atlases. Release art 1.77 MiB. Done so far: idle, run, run down, run down-diagonal.

**New player head, sheet 2 of 18: run (2026-10-17):** `public/art/player-run-authored.png` replaced from the user's 8-pose sheet (1667 x 943 WebP): scaled 1.52 to the old body size, centred on the legs, boots on y 681 (each pose keeps its height above its source row's ground), same 4 x 2 layout of 640 x 724 cells. Kit split now uses per-pose `splits` (horizontal waist lines; shorts lines slanted on poses 1, 4, 5 and 8 where the back leg's sock sits higher), checked on pink / blue / red / keeper green. Release art 1.83 MiB. Scratchpad tool `sheetbuild.py <src> <out> <grid> <scale> <cell_w> <cols> <ground> <poses-json>` fits any redrawn sheet into an existing layout. Done so far: idle, run.

**New player head, sheet 1 of 18: idle (2026-10-17):** to avoid a real footballer's likeness (Devvit Rules: no third-party IP / impersonation) the user is supplying the sheets again with a redrawn head (clean-shaven, new face and hair), one by one. An automatic beard removal in the bake was tried first and rejected (blotchy faces, smeared eyebrows / mouth; never shipped). Done: `public/art/player-idle-authored.png` replaced from the user's 4-pose sheet (1748 x 899 WebP with alpha): poses scaled 0.80 (same body size as before), centred on the legs, boots on y 695, in the same 4 x 352 x 724 layout; the idle entry in SOURCE_SHEETS now has its own split lines (waist 440/425/442/442, shorts end 525/510/528/525; the hold sheet keeps STAND_WAIST / STAND_SHORTS). Rebaked (`art:bake` + optimize_art): kits split cleanly, the new face / hair are found by the look layers. Release art 1.98 MiB. Until all 18 sheets are replaced, the other animations still show the old bearded head.

**Devvit Rules compliance (2026-10-17):** user pasted developers.reddit.com/docs/devvit_rules. Already met: README rules, no links out, no payments / fetch / LLMs, no Reddit IP (no Snoo or logos), not aimed at under-13s, data minimal and expiring (8 days < recommended 30). Fixed per the User action requirements: (1) score-only shares are now replies to a stickied comment: `server/core/scoreThread.ts` creates one pinned app comment per post ("Scores", `distinguish(true)`), when the post is created (`createPost`) or on first need, id kept in Redis `scorethread:<postId>`; POST MY SCORE replies to it when there is no player text, and posts top-level only with the player's own words (always `runAs: 'USER'`). (2) The POST MY SCORE popup says it posts from the player's account u/name, that everyone sees it with the username, and where it goes; the button reads "Post as u/name". (3) Deletions: new `onPostDelete` trigger (`/internal/triggers/on-post-delete`, devvit.json) deletes the post's daily boards and stats for the last 9 UTC days and its scores comment id (`forgetPost`); `daily.ts` exports `boardKey` / `statsKey`. (4) Reporting: the (i) help shows "REPORT A PROBLEM: MESSAGE THE MODS OF R/<subreddit>" (`context.subredditName`); README has a Support section and documents the scores comment and deletion. Review risk noted, not changed: the authored player art may read as a real footballer's likeness in a pink club-style kit (Devvit Rules: no third-party IP / impersonation); worth a second look at the face / default kit before launch. Type check passes; lint / build / logic run pending at time of writing; no Reddit test of the stickied comment yet (the app account needs mod rights to sticky; it falls back to an unstickied comment).

**Launch guide check (2026-10-17):** user pasted developers.reddit.com/docs/guides/launch/launch-guide. Met: custom first screen (live lobby), responsive (portrait lobby, landscape game), no inline scrolling (`overflow: hidden`, no scroll areas), immediately understandable ((i) help, PASS TO START), `npm run launch` runs `devvit publish` (unlisted by default: right for a game; do not use `--public`). Fixed: the required app README.md is now a reviewer/moderator README (what it is, how it plays, controls incl. keyboard, the moderator menu item and form, data stored in Redis and retention, Reddit API permissions incl. SUBMIT_COMMENT only on POST MY SCORE, logged-out players, no external requests or payments) plus the developer commands. Still the user's: a dedicated non-test subreddit (only r/street_soccer_dev exists), testing on mobile and web from developer / moderator / regular accounts, optional feedback cross-posts (r/Devvit Feedback Friday, r/GamesOnReddit Feedback flair), and reading the Devvit Rules page.

**Deployed v0.0.2 (2026-10-17, `main` at c1382fc):** user playtested v0.0.1.119 in r/street_soccer_dev, then ran `npm run deploy` (type check, lint, vite build, `devvit upload`): app version bumped to 0.0.2 and uploaded (developers.reddit.com/apps/street-soccer). Not published / not submitted for review yet (`npm run launch`). Playtest notes: Vite's "chunks larger than 500 kB" warning is the 800 KB (220 KB gzip) game bundle, expected; Devvit's "scripts.dev did not produce expected build outputs within 60s" comes from slow file-change events on /mnt/f under WSL; it still uploaded the fresh build (if a change ever does not show: stop dev, `npm run build`, start dev again).

**Music fix, new mix, smoother entry into the game (2026-10-17, `main`):** user: background music fails, transition from the post preview into the game is not good, music 80% / other sounds 25%. (1) Music failed because the plain `<audio>` element's play() ran from the game loop, not inside a tap: phones (iOS, some Android WebViews) refuse that silently and it never retried (the post's PLAY tap happened in the feed frame, not the game's). `ui/streamMusic.ts` now routes the element through Phaser's Web Audio (`createMediaElementSource` -> own GainNode -> `sound.destination`), so its volume works on iPhones (which ignore element volume) and Phaser's master mute applies; a refused start is retried on the next pointerdown / touchend / keydown (capture listeners, removed on destroy). MatchScene creates it as soon as the match is ready (no longer waits for `sound.locked`). Falls back to the bare element when Web Audio is unavailable (then soundMuted() drives `muted`). (2) Mix: `MUSIC_VOLUME` 0.8 and `EFFECTS_VOLUME` 0.25 in MatchScene (start, over, strike, goal, and the miss cue's fade target). (3) Entry into the game: the page loader (index.html / style.css) is now just the navy Phaser starts with and a small bar near the bottom, no big STREET SOCCER title; BootScene fades it out (300 ms, class `done`, removed after 400 ms) while the match camera fades in from that navy (`fadeIn(450)`), and the court is drawn first; the LOADING PLAYERS text is small (0.75 PX, 80% alpha) at the bottom. Type check, lint, build and 28 logic checks pass; no listening / device test.

**Live preview straight away; sound switch fixed (2026-10-17, `main`):** (1) Sound toggle: Phaser's `sound.mute` reads the Web Audio gain, which only updates on the next audio processing step (never while audio is still locked), so the button read back the old value, drew the wrong icon, saved the wrong value and the next tap undid it. Now `ui/soundSetting.ts` holds the switch (soundMuted / setSoundMuted, localStorage) and applies it to Phaser; HudScene draws from it and the streamed music follows it. (2) Feed card (user: no loading panel, show the live preview directly, no extra layers): splash.html is only the `#game` box; splash.ts starts the live lobby as soon as the card is visible (no 1.5 s wait, no data-saver skip, no painted card) and still sleeps it off-screen. (3) Court first: MatchScene.create paints the court/scenery (PAINT_STEPS), builds the Court and the CameraRig (focus on the centre) and draws the court every frame while it waits for the player art; the players join when it is in. The feed preview shows no LOADING text (a real match still shows LOADING PLAYERS n/8). (4) Parallel downloads: `art/assetList.ts` (the file list, no Phaser) and `earlyAssets.ts`: `startEarlyDownloads()` fetches the match's art into blobs at once; main.ts and splash.ts call it first and then `import('./game')` dynamically, so the art downloads alongside the 220 KB game bundle (built: entry 0.2-0.4 KB + 11 KB shared chunk, then game2.js). Boot hands the loader the blob URLs (`withEarlyDownloads`, single download; failed early fetches fall back to the normal URL) and frees them after (`releaseEarlyDownloads`). The game page keeps its STREET SOCCER text loader until Boot. Pasted Reddit GameMaker quickstart checked: Node 22+ (we use 24), 100 MB / 30 s upload limit (build ~8.3 MB, largest file 2 MB), npm run dev / deploy / launch present; the rest is GameMaker-specific. Type check, lint, build and 28 logic checks pass; no gameplay test.

**Reddit compliance clean-up (2026-10-17, `main`):** the Reddit docs page (quickstart-gamemaker) could not be fetched (developers.reddit.com is blocked for the agent), so the review used AGENTS.md's Devvit rules and the code. Already fine: Phaser only, no blocks / public-api, no window.location / alert / confirm / prompt, no geolocation / camera / notifications / downloads, no inline scripts, only same-origin `/api/*` requests, sound only after a gesture with a mute. Fixed: (1) template leftovers removed: the moderator menu item "Example form" (its route was already gone, so it was broken), the `exampleForm` form and `/internal/form/example-submit`, and the unused demo endpoints `/api/init`, `/api/state` (GET/POST), `/api/score`, `/api/leaderboard` with their types (InitResponse, StoredState, StateUpsertRequest, ScoreSubmit*, Leaderboard*). (2) POST MY SCORE no longer falls back to posting the player's text from the app account: if Reddit refuses the user comment it returns 502 "Reddit did not accept the comment" (`PostScoreResponse.asUser` removed). (3) Rate limits (Redis keys with expiry, `routes/api.ts` `takeCooldown`): one score comment per player per post every 10 min (`COMMENT_COOLDOWN_SEC`, 429 with a message; a failed post releases it), and a result is saved to the daily board at most once per 0.8 x the post's match length (`matchLengthSec`: duration + golden goal). (4) `readStats` rejects more goals than the match length allows (at least `MIN_SEC_PER_GOAL` 4 s each; against: plus the head start). True anti-cheat would need server-side simulation. Type check, lint, build and 28 logic checks (1 new) pass; Reddit-side behaviour (user comments, limits) needs a playtest.

**Load optimisation round 2 (2026-10-17, `main`):** measured first: on Reddit PLAY goes straight into the match, and the match preloaded 6.5 MB of audio (3.1 MB music MP3 + five 24-bit stereo 48 kHz WAVs, 3.6 MB) before it could start; the music would also decode to ~90 MB. (1) Audio: `scripts/optimize_audio.py` (`npm run audio:release`, needs `pip install lameenc miniaudio`) writes `public-release/audio`: effects as mono 96 kbps MP3 (3.5 MB -> 151 KB: shoot 1, goal 74, start 35, stop 13, goal-miss 28 KB), music re-encoded 64 kbps stereo (3.0 -> 2.0 MB); WAV sources stay in public/audio. MatchScene no longer preloads audio: the effects load in the background once the match is ready (`loadSoundsInBackground`; every play already checked the cache), and the music streams through an `<audio>` element (`ui/streamMusic.ts`: starts once Phaser audio is unlocked, follows the master mute, pause/resume with the match, stop at full time, released on shutdown), so nothing waits for sound and nothing decodes the whole track. (2) `gameAssets.ts`: PAINT_STEPS (court, scenery: no downloads) run one per frame in Boot while the art downloads; PREPARE_STEPS (player frames, ball) after; MatchScene runs both (idempotent). (3) Feed preview (splash.ts): starts only after the card has been visible 1.5 s (`PREVIEW_AFTER_MS`), never with data saver on (then the card says TAP PLAY MATCH); still 30 fps and asleep off-screen. (4) Celebration sheets are `outfieldOnly`: left out of the keeper atlases (310 -> 262 KB each); `MatchScene.scorer` never picks a keeper (a keeper's goal is celebrated by the nearest outfielder). (5) Shared tinted kit layers instead of per-kit atlases were measured and REJECTED: one grey ramp x tint reproduces the kits with mean error ~11 and up to 50 (red / keeper shorts; our limit is 5) because shade / highlight colours are not scaled copies of the base; a smaller palette (128 / 96 colours) only saves 5-10%, so 256 stays. (6) New timing marks: `court painted`, `sound effects`. Result: per match before playable ~8 MB -> ~1.4 MB (game code 226 KB gzip + 2 outfield kits ~480 KB + 2 keeper kits ~525 KB + looks/ball 153 KB); effects (151 KB) and music (2 MB, streamed) after, in the background. Release art 2.05 MiB, audio 2.2 MB, dist 5.1 MB. Type check, lint, build, 27 logic checks pass; no gameplay/listening test.

**Save updates on main (2026-10-17):** changes were already on main as uncommitted work; saving the responsive live lobby, theme, audio assets, master mute and final mix/fade settings together. Latest production build, types and changed-file lint passed. Local commit only; GitHub push not requested.

**Miss/save fade-in (2026-10-17):** only goal-miss now starts at volume 0 and uses a 150 ms Sine.easeIn tween to 0.4. Existing keeper-area and once-per-shot checks retained. Cue destroys on stop/completion and removes its fade on destroy. All other effects remain immediate at 0.4; BGM stays 1. Types and changed-file lint passed; listening review pending.

**Sound effects at 40 percent (2026-10-17):** user deferred fade-ins; only changed shoot/pass, goal, start, fulltime and miss/save volume from 0.5 to 0.4. BGM remains 1. No fade-in changes implemented.

**Sound effects volume (2026-10-17):** shoot/pass, goal celebration, opening whistle, fulltime whistle and miss/save effects now play at 50 percent, per user request. Background music remains at 100 percent; master mute still applies.

**Background music volume (2026-10-17):** user requested full volume; match BGM gain changed from 0.22 to 1. Sound effects remain at 0.65 and master mute still applies.

**Background music and sound toggle (2026-10-17):** supplied 4:20 bgm.wav converted from 74.9 MB PCM to 3.12 MB 96 kbps MP3 in source/release. Normal matches loop it at 100 percent after audio unlock; preview remains silent. Music pauses/resumes with the match, stops at fulltime and is destroyed on shutdown. Pixel speaker button left of i controls master music/effects mute, with green/red-slash states and localStorage preference (session fallback). Types, changed-file lint, build and matching source/release hashes passed. Browser verified button placement and toggling between green speaker and red slash; listening balance and real-device review pending. Screenshot: output/match-sound-button.png in workspace root.

**Lobby theme alignment (2026-10-17):** mobile lobby now reuses the game GLYPHS as accessible SVG pixel lettering, PICO-8 amber/yellow/white colours, stepped PLAY edges and square bordered leaderboard panels. Desktop left panel uses the existing street backdrop cropped to the panel under a dark overlay, leaving the live match visible. Responsive layout and live preview retained. Types, changed-file lint, build and whitespace checks passed; phone views at 390x700 and 320x500 plus leaderboard popup verified locally.

**Portrait live lobby (2026-10-17):** responsive native-size HTML controls overlay the real silent preview on portrait screens below 700 px. Full-card gameplay sits behind a readable gradient; title/live badge at top, teams/kits/formations, duration/difficulty/starting score, challenge, 50 px PLAY target and top 3 at bottom. ALL opens a paginated, non-scrolling leaderboard. Compact-height cards show the top player; desktop keeps the side-by-side Phaser layout. PLAY removes the overlay and starts a fresh player match; Reddit expands into the landscape game. Default feed height is tall. TypeScript, changed-file ESLint, 27 logic checks and production build passed. Browser verified portrait views at 390x700 and 320x500, ALL open/close and PLAY resetting to 0-0. Real Reddit expansion and populated leaderboards still need playtest.

**Live opening lobby (2026-10-17, main):** left panel shows post teams/kits/formations, duration, starting score, difficulty, description and today's top 3 plus personal best. Right panel reuses MatchScene in silent AI-vs-AI demo mode with a cropped broadcast camera and live score; loops full matches without entering ResultScene or writing results. PLAY replaces the demo with a fresh player match; on Reddit feed it expands straight into a fresh match. Inline preview lazy-loads the game only when visible and sleeps off-screen; inline stays unrotated while expanded gameplay retains landscape rotation. Desktop live gameplay, full-match looping and fresh PLAY transition verified locally. TypeScript, changed-file ESLint, 27 logic checks and production build passed; Reddit API data and expansion still need playtest.

**POST MY SCORE permission fix (2026-10-17):** declared permissions.reddit.asUser SUBMIT_COMMENT, required by submitComment with runAs USER. Existing scope user did not enable the UserActions plugin. Requires a fresh Devvit playtest upload/restart; real comment attribution still needs Reddit testing.

**Miss/save sound restricted to keeper area (2026-10-17):** latest user sample copied to source/release. Cue now checks the ball's event position against either chalk penalty box (PITCH.boxDepth/boxHeight, including the goal recess behind the line for misses). Elsewhere the attempt is consumed silently. Keeps once-per-attempt behavior and 65 percent volume. TypeScript, production build and whitespace checks passed; source/release hashes match. Localhost rebuilt; listening review pending.

**Refreshed miss/save sample (2026-10-17):** recopied the latest supplied Downloads/sound/goal miss.wav into source and release goal-miss.wav. Existing triggers and 65 percent volume retained. Production build passed; source and release hashes match. Localhost rebuilt; listening review pending.

**Miss/save audio (2026-10-17):** supplied goal miss.wav saved as audio/goal-miss.wav in source/release. Tracks unresolved shots, plays at 65 percent volume on the first keeper catch/parry/smother or shot hitting a post/wall/going out. Consumes the attempt so save-then-out cannot repeat; normal passes and dribbling do not trigger it. Goals, possession and kickoff clear the attempt. TypeScript, 27 logic checks, build and whitespace checks passed; source/release hashes match. Localhost rebuilt; listening review pending.

**Match over sound (2026-10-17):** supplied stop.wav added to source/release audio, preloaded and played once on entry to fulltime at 65 percent volume. Covers regular and golden-goal endings without sounding at the golden-goal break. Stops any remaining goal cheer; may finish over results and is stopped before a new match. TypeScript, build and whitespace checks passed; source/release hashes match. Localhost rebuilt; listening review pending.

**Match start audio (2026-10-17):** supplied start.wav added to source/release assets and preloaded by MatchScene. Plays once when the opening match is ready at 65 percent volume, waits for browser audio unlock if needed, resets for a new match/replay and stops on scene shutdown. Goals and pause/resume do not repeat it. TypeScript, build and whitespace checks passed; source/release hashes match. Localhost rebuilt; listening review pending.

**Goal celebration audio (2026-10-17):** supplied goal.wav added to source/release audio. Match preloads it and plays once at 65 percent volume when the total score increases for either team; kickoff head starts do not trigger it. Retrigger replaces an unfinished cheer; scene shutdown stops match effects so they do not leak into menus/replays. TypeScript, build and whitespace checks passed; source/release hashes match. Localhost rebuilt; listening review pending.

**Replacement pass/shot sound (2026-10-17):** replaced both source and release shoot.wav with the user's Downloads/sound/shoot.wav. Existing triggers and 65 percent volume retained. Source/release hashes match; production build passed and localhost rebuilt. Listening review pending.

**Pass/shot sound (2026-10-17, main):** user-provided shoot.wav copied to public/audio and public-release/audio. Match preloads it once and plays at 65 percent volume when the ball is actually struck by a pass, through pass or shot on either team, including kickoff. A ball strike counter keeps audio outside simulation logic and avoids duplicate playback within a rendered frame. Browser audio unlock is respected; missing audio does not block gameplay. TypeScript, 27 logic checks, production build and whitespace checks passed. Source/release WAV hashes match; listening review pending.

**Feed card = title screen; result screen: POST MY SCORE and today's top 3 (2026-10-17, `main`, uncommitted):** (1) The inline splash is now one canvas painted like the game's title screen (user: show the menu scene in the feed, not the old HTML card). `ui/menuCard.ts` (no Phaser) paints the street backdrop, title, match line or a moderator's locked settings, and the PLAY button; MenuScene paints its static part with the same function (a canvas texture, buttons stay Phaser) and the result screen's backdrop too, so all three always match. Font glyphs moved to `ui/glyphs.ts` so the splash can draw them (2 KB + a 31 KB shared chunk, no Phaser). The 1280 x 720 view is scaled to fit the card; the wall and street fill the rest. The challenge text is no longer drawn (it is the canvas tooltip). On a locked post, PLAY goes straight into the match (BootScene launches Match; the menu is still reached by QUIT). (2) Result screen: MENU replaced by **POST MY SCORE**: Devvit's `showForm` popup with a comment box and "Share my score and match stats" (on by default), then `POST /api/post-score` comments on the post as the player (`runAs: 'USER'`, devvit.json now declares `permissions.reddit.scope: "user"` and `redis: true`); if Reddit refuses that, the app account posts it headed with the player's name. Button shows POSTING... / POSTED! (once per result). (3) **Today's top 3** panel: the screen sends the match to `POST /api/result` (`server/core/daily.ts`): kept if it is the player's best of the UTC day on this post (Redis zset `daily:{postId}:{day}` ranked by goal difference then goals, stats hash beside it, kept 8 days); returns the top 3 (rank, u/name, score, W/D/L, shots) and the player's own rank if outside it. Results are checked server-side (`server/core/matchStats.ts`: whole numbers in range; a locked post's difficulty and at least its head-start goals against). Outside Reddit the panel says LEADERBOARD ONLY ON REDDIT and posting says ONLY ON REDDIT. Type check, lint, build and 27 logic checks pass (3 new); splash (locked and default), straight-to-match, result screen and a mocked top 3 checked in headless Chrome; the popup, comment posting and Redis board are not yet run on Reddit.

**Minimap (2026-10-17, `main`, uncommitted):** a top-down pitch at the bottom centre of the HUD (`ui/Minimap.ts`, 264 x 143 = the pitch at 1/10, 16 px above the bottom, between the joystick and the PASS button): lines, boxes and goals drawn once, then every frame a square per player in its jersey colour (keepers green / gold), the human's player bigger with a yellow rim, and the ball as a white square. Positions are the players' interpolated render positions (`MatchHudState.minimap`, filled in place by `MatchScene.updateHud`, no per-frame arrays). Not interactive; hidden under the pause / help overlays. Type check, lint and build pass; checked in a headless Chrome screenshot of the local build (kickoff).

**Custom match posts (2026-10-17, `main`, uncommitted):** the moderator menu item is now **Create Street Soccer match**. It opens a form (`server/core/challengeForm.ts`, registered as `challengeForm` in devvit.json) with: post title, optional challenge text, each team's label (A-Z/0-9/space, max 10), jersey colour and formation, bot difficulty, match length (0:30 to 5:00 in 30 s steps) and goals already conceded at kickoff (0-5, the AI starts that many up). `routes/forms.ts` `/challenge-submit` checks the user is a moderator of the subreddit and validates with `parseMatchConfig` (`shared/matchConfig.ts`, shared with the client); invalid answers reopen the form with the reason in a toast. The post stores `{ match: MatchConfig, description }` as **postData** (no Redis, no request: `client/challenge.ts` reads `context.postData`). A post with settings (`locked: true`) shows them on the menu with no difficulty picker, and PLAY AGAIN replays the same `MatchConfig` (MatchResult now carries `config`). Posts without settings (install post, older posts, local preview) keep the old menu with the default match. **Jerseys:** six outfield kits (pink, blue, red, white, black, purple; keepers stay green / gold): the kit atlases are named by colour (`player-pink` / `player-blue` replace `player-home` / `player-away`, pixel-identical) plus 4 new baked atlases (~235 KiB each). Boot, the match and the splash prefetch download only the two kits the post's match uses. Scoreboard shows the team labels with jersey-coloured chips. **Formations:** `FORMATIONS` in tuning.ts (2-1-1 default, 1-2-1, 2-2, 1-1-2, 3-1); every slot has a line and TACTICS push / drop by line instead of slot index (same numbers for 2-1-1, so the default match plays as before); last slot = forward (kickoff taker, CPU outlet). `TeamBrain` takes its side's formation. `MatchFlow(durationSec, startScore)`. Type check, lint, build and 24 logic checks pass (4 new: form -> config, rejections, start clock/score, formation spots); not run in Reddit or a browser.

**How-to-play (i) button (2026-10-17, `main` at 618ae6b):** a blue "i" button sits left of the pause button (`TextButton` icon `info`, a pixel lowercase i with the pause bars' drop shadow). It opens `ui/HelpPanel.ts`: a dimmed full-screen panel with every control drawn with the game's own icons (joystick ring + knob, tinted PASS / SHOOT / TACKLE / SWITCH / DIVE / THROW / KICK discs from `createButtonTexture` + `ACTION_COLORS`, yellow swipe arrows round SHOOT) and short text, plus the keyboard keys; GOT IT closes it. Opening it pauses the match like the pause menu (`HudScene.setOverlay('pause' | 'help' | null)` replaces `setPaused`); ESC closes whichever is open, else pauses; I toggles the help. Type check, lint and build pass; not yet looked at in a browser.

**GitHub main integration (2026-10-17):** merged remote passing, switching and defensive AI updates with local scoreboard/action UI fixes. Resolved UI conflicts by retaining the local UI files; incoming changes there were line-ending-only. Kept both sets of project notes. TypeScript, lint, 20 logic checks and production build passed; unit runner found no tests. Localhost rebuilt.

**UI changes prepared for main (2026-10-17):** scoreboard fitting and YOU/OPP labels, solid pause icon and smaller TACKLE label are ready to merge from assests. Preserved user-adjusted score y=46, bar y=42/height=28 and timer y=50. Latest production build passed.

**Smaller TACKLE label (2026-10-17, assests):** reduced only the TACKLE button label to 75 percent of its previous size. Other actions reset to normal label scale when the context changes. Production build and whitespace checks passed; localhost rebuilt. Visual review pending.

**Pause icon (2026-10-17, assests):** replaced the serif-like II text with a centred two-bar pause graphic. Keeps the pixel button bevel, shadow, hit area and press animation. TypeScript, production build and whitespace checks passed; localhost rebuilt. Visual review pending.

**Scoreboard colour bars (2026-10-17, assests):** box, bars and text now share explicit centre coordinates. Bars shortened from 32 to 24 px, with equal 16 px top/bottom padding, matching the lettering height. Production build and whitespace checks passed; localhost rebuilt. Visual review pending.

**Visible scoreboard centring (2026-10-17, assests):** restored the score anchor to (184,44), the box centre. Display origin excludes the retro font's one-pixel transparent right/bottom padding, centring visible lettering and shadow. YOU/OPP and width fitting retained. TypeScript, production build and whitespace checks passed; localhost rebuilt. Visual review pending.

**Scoreboard placement and labels (2026-10-17, assests):** score text centred at y=48; labels now YOU and OPP. Width fitting retained. Production build and diff whitespace check passed; localhost preview rebuilt. Visual review pending.

**Scoreboard text containment (2026-10-17, `assests`):** reduced the score label's pixel size to 3 logical pixels and fitted its measured width within the 272 px space between the team colour chips. Multi-digit scores shrink as needed without changing the scoreboard footprint. Localhost visual review pending.
**AI defending: recovery runs, cover defender, show wide (2026-10-17):** user picked A, B and C of six proposed defending upgrades (D cut passing lanes, E block shots, F tighter in the box were not built). Shared AI, so our AI teammates defend this way too. (A) **Recovery runs:** with the opponent on the ball, a defender (cover, mark or backup role) caught upfield of the ball by more than `LEVELS.recoverSlack` (150 / 60 / 20 px easy / normal / hard) sprints back (order `sprint`, so no calm glide) if it has the stamina; a zone player aims at least `AI.recoverGoalSide` 40 px goal-side of the ball; never the CPU's outlet forward. (B) **Cover defender** (new role `backup`, `pickBackup`): the nearest free player (not the outlet forward, and only if another is left for the zones) stands behind the presser on the line from the carrier (as seen `readSec` ago) to our goal centre, `AI.pressGap` x the plan's scale + `AI.backupGap` 150 px from the carrier, never within `backupMinFromGoal` 120 px of the goal centre (none if that leaves under `backupMinGap` 120 px: the keeper's job); kept between thinks unless another is `pressKeep` closer; also behind our human when he presses; not while two press an idle carrier. **Hand-over:** `pickPresser` counts a player more than `AI.beatenMargin` 20 px upfield of the carrier as `beatenPenalty` 250 px further away, so once the carrier gets past the presser a goal-side teammate (usually the backup) steps up and the beaten one recovers (A). (C) **Show him wide** (`pressPoint`): the presser shifts `AI.showWide` 0.45 x its gap toward the middle of the pitch (the carrier's inside shoulder), scaled by how wide the carrier is (full from `showWideFull` 260 px off the middle, none in the centre) and faded out near our goal (none within `showWideNear` 330 px of the goal line, full from `showWideFar` 560). Type check, lint and 18 logic checks pass (4 new: show wide, backup, beaten hand-over + recovery, no recovery when goal-side); no gameplay test.

**Faster tap passes (2026-10-17):** user: tap passes felt slow. `PASS.arriveSpeed` 230 -> 360 (the pace a normal pass still has on arrival), `minSpeed` 300 -> 420, `maxSpeed` 1100 -> 1200. Travel times: 150 px 0.48 -> 0.34 s, 400 px 0.95 -> 0.72 s, 600 px 1.20 -> 0.94 s, 800 px 1.49 -> 1.20 s. Shared by everything that uses `passSpeed`: the CPU's and our AI's passes, keeper throws, the weighted pass's roll target and the AI's through-ball / travel-time planning, so CPU passes are quicker and harder to cut out too. Type check passes; no gameplay test.

**Switch after losing the ball (2026-10-17):** user request: when the CPU tackles the ball off the player you control, one SWITCH tap should go to the fastest/closest teammate, who then runs at the ball by himself. A CPU tackle won against our controlled carrier sets `MatchScene.lostBallAt`; for `INPUT.lostBallSwitchSec` 4 s (or until we gain the ball again, or a kickoff reset), a new SWITCH cycle puts the outfielder who can reach the ball soonest first (`interceptPoint`, keeper excluded) instead of the AI's presser pick (`homeBrain.switchTarget`); repeat taps within 1 s still cycle on; the in-our-third threat rule can still put the keeper first. The switched-to outfielder gets a **chase assist** (`INPUT.chaseAssist`, `startChaseAssist`: the receive assist's `kind: 'chase'`): he sprints at the carrier (or to where he can first reach a loose ball) while the ball is the CPU's or loose (not in a keeper's hands, not out), until the human steers him (same takeover rule as the receive assist: push the stick after centring it, or turn it `PASS.assistTakeoverDeg` from how it was held at the switch). TACKLE still works during the chase. Only CPU tackles count as losing the ball (not keeper smothers, not a dribble running away). Type check and lint pass; logic checks and build not run here (the user runs `npm run test:local`); no gameplay test.

**Goalkeeper idle, jump save and standing block (2026-10-17):** user supplied 3 keeper sheets (gloved idle x3, jump save: set / take-off / top / land, standing block x3). Cut, scaled (idle and jump 0.875, block 1.08) onto 720 x 724 cells on the 681 ground line (`public/art/player-keeper-{idle,jump,block}-authored.png`), kit split by rows per pose, baked like every other sheet. New `keeperOnly` sheets (also dive, hold, carry) are left out of the outfield kits' atlases (empty cells), and the look layers are baked from a full home atlas so keepers keep their skin/hair: atlas now 88 frames (11 rows, 1792 x 1408); release art 1.28 -> 1.22 MiB despite 10 new frames. Logic: keepers use the gloved idle loop. `keeperThreat` now returns a KeeperMove: `dive` (shot to its side), `jump` (a shot coming at it that crosses above `standReachHeight` 96 and up to `jumpReachHeight` 132; the AI waits until the ball is within `jumpLead` 0.25 s so the top of the jump meets it), `smother` (dive at a carrier within smotherRange) or `tackle` (carrier within `standTackleRange` 60: standing block that takes the ball within `standTackleReach` 50). `startJump`: 0.5 s in the air (reach height rises from 96 to 132 and back, ground reach 48, body drawn up to 18 px high via keeper z), 0.2 s landing, no running. `startBlock`: 0.35 s block pose standing still, after any standing catch/parry and as the standing tackle. Our keeper: dive button with the stick centred jumps when the ball is coming straight at it (else the usual dive to the crossing point). `Player.reactSmother` replaced by `reactKind`. Type check, lint, build and 16 logic checks pass (2 new: jump timing, standing tackle); no gameplay test.

**Ball-free goalkeeper block (2026-10-16):** removed the footballs from the three-frame blocking draft with built-in imagegen. Saved `public/art/player-keeper-block-3frames-no-ball-v1.png`; transparent background and three standing block poses retained. Visually inspected, not applied in-game.

**Three-frame goalkeeper block draft (2026-10-16):** clarified blocking rather than catching. Created `public/art/player-keeper-block-3frames-v1.png`: standing ready palms, forward hand block contact, open-palm follow-through with ball rebounding away. Transparent source draft matching keeper idle; visually inspected, runtime unchanged.

**Three-frame normal standing hand save (2026-10-16):** user clarified exactly three frames of a normal standing tackle stopping the ball with hands. Created `public/art/player-keeper-standing-save-3frames-v1.png`: ready hands, contact/catch, secure upright hold. Football included in this visual draft; both feet grounded, no deep crouch. Visually inspected; not integrated into runtime.

**Standing keeper tackle draft (2026-10-16):** user clarified standing tackle instead of vertical dive. Created `public/art/player-keeper-standing-tackle-v1.png`: four transparent poses (ready, step/reach, low gather while on feet, upright recovery). Matches existing keeper draft; visually inspected, not integrated into runtime.

**Goalkeeper tackle art draft (2026-10-16):** generated `public/art/player-keeper-tackle-v1.png`: two transparent poses (low forward lunge, grounded smother), matching the keeper idle draft's pink kit and white gloves. Ball omitted for separate game rendering. Visually inspected; not registered or baked into the live game.

**Goalkeeper standing art draft (2026-10-16):** generated `public/art/player-keeper-idle-v1.png`: three standing ready poses in one transparent horizontal sheet, matching the existing pink player character with white goalkeeper gloves. Visually inspected; saved as a new source draft, not registered in the live game or baked release atlases.

**Top-corner shots (2026-10-16):** user: hard to shoot top corner. Cause (simulated with the game's flight numbers): height comes only from the charge, and the accurate green band (0.6-0.8) arrived at most ~15-45 px high (bar 120) from 250-450 px, so a high shot needed an over-hit (up to +5 deg stray, a ~0.05-charge window before going over); and a diving keeper reached 120, the whole goal height. Fix: `SHOOT.fullLift` 420 -> 600 (green-band strikes from 350-450 px now arrive ~50-87 high; over-hits go over the bar), and `KEEPER.stretchReachHeight` 95: a diving keeper's reach height falls from 120 to 95 with how far into a full-length dive it is (`diveReachHeight` in keeper.ts), so top corners beat a full-stretch dive while shots near it are still saved. AI shots (charge 0.7 +- level noise) now arrive ~55-70 high from 250-450 px; Easy will sky a few more close shots. Type check, lint, build and 14 logic checks pass; no gameplay test.

**End walls fit the bigger goals; wall text removed (2026-10-15):** user: the walls were not adjusted to the larger goal. The end-wall gap already follows `goalMouth`, but `PITCH.endWallHeight` was still 120 while the crossbar reached 120.12, so the goal poked above the walls. Now 138.6 (scaled with the goal, +10% then +5%, keeping the original ~15% margin over the crossbar; also the height a ball must clear to go out over them, ballPhysics). The graffiti tags on the far wall (ZONE, STREET, 5V5, KICK IT, GOAL!, NO RULES, PLAY) are removed (user request). Type check, lint, build and 14 logic checks pass; no gameplay test.

**Receiver hold (2026-10-15):** user request: after a pass the receiver should not run off before the ball arrives. The intended receiver of a normal pass (both teams, keeper throws included, the human's player too) is capped at `PASS.receiveHoldSpeed` 80 px/s (~25% of sprint, no sprint) from the pass until it has the ball, the pass stops being its (deflected / cut out: `receiving` cleared), or `PASS.receiveHoldSec` 1 s has passed. It can still step toward the ball (receive assist / AI chase). Through balls are excluded (`Player.receivingThrough`, set by kickThroughPass). Implemented as an optional `maxSpeed` on `stepPlayer` and `MatchScene.receiverHeld` (first time seen receiving, per player). Type check, lint, build and 14 logic checks pass; no gameplay test.

**Goals 5% bigger (2026-10-15):** user tested the load-time work ("good for now") and asked for a 5% larger goal: `PITCH.goalMouth` 286 -> 300.3, `goalHeight` 114.4 -> 120.12, `goalDepth` 66 -> 69.3, `BALL.postRadius` 6.6 -> 6.93 (render and collision share it). Pitch, boxes and player sizes unchanged; everything reads these values from tuning.ts. Type check and 14 logic checks pass; user review pending.

**Shorter first screen, prepared first PLAY (2026-10-15, `main`):** (1) Trimmed Phaser: vite.config.ts aliases `phaser` to `tools/phaser-trim.cjs` (based on Phaser's own src/phaser-core.js; TypeScript still uses Phaser's types) and the `phaserFlags` plugin replaces Phaser's `typeof FLAG` build switches (WebGL only, Canvas renderer off, sound on). Kept: core, WebGL renderer, scenes, 2D cameras, input (touch/mouse/keyboard), loader incl. audio files, textures, animations, Sprite/Image/Graphics/Container/Rectangle/BitmapText+RetroFont/Mesh, scale, events, sound, tweens, timers. Dropped: Arcade/Matter physics, tilemaps, particles, video, DOM elements, canvas Text, lights, unused game objects, gamepad, Canvas renderer (to add one back: require it and its Factory in phaser-trim.cjs). game.js 1.31 MB -> 0.78 MB (355 -> 213 KB gzip). (2) Boot loads nothing before the menu: it opens the menu at once, then keeps running invisibly (`src/client/art/gameAssets.ts`): downloads the outfield kits + skin/hair first, then keepers + ball sheets, then prepares one step per frame (player frames/animations, ball atlas, court textures, scenery textures) and stops. Match only waits ("LOADING PLAYERS n/8") for downloads still missing (and fetches them itself if Boot finished without them); every preparation call is a no-op when already done. A GPU warm-up was not needed: Phaser uploads textures when loaded/painted and compiles shaders at boot. New timing marks: kits and looks, keepers and ball, match prepared. dist/client 2.6 -> 2.1 MB. Type check, lint, build and 14 logic checks pass; NOT run in a browser (no gameplay tests): the trimmed Phaser can only fail at runtime, so a full match must be played to confirm.

**Load-time optimisation (2026-10-15, `main`):** player art is baked at build time instead of on the device. `npm run art:release` = `art:bake` (scripts/bake-player-atlases.ts, Node, no new dependencies: own PNG codec in scripts/png.ts) turns the 15 editable sheets in public/art into 4 kit atlases + grey skin/hair look layers (1792x1280, 78 frames of 224x128) in art-baked/ (gitignored), then scripts/optimize_art.py (needs Python Pillow) writes the shipped WebP: kit atlases as a 256-colour palette stored lossless (lossy WebP shifted colours ~9 levels via chroma subsampling; the palette keeps mean error < 4, alpha exact), look layers and balls lossless, stale release files removed. All bake data/logic (frame tables, kit colours, waist/shorts lines, dive split lines, recolour, shadow, nearest-neighbour scaling, look layers) lives in the pure module `src/client/art/playerSheets.ts`, shared by the game and the bake; playerArt.ts now only registers frames/animations and draws UI textures (the dead code-drawn poses were removed). One pink rule for every sheet (blue >= 0.4 of red), which also removed old pink streaks on the away/keeper shorts in the back/front running frames. Release art 5.6 -> 1.28 MiB (8 files), dist/client 6.9 -> 2.6 MiB, no per-pixel work or 162 MB of decoded source sheets on the device. Flow unchanged (Boot -> Menu -> Match): Boot loads only the ball sheets, opens the menu at once, stays running invisibly to download the 6 atlases, then stops itself; Match shows LOADING PLAYERS only if they are not in yet (and fetches any a failed download missed). index.html shows a CSS loading screen until Boot runs. The splash prefetches game.js/css and the art once the card has been at least half on screen for 1.5 s (never with data saver). Timing marks (`ui/timing.ts`) log `[timing] game code / boot / menu / player art / match ready` in ms to the console and appear in the ?debug overlay. Type check (now also covering scripts/), lint, production build and all 14 logic checks pass; baked atlases inspected as images; no gameplay test; the splash prefetch is unverified on Reddit (depends on its cache headers).

**Celebration camera zoom (2026-10-15, `main`):** user feedback: the goal celebration needs focus on the scorer. While a player is `celebrating`, `CameraRig.update` takes `celebrant` (from `MatchScene.celebrantFocus`) and centres on the scorer instead of the ball/controlled-player blend, aiming `CAMERA.celebrateLift` (80 world px) beyond its feet so the whole body is centred, with x allowed right up to the goal lines, and eases the zoom to `CAMERA.celebrateZoom` (1.6) at the normal zoom rate. After the kickoff reset it eases back to the usual follow and zoom. The code landed in commit `80c2c35`. Type check passed; lint, build and logic checks were not run (user stopped them); no gameplay test.

**First-Play loading fix (2026-10-15, `main`):** pressing Play now shows a match-preparation screen while player artwork is processed one source sheet per rendered frame and skin/hair layers are processed in 64-row steps. Alternate-kit temporary canvases are released after each sheet is copied into its atlas, reducing peak decoded memory. Player atlases use 8 columns (1792x1280) instead of 16 (3584x640), staying within a 2048 px texture dimension common on older phones. The local built game reached the match on first Play with no browser errors. Type check, lint, and production build passed; Reddit mobile timing remains unmeasured.

**Smaller player sheets (2026-10-15, `main`):** release player animation WebP sheets now use quality 98, while both ball sheets remain lossless and editable source PNGs remain unchanged. `scripts/optimize_art.py` verifies identical alpha and bounds visible per-channel color error for every player sheet. The 17 release sheets fell from 9.41 to 5.50 MiB; the complete `dist/client` fell from 10.69 to 6.77 MiB (36.7% further reduction). Production build passed on `main`. A side-by-side run frame looked nearly identical, but the small color changes can affect alternate-kit recoloring; test home, away and keeper animations in Reddit playtest before publishing.

**Local branch integration (2026-10-15):** all authored sprites, player/ball animation work, court and goal updates, celebrations, and the first Reddit build optimization from `assests` were merged into `main` at `af66544`; handoff notes followed at `73da3c0`. Type check, lint, production build and all 14 logic checks passed before that merge. The subsequent quality-98 size reduction was merged from `assests` to local `main` at `579faf6` and passed a fresh production build.

**First Reddit client build optimization (2026-10-15):** the merged baseline uses lossless WebP in `public-release/art`; the editable PNG originals remain in `public/art`. Devvit client/server source maps are disabled, and the release public directory excludes development review pages and source PNGs. Boot loads the release sheets. Home-kit atlas generation reads its source images directly; after first-match atlas creation, Phaser releases all authored source textures. Ball atlas creation skips source reads on later matches. Production client size fell from 25.11 to 10.69 MiB (57.4%); sprites from 13.62 to 9.41 MiB (30.9%). Type check, lint, build and 14 existing logic checks passed; all 17 referenced sheets are present in release output.

**Warm street asphalt revision (2026-10-15, `assests`):** user preferred the older field to the blue-gray version. Code painter now restores warm gray/brown asphalt with exposed aggregate and dark pits, four darker/lighter resurfacing patches and stronger tar seams, dusty edges, scuffed goal wear, twelve short sealed cracks and broken faint basketball key/arc paint. Current football markings stay bright and unchanged. Goal recess floor matches the warm base; geometry, goals and surrounding scenery retained. Texture preview inspected; user gameplay review pending.

**Goal celebrations (2026-10-15):** the scorer plays one of three user celebrations, picked at random once per goal (`CELEBRATIONS` in playerArt.ts; `Player.celebrate(style)`), each 6 poses looped at 6 fps through the goal phase: (0) fists, fists up, arms-up hop, jump, flex, one arm up (`player-celebrate-authored.png`, scale 1.45); (1) run in, knee slide arms out, fists, fist up hand on heart (`player-celebrate2-authored.png`, 1.37); (2) dance: hips, flexes, swing, pointing up (`player-celebrate3-authored.png`, 1.35). Sheets: 3x2 cells of 720x724 (wide for outstretched arms), poses scaled 1.45x (nearest) to the idle size, centred on the legs, feet on the 681 ground line, the jump lifted ~104 px. Kit split by rows per pose (`CELEBRATION_WAIST` / `CELEBRATION_SHORTS_END`); deeper pink matched with the 0.4 blue limit like the dive. Scorer = `ball.lastTouch` if on the scoring team, else (own goal) the scoring team's outfielder nearest the ball (`MatchScene.scorer`). `Player.celebrate()` sets `celebrating` until the kickoff reset (`placeAt`). Atlas now 78 frames (5 rows of 16). Skin/hair look layers apply. User visual review pending.

**Tackle stagger 1.0 s (2026-10-15):** `TACKLE.staggerSec` 0.5 -> 1.0 (user choice) so the coming 8-pose tackled-player fall animation reads; also applies to a keeper smother. The fall art itself is still to come (the image arrived mid-task and was not saved as a file; asked the user to resend).

**Court surface character (2026-10-15):** `paintGround` (pitchArt.ts) now runs a one-off pixel pass over the court after the speckle: slow light/dark grain (value noise, 44 and 14 art px cells, +-6-9%), polished wear (+10% lighter, fewer grit specks) in the centre circle and in front of each goal (`courtWear`), a dark dusty strip ~22 art px along the walls and fence with a ragged edge (`edgeDust`, -16% and 30% towards a dust brown; skipped in the goal mouths), and 7 hard-edged resurfacing patches (0.9x or 1.07x) with dark seams and chipped light pixels. Baked into the ground texture at startup, no runtime cost. Cracks, puddles and lines unchanged. User visual review pending.

**New keeper dive (2026-10-15):** `public/art/player-dive-authored.png` is rebuilt from the user's 4-pose dive (crouch, launch, full stretch, landed; 1536x1024 WebP with alpha). Poses scaled 1.25x (nearest, to match the old dive's size) into the same 3x2 grid of 1152x724 cells, centred, bottoms on the 681 ground line (launch lifted 40 px, stretch 20 px). Cells: crouch, launch, launch, stretch, stretch, landed, so Player.ts timing is unchanged (crouch 0-20% of the flight, launch to 60%, stretch to the end, landed until recovery). Keeper kits split shirt / shorts / socks with slanted lines per pose (`DIVE_KIT_SPLITS`, playerArt.ts) since the body is diagonal or flat; the dive's deeper shaded pink is matched with a lower blue limit (0.4 vs 0.55). User visual review pending.

**New rolling ball (2026-10-15):** `public/art/ball-authored.png` is now the user-supplied four-view ball (2000x667 WebP with alpha, cut into a 4 x 64 px strip, ball filling the frame like the old one). `BALL_FRAMES` is `a`-`d`; the roll advances a frame every 14 px, forwards when the ball moves right and backwards when it moves left (Ball.rollDir; a straight up/down roll keeps the last direction). The shot squash/stretch frames (`ball-shot-authored.png`) are unchanged, drawn from the older ball. User visual review pending.

**Player looks (2026-10-15):** every player has their own skin tone and hair/beard colour, from one set of authored art. At startup `createLookLayers` (playerArt.ts) reads the home atlas, classifies skin and hair pixels (warm tones; hair = darker, less blue; a neighbour vote cleans copper hair highlights and specks) and builds two grey atlases, `player-skin` and `player-hair`. Each Player draws them as two tinted sprites over the kit sprite, copying its frame, position, scale, angle, flip and depth every render. 6 looks in `LOOKS` (original, olive/black, brown/black, fair/blond, dark/black, light/red); home players take looks 0-4, away starts 3 along, so nobody in a team shares one. Memory is fixed: two extra atlases whatever the number of looks. User visual review pending.

**Pitch resize rendering correction (2026-10-15):** car park coordinates now follow the right goal line, preventing parking bays/cars from overlapping the enlarged playing field and goal recess. Camera follow limits derive from pitch dimensions. Goal frame thickness now follows the 10% larger post radius, shared with collision. Pitch/goal geometry retains the requested 10% increase; camera zoom/player scale remain unchanged. User visual review pending.

**Larger pitch and goals (2026-10-15, branch `assests`):** pitch dimensions increased by 10% to 2640x1430; goal opening 286, height 114.4 and net depth 66. Centre circle, penalty/goal areas and formation positions scale with the field; kickoff retains the 24 px ball gap. Player size, camera settings and movement/save tuning retained. User visual review pending.

**Shot and keeper carry replacements (2026-10-14):** latest supplied six-pose ball sheet replaces shot artwork; latest open-glove running sheet replaces keeper carrying artwork. Live held-ball anchors have been remeasured for all six poses. Existing shot trails, animation rates, stationary holding, physics and user scale/camera settings remain unchanged; visual review on localhost pending.

**Shot-ball deformation (2026-10-14):** supplied six-pose squash/stretch ball plays once at 18 FPS on shots (and human keeper kicks), then returns to the rolling sheet. Shape changes preserve the sprite centre and base ball diameter. Existing trail rendering, shadow, ball physics and shot tuning are unchanged.

**Keeper carrying and authored ball (2026-10-14):** moving keepers use the supplied six-pose gloved carrying cycle; stationary keepers retain the earlier four-pose holding loop. Ball hand anchors follow each pose and mirror with facing, with gloves drawn over the moving keeper's held ball. The ball itself now uses the supplied six-frame rolling artwork, preserving its logical 24 px world diameter and all ball physics.

**Tackled-player reaction (2026-10-14):** supplied four recoil/fall poses now play on the carrier after a successful tackle or keeper smother. The reaction follows the existing stagger lock, mirrored to the player's facing; the final portion uses existing tackle get-up poses. Failed tacklers keep their own slide/stumble recovery. No changes to tackle success, ball release or lock durations; user visual review pending.

**Keeper holding artwork (2026-10-14):** supplied four holding poses now loop while a keeper holds the ball, for both teams. The live ball is drawn between per-frame hand anchors, mirrored with the player, at a suitable held size. Free-ball rendering resumes on release; possession/distribution physics remain unchanged. The supplied sheet contains holding only, so no new throw wind-up/release animation is inferred.

**Authored goalkeeper dive (2026-10-14):** both keepers use the latest six-pose, two-row raised-arm dive sheet, replacing the earlier four-pose sheet. Five poses span the active dive and the sixth holds through recovery; the source reaches left and is mirrored for rightward dives. Frames follow each dive's actual simulation start/end, including short AI dives; the landed pose holds through recovery and mirrors for leftward dives. Authored poses are not rotated. Save physics, reach and timing remain unchanged; user visual review pending.

**Authored tackle (2026-10-14):** supplied eight-pose slide/recovery art replaces the reused shooting animation for human and AI tackles. Frames follow simulation wind-up/active/recovery; failed tackles hold the low pose before getting up, without rotating the authored slide. Existing tackle movement, contact and success rules are retained. Type check, lint, WSL build and all 14 logic checks pass; user visual review pending.

**Directional running (2026-10-14):** supplied back/front sheets are used for up/down movement for all four kits. Predominantly vertical headings select four-frame cycles at 8 FPS; horizontal movement keeps the eight-frame side cycle at 16 FPS; upward and downward diagonals use their supplied four-frame three-quarter sheets at 8 FPS, mirrored for left. Enter/exit thresholds reduce view flicker; vertical sprites are not mirrored. Idle/shoot remain their existing side-view art.

**Player size (2026-10-14):** user changed `PLAYER_PX` to `3.0 / DETAIL`; the frame world height is now 96 px (previously 88 px). Frame canvas is now 224x128 to fit full sliding tackles and outstretched keeper gloves; height and user-selected world scale are unchanged. WSL production rebuild passed; refresh localhost for visual review.

**Authored idle artwork review (2026-10-14):** the user supplied a transparent four-pose idle sheet. Prepared aligned 352x724 frames in `public/art/player-idle-authored.png` plus frame metadata. `/player-idle-review.html` previews the original artwork enlarged and at 48-120 px heights, with play/pause. The game now uses all four supplied idle frames for every kit. Boot preloads the image; player textures composite it at the existing world size and foot origin. Home preserves the original colors, away/keeper clothing is recolored. Running now uses the latest supplied two-row, eight-pose sheet in row order at 16 FPS, replacing both earlier Run 1 and Run 2 sheets. Shooting uses the supplied wind-up/contact/follow-through/recovery frames at 14 FPS. All kits use the authored art; home retains source colors and other kits recolor clothing.

**Character detail update (2026-10-14, branch `assests`):** code-generated player frames are now 96x128 with a smaller adult head, three-quarter eyes/nose/ear, swept hair highlights and a short beard, broader shoulders, longer angular jersey, clustered fabric folds, sleeve cuffs/armband badge, shorts folds, sock stripes and layered white boots. Updated toward the user's supplied sprite sheet: home wears pink shirt/shorts/socks; away is blue, keepers green/gold. Character-specific warm color ramps are named in the shared palette. World size, leg/arm animation endpoints, frame names and animation timings remain the same. The neck/shoulder drawing anchors are adjusted to lengthen the jersey; textures rasterize at four times the original resolution. A generated sprite contact sheet was visually inspected; type check, lint and the WSL production build pass. In-match/phone visual review is still pending.

**Phase 2 (ball, dribbling, pass, shoot, goals, match flow) is done** and verified in a local preview with scripted scenarios. It still needs a real-phone playtest in Reddit. **Phase 3 (5v5 with AI) is in progress: steps 1-5 of 6 (away team, AI hand-over, shared outfield AI, AI carriers + tackles, keepers + difficulty) are done. Step 6 (regression and phone playtest) is in progress: the code audit and its fixes are done (no automated gameplay testing, user request: only type check, lint, build and logic checks); the phone playtest is the user's.** **After the audit, an AI overhaul (user request: "every AI player marks our player, it feels robotic"; ideas taken from reading the Soccer-Unity (FStudio match engine) and openFIFA repos, no code copied): zonal defence with at most 2 markers, smarter chasing, shot placement and chips, through balls, give-and-go, showing for the ball, rest defence, pressure by closing time, smoother dribbling round defenders, front-only AI tackles, switching to the AI's chosen player, positioning error and keeper dive error by level, chance-based keeper catches. Not playtested yet (user: no automated testing; the user tests).** The user picked plan v3 (one shared AI for both teams, opponents first) plus v2's tackle rules, steering, debug overlay and regression matrix. Build order: 1 away team + resets, 2 released players hand over to AI, 3 shared outfield AI (support, recover, chase/intercept, one presser, mark/cover), 4 AI carriers (pass/shoot/dribble) + tackles (human B1 too), 5 keepers + Easy/Normal/Hard, 6 phone playtest. Keeper control stays for now (the plans assume the keeper is AI-only; the user hasn't decided).

What works now:

- Inline splash post in the feed (`splash.html`), retro styled, with a Play button that opens the game in expanded mode.
- Scene flow: Boot -> Menu (difficulty picker + Play) -> Match + Hud (overlay) -> Result (Play again / Menu). The pause menu's Quit goes back to Menu.
- **Court (perspective view):**
  - textured ground, the far wall with graffiti and an apartment facade, thick end walls with the goals in the gaps;
  - 3D goals with nets, a see-through fence on the near touchline, a crowd behind it;
  - a basketball court and a car park beyond the goal lines.
- **Teams (5v5):** home 4 outfield players in a 2-1-1 shape (pink) plus a keeper (green); away (CPU) 4 outfield players in the mirrored shape (blue, `MatchScene.away`) plus a keeper (yellow). All 10 are in `everyone` (collisions, possession, rendering) and both outfield teams are constrained and stepped. Outfielders the human isn't controlling are driven by the **shared outfield AI** (below). Kickoff: the kicking side's forward stands next to the ball and the other side's forward waits outside the centre circle (`FORMATION.defendKickoffX` 1020, mirrored). `opponentsOf` now includes the opposing outfielders, which affects shot/pass pressure and chips over a blocked pass lane. The away keeper throws to the away outfielders.
- **Outfield AI (`systems/ai.ts`, `AI` in tuning):** one `TeamBrain` per side, the same code for both. It re-assigns roles every `LEVELS.thinkSec`: 0.3 / 0.2 / 0.12 s for the CPU by difficulty, 0.2 s (normal) for our teammates. Every step each AI player steers to its role's target through the normal `stepPlayer` (same speeds, turning, stamina, no teleports); standing still, it faces the ball. Only runs while live (not during freezes or celebrations).
  - **Loose ball:** one **chaser** per team: whoever reaches the ball first at a sprint along its predicted roll (`interceptPoint`); an intended receiver of ours always goes. If our human is quickest, no AI chases. The current chaser keeps the job unless someone is 0.25 s quicker. **How it chases (`chaseOrder`):** no opponent (their keeper included) can get there within 0.5 s of it -> it **jogs** (`relax`, saves stamina); an opponent gets there 0.2 s+ sooner and that is in our half -> it runs to a spot 70 px **goal-side** of where the opponent will take it (`goalSide`) instead of arriving behind him; a pass's receiver always goes for the ball. Others **cover** formation spots.
  - **Opponent on the ball (zonal defence, user complaint: "every AI player marks our player"):** one **presser contains, it doesn't shadow** (user feedback: it followed the carrier like a shadow and cut out every pass back; `pressPoint`): its spot is worked out when its team thinks (it reacts instead of mirroring every step) **from the carrier as it saw it `LEVELS.readSec` ago** (0.35 / 0.25 / 0.15 s; ours 0.25; `Player.seenAgo`: feints and sharp turns wrong-foot it), goal-side of where the carrier will be in 0.4 s but not following a carrier that retreats toward its own goal, 85 px off a slow carrier and 95 px off one on the move, growing to 170 px the deeper the carrier is in its own half (from 1200 to 1700 px from the presser's goal line: room to play out); it goes in for tackles (see Tackles). **A carrier standing idle on the ball gets attacked** (user request; `carrierIdle`): slower than 40 px/s for 1.5 s, the presser goes to the ball in front of it (30 px beyond the ball) with double the tackle chance (at most 0.95); after 2.5 s a second presser closes in from behind; moving off faster than 120 px/s ends it. The main presser keeps the job between thinks (`mainPresser`). If our human is within 130 px of the carrier, they are our presser and no AI presses. **Markers (`assignDefence`):** only opponents within 900 px of our goal line (a marked one keeps his marker to 1020 px) get one, nearest our goal first, **at most 2 and never everyone** (at least one player always holds a zone); a marker keeps its man between thinks (no swapping), else the nearest free player takes him. A marker stands goal-side, leaning toward the ball, 50 px off plus 0.12 px per px the man is from the ball (up to 170: tight near the ball, loose away from it). **Everyone else holds a zone** (`zoneSpot`): the dropped-back formation spot pulled 20% toward the line from the ball to our goal centre; in the CPU's balanced plan **the forward stays up** instead (not dropped or pulled in: an outlet, and one body fewer round the ball); in our attacking plan it tracks back too.
  - **Own ball (`assignSupport`), in order:** give-and-go runners keep running; **rest defence**: with two or more AI players left, the deepest stays 110 px goal-side of their most advanced player (at least 150 px behind the ball) against the counter; **show**: our carrier (the human too) under pressure (`pressureOn` >= 0.35) -> the nearest teammate (the one already showing keeps the job) goes to a free spot 200 px from the carrier (of 8 directions, the 4 nearest it; no opponent within 90 px of it or 30 px of the pass line; kept while still free); **runner**: **our forward** (else the furthest upfield) at least `runAhead` ahead of the ball (ours 340, the CPU 280), or at its pushed-up spot if further (none while a give-and-go run is on); the rest **support**: spots pushed upfield by the plan (`TACTICS.pushAttack` per slot: ours 330 / 330 / 420 / 480 px for backs / midfielder / forward, the CPU 140 each) and **1.6x further out from the middle** (`AI.attackWidth`: wide players near the touchlines), moved out of the way of the nearest opponent (140 px) and kept 240 px from the carrier.
  - **Give-and-go (`passAndRun`):** after any pass of ours (AI or the human's), the passer bursts 320 px upfield (25% of the way in to the middle) flat out for 1.6 s, with the plan's chance (ours 85% from 45% of the way up the pitch, none before 20%; the CPU 60% from 55%, none before 30%; ramping in between). Runs end when the opponent gets the ball, when the time is up, or when the runner gets the ball.
  - **Positioning error (`LEVELS.posError`):** every spot (zones, support, marks, rest) is off by up to 70 / 30 / 12 px (easy / normal / hard; our teammates 30), renewed every ~3 s per player: natural gaps, never a machine-perfect shape.
  - Formation spots slide only a little with the ball (0.35 along, 0.2 across; was 0.5 / 0.35, which piled everyone up round the ball). Teammates within 150 px push their spots apart (cover / support / run / show only). **Calm movement** (positioning jobs: cover, support, run, show, mark, rest): the spot glides to new places (`AI.aimEaseRate` 3/s, `TeamBrain.aims`; a new job over 250 px away is taken at once) and a player standing at it only sets off again once it is 45 px away (`restartDist`): no fidgeting. Chasers, pressers and anyone sprinting go straight. Sprinting: chasers and pressers beyond 60 px (not a jogging chaser), give-and-go runners, anyone beyond 320 px, saving stamina below 30.
  - **Hand-over (step 2):** `setControlled` wakes both brains, so the released player gets an AI role on the next step and the new one drops its role. Our AI players can win loose balls; control then follows the ball to them, as before.
  - **?debug:** each outfielder shows its role over its head (HUMAN for yours; `updateRoleText`).
  - AI never decides for a ball the human controls (our keeper included, `Player.controlled`), never chases a ball that is out behind a goal, and both brains are reset at every kickoff (`TeamBrain.reset`: no queued pass, shot or tackle survives a restart).
  - **Frame cost on a phone:** tap the FPS readout for the debug overlay; its `SIM x MS/FRAME PEAK y` line is the simulation's cost per rendered frame (smoothed, and a slowly decaying peak).
- **AI carriers (`TeamBrain.decideCarry`, executed by `MatchScene.stepAiCarriers`):** any AI player with the ball (an AI keeper with it at its feet too) scores its options at each think, each score x (1 +- `decisionNoise`, by level). **Pressure (`pressureOn`, 0..1)** = how soon an opponent could be on the carrier: (distance - 40) / (165 px/s + 0.35 x how fast it is already closing in); 1 at 0.12 s or sooner (a standing opponent ~60 px away, as the old 60 px rule), 0 from 0.2 s. A sprinting defender counts as nearer than a jockeying one; only opponents able to act count (not in a tackle, staggered or down: passing every time a tackle started made tackles useless):
  - **shoot** within 760 px of the goal centre, **when the chance is as good as the moment asks for** (user request: not only from round the box): `shotQuality` 0..1 = distance (full at 150 px, none from 800, ^1.5) x angle (worse from wide) x openness of the best spot (0.35-1; x0.3 with a defender within 35 px of the line), against the quality wanted = 0.55 with time and space down to 0.12 when hurried (hurry = the most of: pressure, a crowd of 2+ opponents within 160 px (3 = full), someone within 140 px straight ahead toward goal (0.5)), x a random **appetite** 0.7-1.3 per possession. Score 1.1 x (quality / wanted), at most 1.6x. Roughly: unpressed it works the ball in and shoots from 250-440 px (inside or at the edge of the box), pressed or crowded it shoots at once from up to 600-670 px; a keeper rushing out counts as pressure. **Aim (`shotTarget`):** the most open of 5 spots across the mouth (30 px inside the posts): the one whose line is furthest by angle from the keeper and any defender in front (minus their width; up to 6 degrees of random preference); pulled toward the centre by up to `aimSpread` 110 / 70 / 40 px; charge 0.7 +- 0.25 / 0.12 / 0.05 through the normal `kickShot`. **Chip (`chipShot`):** a keeper 110+ px off its line, 140+ px from the ball and within 70 px of the line to the goal centre: the lowest charge (0.2-0.8) whose full chip (simulated with the real flight, `actions.chipFlight`) passes 16 px over the keeper's standing reach and crosses the line 14 px under the bar (or lands within 80 px of it), scored 1.1 (+ up to 0.4 the further out the keeper) - 0.4 x pressure;
  - **pass** to a teammate 100-750 px away: 0.15 + 0.5 x progress + 0.3 x open + 0.3 x lane safety, -0.2 over 500 px, +0.3 x pressure (progress weighs 0.7 in our attacking plan, 0.5 for the CPU); the normal `kickPass` (auto weight, lead, chip over a blocked lane). **Through ball** to a teammate running upfield (150+ px/s): aimed where it will be when the ball gets there plus 50 px beyond (`actions.throughSpot`, refined with the pass travel time), only if it gets there before any opponent by the plan's margin (ours 0.08 s, the CPU 0.15 s); 0.2 + 0.6 x progress + 0.3 x margin + 0.15 x lane, +0.3 x pressure; struck by `actions.kickThroughPass` (pace fitted to the spot, same error and chip rule);
  - **dribble** (not keepers) 200 px ahead: **straight upfield until 45% of the pitch, cutting in toward goal fully from 80%** (keeps the width); **turned away from opponents** within 200 px ahead or beside (summed, nearer and more ahead = stronger, at most 50 degrees; the other way at a side wall); **eased** 55% per think toward the new direction (no zig-zag); 0.45 + 0.5 x space ahead - 0.4 x pressure; sprints with 220 px of space; **counter-attack:** for 3 s after winning the ball from the other side (`turnoverAt`), it heads straight at goal, +0.35 with nobody within 250 px ahead (user request: "get the ball and go through on goal");
  - **clear**: a lofted kick upfield (`kickShot` at 0.6 with swipe-up 0.7): 0.05 + 0.5 x pressure in our half, 0.35 for a keeper, else 0.05.
    Passes and shots wait for the first touch to settle (0.3 s after gaining it).
- **Tackles (`systems/tackle.ts`, `TACKLE` in tuning), the human and the AI alike:** start-up 0.10 s (slows), lunge 0.15 s (70 px), recovery 0.35 s. Contact = an opposing carrier's ball within 48 px and within 70 degrees of the lunge, during the lunge (one per tackle). Success chance 55%, +15% from the carrier's front/side (within 110 degrees of its facing) or -30% from behind, -15% if the carrier sprints, +10% if the tackler went in at a sprint. **Juke:** the carrier's stick (or AI direction, `Player.wantDir`) turned more than 90 degrees since the tackle started = always fails (was 120: too hard to fake). **AI tackles are judged on the carrier as seen `readSec` ago** (where it was, faced and moved), so a late cut makes the lunge miss. **Won:** the ball is knocked loose at 110 px/s toward a point 40 px ahead on the lunge line, where the sliding tackler collects it (first touch is the tackler's for 0.35 s, `Ball.priority`); the carrier staggers 0.5 s (no moving or touching the ball); the tackler is up after 0.1 s. **Failed:** the tackler stumbles 0.6 s (drawn on its side). Deviation from the plan's 300 px/s pop: popping along the lunge sent the ball away from the tackler to the carrier's teammates; a random-side nudge often took it out of reach. Now every won tackle in tests ended with the tackler on the ball.
  - **Human:** B1 (TACKLE) without the ball lunges along the stick (the facing with it centred); not at a teammate's ball.
  - **AI:** only the presser, when the ball (predicted 0.17 s ahead) is within lunge reach and **only from the carrier's front or side** (from behind it runs goal-side first): a chance per think of 0.25 / 0.45 / 0.65 (easy / normal / hard; ours normal), doubled against a carrier idle on the ball (at most 0.95); 1 s cooldown; none in the first 0.5 s after the kickoff pass (`liveSince`). A shielding carrier is reached by the idle attack (it goes to the ball after 1.5 s standing), no longer by a presser glued at 40 px.
- **Pass in flight belongs to its receiver:** while a pass travels, the passer's other teammates can't take it (opponents can intercept); a deflection frees it. Needed because AI teammates now stand in passing lanes (an AI pass was cut out at 904 px/s by a teammate next to the passer).
- **Ball** (`entities/Ball.ts`, `systems/ballPhysics.ts`):
  - 3D position and velocity: rolling drag 0.35/s plus 40 px/s² rolling friction, air drag 0.5/s, gravity 1400, bounce 40%, spin curve. A full-power shot travels about 1000 px in all (it no longer crosses the court); a tap about 525 px;
  - 50% bounce off the far wall, near fence, end walls and posts;
  - enters a goal only through the mouth, under the bar (fully over the line = goal, then the net holds it); at bar height it hits the crossbar and comes back; over the bar, or over an end wall (higher than 120), it goes out behind the goal. An OVER THE BAR / OUT banner shows, and after 0.9 s the defending keeper restarts with the ball in hand (ours is then human-controlled);
  - drawn with two rolling frames, lifted and scaled with height, plus a ground shadow that shrinks and fades as it rises (added early at the user's request, so height reads in perspective).
- **Possession** (`systems/possession.ts`):
  - control within 34 px, below 40 px high (feet to chest) and under 1000 px/s, so passes and most shots at a teammate are controlled; faster balls deflect off the player (20% speed kept); 0.25 s regain lockout;
  - the intended receiver of a pass always controls it, with a +22 px first-touch bonus; an opponent cuts out a pass still moving faster than 200 px/s only within 22 px of the ball (a slower, dying pass: the normal 34);
  - **close-control dribbling (FIFA-like):** the ball's place around the carrier is an angle plus a distance. The distance is about 20 px at the feet when slow, about 28-30 jogging and about 42-53 sprinting, with small rhythmic taps or sprint knock-ons (smooth, no jolts). The angle follows the facing at a limited 620 deg/s, so on turns the ball is dragged round the player in an arc. The first touch is cushioned (a fast ball runs on a little, then settles);
  - **momentum movement:** speed ramps (accel 1500, or 1150 with the ball; decel 1800); turns are fast when slow (a 1080 deg/s pivot under 70 px/s) and wider at speed (900 -> 380 deg/s, x0.85 with the ball); sharp direction changes brake (plant and turn); with-ball speeds 205/290 px/s.
- **Controls:**
  - two context buttons (HUD bottom right) plus J/K: PASS/SHOOT with the ball, TACKLE/SWITCH without;
  - 150 ms press buffer when the ball is close;
  - control follows the ball (gaining it switches control to the carrier).
  - **Controlled player marker (FIFA-style, `MatchScene.updateGroundMarker`):** the yellow arrow overhead plus a **ground ring** (radius 44 world px, dark translucent disc, white outline) with a **pointer** on it toward the facing direction (`heading`). While SHOOT / KICK charges, the pointer follows the strike direction, a **24-segment gauge** fills round the ring (white, green in the perfect band, red when over-hit, white for a keeper kick) and **the pointer itself stretches out into the aim arrow** (ease-in, up to 190 px; one arrow, no second arrow from the ball). The same happens for a held (weighted) PASS, pointing at the target, with the right-weight segments glowing green. The ring is drawn as projected points every frame at depth y - 0.5 (under the player).
- **Pass** (`systems/actions.ts`):
  - target = the **nearest** outfield teammate in the stick direction (the facing when the stick is centred): a 60° cone first, widening to 110°, 180° and then all round if nobody is in it (`PASS.coneStepsDeg`). A pulsing blue ring marks the target while you hold the ball;
  - 0.08 s wind-up; **tap** = strike speed solved from the ball physics so the pass arrives at about 230 px/s (clamped 300-1100); **hold = weighted pass**: the charge (0.9 s full) sets how far it rolls (100-1300 px, curved, up to 1150 px/s), so it can stop short or run past (gauge green when well weighted); leads the receiver; 1.5° error (4° under pressure; the CPU x `LEVELS.passErrorScale` 2.6 / 2 / 1.4, the same as before); chips over an opponent within 60 px of the line that the ball still has to pass (30 px or more along it: a presser beside or behind the passer no longer turns a pass into a chip);
  - control moves to the receiver at release. **Receive assist (`PASS.receiveAssist`, `MatchScene.humanSteer`):** the receiver comes to meet the ball (where it can first reach it, sprinting when an opponent could get there too) until you steer him: push the stick after centring it, or turn it 40° (`assistTakeoverDeg`) from how it was held when you passed. Before this, the stick still pushed the way you passed ran him away from the ball. Also after keeper throws. **The other side reacts to a pass late:** its AI doesn't re-think for `LEVELS.passReactSec` (0.45 / 0.32 / 0.22 s; ours 0.32 for CPU passes; `TeamBrain.delay`), so only players already in the way can cut it out; a CPU player who wins the ball still decides at once. A chaser that will clearly lose the race to the intended receiver goes goal-side of him instead of lunging at the ball. The receiver keeps a guaranteed first touch while the pass travels (the passer's other teammates leave it; opponents can intercept), dropped once the loose ball is slower than 60 px/s or deflected. (The Phase 2 rule "nobody runs toward the ball by themselves" ended with Phase 3: everyone the human isn't controlling is AI-driven now.);
- **Shoot (skill-based, user request: no help from the game; `actions.kickShot`):** the ball leaves **exactly along the stick** (the facing with the stick centred). No aim assist, no snapping to the goal, no auto-ranging, no automatic curve. Tap = 900 px/s (lift 120); hold up to 0.6 s for up to 1250 px/s (lift 420). **The run feeds the strike (FIFA-like):** half the run speed along the shot is added to ball speed (subtracted when running away); 0.35 x that run speed is added as lift; shooting back across the run loses up to 30% power. **Accuracy = timing:** releasing in the green band (charge 60-80%) is a perfect strike (strays at most 0.5°); any other release strays up to 2°; over-hitting past 80% adds up to +5° stray and +180 lift (over the bar). Sprinting +3°, straight back across the run +5° (scaled), a defender within the pressure radius +3°. Stray is a triangular spread (mostly small); there is no random lift. While charging, the ring pointer stretches into an **aim arrow** showing the strike direction only (white / green perfect / red over-hit; `SHOOT.aimArrow` turns it off). A free ball faster than 650 px/s draws a fading trail.
- **Swipe shots (PES-mobile layout, ANALOG):** while pressing SHOOT, slide the thumb: up = CHIP, down = POWER, left / right = CURL. **How far you slide is how much of the effect** (10 px of wobble ignored, full at 70 px; `Controls.swipe` is a vector, `actions.shotShape`), and diagonals mix (e.g. up-right = a chipped curler). It follows the thumb until release, so sliding back takes effect away. Hold to charge as usual; a flick works too (but a flick is a low-charge strike). The arrows around the button grow and turn yellow with the amount, and because the thumb hides the button, **a label above the shooter** spells out the shape while charging (e.g. `CHIP 70 CURL R 70`, `SHOT` with no swipe; `actions.shotLabel`). Keyboard: T / G / F / H = SHOOT with a full swipe up / down / left / right.
  - **Up = CHIP:** blends toward a lob whose pace (450-900) and loft (450-750) the charge sets. At a full swipe the first bounce is about 310 px at a tap and about 700 px at the sweet spot, so you judge the distance. Stray -30% at full.
  - **Down = POWER:** +22% pace and +30% lift with topspin (`ball.dip` up to 0.7 extra gravity until it lands), stray +40%, and over-hit lift +30% at full.
  - **Left / Right = CURL:** sidespin up to 1.1 rad/s (decaying) bending that way **as the shooter sees it** (moving right on screen, a left curl bends up the screen). It leaves along the stick and bends away from that line, so aim outside the post. -20% pace, -25% lift, stray -20% at full.
  - No swipe = the plain shot above (no spin). `BALL.spinMinSpeed` is 300 so curlers keep bending as they slow.
- **Switch:** a tap goes to **the player our AI has sent for the ball** (our presser when they have it, our chaser / a pass's receiver when it's loose; `TeamBrain.switchTarget`), else to the teammate who can get to the ball soonest (`interceptPoint`, the keeper included); repeat taps within 1 s cycle on in that order; 0.12 s cooldown. **Holding SWITCH (0.35 s)** jumps straight to our keeper. When the ball is heading toward our goal (faster than 250 px/s, in our third), a tap picks the keeper first. **After a shot** control follows the outfielder **closest to the loose ball**, re-checked every step as the ball travels (the shooter keeps it while still closest; another takes over once 30 px closer, `SHOOT.followShotMargin`). It ends when someone gains the ball, when the ball has died (after a last pick), when the player presses SWITCH, or after 4 s (`followShotMaxSec`; `MatchScene.followShotUntil`).
- **Goalkeepers** (`systems/keeper.ts`, `KEEPER` in tuning; both teams, and ours whenever the human isn't controlling it):
  - **Positioning** (`keeperStick`): on the **bisector of the angle between the ball and the two posts** (covers both posts equally: nearer the near post when the ball is wide; was the line to the goal centre), 30 px off the line with the ball 1000+ px away, up to 60 px out with it 350 px away (within the mouth's width). **Once a shot is struck** (free ball faster than 450 px/s, coming at the goal) it **sets itself, side-stepping toward where it will cross at a walk** (`KEEPER.shuffleStick` 0.5, ~140 px/s) until its reaction dive. Not a sprint, so corners still beat it: with the 0.4 s reaction it covers ~55 px, which mostly saves shots placed between the keeper and the post rather than in the corner.
  - **Claiming:** a loose ball slower than 450 px/s that it can meet in its box (or 40 px outside) at least 0.15 s before any opponent, and before any teammate: it sprints to the meeting point (`ai.interceptPoint`). Tested: 8/8 balls rolling into the box with an attacker 350 px behind were claimed.
  - **Rushing out:** an opposing carrier within 450 px of goal with none of the keeper's outfielders nearer the goal: it comes out toward the carrier (to 80 px from it, at most 170 px off its line, inside its box).
  - **Reaction** (`cpuKeeperReact`, reaction `LEVELS.keeperReactSec` 0.5 / 0.4 / 0.32 s +- 0.04 random; ours always 0.4; the timer restarts when the threat changes kind, e.g. the carrier it was about to smother shoots, `Player.reactSmother`): a shot heading for its goal (faster than 300 px/s, on target or within 30 px of a post, under its reach height, arriving within 1.2 s): a sideways dive toward where it will pass, only as far as needed (straight-line prediction, so a late curler can beat it); a carrier close in its box (95 px): a **smother** dive at the ball. Diving with an opposing carrier's ball in reach in its box takes it (the carrier staggers 0.5 s, like a lost tackle). Standing it reaches 96 high, diving 120. **Catch or parry by chance:** always caught at or below 420 px/s, the catch chance falling to none at 900 px/s (x0.75 in a dive above 420); otherwise parried (25% speed), one roll per touch: rebounds. **Dive error:** each reaction dive's length is off by up to 30 / 12 / 5 px (`LEVELS.keeperDiveError`; ours 12), so weaker keepers sometimes dive short or past it.
  - **Shot table** (measured in step 5, before the AI overhaul added dive error and chance-based catches; perfect-timed shots from straight in front, 12 each, goals; corner = aimed 105 px off centre, mid = 60, weak = 20% charge): easy: 450 px corner 12, mid 12, central 0, weak corner 10; 300 px corner 12, mid 0, weak 12. Normal: 450 corner 12, mid 5, central 0, weak 0; 300 corner 12, mid 0, weak 12. Hard: 450 everything saved; 300 corner 12, weak 12, mid 0. So placement, power and distance decide; hard asks you to get closer.
  - **1v1** (normal, the human dribbling at goal through the middle): shooting at a corner within 420 px (keeper still on its line) 12/12 goals; within 330 px (keeper rushed out to ~170 px) 12/12; waiting until 250 px: 2/12 (it's on top of you); dribbling on without shooting: smothered 8/8.
  - **Distribution** (holding the ball, not human-controlled: after 1 s; a human-controlled keeper auto-distributes after 6 s): throws (the normal pass, lofted) to the best teammate 120-800 px away scored on openness (no opponent within 120 px), lane safety and progress; if nothing scores 0.55, a long punt (820 px/s, lift 520) upfield toward the most advanced teammate's side. Control goes to the throw's receiver, or the outfielder nearest where a punt is heading.
  - **You can control your keeper:** SWITCH to it (hold SWITCH to jump straight there), or it catches the ball. Without the ball you can move it anywhere, **out of its box too** (sprint allowed). Hands only inside its own box: it catches, parries and holds there, can't carry a held ball out (`keepInBox` while `holding`), and outside the box it plays with its feet like an outfielder (dribble, PASS/SHOOT; fast balls deflect), and it faces the ball when standing. **B1 = DIVE:** along the stick (a full 0.35 s lunge at 480 px/s), or with the stick centred a smart dive toward where the ball will cross the keeper's line, only as far as needed. Reach while diving is 64 (normally 40), then 0.45 s down (drawn on its side). B2 = SWITCH out. With the ball: B1 = THROW to the ring-marked teammate; **B2 = KICK, held to charge** (tap = 520 px/s low clearance, full = 900 px/s lofted; the ring is white then yellow). **KICK takes the same swipes:** up = PUNT (1.5x lift), down = DRIVE (1.3x speed, 0.4x lift), left/right = CURL (bends 18° that way, spin 0.9 rad/s). Control then passes to the receiver or the nearest outfielder. It auto-throws after 6 s.
- **Player collision** (`systems/collisions.ts`): bodies of radius 16 push apart (half each) after movement; then court and box limits are re-applied.
- **Match flow** (`systems/MatchFlow.ts`):
  - kickoff with a 1 s READY freeze; **then nothing starts until the kickoff pass** (user request: neither the AI nor the clock; `MatchFlow.awaitingKickoff`, `playersFrozen`): the kicker has the ball at its feet from the reset (`gainBall`); at our kickoff the banner says PASS TO START and only PASS works (aim with the stick; no shot, tackle or switch), at the CPU's its kicker passes to its nearest teammate 0.8 s after the freeze (`MatchScene.cpuKickoff`, `MATCH.cpuKickoffSec`). The kickoff pass (`MatchFlow.kickedOff`) starts the 90 s clock and the AI, and shows GO!;
  - goal = 0.3 s hit-stop, 1 s slow motion at 0.4x, 2.5 s celebration, then a reset with the conceding team kicking off;
  - full time: level -> **golden goal** (user request): the game pauses 2 s (GOLDEN GOAL banner, phase `break`, time scale 0), then restarts from a kickoff (players and ball reset; kicked off by the side that didn't take the last kickoff; it waits for the kickoff pass as usual) with a fresh 30 s clock; the next goal wins, still level -> draw; then a FULL TIME banner and the Result screen with goals, shots and passes.
- **HUD:**
  - scoreboard pill "YOU x - y OPP" (top left), clock (top centre; red and pulsing in the last 10 s, GOLDEN GOAL label), centre banners;
  - floating joystick, action buttons, pause; FPS/debug under the scoreboard.
- Type check, lint and build all pass.

Not yet built / still open (Phase 3):

- Step 6 phone playtest in Reddit (the user does it with the checklist in "Next up"; nothing in Phase 3 has been played on a phone yet).
- Open decision: keep human keeper control or make keepers AI-only.
- No switch speed boost.

The server still has the template's demo endpoints (`/api/state`, `/api/score`, `/api/leaderboard` with Redis); Phase 5 replaces them with `/api/init` + `/api/challenge` and removes Redis.

## Phase roadmap

| Phase | Scope                                                                                                                                                                      | Status                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 0     | Replace GameMaker template with Phaser, scene skeleton, landscape, pixel style                                                                                             | Done                                                  |
| 1     | Fixed 60 Hz loop, 2.5D (x, y, z) model, pitch 2400x1300, camera, floating joystick, keyboard fallback, one player with walk/sprint/stamina                                 | Done, plus the broadcast camera                       |
| 2     | Ball physics, possession and dribble touches, context buttons (+ J/K keys), pass (target ring), shoot (charge), goals and match flow (clock, kickoff, golden goal, Result) | Done (awaiting phone playtest); switch included early |
| 3     | Away 5v5 team, tackle, AI state machine (Chase/Support/Mark/Carry), real goalkeepers, difficulty levels, fairness helpers, switch boost                                    | In progress (steps 1-5/6)                             |
| 4     | HUD polish (crests, name tags, minimap), sprites and animation states, juice (shake, particles, celebrations), audio, haptics, performance pass                            |                                                       |
| 5     | Server `/api/init` + `/api/challenge`, challenge posts, splash challenge banner, cleanup, deploy and launch                                                                |                                                       |

## Architecture

```
src/
  client/
    index.html, style.css   game entrypoint ("game" in devvit.json); #game box is 1280x720
    main.ts                 creates Phaser.Game (WEBGL, Scale.NONE, pixelArt), forceLandscape; ?debug exposes window.__game
    splash.html/.css/.ts    inline feed entrypoint ("default"); must stay light, no Phaser
    freekick.html/.css/.ts  Free Kick entrypoint ("freekick"); its own portrait Phaser game (Scale.EXPAND around 720x1280)
    freekick/               Free Kick mode
      rules.ts              pure rules (no Phaser): kick spots, wall, keeper AI, swipe reading, aim, strike, flight, outcomes, scoring, power band
      KickCamera.ts         Projector subclass: behind the kicker looking down +x, focal length and lens shift solved per kick, push-in zoom
      Stage.ts              court rebuilt per kick in front of the camera, chalk and spray, goal with net ripple, kicker/wall/keeper, ball, depth-banded trails
      FreeKickScene.ts      flow (aim, run-up, flight, next, over), swipe input and trail, power meter, HUD, banners, results card, audio
      game.ts               createFreeKickGame()
    scenes/
      BootScene             builds the pixel font, then Menu
      MenuScene             difficulty + Play -> Match(MatchConfig)
      MatchScene            the match: players, ball, fixed-step sim (input, movement, ball, possession, actions, flow), camera; launches Hud
      HudScene              screen-space UI: scoreboard, clock, banners, joystick, action buttons, pause, FPS/debug
      ResultScene           score + stats; Play again / Menu
    render/                 the perspective "broadcast camera" layer
      Projector.ts          3D camera math: setFocus(fx, fy, zoom), project(x, y, z) -> screen x/y, scale, depth; groundSquash()
      ProjectedPlane.ts     textured quad in 3D (ground, walls, fence) as a Phaser Mesh with per-frame vertex positions; bilinear()
      Court.ts              builds and reprojects everything static: surfaces, goals, props, crowd (depth constants live here)
      Goal.ts               3D goal drawn with Graphics lines in three depth layers; NEAR_WALL_DEPTH
      PitchLines.ts         pitch markings (touchlines, halfway, centre circle, boxes, spots) as projected Graphics lines, at least 2 px wide
      Crowd.ts              spectator billboards in rows, idle/cheer frames with a hop, out of sync
      Billboard.ts          static upright prop (car, hoop): camera-facing sprite at a ground point, depth = base + y
    entities/
      Player.ts             sim fields (position, heading, speed, stamina, lockUntil, dribble touch state, receiving, passTarget, keeper dive state, tackle state: tackleAt/Until/Dir, stumbling, staggerUntil, wantDir) + render (lying = on its side)
      Ball.ts               3D sim fields, owner, lastTouch, priority/priorityUntil (won tackle), inNet, spin, dip + render (rolling frames, lift with height, fast-ball trail)
    systems/
      FixedStep.ts          60 Hz accumulator; returns the interpolation alpha
      Controls.ts           input bridge: joystick (touchStick), keyboard (WASD/Shift/J/K), button press/hold/buffer state
      movement.ts           stepPlayer(): momentum (accel/decel, speed-dependent turning, plant-and-turn), speeds with/without ball, stamina; constrainMove()
      ballPhysics.ts        stepFreeBall() (gravity, bounce, drag, spin) and collideBall() (walls, fence, posts, nets, goal detection)
      possession.ts         stepPossession(): control/deflect for a loose ball, close-control dribble (angle + distance around the carrier); gainBall (cushioned)/releaseBall
      actions.ts            choosePassTarget(), kickPass() (auto or weighted pace, errorScale), kickThroughPass() + throughSpot() + passTravelTime() (AI through balls), chipFlight() (AI chip planning), kickShot() (skill-based: stick aim, timing accuracy, swipe chip/power/curl), shotShape(), shotLabel(), passWeight(), idealPassWeight()
      keeper.ts             goalkeepers: keeperStick() (position / claim / rush), cpuKeeperReact() (shot dives, smothers), stepKeeperHands() (catch or parry by chance / smother / hold / distribute), startDive(), stepKeeperBody(), keepInBox(), inOwnBox()
      ai.ts                 TeamBrain: shared outfield AI for both teams (role assignment + steering: chase/press/mark/cover/support/run/show/rest/carry; zonal defence), carrier decisions (decideCarry: shotTarget, chipShot, through balls, avoidance), give-and-go (passAndRun), switchTarget(), AI tackle intent, pressureOn(), interceptPoint()
      tackle.ts             tackles for everyone: startTackle(), stepLunge(), resolveTackle() (contact, success chance, juke, win/fail), tacklePhase()
      collisions.ts         separatePlayers(): body-circle push-apart
      MatchFlow.ts          kickoff/live (awaiting the kickoff pass)/goal/break (golden-goal pause)/fulltime state machine, clock, score, golden goal, banners, time scale
      CameraRig.ts          focus point: ball/player blend + filtered look-ahead, critically damped smooth-follow (smoothDamp), zoom, clamp -> projector.setFocus
      geometry.ts           DEG, clamp, lerp, angleDiff, distToSegment
    art/                    textures painted in code at art-pixel resolution (1 texel = PX world px)
      pixelArt.ts           makeTexture, fill, paintRows, paintRing, paintEllipseRing, hex
      pitchArt.ts           court textures; GROUND_EXTENT, BASKETBALL, PARKING
      playerArt.ts          player sheets per kit (home, away, homeKeeper, awayKeeper): 24x32 art px frames drawn at PLAYER_PX 2.75 (about 88 world px tall), posed from skeletons (idle1-3, run1-8 procedural gait, shoot_windup/contact/follow/recover) + idle, run and shoot anims; pass-target ring, overhead arrow, joystick parts, round button discs
      ballArt.ts            6x6 ball, two rolling frames
      sceneryArt.ts         prop textures: hoop, cars, spectators
    ui/
      landscape.ts          forced landscape: CSS scale/rotate of #game + pointer mapping
      palette.ts            PX (art pixel = 4 world/screen px) and PAL (16 colours)
      pixelFont.ts          5x7 glyphs -> RetroFont 'pixel'; pixelText(); paintPixelText() for baked art
      TextButton.ts         pixel-art button class (sinks on press, fires on release)
      Joystick.ts           floating joystick (HUD scene, left half)
      ActionButtons.ts      two context buttons (HUD scene, right side), per-pointer tracking, charge ring
      backdrop.ts           menu/result street backdrop; seededRandom()
  server/                   Hono app: /api/* (template demo), /internal/menu|form|triggers
  shared/
    tuning.ts               every gameplay number: VIEW, SIM, PITCH, MATCH, FORMATION, BALL, POSSESSION, DRIBBLE, PASS, SHOOT, KEEPER, AI, LEVELS (difficulty table), TACKLE, INPUT, PLAYER, STAMINA, STICK, CROWD, CAMERA
    types.ts                Difficulty, Team ('home' human / 'away' CPU), MatchConfig, MatchResult
checks/logic-check.ts       npm run test:logic: Phase 3 rule checks on hand-made players (bundled with rolldown, run in node)
    api.ts                  request/response types (template demo for now)
public/ball.svg             pixel ball shown on the splash
```

**World coordinates (simulation):**

- Flat ground plane: x 0..2400 along the pitch (goal lines at x=0 and x=2400); y 0..1300 across it (y=0 is the far touchline, y=1300 the near one, nearest the camera); z is height above the ground.
- Home attacks right (scores in the right goal, x=2400); its keeper guards the left goal.
- Goals are centred on y=650 with a 260 mouth (y 520..780), crossbar 104 high, nets 60 deep.
- Players may enter a goal (x down to -46 or up to 2446, feet radius 14). `constrainMove` resolves x against the current row, then y against the new column, so the posts and side nets act as walls.
- Ball radius 10. It is walled in all round: the far wall (y=0), near fence (y=1300), end walls outside the mouth and the posts (circles of radius 6). A ball fully over the line in the mouth (x < -10 or > 2410, z under the bar) is a goal; `ball.inNet` then keeps it in the net box (roof 73 high).
- Fairness (from the MVP plan): the team behind on the scoreboard refills stamina 15% faster (`STAMINA.trailingRegen`); no AI tackles in the first 0.5 s after kickoff; the receiver of a pass has a +10 px first touch.
- Formation (home): left back (520, 420), right back (520, 880), midfielder (840, 650), forward (1120, 650), keeper (40, 650). At a home kickoff the forward stands at (1176, 650) by the ball on the centre spot (1200, 650). The away team mirrors it in x (keeper at (2360, 650)); the non-kicking forward waits at x 1020 (home) / 1380 (away), outside the centre circle.
- The ground texture extends 720 beyond each goal line and 320 beyond the near touchline (`GROUND_EXTENT`). Scenery is render-only.

**World geometry (render):** solid walls are boxes 32 thick (`wallThickness`), extending outward from the court.

- Far wall: a brick face at y=0 (160 tall), coping on top (y -32..0), and the facade rising from the back of the wall (y=-32, z 160..440).
- End walls (120 tall): solid blocks along x=0 (x -32..0) and x=2400 (2400..2432), outside the goal mouth. Only camera-facing faces are built.
- Fence: y=1300, 96 tall. Crowd: 2 rows at y≈1364/1412, x -120..2520, spacing from `CROWD`.

**Depth (Phaser setDepth), back to front:**

- Ground -3e6; far wall -2.6e6; props outside the court -2.5e6 + y; end walls (far segments) -2e6.
- Players by ground y, and the ball by y + 0.5, sharing that range with the goal layers:
  - back layer at y=519;
  - near side net at `NEAR_WALL_DEPTH - 1`;
  - near end-wall segments at `NEAR_WALL_DEPTH` (782);
  - frame layer at +1.
- Ground rings (control and pass target) at the player's y - 1.
- Fence 1e6; crowd 1e6 + 1 + y; overhead arrow and stamina bar 2e6; shot label 3e6. The HUD is a separate scene, always on top. The ground marker (`MatchScene.marker`, ring + pointer that stretches into the aim arrow while charging) sits at depth y - 0.5. ?debug role labels at 3e6.

**Fixed step (MatchScene.step), in the plan's order:**

1. Save previous positions; drop pass receivers once the loose ball has died.
2. AI (only while live and not frozen): both `TeamBrain`s `think` (at their own cadence), and the tackles they decided on start (`startTackle`; never for the human's player).
3. Movement, outfielders: a lunge moves the body (`stepLunge`); start-up / recovery / stumble / stagger stand still; otherwise the human's stick or the brain's `steer`, through `stepPlayer` (with the trailing team's stamina regen). Keepers: `cpuKeeperReact` (dives) for those the human isn't controlling, `stepKeeperBody` while diving/down, else the human's stick or `keeperStick`.
4. `separatePlayers`, then court / box limits.
5. Tackles resolve (`resolveTackle`) for lunging players.
6. Free ball physics (`stepFreeBall`) if nobody owns it; a pending goal-kick restart.
7. While live, possession: `stepPossession` (control, deflect, or dribble the carrier; a won tackle's priority; a pass in flight is its receiver's), then `stepKeeperHands` for both keepers.
8. `collideBall`; on a goal: release, clear actions, `flow.onGoal`; out behind a goal: banner and goal-kick restart.
9. While live: `stepActions` (the human: pending pass, PASS tap/hold, SHOOT charge, SWITCH, TACKLE, keeper THROW/KICK/DIVE; follow-the-shot control) and `stepAiCarriers` (AI passes / shots / clearances that are due).
10. `flow.tickClock(dt)`.

**Per render frame (MatchScene.update):**

1. `controls.sample()`.
2. `flow.update(realDt)`, which may request a kickoff reset or finish the match.
3. `FixedStep.advance(delta * flow.timeScale)`: hit-stop/slow-mo scales the sim.
4. Interpolate, then the pass preview ring.
5. Camera: ball and controlled player, with air zoom while the ball is high and fast.
6. `court.update`, `player.render`, `ball.render`, then `updateHud` (writes `MatchHudState`).

**Scene restarts:** Phaser reuses the scene instance, so per-match state (lists, timers, stats, pending actions) is reset in `init()`. Scene-event listeners added in `create()` must be removed on SHUTDOWN.

**Scene data:**

- Menu starts Match with `MatchConfig`.
- Match launches Hud with `HudData`: `controls`, `state` (a `MatchHudState` object the Match mutates each frame), and `debugInfo()`. It stops Hud on shutdown.
- Match starts Result with `MatchResult`; Result restarts Match with the same difficulty.

## Decisions (and why)

- Do not query the app account subscription list as if it were the player’s. Provide a separate manual Already Joined preference until a supported player membership API is available.

- Keep diagnostic references while removing the unwanted retry action. A permission-classified SDK failure is not proof that a user declined native consent; avoid blaming the player.

- Correlate a safe on-screen join reference with SDK failure details in server logs instead of exposing raw platform errors to players or guessing the production cause. Require Free Kick Restart in the overlay contract.

- Restart abandons the current attempt and starts with identical settings; it never submits a partial leaderboard result. Reuse the existing Free Kick reset and normal Match initialization rather than manually recreating their state.

- Reveal results immediately on Join, but thank the player only after confirmed subscription. Keep native Reddit permission consent intact and explain it before the button.

- Enable Challenge record submission together with its result leaderboards so newly created Free Kick posts can populate both boards. Validate wins and terminal losses using the post settings rather than legacy unlimited-run limits.

- Keep Free Kick feedback above the scene with no background plate; pair instructions with HUD examples and use a complete challenge stat grid instead of an uneven final row. Scope result alignment changes to Free Kick.

- Subscription happens only after an explicit Join action and native permission consent. Use only confirmed local join receipts for suppression; do not represent unavailable SDK membership information as a real membership check.

- Group tactics with movement/shooting in the left info column, as requested, rather than a full-width strip competing with navigation.

- Reuse one tactics button factory/active-state painter in the live HUD and info controls examples so their appearance stays consistent. Help previews display the selected tactic without changing it while paused.

- Update only patch/minor releases and keep Devvit packages synchronized. Defer Phaser 4, TypeScript 7 and Node 26 typings to separate compatibility work.

- Let opponents adapt to public score/time using the same formation modes, with delayed stable intent and a minimum hold. Keep the last applied Daily plan as Normal so automatic mode rules and difficulty retain their existing timing.

- Show tactics in both info controls and desktop key bindings: the desktop Controls button opens a different panel, so footer-only instructions were insufficient.

- Use exact 8% normal and 15% sprint possession penalties against off-ball speeds, as requested.

- Apply manual match tactics as a formation-target offset separate from automatic match/Daily plans. Keep Normal identical to existing AI and preserve active pressing/interception jobs instead of teleporting players or overriding the human.

- **Free Kick Challenge settings live on the post, the wall is measured from goal (2026-11-11, user's choices):** the creator picks distance (each round varies 5 m either way) and the wall's distance from goal; the wall keeps at least 9 m from the ball so it can be cleared. Difficulty sets the first round's level and a cap; each round is one level harder. Ranked Play is no longer offered on the card (the user wants only Challenge and Practice); its code and boards remain.
- **Free kick strike poses are outfield-only atlas frames (2026-11-11):** keepers never take a free kick, so their atlases skip the 12 poses (like the celebrations); the frames are timed by run-up progress and time since the strike rather than a Phaser animation, because the scene draws the kicker frame by frame.
- **Free Kick camera is a real angled view, not a square-on one (2026-11-10):** the user found the straight-on view flat ("very perpendicular"). The old camera always looked straight down the pitch, so the goal was a perfect rectangle from any spot. It now orbits the ball and turns toward the goal. The reference shots the user supplied (mobile free-kick games) set the final look: low, close, kicker big on one side, only a small swing (7.5 degrees), because on a portrait screen every degree pushes the ball away from under the goal. The kicker moved to the ball's right so the fixed left controls cover empty pitch, not him.
- **Flight physics left alone (2026-11-10):** the user asked for smoother, more cinematic ball movement. The flight model feeds xG, xGOT and the points, all calibrated on 2026-11-09, so only how the flight is shown changed (eased slow motion, camera push, spin-frame cap, trail). Changing drag, curl or dip is a separate balance job.
- **Challenge is unranked and client-only (2026-11-10):** the server validates Play runs as shots = goals + lives + great saves, which a five-kick challenge does not fit. Giving it a board means a new stats shape and validation; not done until asked.
- **"Five lives" in the challenge means five kicks (2026-11-10):** the user's example (goal, goal, miss = failed, "even if he wins four and five") only works if a goal uses a kick too.

- Merge and push the movement, defence, tackle and keeper changes into main as requested, ahead of the phone playtest (the user's call).

- **Defend with lines and tackles, not bunching (2026-11-09):** the user found 3-4 defenders crowding the box ugly and unfair to score against. Defenders now hold a back line, markers leave the opponent by the ball to the presser and cover, and the Hard/Pro near-goal compaction is gone. Difficulty comes from tackling instead: harder levels slide more, press tighter and wait less between tackles (`LEVELS.slideShare` was the lever that restored Hard in the simulator; more pokes or a tighter press did not). There are two tackle kinds (a poke close, a slide further away), so tackling isn't one-dimensional. A won poke never knocks the ball on along the carrier's run: that handed it straight back to the attacker and made Hard much easier in the simulator. Keepers sweep behind the line but drop back to the old 60 px as the ball comes into range, so chips stay as rare as before. Balanced with a headless simulator and a scripted human, so the numbers need a phone playtest.

- **Smooth sprites in the match (2026-11-09):** draw players and the ball with filtered (LINEAR) textures and let the browser scale the canvas smoothly. At the match camera they are shrunk and moved by sub-pixel amounts, where nearest sampling shimmers and a non-integer pixelated upscale judders. This partly reverses the 2026-10-12 crisp-textures choice: court, scenery, HUD textures and all of Free Kick (its own game and close camera) stay nearest. Leg animation follows the distance actually covered (0.6 rate floor), and switching run cycles keeps the stride phase. Generated optical-flow in-betweens were rejected for ghosting; smoother runs need authored poses.

- Share match-card action styles with Free Kick and keep detailed leaderboard controls in an ALL sheet so the feed prioritizes the live shot. Use direct interpolation for preview movement instead of expanding the trimmed Phaser API.

- Keep Free Kick records separate from football-match rankings and use the same seven-day UTC window. Share only completed server-cached Play summaries after explicit confirmation; retain Practice isolation and native trusted-click quit behaviour.

- Reuse the actual Free Kick court and simulation in a separate passive preview scene. Keep player sessions/audio/metrics out of the demo, and retain the standalone post’s two expanded-entry actions.

- Merge and push standalone Free Kick posts and Practice into main as requested, preserving the no-build instruction.

- Give Free Kick its own post type and route its two actions through explicit expanded entries. Practice is a chosen-level training session with unlimited same-spot attempts; keep it separate from normal run records and match rankings.

- Merge and push the Free Kick info/pause changes into main as requested, preserving the no-build instruction.

- Use Free Kick-specific portrait instructions with the normal match icon/card style. Keep overlay UI responsive while pausing scene simulation explicitly, and retain pause-menu return state when opening help.

- Merge the Free Kick left-control and swipe-trail changes into main and push them as requested, preserving the no-build instruction.

- Keep Free Kick settings in a fixed left column and let clear right-side pitch accept swipes. Sample the actual gesture for feedback while retaining endpoint-based aiming, independently selected power/contact and the world-ball launch preview.

- New key actions load with their default key when missing from a saved layout (if free), so adding an action never wipes a player's remapped keys.
- Pixel text only at whole sizes (size x CELL_W font size, size >= 2): fractional sizes such as 0.4 x PX drop or double font pixels and garble letters on the scaled canvas.
- Aerial passes solve their pace from the launch lift and air drag so the first bounce lands at the receiver; a curl's air/ground choice uses the held pass charge (user: "more power = aerial"), so a tap curl always rolls.
- Save desktop bindings in local storage and expose the editor for fine-pointer devices with hover. Track physical keyboard codes for either Shift key and keep keyboard button holds separate from touch holds.

- On Noob and Easy, have the keeper close dribbling lanes later and wait until the actual ball is in range. Preserve shot timing and the physical reach of tackles.

- Set dribble and shot reaction delays independently so Easy can punish walk-ins sooner while giving players more room to shoot.

- Keep the bot's preferred charge whenever its flight fits. Search alternatives only at launch for affected Chaos shots. Scale keeper coverage for both teams when AI-controlled, keeping the regular rules at 100%.

- Pass swipes shape the flight while keeping the same targeting and base charge. Curl aim reuses the free-ball step to bend the path back toward the receiver. The default tap, weighted pass, AI passes and keeper throws retain their existing mechanics.

- Defend close dribbles with earlier keeper positioning and contact-based tackles. A shot starts its own reaction timer, and a dribbler who gets past the keeper can still score under the existing goal rules.

- Keep the post report in installation-scoped Devvit Redis with 30-day expiry and post-deletion cleanup. Record aggregate event counts without player identifiers. Keep the existing Reddit Journey map separate from the new counters.

- Free Kick is a separate Phaser game on its own entrypoint, not a scene in the match game. The match canvas is fixed landscape (forceLandscape rotates it in portrait), and Free Kick needs a portrait canvas (Scale.EXPAND around 720x1280). The feed card stays light: Phaser loads only in the expanded page.

- Free Kick reuses the court art, kits, ball, sounds, TextButton and Projector/ProjectedPlane (KickCamera extends Projector). It has its own pure rules (`freekick/rules.ts`) and its own goal/net and figure drawing, because the camera looks down the pitch and needs different depth layers. No match code changed apart from the lobby button.

- Free Kick difficulty is tuned with simulated players (aim off by up to 25 px, power off by up to 0.08). Skilled shots (over the wall, curled round it) score about 50-65% at every level; random swipes score about 17%. Levels add wall men, distance and angle, and a sharper keeper standing closer to the wall.

- The vertical Free Kick slider shows a green wall clearance guide when there is a power range that clears the jumping wall and stays below the bar with the selected contact. The on-ball frame and slider capture their own gestures. Only the swipe pad can arm a shot, and the arrow uses the same launch heading as the released swipe. Retry clears the last flight trail so the arrow has a single meaning.

- Merge post flair selection into local main by fast-forward; keep the pre-existing package whitespace edit outside the commits.

- Load subreddit flair templates only after moderator authorization and pass a validated selection through the existing post-submit call, avoiding a second flair-write operation. Retain optional no-flair posting and existing form endpoints/permissions.

- Merge the desktop preview layout fix into local main by fast-forward, preserving the existing package edit outside the commits.

- Let desktop lobby controls fill the preview rather than capping them to a left column; align header and lower controls with matching responsive gutters and keep desktop sizing bounded.

- Merge the reviewed session changes into local main by fast-forward; leave the pre-existing package whitespace edit outside the commits.

- K always supplies the power-shot effect as requested; I/J/L trigger chip/curl shots directly. N covers context-sensitive keeper throw/dive, and K keeper kick/switch. Keep Enter and arrow-key navigation as additional shortcuts.

- Use Custom as the display name while retaining established `casual` identifiers and storage keys so the rename does not migrate or invalidate existing data.

- Share SWITCH target planning between the marker and button without advancing the stored cycle during preview. Distinguish the secondary target through a smaller dashed outline, lower opacity and no primary-marker decorations.

- Restrict SWITCH to outfield teammates for taps, repeated taps and holds; keeper control still follows actual keeper possession and goal kicks.

- Size the desktop lower scrim independently of the 580 px controls panel using `100vw`, keeping one continuous vertical gradient across the preview.

- Merge the post-goal Rampage level-up refinement into main as requested, preserving the no-build instruction.

- Separate Rampage upgrade feedback from goal graphics entirely: announce the applied tier at kickoff in one quiet line, without extra outlines, stacked text or a box.

- Merge the subtler difficulty label into main as requested, preserving the no-build instruction.

- Use a quieter persistent difficulty label while retaining bright accents for the brief level-up celebration. Keep the goals/lives labels unboxed.

- Merge the refined Rampage HUD, tier animation and three new kits into main together as requested, preserving the no-build instruction.

- Keep goals/lives unboxed and the tier fill borderless; use white outlined glyphs for contrast. Announce only an actual upcoming Rampage tier increase, then apply the existing kickoff progression. Bake new kit art ahead of time so runtime recolouring and additional per-match texture downloads are unnecessary.

- Merge the Rampage, Chaos briefing and Hard/Pro defence changes together into main as requested; preserve the instruction to skip application builds.

- Strengthen only Hard/Pro defensive decisions near goal. Keep a nonzero gap for urgent cover instead of disabling spacing, and preserve normal spacing with our possession or outside danger.

- Explain Chaos settings in the existing match briefing: show actual saved strength relative to normal, shared full-match scope, and regulation win conditions without introducing another page.

- Use RAMPAGE for the mode badge; retain the actual dynamic difficulty in the live HUD, highlighted from green through red. Read the tier directly from match state rather than parsing display text.

- Merge the tested Chaos and Journeys changes into main at the user’s request. Code matches the validated branch; Reddit approval/allowlisting still gates analytics ingestion.

- Chaos rules are per-match, never mutable global tuning. Power/goals accept 50–150%, Slippery 100–150%; both teams share the saved effect. Goal size scales width/height, end-wall height and keeper/chalk boxes together; side walls stay fixed.

- User’s latest instruction supersedes the earlier default-off choice: enable normal builds now, preserve an explicit false kill switch and nonblocking denial handling. Reddit continues to enforce approval/allowlisting.

- Journeys is now enabled by default at the user’s request; Reddit still gates ingestion until approval/allowlisting. Track one attempt per explicit play, each rematch gets a fresh ID; bounded requests and failures never block gameplay. Only whitelisted mode/difficulty/duration/outcome/score/time fields reach the SDK.

- Merge the tested Shield/security branch into main at the user’s request. Application code matches the branch validated with zero-finding audits, clean installs, local checks and Daily browser tests.

- Resolve all audit findings with patched minimatch/tmp overrides and a guarded postinstall compatibility fix for legacy glob 7. Preserve nonrecursive Matcher.test() rather than converting to regex. Retain stable Devvit; avoid audit-suggested toolchain downgrades. Remove/review the shim when upstream glob/Devvit changes.

- Shield is a display rename only; retain the saved `hold-lead` ID and existing protect-the-lead rules.

- Merge the tested Rampage/goal-burst branch into main at the user’s request; keep real Reddit visual playtesting as the next validation step.

- Rampage is a display rename: retain the stored `survival` ID and limits for old posts/results. Explain per-goal opponent/keeper progression. Keep the goal burst above the scorer, speed steady, and reduced-motion feedback static.

- Merge the tested Daily branch into main at the user’s request; continue real Reddit playtesting from main.

- Survival’s main board is finishers only, fastest live-clock time first, then fewer conceded and username. Recompute older stored rows under this order. New posts use a fixed 5:00 cap, configurable target (1–15) and concession limit (1–10); old posts retain saved caps/default 5/3 limits. Difficulty rises per goal until Pro.
- Initial entry remains paused for Match details → How to Play → Play Match. The info button opens the same two pages; replay keeps the existing quick-start behaviour.

- New Daily templates are explicit saved settings; legacy posts keep their original rules. Daily creation uses a template step so only relevant settings appear. New templates finish at regulation time without golden goal; Survival ends at its saved goal/concession limit. Classic/Casual keep their existing rules.
- Bot tactics and difficulty remain separate: add Defensive and late All-out plans without changing player physics; apply score changes at kickoff and live time-pressure changes after a short delay. Survival promotes the entire opponent, including its keeper, at kickoff.

- Give speed a minimal, borderless dark-blue backing at 45% opacity with larger white digits; enlarge the number and unit without restoring the dark headline box or covering the scorer.

- The scorer’s animation takes visual priority: remove the dark headline plate, reduce headline/stretch/shadow/impact size, and keep secondary goal feedback in the upper HUD rather than stacking it over the player.

- Use a dedicated Phaser HUD celebration with animation derived from goal age. It pauses with the match, resets on every goal, and needs no persistent timers/tweens. Preserve the existing 2.8-second goal sequence; reduced motion shows a steady full headline and metrics.

- Goal speed is the calibrated arcade launch velocity in km/h, sampled before drag; only scoring shots without an intervening player touch qualify; personal/ranked records require the human-controlled shooter. Speed is a calibrated arcade measurement, and bounded client reports are not cheat-proof. Keep Casual and ranked device records separate. Only fixed competitive matches submit speed records; one best entry per player per post across seven UTC days, with existing privacy deletion/retention.

- Keep Devvit CLI/start/web versions aligned on the stable release. Keep Phaser 3 for the current custom renderer/build and TypeScript 6 because typescript-eslint 8.72.1 supports TypeScript <6.1; major migrations are separate work. Preserve Node 24 typings for the pinned Node 24 runtime. Track upstream audit findings rather than forcing incompatible transitive major versions.

- Retire 0-3-1 globally; normalize old saved values to 1-2-1 so existing posts remain playable without resetting other settings.

- Results use one responsive card with centred outcome, colour-coded teams, score, difficulty/time and stat tiles. Centre the card vertically when it fits; retain safe scrolling on genuinely small viewports rather than clipping actions. Ranked results retain leaderboard/share/Play Casual; Casual retains rematch/settings/exit and makes no ranked calls.

- Ranked results offer a direct route to Casual setup through the existing scene, rather than replaying fixed challenge settings. Keep ranked saving/sharing and Casual results actions unchanged.

- Use the short PRO display label everywhere through `DIFFICULTY_LABEL`; retain the existing stored `pro` ID for compatibility.

- Header time is the configured match duration, not the AI demo countdown. Badge colours: Noob green, Easy teal, Normal yellow, Hard orange, Professional red. Casual has no fixed time/difficulty in the feed and uses CUSTOM SETTINGS instead.

- User rejected the framed split preview layout: gameplay must fill the card, with title and play/settings information overlaid as in the earlier version. Remove decorative formation diagrams from Casual setup, retaining accessible arrow selectors and the no-scroll requirement.

- Games played means completed matches, including rematches and Casual; previews, abandoned matches and duplicate completion requests do not count. Store no usernames or scores for this metric; transient receipts expire in 24 hours. Keep lifetime aggregate counts per post, clear on post deletion, and block pending receipts from recreating deleted counts. One native preview UI serves desktop and mobile; only its stage reveals the existing Phaser AI match. Casual setup must fit short mobile webviews without scrolling or inaccessible controls.

- Daily Challenge and Classic expose identical creation fields and keep per-post rankings; Casual starts 0–0, accepts free preset choices, and never calls ranked result/sharing endpoints. Both server mutation routes reject explicitly Casual results and all Casual posts. A dedicated `casual` entry point preserves the feed button intent across Reddit expansion without relying on shared browser storage. Native Reddit forms use a type-selection step followed by the relevant fields because live conditional fields are unsupported. Preferences contain settings only and stay on the device.

- Dependency refresh keeps Phaser 3.90.0 because the custom trimmed build imports Phaser 3 internals. Keep TypeScript 6.0.3 within typescript-eslint 8.72.0's supported range (<6.1), and Node types on the pinned Node 24 runtime line. Phaser 4 and TypeScript 7 require separate migrations.

- **Keep every Devvit package on one exact version** (`devvit`, `@devvit/web`, `@devvit/start`): a mismatch installs two copies of `@devvit/server`, and server code then can't find its request context ("No context found" in playtest logs). Upgrade them together.
- User feedback on the first teaser prioritizes continuity and smooth motion: use one complete real-game passage, keep the camera following play, remove flashes/replay cuts, and reveal branding over the existing celebration. Continue to omit match-duration marketing copy.

- Teaser uses landscape 16:9 and the approved save-focused script, omitting match-duration claims. Use directed in-engine capture with the current art and existing physics, with production scripts isolated under workspace `output/teaser/`.

- Desktop banner v3 uses the 1072:128 proportion supplied by the user, a single-line title and actual baked game pixels for the players, rather than relying on generated sprite lookalikes.


- Subreddit branding uses the current clean-shaven character references and the in-game brick / asphalt / pixel-lettering theme. Banner output is versioned separately, preserving the supplied original.


- Player deletion is confirmed and authenticated against the current Reddit user, covers all indexed retained boards in this subreddit, and reports migration failures. Account cleanup uses rotating scheduled pages; lookup errors never count as deleted accounts. Score-only shares require a verified pinned parent; moderator challenge text uses user-action attribution.


- Use latest supplied four-frame clean-shaven standing pose for keeper hold, superseding the earlier bearded attachment; fit with uniform scaling so proportions are preserved.

- Follow explicit request to use the four supplied falling poses for side tackle. Repeat/reverse into the established eight-frame animation rather than changing runtime timing; retain existing tackle physics and hitboxes.

- Route three standing palms-forward frames to keeper block; restore alpha and original cell/ground alignment while deferring colour checks and builds.

- Use four-frame overhead glove poses for keeper jump, preserve relative pose sizes with one uniform scale and ground alignment; restore alpha before source import and defer colour/build checks.

- Route three gloved standing frames to keeper idle; restore alpha and retain established cell/boot alignment without running colour checks or builds.

- Route the six running-with-gloves poses to the keeper carry sheet, retaining the four-pose static hold. Restore alpha on the supplied RGB attachment before importing; defer bake/build and colour checks as requested.

- Use supplied four-pose sheet for keeper hold (not the separate three-pose gloved idle). Preserve pixels/layout directly and skip colour checks/build per user request.

- Import the supplied dive sheet directly at the established source canvas size; preserve animation keys, timing, hitboxes and recolouring because the pose bounds remain aligned.

- Import supplied celebration artwork directly without regenerating; retain existing animation keys, six-frame order, source layout, ground anchors and per-pose jump displacement. Keep the established recolouring metadata after visual kit checks.

- Commit the current completed updates directly on main because that is already the checked-out branch; no branch merge is needed.

- Apply a short 150 ms eased attack only to the missed/saved-shot cue, following the latest request; preserve all other audio behavior.

- Apply only 40 percent effect levels now; defer the earlier fade-in request following user steering. Retain 100 percent BGM.

- Set every match sound effect to 0.5 while retaining BGM gain 1, as requested.

- Use 100 percent background music volume as explicitly requested; retain existing effect levels and master mute.

- Compress the supplied long WAV for mobile loading; use one global mute for music and effects, remembered locally. Keep automated feed demos silent and defer music until browser audio unlock.

- Reuse the existing glyph data and palette for the lobby; SVG letters inherit colour and retain hidden readable text for native control accessibility. Keep player names as regular monospace text for legibility.

- Use DOM text/touch targets for portrait lobby readability rather than shrinking the desktop canvas. Keep gameplay and physics unchanged and use cover framing only while the portrait lobby is active.

- For the requested real live feed preview, reuse Phaser and the actual match engine via a lazy shared game module instead of the previous static lightweight splash. Only visible posts load it; inline runs at 30 FPS and sleeps off-screen. Demo mode disables player input, sounds, HUD and result submission.

- Request only SUBMIT_COMMENT for the existing explicit POST MY SCORE action; do not add posting or subscription permissions.

- Interpret goalkeeper D area as the existing chalk penalty box; restrict miss/save sound by event position, not shot origin.

- Use the latest attached miss/save sample while retaining existing playback behavior.

- Play miss/save audio only for an unresolved shot, once per attempt; retain existing shot and goal cues.

- Trigger stop.wav at fulltime once, let it finish over results and reset for replay.

- Play start.wav when the opening match becomes ready, once per match; defer until audio unlock rather than dropping the cue.

- Trigger goal.wav from a new goal rather than a repeating celebration animation, and stop match sounds on scene shutdown.

- Use the latest user-supplied Downloads/sound/shoot.wav as the pass/shot sound.

- Reuse the supplied shoot.wav for passes and shots; trigger on actual ball strikes rather than button presses. Keep source and release audio together.

- The splash paints the real title screen on a canvas with shared Phaser-free code (menuCard.ts) instead of loading Phaser in the feed, so the card stays fast while looking exactly like the game.
- Daily leaderboard ranks each player's best match of the UTC day by goal difference, then goals scored; results come from the client and are only sanity-checked (no replay validation).
- Score comments are posted as the player; if that is refused, the app account posts them with the player's name rather than failing.

- Custom match settings live in the post's postData, not Redis: the splash and the game get them from context with no request, and they can't change after posting. `/api/init` was left alone because the client never calls it.
- Jersey colours are preset baked kits rather than a free colour picker. Recolouring on the device was removed for load time, and a preset palette keeps keepers (green/gold) and both teams distinct.
- "Goals conceded" means the AI's score at kickoff (a comeback challenge), not a concede limit; a concede-limit win rule would be a new objective.

- The help panel pauses the match and reuses the HUD's own textures/colours, so the icons always match the real buttons.

- Preserve local UI edits while integrating remote gameplay and preview tooling; retain both branches' notes.

- Preserve the user's manual scoreboard, bar and timer positions when merging UI changes to main.

- Scale only the longer TACKLE label down; retain existing button dimensions and other action label sizes.

- Draw the pause symbol with solid pixel bars inside TextButton's moving face rather than font glyphs.

- Draw scoreboard bars as centre-origin rectangles on the box centreline; use 24 px height for balanced spacing around the lettering.

- Centre scoreboard ink and shadow at the box centre (184,44); compensate for bitmap cell padding rather than shifting the anchor down.

- Use YOU and OPP as scoreboard labels; place the score text at y=48 per user request.

- Keep the scoreboard background and team chips in place; fit score text to the padded interior so longer scores cannot spill outside.

- Use the ball-free three-frame block draft for subsequent integration so the existing game ball can render separately.

- Latest three-frame request is an open-palm block/parry with the ball rebounding, rather than a secure catch. Preserve earlier drafts as alternatives.

- Latest keeper standing-tackle direction is a simple three-frame standing hand save with the ball visible, superseding the four-frame low-gather draft. Keep drafts versioned and runtime unchanged.

- The requested four-frame keeper animation is a standing tackle: keep feet grounded through the low gather and recovery. The superseded vertical dive generation is not a project asset.

- Keep the two-frame keeper tackle as a separate versioned source draft; omit the ball from the artwork so the game can position its own ball.

- Keep the new three-frame goalkeeper standing sheet as a versioned draft until integrated; preserve existing idle artwork and current runtime animations.

- Prepare authored player atlases incrementally on the first match. Yield after each source sheet and each 64 rows of skin/hair processing so the loading screen renders and input no longer looks frozen; release recolored temporary canvases promptly to lower memory pressure. Keep atlas width below 2048 px for older mobile GPUs without changing sprite frame size or appearance.

- Fast-forward the tested size-reduction commit from `assests` to `main` as requested. Keep the source PNGs and lossless ball sheets; playtest alternate-kit recoloring before publishing the new Reddit version.

- Trial quality-98 WebP on player release sheets to reduce Reddit download size while keeping exact alpha and lossless ball art. Preserve the editable PNG originals. The slight RGB changes make an alternate-kit visual playtest necessary before publishing.

- Commit the tested `assests` working tree before merging, then fast-forward local `main`. Keep `assests` available for reference and leave remote publication for a separate request.

- Preserve the original sprite PNGs for editing and package pixel-identical lossless WebP copies for Reddit delivery. Keep release art in a separate public directory so development review files and originals are not copied into `dist/client`. Disable Devvit build source maps through its supported client/server options. Release source textures after atlas generation to avoid retaining duplicate images during matches; keep generated atlases across match restarts.

- User rejected the smooth blue-gray look. Restore the older warm asphalt palette and stronger grit, adding street history through faded basketball paint and tar repairs. Old paint remains faint and broken beneath current football markings; all surface details are cosmetic and baked once in code.

- Field artwork uses a seeded startup raster pass, with no imported image assets or per-frame texture work. Keep repairs/cracks near the perimeter and variation quiet at midfield to improve player/ball readability; preserve existing projected markings and goal art.

- Player variety by tinted skin/hair layers instead of baked copies per look: copies of the 3584x512 atlas per kit x look would multiply GPU memory, the layers cost two atlases total. The face shape and hairstyle stay the same; hairstyles and beards drawn by code over a plain-faced base sheet are the planned next step (needs art with a plain face).

- Anchor parking rows to `PITCH.width` and derive camera focus limits from field proportions so resizing the court updates surrounding scenery and follow coverage. Render goal tubes using the collision post radius, including the 10% increase, without rounding away small thickness changes.

- Interpret the 10% playing-area increase as 10% in both ground dimensions, and the goal increase as 10% in width, height and depth. Scale markings and formation positions proportionally, but keep kickoff ball clearance and player/ball sizes unchanged. Keeper reaction fixture now uses pitch-relative positions.

- Replacement shot/carry sheets retain the established six-frame layouts and timing. Recompute live-ball hand anchors for the new open-glove poses, drawing the ball behind the gloves while carrying.
- Latest dive sheet has six poses in row order, stored in three source columns. Keep hurt artwork in its separate two-column layout. Scale five dive frames over the actual dive duration and hold frame six through recovery; mirror the new left-reaching source for rightward dives.
- Shot deformation is a brief six-frame sequence rather than continuous pulsing throughout flight. Use uniform source scaling and 96x96 cells around a 64 px round-ball reference so tall/wide poses preserve their intended deformation. Center the shot frames at the normal ball centre and leave `renderTrail` unchanged.
- Carrying is a six-frame 12 FPS half-second stride scaled by speed; stationary holding stays at 4 FPS. Keep ball pixels separate from character art, with measured per-pose glove anchors. Authored ball frames are 64x64, but display scale derives from the original logical `BALL_W = 6` and `PX`, preserving size/shadow/trail calculations.
- Replacement dive sheet retains the existing four-frame two-column asset layout and simulation timing. Extract top row left/right then bottom row left/right, use one uniform scale and shared baseline within each supplied row; keep all gloves and boots intact.
- Getting tackled uses a distinct hurt sequence on the ball carrier, triggered only by successful tackle/smother events. Four supplied fall frames occupy the first 75% of the existing stagger duration; tackle get-up frames cover the final 25% because no dedicated hurt recovery sheet was supplied. Rendering uses simulation time and preserves facing.
- Use the supplied four poses as a 4 FPS keeper holding loop. Keep the ball as its own game entity and expose screen-space hand anchors from Player to Ball; this preserves release physics and avoids painting a duplicate ball into the character sheet. Throw release poses still need a separate sheet.
- Record keeper `diveAt` so the authored sequence follows actual shortened dive duration and simulation pauses. Hold the landed frame until `recoverUntil`; a separate get-up sequence is not supplied. Wide gloves need 224 px game frames; the 16-column kit atlas is 3584x384 and the two-column source dive sheet is 2304x1448.
- Tackle frames are selected by simulation time rather than a free-running animation so hit-stop and shortened success/longer failure recovery stay synchronized. Wider 192 px frames use a 16-column atlas (3072x384). Eight-frame source run/tackle sheets use two rows to stay within 4096 px texture width.
- Downward diagonals use the supplied front three-quarter sheet as drawn for right and mirrored for left. Preserve one common source baseline across the sheet; apply the existing diagonal hysteresis and half-second stride duration. The full kit atlas is 3840x128, within a 4096 px texture limit.
- Upward diagonals use the supplied rear three-quarter sheet, right-facing as supplied and mirrored for left. Direction selection uses hysteresis both at vertical boundaries and near horizontal. Preserve the common source y=684 baseline across the four poses so raised feet do not pull the entire character down.
- Up uses the back sheet (negative world y); down uses the front sheet (positive world y). Four directional frames at 8 FPS preserve the side cycle duration. Switch into vertical views at |sin(heading)| > 0.82, out below 0.72, to avoid diagonal flicker. Keep idle/shoot direction handling until those views are supplied.
- Latest combined run sheet replaces the two earlier sources. Read top row left-to-right, then bottom row. Normalize with one uniform scale (no per-pose stretching), center within existing source cells and retain the shared foot baseline.
- Run 1 and Run 2 form one eight-frame loop at 16 FPS. Shooting retains its four-frame/14 FPS duration. Wide action sheets use 640x724 source cells, normalized to a shared foot baseline; the game frame width is 120 px to prevent clipping. Extract connected silhouettes when adjacent source poses overlap in x, rather than cutting equal quarters.
- Supplied Run 1 sheet is a four-frame loop at 8 FPS, preserving the old eight-frame/16 FPS stride duration and movement-speed scaling. Wide poses use 528x724 aligned source cells with a shared foot baseline; source silhouettes were separated by actual gaps rather than equal input quarters to avoid cutting the first boot.

- **Authored sprites replace procedural anatomy once the base is accepted:** use the supplied four idle poses directly. Normalize horizontal frame alignment and preserve the shared foot baseline. Idle is now integrated; running/shooting and face variants need compatible artwork. Clothing recoloring is restricted to the source pink pixels, retaining skin/hair/trim/boots.

- **Character details before animation work (2026-10-14):** rasterize the existing pose skeleton at four times the original resolution, using `PLAYER_PX` independently of texture detail (user now chose `3.0 / 4`, 96 px world height) and retaining the foot origin. Keep code-generated textures, with named warm skin/hair and muted kit ramps added to the shared palette to match the supplied reference. Home wears pink; other kits stay distinct. Animation refinements and separate dive poses are deferred.

- **Phaser 3 only, no GameMaker.** The project was generated from the GameMaker Devvit template; all GameMaker runner files were removed. Only Phaser.js (Three.js optional later) is allowed.
- **Server stays Hono** (the template's framework), not Express as the plan says. Same `/api/*` endpoints.
- **Broadcast camera (perspective) instead of a top-down view** (user request, FIFA-like screenshots).
  - The simulation stays 2D on the ground plane; only rendering is 3D. `Projector` is a pinhole camera that sits on the near side, raised, looking toward the far side and tilted down by `CAMERA.tiltDeg` (35°), with `fovDeg` 40°.
  - It never yaws, so x-lines stay horizontal and y-lines converge. `focusScale` (0.85) sets the camera distance. Default zoom 0.9 (was 1: a little more of the pitch, less crowded on screen); the air zoom of 0.84 pulls it back further while the ball is high and fast.
  - **Ground and walls** are `ProjectedPlane`s: a Phaser Mesh grid whose vertices' `vx/vy` we overwrite each frame with projected screen positions. The mesh is removed from the update list so its own 3D `preUpdate` never runs. A dense grid (ground 40x18) hides affine warping. The Mesh needs WebGL, so the game is `Phaser.WEBGL`.
  - **Sprites are camera-facing billboards**, scaled by `PX * projected scale`. Vertical geometry is foreshortened by about cos(tilt), so the goal height is 104.
  - **Camera focus clamps** (x 400..2000, y 400..960) keep the view on the court.
- **Forced landscape via CSS rotation, not the Screen Orientation API.** `screen.orientation.lock` needs fullscreen, which the Reddit webview doesn't give. So `ui/landscape.ts` scales/rotates the fixed 1280x720 `#game` box; Phaser runs in `Scale.NONE`; `input.transformPointer` is wrapped to map touches back through the rotation; the layout is re-checked every frame.
- **Retro pixel art style.**
  - Crisp textures via `antialias: false` (nearest filtering) with `roundPixels: false`. Exception since 2026-11-09: in the match, the player atlases, ball and ball shadow are switched to LINEAR (`smooth sprites` prepare step) and the canvas is no longer CSS-pixelated (see "Smooth sprites in the match"). Do NOT use `pixelArt: true`: it forces roundPixels, and rounding each sprite and ground vertex separately under the moving perspective camera made everything step and shimmer against each other. One art pixel = `PX` = 4 world px; only named colours from `PAL` (base PICO-8 plus character ramps added for the supplied reference). Don't snap HUD or overlay positions to the PX grid either: that made the stamina bar and joystick knob move in 4 px steps.
  - Text uses the generated bitmap font. Only capitals exist: **`setText()` does not upper-case, so do it yourself.**
  - Everything is generated in code (placeholder art until real atlases exist).
- **HUD is a separate scene** (`Hud`, registered last), fed by a plain `MatchHudState` object.
- **Fixed 60 Hz simulation with render interpolation.** The elapsed time per frame is capped at 5 steps; the accumulator resets on resume. Hit-stop and slow motion scale the time fed to `FixedStep`, so the sim stays deterministic per step.
- **Camera motion is continuous** (user feedback: the camera moved in steps): no hard dead zone (it made the camera stand still and then lurch). The focus follows its target with a critically damped smooth-damp (`CAMERA.followSec` 0.35), and the look-ahead is low-pass filtered (`lookAheadSmoothSec` 0.45), so dribble taps and turns can't jolt it. Runs per render frame with real dt. Measured over a zig-zag dribble with a reversal: 0 stop-starts, and the camera's speed changes by about 5 px/s per frame (median), 34 at most.
- **Movement feels FIFA-like, not instant** (user feedback: movement with the ball felt rigid and chunky). This overrides the plan's "no acceleration ramp": speed ramps up (0 -> jog in about 0.2 s, which is still responsive), turning rate drops with speed (wide arcs when sprinting, a quick pivot when slow), and the further the heading is off the stick (45° -> 150°), the more the player eases off. So a reversal plants, turns and re-accelerates instead of snapping round.
- **Dribble model (close control).** The previous model (a spring pulling the ball to a point ahead of the facing, with large out-and-back touches) felt chunky: on turns the target swung round and the ball cut through the player's body. Now the ball is placed relative to the carrier by an angle that follows the facing at a limited rate (dragged round in an arc) and a distance that eases to a speed-dependent lead with small smooth taps. Its velocity is derived from its motion. Measured: jogging lead 29-31 px with at most 0.44 px change per step; a 180° turn keeps the ball at least 26 px from the feet; sprint lead 47-53 px. The carrier loses the ball beyond 110 px (leash).
- **Ball control limit raised from the plan's 450 to 1000 px/s and 40 high** (user request: a shot at a teammate should be controlled). The intended receiver of a pass always controls it (automatic first touch).
- **Shooting is skill-based, with a partial finishing assist** (first user request: no assist, replacing the earlier aim assist; then 2026-10-18 user: too hard to score, shots go at the keeper). The ball leaves along the stick, except that a human shot in or near the mouth from within 700 px is pulled a random 10-90% toward the open side of the keeper (`assistedShotDirection`), so aim still matters (aimed shots score most) but a straight shot no longer goes at the keeper. Accuracy comes from charge timing; swipes on SHOOT shape it (analog chip / power / curl). The AI uses the very same `kickShot` and `kickPass` without the assist (it picks open spots itself).
- **One shared AI for both teams** (user picked plan v3 + parts of v2): a team-level `TeamBrain` assigns roles, players steer with the normal movement code; difficulty only changes the CPU's `LEVELS` row. Tackles are the same code for the human and the AI.
- **Button contexts and buffering:**
  - B1 = PASS / TACKLE, B2 = SHOOT (hold to charge) / SWITCH.
  - A press is kept for 150 ms only when the ball is loose within 60 px of the controlled player, so it can become a pass or shot on gaining the ball. Otherwise it acts on the spot (switch/tackle).
  - Shot charge is timed in real time from the press.
- **Goalkeepers share one AI** (keeper.ts) for both sides; saves only come from real reach and dive timing. Difficulty changes reaction time only (no reach or speed boosts). The human can control ours (via SWITCH or when it catches the ball), including a DIVE (user request); the Phase 3 plans assumed an AI-only keeper, and the user hasn't decided yet whether to keep keeper control.
- **Min gap is on targets, not physics** (`AI.mateMinGap`, chasers / pressers exempt): spacing is decided where the AI picks its spot, so the ball-winner is never held back and players may still brush past each other while running; tackles and contests are unchanged.
- **Five levels keep the old ids** (user request for NOOB / EASY / AMATEUR / HARD / PROFESSIONAL): `normal` is shown as AMATEUR and `pro` as PROFESSIONAL via `DIFFICULTY_LABEL`, instead of renaming ids, because saved posts' postData and existing configs store `easy` / `normal` / `hard`; renaming would make older challenge posts fail `parseMatchConfig`. Spelled AMATEUR (the user typed "amature").
- **Difficulty = one table (`LEVELS`)** for the CPU; our AI teammates and keeper always play at normal. Same movement and physics at every level (v3: "no impossible movement or guaranteed saves"); only reaction (think rate, keeper reaction), decisions (score noise), accuracy (pass error, shot charge and placement, keeper dive error) and positioning (marking distance, positioning error) change.
- **Team plans (`TACTICS`, `TeamBrain.style`)** (user request: "make our teammates more attacking, the whole plan more aggressive; attackers go ahead with the ball and track back without it, defenders and the midfielder come forward too"): our AI teammates play `attacking` (every slot pushes well up with the ball and drops back without it, the forward always runs ahead, more one-twos, riskier through balls, more forward passing, pressing high and tighter); the CPU keeps `balanced` (the previous behaviour), so the difficulty levels are unchanged.
- **AI reacts late to the opposing carrier** (user request: "it is too difficult to fake them"): `LEVELS.readSec` delay on what the pressing / tackling AI sees, plus juke 120 -> 90 degrees. Applies to both sides (ours reads CPU carriers at normal).
- **Stamina +30% for everyone** (user request): `STAMINA.drainPerSec` 16 -> 12.3 (about 8 s of sprint from full instead of 6); regen, delay and thresholds unchanged, so it refills as fast as before.
- **Keeper improvements kept modest** (user: "don't make it overpowered that nobody can score"): better angle positioning and a walking side-step while it reacts, but the same reaction times, dive and reach. 2026-10-18 (scoring too hard): the side-step starts only after a 0.1 s read, reach 38, rush-out stops 110 px from the shooter; balance checked by simulating shots by distance and aim. Target: most close shots score, placed shots score best, long shots rarely.
- **Less crowding round the ball** (user feedback: "it feels so overcrowded at times"): the shape slides less with the ball, our team stretches wide, the defending zones close the middle less, the defending forward stays up, positioning jobs move calmly, and the camera is zoomed out to 0.9. Player sprites were left at their size (optional idea, not asked for).
- **Kickoffs wait for the kickoff pass** (user request: "unless I click pass the game shouldn't start, neither AI nor time clock"). The CPU kicks off by itself after a short pause, so a CPU kickoff never needs input.
- **Contain, then punish idling** (user feedback: the presser "follows like a shadow, no room to pass to the player behind"; user request: an idle carrier should be attacked and the CPU go through on goal): the presser keeps a real distance and reacts at its think rate, but a carrier standing on the ball for 1.5 s is closed down and tackled, and a won ball turns into a counter-attack.
- **Receive assist despite the Phase 2 "no automatic runs" rule** (user request: "make passing more easy, the AI can easily intercept it or it does not even reach the intended player"): the old rule left the receiver on the stick, which was still pushed the way you passed, so he ran away from the ball. The assist only moves him toward the ball until you touch the stick in a new way; `PASS.receiveAssist: false` turns it off.
- **Zonal defence, not man-to-man** (user complaint: "every AI player marks our respective player, which makes the game unplayable"): one presser, at most 2 markers and only in the 900 px danger zone near goal, everyone else holds a zone pulled toward the middle; markers sag off when their man is far from the ball. This leaves natural space to build play in your own half.
- **Ideas from reference repos, not code** (user asked to read github.com/HTANV/Soccer-Unity and github.com/tshrjn/openFIFA): Soccer-Unity (the FStudio football-simulator match engine, C#, no license file) gave the ideas: chase caution / relax, most-open-spot shooting and chips over a keeper off its line, pressure by closing time, avoidance steering and zone-based dribble direction, give-and-go, showing for the ball, through balls with a race check, rest defence, switching to the AI's chosen player, positioning error, chance-based catches, front-only AI tackles. openFIFA's AI (nearest chases, others return to formation, always-successful tackles) was simpler than ours: nothing taken. Everything was re-implemented in our own systems (its C# / Unity / 3D / 11v11 code doesn't fit, and Soccer-Unity has no license).
- **Ball feel tuned by simulation, not the plan's numbers** (user feedback: shots crossed the whole court, rebounds too strong, shots too flat). The plan's 0.55/s drag let a lifted 950 px/s shot travel about 1700 px. The ground/air drag, friction and bounce were picked with a scratch simulator of `stepFreeBall` so a full shot travels about 1000 px while 300-900 px passes still arrive (verified in game).
- **Switch after losing the ball goes to the soonest, and he chases** (user request): right after a CPU tackle the AI's presser can be a worse pick than whoever is nearest the loose or newly-won ball, and the human then had to steer him there. Limited to a 4 s window after the tackle so normal defending still lands on the AI's presser first. The chase reuses the receive assist's takeover rule so the stick always wins.
- **Defending upgrades A/B/C, not D/E/F** (user choice from six proposals): recovery runs, a cover defender with presser hand-over, and showing the carrier wide fix what an attacker notices most (free counters, one beaten defender = clear run, runs straight through the middle). Cutting passing lanes, shot blocking and a tighter box press were held back until a playtest. Difficulty only changes `recoverSlack` (how far upfield a defender may be before sprinting back) plus the existing reaction, read delay and positioning error.
- **Switch was pulled forward from Phase 3** because teammates exist now. The 0.2 s speed boost on switch is still to do.
- **Debug hook:** `?debug` in the URL sets `window.__game` and shows each outfielder's AI role (or TACKLE / DOWN / STAGGER) over its head. Use `__game.scene.getScene('Match')` to read or set state in tests (ball, home, away, homeKeeper, awayKeeper, controlled, flow, homeBrain/awayBrain.orders, controls.press/release, controls.touchStick, chargeSince).
- **Devvit `context` may be undefined** outside Reddit (local preview), so read it as `context?.username`.

## How to run and verify

The user runs the game commands themselves in WSL (`npm run dev` for the Reddit playtest). An AI assistant should not start the playtest; just tell the user which command to run.

Checks the assistant can run (through WSL, since `node_modules` was installed there):

- `npm run test:local`: runs all of the checks below in order (types, lint, unit, logic, build) and stops at the first failure.
- `npm run test:types`, `npm run lint`, `npm run build`
- `npm run test:logic`: `checks/logic-check.ts`, logic checks of the Phase 3 rules (tackle timeline, chances, juke, contact; keeper reaction restart; AI brain: no decisions for the human's ball, no chase when out, reset; pass weight; difficulty table) on hand-made players, no game or browser. It is bundled with rolldown first, because the source imports have no file extensions (which is also why `npm run test:unit` can't import game modules). Not linted or type-checked (outside `src/`).
- **User preference (stage 6 on):** no automated gameplay testing in the browser preview; check syntax (types, lint, build) and logic (code review, `test:logic`) only. The gameplay testing techniques below are kept for reference.
- From Git Bash, prefix with `MSYS_NO_PATHCONV=1 wsl --cd "/mnt/f/code ball/street-soccer" -- bash -lc "..."`, or the `/mnt/f` path gets mangled.
- Local visual check: `npm start` (build, then `scripts/serve.mjs` serves `dist/client` at http://localhost:4173, no-store caching, `PORT` to change it; `npm run serve` skips the build). The game runs as a guest outside Reddit. The user starts it themselves (it keeps running until Ctrl+C).
  - **Best way to test gameplay:** open `/?debug` and script scenarios through `window.__game`:
    - teleport with `placeAt`;
    - steer with `controls.touchStick = {x, y, r}`;
    - press buttons with `controls.press(1|2)` / `release`;
    - read `flow`, `ball`, `stats`.
    - Screenshots are low-res in emulated viewports; read state via JS instead.
  - For real input testing, use a phone-sized viewport under 768 px wide and reload, then drive the joystick and buttons with synthetic `TouchEvent`s, using fresh touch identifiers each time. Synthetic mouse events fight the real cursor.
  - The preview pane sometimes throttles rendering. Time the game's own work by wrapping `requestAnimationFrame` before blaming the code (about 1.4 ms of JS per frame measured in Phase 1).
  - **The preview tab is often hidden, so `requestAnimationFrame` (and the game loop) stops.** Drive it yourself: `__game.loop.step(performance.now())` in a loop with short awaits (real time; needed for anything timed with `realNow()`, like charges), or **fast-forward** a match with `m.update(fakeTime += 1000/60, 1000/60)` in a tight loop (a full 90 s match runs in about 1.5 s of wall time; flow, kickoffs and goals all advance). To fake a SHOOT charge set `m.chargeSince = performance.now()/1000 - charge * 0.6` with the stick held toward the target. After a match ends, start a new one from the Result scene (`scene.start('Match', {difficulty})`).
  - Useful batch tests (Phase 3): shot tables vs the keeper per level (park the other players far away, place shooter and ball, `upd(20)`, shoot, stop at a goal / the keeper's touch / out); human tackles vs an AI carrier; 1v1 rush; and AI-vs-AI matches by letting `homeBrain.steer` drive `controls.touchStick` for the human's player (patch `m.teamView` so home's `human` is null). Count tackles via `tackleAt` changes, AI actions by wrapping `brain.takeAction`.

## Known issues / notes

- Weighted passes: over-hitting has no downside yet, because the receiver always traps a pass (guaranteed first touch). Whether heavy passes should bounce off is the user's call.
- The Vite build warns that `game.js` is over 500 kB. That's Phaser (about 1.2 MB minified); harmless. The splash bundle stays tiny.
- Git: the repo has a remote (`origin/main`) and the user commits and pushes themselves. Phase 3 steps 1-5 are in commit `a0e005b` (pushed); later edits to this file may still be uncommitted.
- `devvit.json` still has the template's "Example form" menu item (removed in Phase 5).
- Goal depth sorting is per layer, so in rare overlaps a player in front of the goal can be drawn behind the crossbar.
- Phaser Mesh has no canvas renderer, so the game requires WebGL.
- The ball's shadow is a simple oval (no light direction); fine for now.
- Phase 3 balance is only tested by scripts and AI-vs-AI runs; real feel (tackle timing, how often the CPU scores, easy being too soft or hard too harsh) needs the phone playtest. Against a player who just stands still, easy barely attacks (the idle human keeps the ball).
- Over-hit weighted passes are still trapped (see above); AI passes use the auto weight.
- The far wall and near fence are still infinitely tall for the ball; only the end walls have a height (120) for the ball to clear.

## Next up

- Native review of Already Joined suppression; true automatic cross-device membership detection remains blocked by the SDK access limitation.

- Retrieve the community_join_failed log matching reference 6e20b303 to identify the actual production permission failure.

- Upload the diagnostics version, reproduce a join failure and match its reference to `community_join_failed` in Devvit logs. Verify the visible Free Kick Restart against the deployed version; source/browser checks already show it in every Free Kick entry.

- Native Reddit review of Pause Restart across normal/Daily modes and Free Kick Challenge/Practice after the next user-run upload.

- Native Reddit review of the consent explanation, immediate results transition and success thank-you in both layouts.

- Native Reddit verification of Free Kick Challenge completion saves and both seven-day result boards after the next user-run upload.

- Native mobile review of Free Kick help, unboxed Goal/Wide feedback and final-card alignment after the next user-run upload.

- Native Reddit playtest subscription permission approval/denial and both end-screen layouts. Existing members who joined outside the game cannot currently be detected; revisit when a supported membership API is available. Update the older Free Kick flow harness labels to the current controls separately.

- Review the below-Shoot tactics grouping on mobile after the next user-run upload.

- Review the shared tactics examples and active-state synchronization on the native mobile info screen after the next user-run upload.

- Native Reddit playtest after the next user-run upload with Devvit 0.15.3; application build/publish was not run during the dependency update.

- Playtest opponent Attack counterattack exposure, late Defend spacing and live-time switching across match durations and Daily modes.

- Verify the highlighted tactics help and fixed desktop shortcut list on the next native Reddit playtest.

- Review the revised possession speed penalties during the next match playtest.

- Playtest the right-side tactics selector, transition spacing and control-help copy on mobile/desktop after the next user-run upload; check defensive depth and Attack counterattack exposure.

- **Try a Free Kick post with custom settings on Reddit:** the new form fields, the card text, a noob vs pro challenge, a near wall (e.g. 25 m / 16 m) and 10 lives (two rows of icons). Old Free Kick posts should play the default settings.
- **Watch the curved run-up:** enough sideways travel? Widen `kickerStartSide` or raise `runupSideLead`; check the view did not shrink too much on a narrow phone.
- **Watch the new wall animation:** does the jump read, and does a shot under a jumping wall look like it clips the boots (drawn lift 16-24 vs `wallFeetLift` 40)? If so, lift by `wallFeet` instead or lower `wallFeetLift`.
- **Watch the new free kick strike animation in play:** does the mirror flip at the strike on a left curl look right from both sides (CHANGE SIDE)? Does the set pose facing the camera, the 0.55 s run-up (6 poses) and the 0.1 s follow-through poses read well? Tune `runupSec` / `strikePoseSec` if it feels rushed.
- **Phone playtest of the Free Kick changes (branch `freekick-cinematic`):**
  - Is aiming comfortable with the goal up and to the left of the ball? If not, lower `cameraOrbitDeg`.
  - The kicker is a mirrored right-footer (looks left-footed); the wall can sit partly behind the power slider on central kicks.
  - Does the slow-motion dip before the goal line feel dramatic or laggy (`approachScale`, `approachSec`)?
  - Is the challenge too hard at level 3 (`challengeLevel`)?
  - More challenges were hinted at ("this is one challenge"): `challengeState` and the scene's `challenge` flag assume this one.
  - New sprites and ball art are coming from the user; the ball is still nearest-filtered in Free Kick.
- **Fix `checks/freekick-flow-browser.mjs`:** it presses a START button that the help page no longer has (fails on `main`).

- **Phone playtest of the defence / tackle / keeper changes (now on `main`):**
  - Does the CPU still crowd its box when you attack?
  - Do pokes (TACKLE right next to the carrier) and slides feel distinct and fair?
  - Do keepers come out without being chipped too easily?
  - Is Hard about right? In the simulator it is easier than before but clearly harder than Normal; old Hard was close to Pro.
  - Knobs to tune: `LEVELS.slideShare` (difficulty), `AI.lineBehindBall` (how tight the line holds) and `LEVELS.keeperSweep`.
- **Phone playtest of the smoother movement (now on `main`; `npm run dev` in the main repo folder):** do players and the ball move smoothly, is anything too soft (HUD text, sprite edges)? Watch for a faint, flickering 1-px line at the bottom of four poses: idle4, shoot_contact, carry2 and celebrate_c4. In the atlas they sit directly above run_down4, run_down1, celebrate_a4 and jump3, whose art touches the frame top, and filtered sampling can pick up a sliver of it. If it shows, pad the atlas rows in the bake. Note the debug overlay's `FRAME` / `SLOW` numbers during busy play.
- If `SLOW` is more than a few per cent of frames, cut per-frame work next (the pitch lines and goal nets are redrawn every frame).
- Optional A/B: interpolate with Phaser's raw frame delta instead of its 10-frame average. Raw delta is wrong under the inline preview's 30 fps limit, so it needs its own bookkeeping; do it only if the playtest still shows uneven motion with `SLOW` near 0.
- Smoother legs need more poses: user-supplied 8-pose up/down/diagonal runs (now 4 poses at 8 fps) and/or a 12-pose side jog. Or use the 12-pose sprint sheet for jogging too, but the user chose the current run/sprint split on 2026-11-08, so ask first.

- Review the cleaned Free Kick feed preview and ALL leaderboard sheet on Reddit/mobile after the next user-run upload; local source-only checks reproduce the missing shipped helper but do not replace native host validation.

- Playtest Free Kick native intro, completed-run ranking/sharing, trusted Quit and privacy deletion on Reddit after a user-run build/upload.

- Review Free Kick live feed framing and off-screen pause behaviour on Reddit/mobile after the next user-run build/upload.

- Pull main in Codespaces and playtest new Free Kick post creation plus Play/Practice expansion after a user-run build/upload.

- Playtest native Free Kick post creation, Play and Practice expansion on Reddit after a user-run build/upload; validate selected-level training and new-spot controls on mobile.

- Pull main in Codespaces and review Free Kick info/pause controls on mobile after the next user-run build.

- Review Free Kick info/pause panels on mobile after the next user-run build, including mid-flight resume, portrait resizing and touch interaction.

- Pull main in Codespaces and review the Free Kick left controls and swipe trail on mobile after the next user-run build.

- Review Free Kick left-control sizing, swipe trail and touch feel on Reddit/mobile after the next user-run build. No application build/browser checks run for this change.

- Playtest the Free Kick wall/keeper variety: how often under-wall drives work, whether the guessing keeper feels fair, and the lying man's look in the portrait camera.
- Watch the new run and sprint in a match: stride speed at walk vs sprint, the run-to-sprint switch, and non-pink kits' shorts/sock lines on the high back leg.
- Check the restyled match info pages on phone and desktop (text fit of long team names, Chaos/Rampage lines, three-button row).
- Playtest the aerial pass height/hang time (`PASS.airLoft`, `airMaxVz`) and the curl air threshold (`PASS.curlAirWeight`).
- Verify desktop key remapping and iframe focus in a live Reddit playtest.

- Playtest a near-post dribble and a central run on Noob and Easy in Reddit with touch controls.

- Compare straight runs and quick shots on Easy using touch controls in a live Reddit match.

- Play Easy Chaos matches on Reddit at the Power Surge and Goal Resize extremes and compare bot goals and keeper saves.

- Review pass swipe reach and reception on a phone in Reddit, especially short lobs and long curls.

- Playtest the match keeper on touch controls in Reddit, including late changes of direction and quick near-post shots on Noob and Normal.

- Verify the post analytics form, CSV copy and event counts in a Reddit playtest. Use the report to compare Easy and Noob over the same duration and publish window.

- Playtest the on-ball frame, vertical power slider and dedicated shooting pad on a phone in Reddit (feed card -> PLAY FREE KICK -> expanded). Tune the strike and difficulty curve from real play.

- Free Kick follow-ups (not built): a server leaderboard or daily best, Journeys/games-played tracking, hiding the power band at high levels.

- Push main when requested, then playtest selecting and applying a post flair in Reddit after the next build/upload.

- Playtest the Post flair dropdown and applied flair on a newly created Daily, Classic and Custom post in Reddit; merge/push when requested.

- Push the desktop preview layout fix when requested and review it on Reddit after the next build/upload.

- Review the full-width desktop preview controls on Reddit after building/uploading this branch.

- Push main when requested, then review the merged changes in a full game build and on Reddit desktop/mobile.

- Playtest the remapped desktop controls and help-panel readability in the full game; consider a separate neutral-shot binding only if requested.

- Review Custom labels in the feed, setup, briefing, results and moderator post creation after the next build.

- Visually review secondary SWITCH marker contrast on court at desktop/mobile sizes, and confirm preview-to-selection behavior through repeated switches and possession changes.

- Playtest tapping, cycling and holding SWITCH while defending shots; confirm keeper collections and distribution still work. Refresh local dependencies to restore the full type-check/Rolldown toolchain.

- Review the full-width lobby gradient on the Reddit desktop feed after the next build/upload.

- Pull main in Codespaces and review the quieter post-goal level-up feedback on mobile after the next user-run build.

- Review the quieter post-goal upgrade timing after a user-run build, including pause/resume, consecutive goals and rematches.

- Pull main in Codespaces and review the subtler difficulty label on mobile after the next user-run build.

- Review the softened tier label on mobile after the next user-run build.

- Pull main in Codespaces and review the new HUD, tier animation and kit contrast on Reddit/mobile after a user-run build.

- Review the refined Rampage HUD and level-up timing on a physical mobile device after the next user-run build. Check Yellow/Cyan/Maroon kit contrast against both keepers.

- Pull main in Codespaces and playtest the updated UI and Hard/Pro defence on Reddit/mobile after a user-run build.

- Playtest Hard/Pro close-down and near-goal cover after the next user-run build; check that tighter defence feels fair and does not crowd the box excessively.

- Review Chaos briefing readability on mobile after the next user-run build, including all three effects at 100% and percentage bounds.

- Review the Rampage badge on Reddit/mobile after the next user-run build. No build or browser validation is run for this cosmetic change, as requested.

- Playtest newly created Chaos posts on Reddit and a physical mobile device from `main`. Local/mocked checks pass; review percentage balance and lightweight visual feel. Main also includes Journeys, enabled by default; live ingestion awaits Reddit allowlisting.

- Review/allowlisting and deployment remain separate steps. Normal enabled builds, explicit false kill switch, denial/offline/timeout handling and existing game browser suites pass.

- Review docs/journeys-review-map.md and submit the concrete map through Reddit’s current review channel. Normal builds are enabled now; after approval/allowlisting and deployment, verify accepted receipts on the approved app (playtest may be denied). Disabled and enabled implementations pass local/mocked checks; live ingestion is not verified.

- Playtest Shield and the security fixes from `main` in real Reddit. Clean full/production installs, zero-finding audits, local suite, Daily browser scenarios and Devvit CLI help pass; keep install scripts enabled so the compatibility fix applies.

- Playtest Shield naming in old/new Daily posts on Reddit from `main`; types, lint, Daily checks and build pass.

- Playtest Rampage labels/briefing and the reference-inspired goal burst in a real Reddit mobile webview from `main`. Local and mocked browser checks pass; verify visual feel and scorer visibility on-device.

- Review screenshots and playtest newly created posts for all three Daily templates on Reddit from `main`. Verify creator limits/fixed 5:00 cap, fastest-clear persistence, Survival balance, early completion counts and the two-page briefing against real Reddit/Redis. All local and mocked browser checks pass; legacy posts retain old rules.

- Review the minimal translucent speed backing and playtest on a real mobile Reddit webview from `main`. Types, lint, build and focused browser checks pass.

- Review the clear-scorer overlay preview and playtest all celebration poses/positions on a real mobile Reddit webview before merging `codex/clear-goal-overlay`. Local and focused Chromium checks pass.

- Review the animated goal UI screenshots and playtest the effect on a real mobile Reddit webview before merging `codex/goal-achievements`. Local and focused browser checks pass.

- Review goal/results screenshots and playtest goal impact, speed calibration, both leaderboard categories and deletion on Reddit before merging `codex/goal-achievements` (includes package refresh). All local, browser and layout checks pass.

- Review and merge `codex/package-refresh`, then playtest on Reddit. Clean install, local checks and the full mocked browser suite pass. Track upstream Devvit CLI/tmp and minimatch advisories for future compatible fixes.

- Playtest the six remaining formations and compatibility fallback on Reddit.

- Review the unified results screenshots and playtest the end screens on Reddit before merging `codex/results-play-casual`. Local layout checks and browser flows pass, including ranked replay, sharing consent and Casual transitions.

- Review the results-screen PLAY CASUAL button and playtest on Reddit before merging `codex/results-play-casual`; local desktop and mobile click-through checks pass.

- Review the header changes with the shortened PRO label before merging `codex/preview-match-info`.

- Review the top-right duration/difficulty header screenshots and playtest on Reddit before merging. All local and browser checks pass.

- Review overlay and text-only Casual setup screenshots, then playtest the branch on Reddit before merging. Check Orange/Teal visibility and the 1-3 formation during full matches.

- Review the modern pixel UI screenshots and playtest the feature branch on Reddit, especially actual Redis game counts, returning to the preview after a match, and short mobile viewports, before merging.

- Playtest all three native creation forms, actual post creation and both feed buttons in Reddit before release. Local and mocked-host browser checks pass.

- Playtest Devvit 0.15.0 in the Reddit dev subreddit before release; clean install, full local checks and browser gameplay smoke validation passed.

- On Reddit: tapping PLAY in the post opens the match with the how-to-play panel; GOT IT starts play; the next match does not show it again. Decide whether it should show only on a player's first visit ever (would need a stored flag).

- Playtest the 120 px AI gap in defence: if the back line now looks too open, lower `AI.mateMinGap` (100); if still bunched, raise it (140).

- Playtest NOOB and PROFESSIONAL: noob should be winnable by a first-time player, pro should be hard but beatable. Tune `LEVELS.noob` / `LEVELS.pro` in tuning.ts (keep each level sharper than the previous; the logic check enforces it).

- Playtest the easier scoring (finishing assist + keeper read delay). If still too hard or too easy, tune `SHOOT.assistMin/assistMax` first, then `KEEPER.shuffleDelay` / `reach` / `rushGap`.

- Review the revised continuous teaser at workspace `output/teaser/street-soccer-teaser-smooth-v2.mp4`. Original 22 s teaser and separate tools/trailer work remain available; no publishing requested.

- User review of the finished landscape teaser at `output/teaser/street-soccer-teaser-landscape.mp4`; editable capture and audio sources are beside it. No posting or publication requested.

- Use the new 2144 x 256 desktop banner v3 for the subreddit; a 1072 x 128 version is also saved. No Reddit settings changed.


- New subreddit banner is available in output/branding for the user to upload; no Reddit community appearance settings changed.


- Playtest the installed compliance update on Reddit with a non-owner moderator: user post attribution/approval, pin failure and recovery, confirmed deletion across two posts, and scheduled cleanup. No publication requested.


- Rebuild pending tackle and keeper source replacements when requested; latest source head replacement batch now includes the formerly bearded static hold.

- Replace remaining bearded keeper static hold when supplied. Rebuild pending source replacements and review side-tackle animation when requested.

- Rebuild the pending keeper idle/hold/carry/jump/block source replacements when requested.

- Rebuild idle/hold/carry/jump keeper release assets together when requested; source replacements are pending bake.

- Rebuild keeper idle/hold/carry release atlases together when requested; current replacements are source-only.

- Rebuild keeper carry/hold release atlases when requested; these source-only replacements are not yet in the served build.

- Keeper hold source supplied; rebuild atlases/release assets later when requested.

- Review the clean-shaven keeper dive in a match after refreshing localhost or uploading the next Reddit playtest.

- Review the three new clean-shaven celebrations in a match after refreshing localhost/Reddit playtest; continue remaining head replacement sheets as supplied.

- Receive the other 17 sheets with the new head (run, run up/down/diagonals, shoot, tackle, hurt, 3 celebrations, dive, hold, carry, keeper idle / jump / block); fit each into its existing layout, set its split lines, rebake.

- Reddit test: a new post gets the pinned Scores comment; POST MY SCORE without text replies to it, with text posts top-level, both from the player's account; deleting a post clears its leaderboard. Decide on the player art likeness / pink default kit before `npm run launch`.

- Before `npm run launch`: create a dedicated public subreddit for the game and install the app there; test from a regular (non-mod) account and a logged-out browser on phone and desktop; optionally cross-post for feedback; paste the Devvit Rules page (developers.reddit.com/docs/devvit_rules) for a final check.

- Before `npm run launch`: check the launch guide's review rules (developers.reddit.com/docs/guides/launch/launch-guide; paste it, the agent cannot open developers.reddit.com); the `asUser: SUBMIT_COMMENT` permission will be reviewed (POST MY SCORE errors until approved).

- On a phone in Reddit: tapping PLAY in the post opens the game without a hard cut (navy, small bar, court fades in, players join); the music starts on the first touch in the game at 80% and the speaker button mutes it; effects at 25%.

- On Reddit: the feed card shows the court at once and the players shortly after; the speaker button mutes / unmutes music and effects reliably and stays as set after a reload. Paste the launch guide (developers.reddit.com/docs/guides/launch/launch-guide) to check app-review rules.

- On Reddit: POST MY SCORE posts as the user (and shows the error instead of posting as the app if refused), a second post within 10 min is refused with a message, results still reach the daily board. Check the docs page by hand (or paste it) for limits we could not confirm (upload size, inline guidelines).

- Check on Reddit: tap PLAY -> playable time (`[timing]` lines: match ready, sound effects, court painted), music starts after the first touch and mutes with the speaker button, effects arrive within a second or two, the feed preview waits 1.5 s. After changing sound sources: `npm run audio:release`.

- Push main when requested, then restart Reddit playtest and review the mobile card and audio mix.

- Listen to missed/saved shots after refresh to review the new 150 ms fade-in.

- Listen to the 40 percent effects / 100 percent BGM mix after refresh; fade-ins are deferred.

- Review the mix after refreshing localhost: BGM 100 percent, effects 50 percent.

- Listen to the full-volume BGM after refreshing localhost.

- Listen to BGM balance/looping and test sound preference after refresh on mobile Reddit, including pause/help and fulltime.

- Review the themed lobby on Reddit after restarting playtest; local preview rebuilt. Real API rankings and expansion remain Reddit-only checks.

- Restart npm run dev to upload the tall responsive feed card; verify real phone orientation changes, populated leaderboards and Reddit expansion. Local portrait sizing, ALL and PLAY checks passed.

- Verify lobby layout, silent autonomous gameplay, leaderboard fetch and PLAY creating a clean player match on desktop and mobile Reddit.

- Restart npm run dev and test POST MY SCORE as the app owner; user actions for other players require Reddit approval.

- Review misses/saves inside the keeper penalty area and silent shots hitting walls elsewhere.

- Listen to the refreshed miss/save sample after a hard refresh.

- Listen to missed/saved shots, rebounds, and normal passes to verify the new cue triggers only once per attempt.

- Listen to the fulltime cue after normal time and golden goal, and on replay.

- Listen to the opening match cue and verify it returns on replay without repeating after goals or pause.

- Listen to the goal celebration cue, including opponent goals and leaving/replaying a match.

- Listen to the replacement pass/shot sound on localhost.

- Listen to pass/shot audio on localhost and mobile Reddit; tune volume if needed, then add the next user-supplied sound.

- Playtest on Reddit: feed card on desktop and phone, POST MY SCORE popup and comment (as user vs app fallback), today's top 3 with several accounts.

- Check the minimap on a phone: size and whether it gets in the way of the view near the bottom of the pitch.

- Playtest a custom match post in r/street_soccer_dev (`npm run dev`): create via the mod menu, check the form, locked menu layout, scoreboard labels/chips, each jersey and formation, start score and replay.
- Later: daily challenges (scheduled posts reusing `createPost(challenge)`), special objectives (clean sheet etc.).

- Check the i button and help panel on localhost and a phone (text size, layout fits 1280x720).
- In the Reddit playtest: PLAY on the post opens the match with the help panel up and paused; GOT IT starts it; REMATCH / menu matches don't show it again.

- Playtest the combined gameplay and UI changes on localhost.

- Continue UI playtesting on main after the local merge.

- Review the smaller TACKLE label and its transition back to PASS on localhost.

- Review the pause symbol and press feedback on localhost.

- Review the shorter, centred scoreboard colour bars on localhost.

- Visually review the corrected scoreboard centring at y=44 on localhost.

- Review scoreboard labels and y=48 placement on localhost.

- Refresh localhost and visually review scoreboard containment at normal and multi-digit scores.
- Playtest the defending upgrades with `?debug` (role labels: PRESS, BACKUP, COVER, MARK): (A) after a CPU turnover its defenders sprint back goal-side; (B) a BACKUP sits behind the PRESS, and dribbling past the presser brings the backup out to press while the beaten one runs back; (C) wide carriers are shown toward the touchline, central ones and those in the box are not. Check it's not too hard on easy (knobs: `LEVELS.recoverSlack`, `AI.backupGap`, `beatenMargin` / `beatenPenalty`, `showWide`). Then decide on D (cut passing lanes), E (block shots), F (tighter in the box).

- Playtest faster tap passes: short passes should zip, long ones still be controlled; check the first touch doesn't look jerky and CPU passes aren't now too hard to intercept (tune `PASS.arriveSpeed`).

- Playtest switch after losing the ball: get tackled by the CPU, tap SWITCH once: it should land on the teammate nearest/fastest to the ball (not always the presser) who sprints at it by himself; pushing the stick a new way takes him over; TACKLE works on arrival. Check the 4 s window (`INPUT.lostBallSwitchSec`) and whether the chase should also follow keeper smothers.

- Playtest the keepers: gloved idle, jump saves on high balls at the keeper (timing, does it look right lifting 18 px), block pose after standing saves, standing tackles on carriers at its feet (not too strong?), our keeper's centred-stick jump. Tune `KEEPER.jump*`, `blockSec`, `standTackleRange/Reach`.

- Review/integrate `player-keeper-block-3frames-no-ball-v1.png` after normalizing frame alignment and defining animation timing.

- Review the three-frame block/parry draft; normalize frames and separate the ball before game integration.

- Review the three-frame standing hand save; separate ball rendering and normalize frame placement before any game integration.

- Review the four-frame standing tackle draft and normalize cell layout and hand anchors before adding it to the game.

- Review the keeper tackle draft; normalize cell bounds, ground alignment and ball hand anchors before runtime integration.

- Review the new goalkeeper standing sheet, then normalize its cells/foot alignment and add a keeper-specific idle animation if requested.

- Playtest top-corner shooting: green-zone strikes from the edge of the box should rise to the top corner; check low shots still come from a light hold, the keeper still saves high shots near him, and whether AI high shots now score too often (tune `SHOOT.fullLift`, `KEEPER.stretchReachHeight`).

- Playtest the receiver hold: passes should now reach the receiver; check it does not feel sluggish (tune `PASS.receiveHoldSpeed` / `receiveHoldSec`), and that through balls still let the runner go.

- Playtest the 5% larger goals: scoring feel, keeper saves near the posts / crossbar, recess and net drawing.

- Play a full match on `npm run dev` with the trimmed Phaser (menu, match, goal + celebration zoom, pause, result, play again) and compare the `[timing]` lines with before; any "not a function" / undefined Phaser error means a needed part was trimmed (add it back in tools/phaser-trim.cjs).

- Measure on a phone: open the post, read the `[timing]` console lines (or the ?debug overlay) for game code, boot, menu, player art, match ready; compare with and without the feed prefetch. Then consider: direct-to-match start (user will want it at launch; load idle/run/shoot first), tint-layer kits (one base atlas + grey kit layers, ~1 MB less), a trimmed Phaser build, a pre-rendered court texture.
- After changing player art: `npm run art:release` (needs Python Pillow, e.g. `pip install pillow`), commit public-release/art.

- Celebration camera zoom: run lint and logic checks, then review in game (zoom amount 1.6 and lift 80 in `CAMERA`, framing near the goal lines, the ease back after the reset).

- Test first Play on Reddit mobile and record cold-start time and whether the loading message advances smoothly; compare a second match, which should reuse the generated atlases. If preparation remains slow, move atlas generation into build-time assets or reduce source-sheet resolution.

- Run `npm run dev` from `main` and visually check all kits (especially recolored away/keeper sprites), celebrations, dives, tackle/hurt, carrying and shooting on Reddit mobile before publishing the new version.

- Test a fresh match and a second match on localhost/Reddit mobile to confirm release sheet loading and atlas reuse after source textures are released. Record cold start time and memory on a phone before considering smaller source dimensions or build-time atlas generation.

- Review the warmer asphalt revision at gameplay scale: visible grit, worn older-court paint, repair seams and boot scuffs should convey street character while the ball and football lines remain readable.

- Tackled-player fall: waiting for the user's 8-pose image as a file (stumble, fall, crawl, lying, clutch knee, sitting, kneel, getting up). Plan: replace `player-hurt-authored.png` with an 8-frame sheet, slanted kit splits for the lying poses, and play all 8 over the 1.0 s stagger (fast fall, longer lying / get-up) instead of borrowing the tackle get-up frames.
- Review the goal celebration: scale vs other players, the loop speed (6 fps), own goals.

- Review the court surface: grain strength, wear brightness, dust strip and patch count/contrast (numbers inline in `paintGround` / `courtWear` / `edgeDust`). Further ground ideas offered: wall shadow + vignette, painted/chipped lines, street props (manhole, drains, stains, weeds), kerb, dust puffs/scuffs.

- Review the new keeper dive both ways (mirrored for right dives), with both keeper kits; check the pose timing and that the landed pose sits on the ground.

- Review the new ball while rolling (frame order / spin read) and next to the older shot-stretch frames; if they clash, supply a matching shot sheet.

- Review the player looks in game: skin/hair colours, no orange streaks left in dark hair, layers staying locked to the body in tackles, dives and the keeper hold. Tune colours in `LOOKS` and the reference lumas (`SKIN_REF_LUMA`, `HAIR_REF_LUMA`) in playerArt.ts.

- Review the corrected goal areas on both ends: parking must remain outside the right wall, camera should follow to the enlarged boundaries, and post thickness should match the larger opening.

- Playtest the 10% larger pitch and goals on `assests`, checking kickoff, camera coverage and saves near the taller crossbar.

- Review the latest shot-ball sheet and open-glove keeper carrying poses on localhost, especially held-ball alignment in both facing directions.
- Review the six-pose keeper dive, both directions and short AI dives, especially landing/recovery. Physics, shot trails and camera/player scale remain unchanged.
- Review the new shot-ball squash/stretch sequence at strike, the transition back to rolling, and the existing trails during shots/curl/chips.
- Review moving/stationary keeper holding transitions and glove/ball alignment in both directions, plus the new rolling ball during dribbling, shots and release. Explicit keeper throw-release artwork remains pending.
- Review the latest side-profile dive art for both keeper directions and landing/recovery transitions on localhost.
- Review successful tackles/keeper smothers for the carrier reaction and return to play. The hurt-to-get-up transition uses existing recovery art; dedicated matching get-up frames can replace that fallback later.
- Review keeper catches, held ball alignment while facing both ways, and throw/kick release. Supply explicit throw wind-up/release/follow-through frames to animate throwing; the latest sheet depicts holding.
- Review human and AI keeper dives in both directions, short saves, recovery/holding and kit colors. Supply get-up/ball-holding views later if desired.
- Review human/AI tackle wind-up, full slide, missed tackle recovery and failed tackle stumble. The supplied low slide/get-up frames are the current failure fallback; a distinct fall/stumble and carrier recoil can improve feedback later.
- Review all eight movement directions, especially down-left/down-right transitions to front/horizontal, and kit colors. Idle/shoot still use the supplied side-view frames.
- Review upward diagonal running in both directions and transitions to pure up/horizontal. Downward diagonals continue to use the side art until matching artwork is supplied.
- Review up/down movement, diagonal direction transitions, stride timing and kit colors in-game. Direction-specific idle/shoot artwork is not yet supplied.
- Review the replacement eight-frame running loop on localhost. Idle/shoot, kit logic, animation rate, camera and player-size settings are retained.
- Review the complete eight-frame run cycle and authored shooting in-game, including grounding, transitions and clothing colors. Idle/run/shoot now all use supplied art; separate keeper dives/tackles and face variants remain future work.
- Review the supplied Run 1 cycle in-game, including idle/run size, grounding, loop and jersey colors. Authored shooting and any second running cycle remain pending.

- Review the user-selected `3.0 / DETAIL` player scale on localhost after refreshing.

- Refresh localhost and review the authored idle in a match, including pink/blue/keeper kit colors and idle-to-run transition. Next prepare compatible authored run/shoot frames; current running/shooting still use the generated artwork. The standalone idle review remains available.

- Review the updated characters in an actual match at near/far camera distances and on a phone. Compare the revised adult proportions, beard, pink fabric folds and boots to the latest full-body reference before refining animations. Refresh http://127.0.0.1:4173/ after the latest build. Work stays on `assests` until approved for merging into `main`.

**Step 6, phone playtest (the user; `npm run dev` in WSL, then open the post on a phone).** Checklist (plan v3 phase 6 + the v2 regression matrix), on easy, normal and hard:

1. Match start: menu -> each difficulty; 10 players; tap the FPS readout and note FPS, the `SIM` line and the `FRAME` / `SLOW` line during busy play.
2. Kickoffs both ways: after we score the CPU kicks off and vice versa; the other side's forward waits outside the circle; you start on our forward. **New:** at our kickoff nothing moves and the clock stays until you PASS (banner PASS TO START); the CPU kicks off by itself after ~0.8 s.
   **Also new:** the CPU presser keeps its distance (a pass back to the player behind you should be on); stand still on the ball for 1.5 s and it comes for the ball (a second player after 2.5 s), and after winning it the CPU runs at your goal.
3. Control ownership: SWITCH tap / repeat taps / hold for the keeper; the player you leave keeps playing (AI), never two players on your stick; control follows a pass to the receiver and a won ball to the winner; after a shot it follows the player nearest the ball.
4. Passing: tap and held (weighted) passes; AI teammates don't cut out your pass; CPU interceptions possible but rarer. **New:** the receiver comes to the ball by himself (keep the stick still or as it was); push the stick a new way and he is yours at once; passes are quicker and straighter, and the CPU reacts to them a moment late.
5. Shooting: swipes (chip / power / curl), the stretching pointer.
6. Tackles: TACKLE lunges; win = the ball comes to you; fail = you go down; when the CPU goes in, reversing the stick (juke) dodges it; no CPU tackle right after kickoff.
7. Our AI teammates: support / run when we attack, one presser and markers when we defend, no swarming.
8. The CPU: passes, dribbles, shoots, tackles; easy / normal / hard feel different and fair.
   **AI overhaul (new, check with `?debug` role labels):** (a) the CPU no longer shadows every one of your players: in your own half you should find free teammates (at most 2 CPU MARK labels, only near their goal; the rest COVER zones); (b) loose balls: a chaser that will clearly lose the race drops goal-side instead, and one clearly first jogs; (c) CPU shots go for the open side of the goal, through on goal it shoots, and it chips a keeper who has rushed out; (d) CPU through balls to runners, one-twos (RUN after passing), a teammate coming to SHOW when the carrier is pressed (yours too), one REST player staying back when attacking; (e) CPU dribbling goes up the wing then cuts in, bends round defenders without zig-zagging; (f) the CPU only tackles you from the front or side; (g) SWITCH lands on the AI's presser / chaser first; (h) keepers sometimes parry (rebounds) instead of catching, and easy keepers sometimes dive short or past. Report anything too strong / too weak (knobs: `AI.markZone`, `maxMarkers`, `markSag`, `zoneCompact`, `showPress`, `giveGoChance`, `throughMargin`, `pressureFarSec`, `chipKeeperOut`, `KEEPER.catchSureBelow / catchNoneAbove`, `LEVELS.posError / keeperDiveError`).
9. Keepers: corners beat them, central shots don't; they claim loose balls, rush out 1v1 and smother if you dribble too close; their throws and punts. Our keeper under your control (open decision below).
10. Restarts: over the bar / out -> goal kick; goal -> celebration -> reset; full time level -> GOLDEN GOAL pause, then a kickoff with 30 s on the clock; TACKLES on the result screen counts your won tackles.
    **Newest:** our teammates push up (defenders to about halfway) when we have the ball and all track back when we don't; our forward always runs ahead; more one-twos and through balls from our side; feints and sharp turns now wrong-foot the CPU presser and its tackles miss more (it reacts 0.35 / 0.25 / 0.15 s late by level), and a 90 degree cut dodges a tackle.
    **Also new:** sprinting lasts ~30% longer; keepers stand better and side-step toward shots (corners should still go in, middle shots less); CPU players sometimes shoot from distance (especially when crowded or pressed) and sometimes walk it into the box when they have space.
11. Anything that feels wrong (with the difficulty and roughly when), and FPS / SIM numbers.

Then tune from the feedback (most knobs: `LEVELS`, `AI`, `TACKLE`, `KEEPER` in `src/shared/tuning.ts`) and ask for the keeper-control decision.

**Phase 3:**

- ~~Away team~~, ~~AI hand-over~~, ~~shared outfield AI~~, ~~AI carriers and tackles~~, ~~keepers and difficulty~~ (done, steps 1-5). **Next: step 6,** phone playtest in Reddit (all three levels; check frame rate with 10 players, control ownership after resets, both kickoff directions).
- **Open decision (user):** keep human keeper control, or make the keeper AI-only (both Phase 3 plans assume AI-only).
- **Switch boost:** 0.2 s speed boost toward the ball.

## Changelog

- **2026-11-11:** merge Retry Join removal and Already Joined preference into main through `af2af47`; prepare requested GitHub push. No application build/deployment performed.

- **2026-11-11:** add manual Already Joined suppression without permission requests or subscription writes; verify API membership limitations and preference isolation. Types/lint and focused checks pass; no build/live writes performed.

- **2026-11-11:** remove Retry Join and misleading retry/consent wording while retaining join diagnostics. Types/lint and focused API/browser checks pass; no application build performed.

- **2026-11-11:** merge join diagnostics, Retry Join and required Free Kick Restart into main through `bb1009b`; prepare requested GitHub push. No application build/deployment performed.

- **2026-11-11:** add join error classification/reference logging, actual error display and Retry Join; require and verify Free Kick Restart in all entries. Types/lint and focused API/browser/restart checks pass. No application build/deployment performed.

- **2026-11-11:** merge community note/thanks and all-mode pause Restart into main through `e4a24ed`; prepare requested GitHub push. No application build/deployment performed.

- **2026-11-11:** add Restart to every game pause menu with preserved settings, fresh progress/record IDs and re-spaced controls. Types/lint, Free Kick checks and focused callback/WebGL restart checks pass; no application build performed.

- **2026-11-11:** explain native Join consent, transition directly to results on Join, and show confirmed-success thanks on match details. Types/lint and focused API/browser checks pass; no build or live joins performed.

- **2026-11-11:** merge community popup, Free Kick UI polish and Challenge result leaderboards into main through `465d60e`; prepare requested GitHub push. No application build/deployment performed.

- **2026-11-11:** add both result leaderboards to Free Kick Challenge and validate/save completed Challenge records against post settings. Preserve Practice isolation and seven-day privacy handling. Types/lint, rule/API/UI checks pass; no application build performed.

- **2026-11-11:** illustrate Free Kick controls help, raise/unbox shot feedback and align final stats/actions. Types/lint, Free Kick checks and source-only WebGL UI checks pass; no application build performed.

- **2026-11-11:** add themed optional post-match community popup to normal and Free Kick results, with wide/portrait layouts, native consent, explicit subscription endpoint and local successful-join suppression. Focused types/lint/Hono/Chromium checks pass; no application build or live Reddit joins performed.

- **2026-11-11:** merge shared tactics buttons and below-Shoot info layout into main through `99bfe78`; prepare requested GitHub push. Join popup remains unimplemented. No build/deployment performed.

- **2026-11-11:** move tactics help below Shoot, improve button/explanation spacing, and regroup support instructions in the right column. Types/lint and source-only preview checks pass; no application build performed.

- **2026-11-11:** replace tactics help text strip with shared gameplay buttons and concise explanations; fix report/data clipping and reserve desktop layout space. Types/lint and source-only preview checks pass; no application build performed.

- **2026-11-11:** merge controls-help fix, opponent tactics and patch/minor package updates into main through `ffaeb0e`; prepare requested GitHub push. No application build/deployment performed.

- **2026-11-11:** update compatible patch/minor dependencies and minimatch override, regenerate lockfile, verify dependency/gameplay/server/source-browser compatibility. No application build or deployment performed.

- **2026-11-11:** add score/time-based opponent tactics with three-second reaction and twelve-second minimum hold. Preserve Daily/Rampage integration and human selection; types/lint, 72 gameplay checks and Daily regressions pass. No application build performed.

- **2026-11-11:** make tactics controls prominent in the info page and add the missing fixed tactics shortcuts to desktop Controls. Types/lint pass; no build performed.

- **2026-11-11:** merge manual match tactics and revised possession speeds into main through `4ce0ed5`; prepare the requested GitHub push. No application build or deployment performed.

- **2026-11-11:** lower dribble speed to 202.4 and dribble sprint to 280.5 units/s for exact 8%/15% possession penalties. No application build performed.

- **2026-11-11:** add right-side match tactics selector, top-row 8/9/0 shortcuts, animated selection feedback and controls help. Add formation-shift regression checks; types, lint and 71 logic checks pass. No application build performed.

- **2026-11-11:** Free Kick posts get creator-set Challenge settings (kits, lives, goals to win, distance, wall distance from goal, difficulty); the card offers only Challenge and Practice; rounds vary the angle and rise one level each.

- **2026-11-11:** Free Kick run-up: new first two strike poses, kicker faces the way he runs (unmirrored on the ball's right), wider start and a curved run (sideways first, `runupSideLead`), follow-through toward goal.

- **2026-11-11:** Free Kick wall men get their own 4-pose animation (`player-wall-authored.png`, `WALL_FRAMES`), lifted by the rules' reach while jumping (`wallAirFrom`, `wallLandUntil`).

- **2026-11-11:** Free Kick strike sheet replaced with the user's right-curl sheet; left curl plays it mirrored from the strike pose (`kickerFrame` returns `mirror`).

- **2026-11-11:** Free Kick strike animation from the user's 12-pose sheet (`player-freekick-authored.png`, `FREEKICK_FRAMES`, `kickerFrames.ts`, `strikePoseSec`); atlases 110 frames, re-baked.

- **2026-11-10:** Free Kick side button moved to the bottom centre (above the hint line) and renamed CHANGE SIDE.

- **2026-11-10:** Free Kick view closed up (user: too small). Kicker fit uses `cameraKickerEdgePx` 4 and half-width 24, kicker waits nearer the ball (`kickerStartBack` 56, `kickerStartSide` -40), `cameraZoom` back to 1. Striker still in frame on both sides.

- **2026-11-10:** Free Kick visuals and Challenge mode, on branch `freekick-cinematic` (user request). Angled camera with a real yaw (`KickCamera.ts`), perspective-correct aim, a brick recess behind the goal, night sky and far skyline, wall men sorted by camera depth. Eased slow motion and a smoother push-in during the flight (flight model unchanged). New continuous ribbon for the flight trail and swipe path (`ribbon.ts`). Goal and miss animations (`resultFx.ts`). Challenge: 3 in a row from 5 kicks at level 3, unranked, own entrypoint `freekick-challenge` and lobby button. Types, lint, 27 Free Kick rule checks, panels, server, unit, logic and build pass; viewed in headless Chrome from source and build. Not playtested on a phone.

- **2026-11-09:** Free Kick UI matches the normal match. Feed card: the ranking block and ALL > sheet are the match's own markup and styles (`.preview-ranking`, `.mobile-board-modal`, `.leaderboard-tabs`, five rows a page, PREV/NEXT, ✕ close), via `leaderboard.ts` `freeKickFeedBoard`; PLAY reads PLAY FREE KICK. i button: page 1 MATCH DETAILS (START GAME or RESUME | NEXT), page 2 HOW TO PLAY (BACK | PLAY), the match's card frame (mode tag, MATCH INFO n / 2, coloured top edge) plus the delete-data / report-a-problem lines; Escape closes, Tab advances. Pause: PAUSED, RESUME, NEW SPOT (practice), QUIT, with no how-to-play detour. HUD buttons in the match's order (sound, i, pause from the left). Results: the match's full-time card (`casualScreen` + `.results-*`), one column in portrait, with points where the scoreboard goes, six stat tiles, fastest goal line, the 7-day board with HIGHEST SCORE / FASTEST GOALS tabs, then PLAY AGAIN, POST MY SCORE, EXIT. `freekick.html` / `freekick-practice.html` now load `style.css`; `records.css` keeps only Free Kick's differences. Types, lint, Free Kick (incl. panels flow), logic and build pass; browser checks' selectors updated but not run. Not seen on a phone.

- **2026-11-09:** Free Kick scores by expected goals. Each spot gets an xG (share of 480 simulated "average kicks" that score against its wall and keeper, computed 30 per frame while aiming); each shot an xGOT (share of 32 re-simulated keeper reactions it beats, counting the real one; 0 off target). Goal = 10 / xG x (0.5 + xGOT) x streak (+0.25 per goal, max x2); style tags are labels only. A saved shot with xGOT 0.5+ is a GREAT SAVE: no life lost, 20 x xGOT points. Retries raise the spot's xG x1.5 (max 0.5). HUD shows XG and the goal's point range; banners show XGOT; results show goals/shots, xG, finishing (goals - xG) and great saves. Server validation accepts the new optional `greatSaves` / `xg` stats. Types, lint, Free Kick (25 + panels + server), logic (70) and build pass. Not playtested.

- **2026-11-09:** a carrier standing on the ball is attacked sooner: `AI.idleSec` 1.5 -> 1.0, `AI.idleDoubleSec` 2.5 -> 2.0 (user request). Types and logic pass. Not playtested.

- **2026-11-09:** playtest feedback fixes. (1) A beaten human no longer counts as our presser: `pickPresser` only lets the human stand in when within `humanPressDist` and not upfield of the carrier by more than `AI.beatenMargin`, so on a counter an AI teammate steps up instead of the defenders holding their zones by the posts. (2) SWITCH while the opponent has the ball puts teammates goal-side of the carrier first (nearest first), beaten ones after (`switchOrder`; new logic check). (3) Button 1 (PASS / TACKLE) is the same size as button 2 (art radius 18, was 14), moved to `VIEW.width - 316, VIEW.height - 112` to fit; TACKLE's label is no longer shrunk. Types, lint and logic (70) pass. Not playtested.

- **2026-11-09:** merged `movement_changes_main` into main through `50446b2` (smooth movement, back line, poke/slide tackles, sweeper keepers, smoother AI steering) and pushed it. Not playtested.

- **2026-11-09:** gameplay on branch `movement_changes_main`. Defenders hold a back line: no marking right by the ball, no cover defender near the box, no Hard/Pro near-goal compaction. Attackers stop short of the keeper. Two tackles for the human and the AI: a standing poke close and a slide further away, with loose-ball outcomes and a bonus against a heavy touch. Harder levels tackle more often, press tighter and slide more. Keepers sweep by level. AI steering is smoother: gliding press and cover spots, start deadbands, continuous intercepts, turning to the ball, leg hysteresis. Help text updated. Types, lint, logic (69) and build pass; balanced with a headless simulator, not playtested.

- **2026-11-09:** smoother 5v5 movement on branch `movement_changes_main`: filtered player/ball textures and smooth canvas scaling (match only), legs driven by the distance covered (0.6 rate floor), stride phase kept across run/sprint/view switches, ball spin capped at 30 frames a second, and a `FRAME` / `SLOW` frame-pacing line in the debug overlay. Generated in-between run poses tried and rejected (ghosting). Types, lint, unit, logic, Free Kick, privacy, games, speed, Daily, journeys and build pass; `test:dependencies` fails on Windows on `main` too. Not playtested.

- **2026-11-08:** merge the Free Kick blank-preview fix and consistent feed UI into main through `243d418`; prepare the requested GitHub push. No application build or deployment performed.

- **2026-11-08:** fix the Free Kick blank preview caused by the missing trimmed Phaser Linear helper; align the feed card with normal match styling and move full leaderboards to an ALL sheet. Types, lint and source-only browser regressions pass; no application build/deployment performed.

- **2026-11-08:** merge Free Kick live preview, intro/results, sharing, leaderboards and Quit into main through `2a1b719`; prepare the requested GitHub push. No application build or deployment performed.

- **2026-11-08:** add default two-page Free Kick briefing, completed-run results/sharing, separate score/speed leaderboards and pause Quit. Add ranked-run validation, immutable receipts, retention/deletion handling and source-only UI/API regressions. No application build or live Reddit writes performed.

- **2026-11-08:** add a real, silent live Free Kick post demo and match normal feed styling. Preserve Play/Practice actions and pause hidden/off-screen previews. No application build or live Reddit deployment performed.

- **2026-11-08:** fast-forward main through `0224d90`, including standalone Free Kick posts and unlimited selected-level Practice. Existing checks pass; no application build or deployment performed.

- **2026-11-08:** add standalone Free Kick post creation and feed Play/Practice actions, with a separate chosen-level unlimited Practice entry. Remove the normal-match shortcut, prevent match leaderboard pollution and preserve normal run records. No application build or live Reddit writes performed.

- **2026-11-08:** fast-forward main through `1c4bc49`, including Free Kick instructions and pause/help/resume controls. Existing type/lint/rule/panel checks pass; no application build or deployment performed.

- **2026-11-08:** add Free Kick info/pause buttons, portrait instructions and Resume/How to Play menu. Freeze active gameplay/timers/tweens, cancel held swipes and preserve nested return/audio/resize behaviour. Add actual-scene headless logic checks without an application build.

- **2026-11-08:** fast-forward main through `46ca4c4`, bringing in fixed left Free Kick settings, right-side shooting swipes and gesture trails. Existing type/lint/20-case Free Kick checks pass; no application build or deployment performed.

- **2026-11-08:** move Free Kick shot-type selector below left power slider, enable shooting swipes across clear pitch and add a bounded fading swipe trail. Preserve launch/power/contact rules, guard gesture ownership and clean up input/trail state across retries/resize/hide/restart. No application build run.

- **2026-11-08:** Separated Free Kick shot type, power and shooting gestures. Added a swipe pad with release feedback and a straight launch arrow, and cleared the previous trail on retry.
- **2026-11-08:** Free Kick: the wall sometimes stays down, low drives slip under a jumping wall (UNDER THE WALL tag), a man may lie behind it; keepers may cheat to the wall side, guess a corner or read part of the curl.
- **2026-11-08:** Moved the Free Kick contact frame onto the ball, moved power to a vertical slider on the left and added a live dotted preview of the shot.
- **2026-11-08:** Free Kick now uses a draggable contact dot and separate power slider. The swipe chooses the launch direction and shoots. Updated the wall guide, retry tips and flight checks.
- **2026-11-08:** New six-pose side run and twelve-pose sprint animations from user sheets; atlases re-baked.
- **2026-11-08:** Receiver slowdown after a pass halved: 1 s to 0.5 s.
- **2026-11-08:** Air pass: chip-shot height but paced to land at the receiver (replaces the same-day "copy the chip shot" version).
- **2026-11-08:** How to play (touch): the PASS disc now has the same four slide arrows as SHOOT.
- **2026-11-08:** Match info pages fill the card: page 1 blocks sized to the free room, page 2 key columns spread evenly with descriptions aligned to the widest key.
- **2026-11-08:** How to play: keyboard-only on desktop (live key caps), touch-only on mobile, new pass controls listed. N stays the one ground/normal pass key (no separate C key).
- **2026-11-08:** Match info pages: no overlapping text, crisp whole-pixel font sizes, re-spaced team cards, tiles, discs, footer and buttons.
- **2026-11-08:** Match info (i button) restyled like the results card; page 1 gains START GAME / NEXT, plus CONTROLS on desktop.
- **2026-11-08:** Pass swipes reworked: up = aerial pass that carries to the receiver, down = ground pass (no auto-chip), curl = aerial when held to half charge or more, ground otherwise. AIR / GROUND / AIR CURL / LOW CURL labels.
- **2026-11-08:** Added desktop pause-menu key remapping with saved defaults, both Shift keys and keyboard lob and curl passes.

- **2026-11-08:** Shortened Noob and Easy keeper approach and smother ranges against dribblers.

- **2026-11-08:** Tuned goalkeeper difficulty with separate reaction delays for dribbles and shots.

- **2026-11-08:** Balanced Chaos bots for weak and boosted shots, smaller goals and wider or taller keeper coverage.

- **2026-11-08:** Added analog lob, driven and curling swipes to PASS with on-button hints and receiver-directed curl.

- **2026-11-08:** Fixed straight dribble walk-ins by covering the goal lane earlier and preserving the AI keeper's reaction when the carrier comes into standing tackle range.

- **2026-11-08:** Added aggregate post analytics and a moderator menu report for the playable-post funnel and in-game milestones.

- **2026-11-05:** commit Free Kick mode to `main` and push to origin.
- **2026-11-05:** add Free Kick mode: portrait expanded entrypoint (`freekick.html`), PLAY FREE KICK lobby button, swipe aim/power/curl with a live power meter, swipe and ball trails, wall/keeper AI, lives/levels/streak scoring, and `test:freekick` (12 rules checks, added to `test:local`). Every local check except the Windows-only dependency check passes.

- **2026-11-02:** fast-forward local main through `c61061f` with game-creation post flair support; no push or deployment performed.

- **2026-11-02:** add optional subreddit post flair selection to game creation, validate current template IDs and apply selected flair on submission; strict changed-file types, lint, logic/Daily and expanded form-handler mocks pass.

- **2026-11-01:** fast-forward local main through `dde3c58` with responsive full-width desktop preview controls; no push or deployment performed.

- **2026-11-01:** fix desktop preview UI sizing/alignment after the gradient fix; full-width controls and responsive desktop sizing verified with 21 actual-lobby layout scenarios and a rendered 875x640 preview.

- **2026-11-01:** fast-forward local main through `87c5158` with the desktop gradient, switching/marker, Custom naming and keyboard updates. Preserve the local package edit; no push or deployment performed.

- **2026-11-01:** apply the requested WASD/Left Shift, I/J/K/L/N, Space/M/Escape keyboard layout; update help/documentation/browser selector, guard repeated HUD shortcuts and add two Controls regressions (55 logic cases pass).

- **2026-11-01:** rename Casual to Custom throughout user-facing labels, forms, errors and documentation; update existing browser selectors and game-count error expectation while preserving internal IDs and saved preferences.

- **2026-11-01:** add a subtle dashed next-SWITCH ground ring and shared read-only target planning; two new preview/cycle regressions bring the logic suite to 53 passing cases. Client types/lint and isolated renderer visibility checks pass.

- **2026-11-01:** make SWITCH outfield-only, remove keeper threat/hold overrides, update control help and add two switching regression cases. Client types, lint and 51 logic checks pass; full types blocked by missing analytics server module locally.

- **2026-11-01:** fix the desktop lobby gradient cutoff on `game-updates`; stylesheet geometry checks pass at seven desktop/mobile sizes. No application build or deployment performed.

- **2026-10-31:** fast-forward main through `335ebe3` with cleaner Rampage level-up feedback starting after the goal celebration. No application build, browser check or deployment performed.

- **2026-10-31:** move Rampage upgrade feedback to the actual post-goal kickoff and replace the crowded two-line outlined animation with one short subtle line. Preserve existing progression and pause/reduced-motion handling; no application build/browser checks run.

- **2026-10-31:** fast-forward main through `f6dd497` with the subtler Rampage difficulty label. No application build, browser check or deployment performed.

- **2026-10-31:** mute Rampage difficulty badge colours/opacity, reduce badge/text size and remove the heavy text outline. No gameplay or level-up animation changes; no application build run.

- **2026-10-31:** fast-forward main through `4c61b5e`, bringing in Rampage HUD refinement, actual-tier upgrade feedback and three shipped team kits. No application build, browser check or deployment performed.

- **2026-10-31:** remove the dark Rampage counter strip/tier border, improve tier text contrast and add reduced-motion-aware level-up feedback. Add Yellow, Cyan and Maroon team kits with pre-generated release textures and selector/validation coverage. No application build or browser check run.

- **2026-10-31:** fast-forward main through `91426db`, including Rampage badge styling, Chaos briefing explanations and Hard/Pro near-goal defence. Existing type/lint/48-case logic validation passes; no application build or deployment performed.

- **2026-10-31:** improve Hard/Pro near-goal pressure and allow tighter marker/backup/rest-cover spacing during opposing possession. Add behavioural checks for both goal directions, difficulty isolation, distance fade and possession isolation. No application build run.

- **2026-10-31:** clarify Chaos match details with effect-specific mechanics, percentage meaning, both-team/full-match scope, explicit start-score ordering and regulation-only clear conditions. No gameplay changes; build/browser checks skipped per user instruction.

- **2026-10-31:** rename RISING AI badges to RAMPAGE and add a colour-coded live difficulty badge with a dark goals/lives strip. Preserve AI progression, mode compatibility and goal celebration visibility. Update existing browser label expectation; skip build/browser checks as requested.

- **2026-10-31:** fast-forward `main` through `ca9cb2d`, bringing in tested percentage-controlled Chaos effects and the enabled-by-default Journeys integration at the user’s request. No live deployment or review submission.

- **2026-10-31:** implement fixed-effect, percentage-controlled Chaos Daily creation and per-match physics/geometry. Add lightweight flame/rain/highlight graphics, explicit UI labels, Chaos speed-record isolation and backward-compatible rules. Validate 100% baseline, low/high strengths, shots/tackles/walls/goals, native posting retries, actual browser goals, mobile results, reduced motion, rematches and Casual/legacy separation. Full local and browser suites pass; audit zero; live Reddit testing remains outstanding.

- **2026-10-31:** enable Journeys in normal builds at the user’s explicit request, preserve `STREET_SOCCER_JOURNEYS_ENABLED=false` as a kill switch and update review/activation documentation. Types, lint, lifecycle/API checks, enabled/disabled tracking browser cases and both existing game browser suites pass. Keep the final local build enabled; no live deployment or review submission.

- **2026-10-31:** implement default-off, match-level Reddit Journeys with a Hono SDK adapter, bounded allowlisted metadata, per-attempt IDs and nonblocking ready/start/result/quit/rematch hooks. Add review map, lifecycle/API/browser regressions and tests for denial/offline/timeout and passive preview exclusion. Keep rematch markers outside game settings. Clean install, local suite, default/enabled mocked tracking and existing game browser suites pass; audit zero. Restore default-off build; do not activate or submit review automatically.

- **2026-10-31:** fast-forward `main` through `a97f467`, bringing in Shield naming and all 48 npm audit fixes at the user’s request. Preserve the tested application code and installation compatibility fix.

- **2026-10-31:** eliminate all 48 npm audit findings with patched minimatch/tmp overrides, a guarded glob 7 compatibility postinstall and regression checks. Validate clean full/production installs, both zero-finding audits, full local suite, Daily browser scenarios and Devvit CLI commands in help mode. No live upload/publish.

- **2026-10-31:** rename Hold the Lead to Shield across visible app text and documentation, preserving stored mode IDs and gameplay. Types, lint, Daily rule/form/leaderboard checks and build pass.

- **2026-10-31:** fast-forward `main` through `2e53db0`, bringing in Rampage naming, rising-AI badges/briefing and the tested diagonal goal-text burst at the user’s request. Application code matches the tested branch.

- **2026-10-31:** rename the visible Survival mode to Rampage while preserving saved IDs; add rising-AI badges and explicit per-goal opponent/keeper progression in match info. Replace the old headline stretch with outlined chromatic text, tilt/shake and diagonal repeated trails fading into kickoff; keep speed steady and reduced motion static. Local and both browser suites pass; focused screenshots/checks cover reset, fade, bounds and kickoff cleanup. Live Reddit testing remains outstanding.

- **2026-10-31:** fast-forward `main` through `8ce99b7`, bringing in the tested Daily modes, Survival time ranking/custom limits, two-page match briefing and minimal goal-speed backing at the user’s request.

- **2026-10-31:** add Survival finishers-only time ranking, atomic personal-best writes, configurable goal/concession limits, fixed 5:00 cap for new posts and a paused Match Details → How to Play briefing. Validate custom limits, older board ordering, concurrent writes, deletion guards and two-page navigation with local/mocked SDK/browser checks. Review desktop/portrait/landscape screenshots; live Reddit testing remains outstanding.

- **2026-10-31:** implement three Daily templates, adaptive team tactics, Survival difficulty/keeper progression, objective-aware previews/results/rankings and a native creator template step on `codex/daily-challenge-modes`. Add mode, form-handler, counter and browser regressions; all local checks and both browser suites pass. Keep legacy/Classic/Casual rules and privacy retention compatible.

- **2026-10-31:** lighten the speed backing to 45% opacity and remove its border, preserving the larger digits and clear scorer area.

- **2026-10-31:** enlarge goal-speed digits/units and add a high-contrast speed badge while preserving the clear scorer area. Validation and focused mobile/desktop checks pass on `codex/goal-speed-visibility`.

- **2026-10-31:** clear the goal overlay away from the scorer: remove dark backings, raise/reduce animated lettering, tighten shadow/stretch/impact and put compact goal feedback in one upper row. Local checks and focused mobile/desktop celebration checks pass on `codex/clear-goal-overlay`.

- **2026-10-31:** replace the small goal badge with a dedicated arcade HUD overlay: one-shot impact, growing O sequence, final-letter stretch, team accents, tag/speed reveal, device-best ribbon and timed fade. Reduced motion and goal-age reset are covered; local and focused visual/gameplay browser checks pass.

- **2026-10-31:** implement launch-speed achievements, device bests, goal impact, results highlight and independent seven-day Fastest Goals leaderboard on `codex/goal-achievements`. Add transactional/validation/privacy/browser regressions; local suite, full mocked browser flows and portrait/landscape layout checks pass. Preserve native share consent, Casual separation and old result payloads.

- **2026-10-31:** refresh Devvit to 0.15.1, Hono to 4.13.14, ESLint to 10.14.0 and typescript-eslint to 8.72.1; synchronize lockfile on `codex/package-refresh`. Clean install, local checks and full browser suite pass; record remaining upstream audit findings.

- **2026-10-24:** remove 0-3-1 from available formations; migrate legacy configurations to 1-2-1 and update formation cycling/browser checks. Local checks and the full Casual browser suite pass.

- **2026-10-24:** unify responsive pixel results UI and centre the Casual end card on `codex/results-play-casual`. Preserve ranked saving/sharing and all mode actions; add browser regressions for ranked rematch, cancelled/submitted/late share forms and Casual transitions. Local checks and portrait/landscape layout checks pass.

- **2026-10-24:** add PLAY CASUAL to Daily Challenge/Classic results on `codex/results-play-casual`. Types, lint, build and desktop/mobile browser click-through checks pass.

- **2026-10-24:** rename the highest difficulty display label from PROFESSIONAL to PRO.

- **2026-10-24:** move preview time/difficulty into the top-right header with five colour-coded difficulty badges, replace LIVE PREVIEW, remove lower duplicates and place starting score beside team names on `codex/preview-match-info`. Casual shows CUSTOM SETTINGS. Local and browser checks pass.

- **2026-10-24:** restore full-card overlay preview, replace Casual pitch diagrams with text-only selectors, add per-team kit selection plus Orange/Teal atlases and 1-3 / 0-3-1 formations on `codex/overlay-lobby`. All local and browser checks pass; Reddit playtesting pending.

- **2026-10-24:** modern pixel preview card, compact no-scroll Casual setup and anonymous completed-games counter implemented on `codex/modern-pixel-ui`. Local checks and desktop/mobile browser regressions pass; live Redis/Reddit playtesting pending.

- **2026-10-24:** add three post types, Casual setup with premade arrow selectors and formation diagrams, remembered settings, help-before-play, rematch/change-settings/exit, and client/server ranked-result separation. Types, lint, 37 logic checks, privacy regressions, build and desktop/mobile browser flows pass. Reddit-native integration remains to be playtested.

- **2026-10-24:** refresh compatible dependencies and repair manifest/lockfile synchronization on `codex/street-soccer-dev`; preserve Phaser 3, TypeScript 6 and Node 24 compatibility. Clean `npm ci`, types, lint, 31 gameplay checks, privacy, build and Chromium smoke check passed; unit runner found zero tests.

- **2026-10-20:** trailer recorder also logs the ball's screen position per frame (`ball.json` next to each segment's frames, from `__film.stepCapture`), so a vertical cut can crop around the action; new `tools/trailer/promo-plan.json` records the clips for the Remotion promo in `F:\code ball\promo` (outside the repo)

- **2026-10-18:** the how-to-play (i) panel opens by itself on the first match started from the post's PLAY (match paused until GOT IT); the HUD had been opening it on every match, now only behind BootScene's `helpAtStart` flag

- **2026-10-18:** hard minimum gap of 120 px between AI teammates (`AI.mateMinGap`, `TeamBrain.keepApart`), everyone but the chaser / presser; new logic check

- **2026-10-18:** five difficulty levels, NOOB / EASY / AMATEUR / HARD / PROFESSIONAL (new `noob` and `pro` LEVELS rows, display labels, `< LEVEL >` selector on the menu); default stays AMATEUR (`normal`)

- **2026-10-18:** aligned Devvit packages at 0.14.8 (`devvit`, `@devvit/web`, `@devvit/start`, all exact). The CLI had been bumped to 0.14.8 alone, so two copies of `@devvit/server` were installed and scheduled jobs in the playtest failed every 10 minutes with "No context found"

- **2026-10-18:** easier scoring: finishing assist on human shots (pulled toward the open side of the keeper, random 10-90%), keeper reads shots 0.1 s before side-stepping, standing reach 38, rush-out stops 110 px from the shooter; tuned by simulation; new logic checks

- **2026-10-18:** replaced the first teaser's disconnected montage with a separately exported 19 s, 60 fps continuous-gameplay revision; verified 1,140 frames, two saves, one goal, smooth title reveal and unclipped audio.

### 2026-10-18: Trailer v2

- Even-difficulty recording with the real score, zooms on the save and celebration, REPLAY tag, flashes on the title and goal.

### 2026-10-18: Gameplay trailer

- Dev-only trailer recorder (tools/trailer) and a 20 s first cut; `?film` URL flag exposes the game object locally.

- **2026-10-17:** produced and verified a 22-second landscape Street Soccer teaser with two goalkeeper saves, goal celebration, title cards, music and synchronized effects. Export lives outside the repo in workspace `output/teaser/`; 660 frames decode cleanly and audio does not clip.

- **2026-10-17:** redesigned desktop banner for 1072:128 proportions with single-line title and actual game sprites; exported 2144 x 256 / 1072 x 128 PNGs and inspected both.


- **2026-10-17:** created improved Street Soccer subreddit banner v2 using current game sprite references; exported and inspected two wide PNGs with prompt notes.


### 2026-10-17: Review of head replacement and compliance follow-up

- All face sheets confirmed replaced and baked; full check suite passes; launch checklist noted in Current state.

- **2026-10-17:** compliance follow-up adds player deletion and legacy migration, scheduled account cleanup, mandatory verified Scores pins, user-attributed custom challenges, and regression checks; rebuilt all latest sprite sources for release and installed private playtest v0.0.2.2. Reddit UI verification blocked by declined browser-origin permission.


### 2026-10-17 - Replace remaining bearded keeper hold

- Imported latest four-pose clean-shaven hold sheet with alpha, uniform body scale and matching cell/ground alignment. No colour check or build.

### 2026-10-17 - Use supplied four-pose sheet for side tackle

- Fitted four clean-shaven falling poses into eight existing tackle frames with a reverse recovery, and transferred clothing split boundaries; no colour check or build.

### 2026-10-17 - Replace goalkeeper standing block sheet

- Imported three supplied clean-shaven hand-block frames with alpha and matching alignment. No colour check or build.

### 2026-10-17 - Replace goalkeeper jump-save sheet

- Imported four clean-shaven jump-save poses with alpha and original frame alignment; no colour check or build.

### 2026-10-17 - Replace goalkeeper idle sheet

- Imported supplied clean-shaven gloved idle artwork, restored transparency and fitted all three frames to existing alignment; no colour check or build.

### 2026-10-17 - Replace goalkeeper ball-carry animation

- Imported supplied six-pose sheet as keeper carry, restored transparency and matched existing frame dimensions. No colour check or build.

### 2026-10-17 - Copy supplied goalkeeper hold sheet

- Copied the supplied four-frame image to player-hold-authored.png without colour checks or build.

### 2026-10-17 - Replace goalkeeper dive with clean-shaven sheet

- Imported six supplied dive poses into the existing sheet layout, rebaked keeper/look atlases, and visually compared green/gold variants before and after.

### 2026-10-17 - Replace all celebration heads on main

- Fitted supplied jump, knee-slide and dance sheets to existing source cells and replaced all 18 bearded celebration frames. Rebaked kits/look layers and release art; visually checked pink/blue/red frames without changing animation timing or keys.

### 2026-10-17: New head: shoot + hurt sheets

- Shoot and hurt sheets replaced with the redrawn head; per-pose kit splits with a new optional second sock line (`socksAlso`); atlases rebaked; release art 1.63 MiB.

### 2026-10-17: New head: run down + run down-diagonal sheets

- Both sheets replaced with the redrawn head; own kit split lines (slanted on the diagonal's raised-leg poses); atlases rebaked.

### 2026-10-17: New head: run sheet

- Run sheet replaced with the redrawn head; per-pose kit split lines; atlases rebaked.

### 2026-10-17: New head: idle sheet

- Idle sheet replaced with the redrawn clean-shaven head; own kit split lines; atlases rebaked.

### 2026-10-17: Devvit Rules compliance

- Score-only shares reply to a pinned Scores comment; clearer POST MY SCORE popup ("Post as u/name"); PostDelete trigger clears a deleted post's data; report-a-problem line in the help; README updated.

### 2026-10-17: App README for review

- README.md rewritten for Reddit's review (required by the launch guide): overview, controls, moderator tools, data and permissions, then the developer commands.

### 2026-10-17: v0.0.2 uploaded

- `npm run deploy` passed and uploaded app version 0.0.2; not launched yet.

### 2026-10-17: Music plays on phones; mix 80 / 25; smoother entry

- Streamed music routed through Phaser's Web Audio (volume, mute) and retried on the next touch if the browser refused it.
- Music 80%, effects 25%.
- Game page loader reduced to a small bar on navy, faded out while the court fades in; small LOADING PLAYERS text at the bottom.
- Type check, lint, build and 28 logic checks pass; no device test.

### 2026-10-17: Live preview straight away; sound switch fixed

- Sound switch state kept in `ui/soundSetting.ts` (Phaser's mute read-back was stale).
- Feed card: no loading panel or placeholder, the live lobby starts as soon as the card is visible; the court is drawn first; match art downloads in parallel with the game code (`earlyAssets.ts`, dynamic game import).
- Type check, lint, build and 28 logic checks pass; no gameplay test.

### 2026-10-17: Reddit compliance clean-up

- Removed the template's example form and demo API routes; POST MY SCORE never posts the player's text as the app; score comments limited to one per 10 min per player and post; results saved at most once per match length; impossible goal counts rejected.
- Type check, lint, build and 28 logic checks pass; no Reddit test yet.

### 2026-10-17: Faster start: audio compressed and loaded in the background

- Audio 6.5 -> 2.2 MB (effects MP3, music 64 kbps); the match no longer waits for any sound; music streamed (`ui/streamMusic.ts`); `scripts/optimize_audio.py`, `npm run audio:release`.
- Court/scenery painted during the art download; feed preview after 1.5 s on screen, none with data saver; keeper atlases without celebrations.
- Tinted kit layers measured and rejected (visible colour change).
- Type check, lint, build and 27 logic checks pass; no gameplay test.

### 2026-10-17 - Save lobby and sound updates on main

- Recorded completed live-lobby and audio work on main at user request; no separate branch merge needed.

### 2026-10-17 - Ease in missed/saved-shot audio

- Added a 150 ms sine ease-in from silence to 40 percent exclusively for goal-miss, with cue/tween cleanup.

### 2026-10-17 - Sound effects at 40 percent

- Lowered all effects to 0.4, kept music at 1, and deferred fade-ins per user clarification.

### 2026-10-17 - Sound effects at 50 percent

- Reduced all five effect playback levels from 0.65 to 0.5; background music stays at 1.

### 2026-10-17 - Full-volume background music

- Raised match BGM playback from 22 percent to 100 percent at user request.

### 2026-10-17 - Background music and master sound switch

- Added compressed bgm.mp3, match lifecycle playback and a persistent pixel speaker toggle immediately left of the info button.

### 2026-10-17 - Match lobby to game theme

- Replaced rounded modern mobile styling with shared pixel glyphs, game colours and stepped buttons; restored the desktop street backdrop. Mobile sizing and leaderboard popup visually verified.

### 2026-10-17 - Portrait live lobby

- Added mobile overlay layout, full-card live preview framing, readable controls and non-scrolling leaderboard pages. Tall feed card configured. Verified 390x700 and 320x500 layouts, ALL open/close and fresh PLAY transition locally; screenshot saved in workspace output/mobile-live-lobby.png.

### 2026-10-17 - Live match opening lobby

- Added a settings/leaderboard panel beside real AI-vs-AI preview gameplay, shared lazy game bootstrap and a direct PLAY-to-match transition.

### 2026-10-17 - Enable score comment user action

- Added permissions.reddit.asUser SUBMIT_COMMENT to fix UserActions plugin not enabled errors.

### 2026-10-17 - Keeper-area miss/save sound

- Updated the supplied miss/save sample and restricted its playback to events in either goalkeeper penalty area.

### 2026-10-17 - Refresh miss/save sample

- Replaced both source and release goal-miss.wav from the newly supplied file.

### 2026-10-17 - Miss and save sound

- Added goal-miss.wav with unresolved-shot tracking and cleanup on possession, goals and kickoff.

### 2026-10-17 - Match over sound

- Added stop.wav once per fulltime transition with replay reset and goal-cheer suppression.

### 2026-10-17 - Match start sound

- Added start.wav with once-per-match playback, replay reset and scene cleanup.

### 2026-10-17 - Goal celebration audio

- Added goal.wav once per scored goal with audio unlock checks and shutdown cleanup.

### 2026-10-17 - Replace pass/shot sample

- Replaced source and release audio with the latest supplied shoot.wav; gameplay triggers unchanged.

### 2026-10-17 - Pass and shot audio

- Added supplied shoot.wav and playback for passes and shots using Phaser audio with a ball strike counter.

### 2026-10-17 - Feed card = title screen, POST MY SCORE, today's top 3

- Splash paints the game's title screen (ui/menuCard.ts); locked posts go straight to the match; result screen: POST MY SCORE popup comment, daily top 3 per post in Redis.

### 2026-10-17 - Minimap

- Bottom-centre minimap with live player and ball positions (ui/Minimap.ts).

### 2026-10-17 - Custom match posts

- Moderator form creates a post with fixed team labels, jerseys, formations, difficulty, length (max 5:00) and goals conceded at kickoff, saved as postData; game, splash and replay use them; 4 new kit atlases; formations as data.

### 2026-10-17 - How-to-play (i) button

- Added an i button beside pause opening a paused controls panel with game icons (HelpPanel.ts); I key toggles it, ESC closes it.

### 2026-10-17 - Integrate GitHub main

- Merged incoming gameplay changes and local preview commands while preserving scoreboard, pause and tackle label improvements.

### 2026-10-17 - Prepare UI changes for main

- Collect scoreboard fit/labels, the pause graphic, smaller TACKLE text and the user's placement adjustments into one commit on assests for a fast-forward merge to main.

### 2026-10-17 - Smaller TACKLE label (assests)

- Reduced TACKLE text by 25 percent while retaining the action button hit area and other labels.

### 2026-10-17 - Pause icon (assests)

- Added an optional pause icon to TextButton and enabled it for the HUD pause control; other buttons retain text.

### 2026-10-17 - Scoreboard colour bar alignment (assests)

- Shared box/bar/text centre coordinates and shortened colour bars to 24 px, giving equal vertical padding.

### 2026-10-17 - Visible scoreboard centring (assests)

- Restored y=44 and excluded transparent bitmap cell padding from the score label's display origin. Preserved YOU/OPP and fitting for multi-digit scores.

### 2026-10-17 - Scoreboard placement and labels (assests)

- Moved the scoreboard text from y=44 to y=48 and replaced CPU with OPP; preserved scores and width fitting.

### 2026-10-17 — Scoreboard text containment (`assests`)

- Reduced the score label size and bounded its measured display width to the space between the colour chips, preserving centred alignment and padding for longer scores.
- TypeScript, lint and production build passed; localhost preview rebuilt. Visual review pending.
### 2026-10-17: Merge `ketan` into `main`

- Brought the AI defending upgrades, faster passes, switch-after-losing-the-ball, `npm start` and `test:local` into `main` alongside the goalkeeper idle / jump / block work. Kept both sides' status entries; `logic-check.ts` imports both `AI` and `KEEPER`.
- `ketan`'s last commit had re-saved most files with CRLF line endings; the merge keeps `main`'s line endings, so only real changes come in.
- `npm run test:local` passes (types, lint, unit, 20 logic checks, build).

### 2026-10-17: AI defending: recovery runs, cover defender, show wide (user request)

- (A) defenders caught upfield of the ball sprint back (`LEVELS.recoverSlack`); (B) new `backup` role behind the presser, and a beaten presser hands over (`AI.beatenMargin` / `beatenPenalty`); (C) the presser shows wide carriers toward the touchline (`AI.showWide*`).
- 4 new logic checks (18 in all, all pass); type check and lint pass; no gameplay test.

### 2026-10-17: Faster tap passes (user request)

- `PASS.arriveSpeed` 230 -> 360, `minSpeed` 300 -> 420, `maxSpeed` 1100 -> 1200: passes arrive ~25-30% sooner.

### 2026-10-17: `npm start` local preview

- `npm start` builds and serves `dist/client` at http://localhost:4173 via `scripts/serve.mjs` (Node only, no dependencies); `npm run serve` serves the last build. `lint` glob now double-quoted so it works on Windows too.

### 2026-10-17: Switch after losing the ball (user request)

- After a CPU tackle on our controlled player, SWITCH (for 4 s, `INPUT.lostBallSwitchSec`) picks the outfielder who can reach the ball soonest, and he runs at the ball by himself (`INPUT.chaseAssist`) until steered.
- Type check and lint pass; no gameplay test.

### 2026-10-17: One-command local test

- Added `npm run test:local`, which chains `test:types`, `lint`, `test:unit`, `test:logic` and `build` (CI's checks plus the logic checks).
- Quoted the `lint` script's glob with double quotes instead of single quotes, so it also expands on Windows (cmd.exe doesn't strip single quotes, so ESLint was receiving the literal pattern `'src/**/*.{ts,tsx}'` and matching nothing).

### 2026-10-17: Goalkeeper idle, jump save and standing block

- 3 new keeper sheets baked into the keeper atlases (outfield atlases skip keeper-only poses; release art 1.22 MiB).
- Keeper AI: jump save for high balls at it, standing tackle at its feet, block pose after standing saves; our keeper jumps with the stick centred.
- Type check, lint, build and 16 logic checks pass; no gameplay test.

### 2026-10-16: Remove balls from keeper block sheet

- Created `public/art/player-keeper-block-3frames-no-ball-v1.png` by removing all three footballs from the blocking draft. Visually inspected; original preserved, runtime unchanged.

### 2026-10-16: Three-frame standing ball block

- Created `public/art/player-keeper-block-3frames-v1.png` with built-in imagegen and keeper idle style reference. Three ready/contact/rebound poses on transparency; visually inspected. Not applied in-game.

### 2026-10-16: Three-frame normal standing hand save

- Created `public/art/player-keeper-standing-save-3frames-v1.png` with built-in imagegen using keeper idle reference. Three grounded ready/catch/hold poses with a visible ball on transparency; visually inspected. Runtime unchanged.

### 2026-10-16: Four-frame standing goalkeeper tackle draft

- Created `public/art/player-keeper-standing-tackle-v1.png` using built-in imagegen with the keeper idle as reference. Four grounded tackle/gather poses on transparency. Runtime unchanged.

### 2026-10-16: Two-frame goalkeeper ball-tackle sprite draft

- Created `public/art/player-keeper-tackle-v1.png` with built-in image generation and the keeper idle draft as character/style reference. Low lunge and grounded smother poses; visually inspected. Runtime unchanged.

### 2026-10-16: Three-frame goalkeeper standing sprite draft

- Created `public/art/player-keeper-idle-v1.png` with built-in image generation using the existing player idle sheet as a style reference. Three ready-standing poses, white gloves, pink kit, transparent background; visually inspected. Runtime code unchanged.

### 2026-10-16: Top-corner shots possible

- `SHOOT.fullLift` 420 -> 600; keeper dive reach height 120 -> 95 at full stretch (`KEEPER.stretchReachHeight`, `diveReachHeight`).
- Type check, lint, build and logic checks pass; no gameplay test.

### 2026-10-15: End walls scaled with the goals; no wall text

- `PITCH.endWallHeight` 120 -> 138.6; far-wall graffiti text removed.
- Type check, lint, build and logic checks pass; no gameplay test.

### 2026-10-15: Receiver hold on passes

- The intended receiver of a normal pass moves at most 80 px/s for up to 1 s or until it gets the ball (both teams; through balls excluded).
- Type check, lint, build and logic checks pass; no gameplay test.

### 2026-10-15: Goals 5% bigger

- Goal opening, crossbar height, net depth and post radius +5% (tuning.ts).
- Type check and logic checks pass; no gameplay test.

### 2026-10-15: Trimmed Phaser; match prepared during the menu

- `tools/phaser-trim.cjs` + vite alias and build-flag plugin: game.js 355 -> 213 KB gzip (sound kept for later).
- Boot opens the menu without downloading anything first, then downloads the art in priority order and prepares player frames, ball, court and scenery in the background (`gameAssets.ts`); Match waits only for what is missing.
- Type check, lint, build and 14 logic checks pass; not run in a browser.

### 2026-10-15: Faster loading: player atlases baked at build time

- New `playerSheets.ts` (pure layout + bake), `scripts/bake-player-atlases.ts` + `scripts/png.ts`, `npm run art:bake` / `art:release`, `tools/tsconfig.scripts.json`; optimize_art.py ships the baked atlases (palette + lossless) instead of the 15 big sheets. Release art 5.6 -> 1.28 MiB.
- Boot opens the menu immediately and downloads the atlases in the background; Match waits only if needed. HTML loading screen, gated splash prefetch, load-timing marks. Wider pink match for every sheet.
- Type check, lint, build and 14 logic checks pass; no gameplay test.

### 2026-10-15: Camera zooms in on the celebrating scorer

- `CameraRig` follows and zooms (1.6x) on the scorer during the goal celebration (`CAMERA.celebrateZoom`, `CAMERA.celebrateLift`, `CameraFocus.celebrant`, `MatchScene.celebrantFocus`).
- Type check passed; lint, build and logic checks not run; no gameplay test.

### 2026-10-15: Prevent first-Play apparent hang

- Split first-match player atlas preparation into one authored action sheet per frame and skin/hair layers into 64-row steps; display a preparation message and release each temporary recolored canvas before continuing. Reduced atlas width from 3584 to 1792 px for mobile texture compatibility. Local first Play reached kickoff without browser errors; TypeScript, lint, and production build passed.

### 2026-10-15: Merge smaller release build into `main`

- Fast-forward merged `assests` commit `579faf6` into `main` as requested. Rebuilt on `main`: client output remains 6.77 MiB, down from the prior 10.69 MiB. Reddit visual playtest remains pending before publication.

### 2026-10-15: Smaller player sheets prepared on `assests`

- Re-encoded the 15 player animation sheets as quality-98 WebP while preserving exact transparency. The two ball sheets remain lossless and all original PNGs remain editable. The regeneration script now checks alpha identity and visible color error. Production client reduced from 10.69 to 6.77 MiB; production build passed. Reddit visual playtest remains to be done before merging.

### 2026-10-15: Merge `assests` into local `main`

- Committed the tested asset, field and build-size changes on `assests` (`af66544`) and fast-forward merged them into local `main`. Type check, lint, production build and 14 logic checks passed before merge. Remote main remains at the previous commit pending a push.

### 2026-10-15: Smaller Reddit release build

- Added a reproducible lossless WebP conversion script and a release-only public directory; changed Boot to load these exact-pixel sheets. Disabled Devvit source maps and excluded sprite source PNGs/review pages from client output.
- Avoided home-kit source canvas copies, released authored source textures after atlases are built, and made ball atlas creation reusable on match restart. Output: 25.11 to 10.69 MiB; visible sprite colors and alpha were checked pixel-for-pixel. Type check, lint, production build and all 14 existing logic checks passed; static release references verified.

### 2026-10-15: Warmer, rougher street field revision

- Reworked the rejected blue-gray surface toward the older warm asphalt look, with stronger stone/pit grain, four repaired sections, tar seams, goal scuffs and more visible boundary cracks.
- Added faded, chipped basketball keys/arcs beneath the football markings, entirely through code. Inspected the painter preview; type check, lint and rebuild passed. User visual review pending.

### 2026-10-15: Code-painted blue-gray street field

- Added a deterministic asphalt painter with broad fading, restrained grain, three jagged repairs and subtle goal wear. Removed dense bright speckles, random central repairs and bright puddles from the playing field; retained surrounding pavement/parking/basketball artwork and projected football markings.
- Inspected a raster preview of the actual painter. Type check, lint and production rebuild passed; user in-game review pending. No image assets added.

### 2026-10-15: Three goal celebrations, picked at random

- Added the user's knee-slide and dance celebrations next to the first one; the scorer picks one at random per goal. All three sheets rebuilt on 720 px cells.
- Type check, lint, production build and logic checks run; offline kit-split previews checked; no gameplay test (user review pending).

### 2026-10-15: Goal celebration; tackle stagger 1.0 s

- The scorer loops the user's 6-pose celebration during the goal phase (new sheet, `celebrateAnim`, `Player.celebrate`, `MatchScene.scorer`).
- `TACKLE.staggerSec` 0.5 -> 1.0 for the upcoming tackled-player fall animation.
- Type check, lint, production build and logic checks run; offline kit-split preview checked; no gameplay test (user review pending).

### 2026-10-15: Court surface with character

- Grain, polished wear (centre circle, goal mouths), dusty strip along walls/fence and resurfacing patches with seams, baked into the ground texture.
- No gameplay test (user review pending).

### 2026-10-15: Ball spins backwards when rolling left

- Ball.ts keeps a signed roll distance: moving left plays the 4 roll frames in reverse, so the spin matches the direction (user: the right-moving roll was perfect, left looked wrong).
- Type check, lint, production build and all 14 logic checks passed; no gameplay test.

### 2026-10-15: New goalkeeper dive

- Replaced the 6-frame dive with the user's 4 poses laid out as 6 cells (crouch, launch x2, stretch x2, landed). Slanted per-pose kit split lines for the keeper kits and a wider pink match for this sheet.
- Type check, lint, production build and all 14 logic checks passed; offline kit-split preview checked; no gameplay test (user review pending).

### 2026-10-15: New ball sprite

- Replaced the 6-frame rolling ball with the user's 4-view ball sheet (transparent, 64 px frames, same on-pitch size). `BALL_FRAMES` cut to 4.
- Type check, lint, production build and logic checks run; no gameplay test (user review pending).

### 2026-10-15: Different skin tone and hair colour per player

- New grey skin and hair layer atlases built at startup from the home atlas; each Player draws them tinted over its kit sprite. 6 looks, no repeats within a team (MatchScene). `Player` takes an optional `look`.
- Type check, lint, production build and all 14 logic checks passed; offline colour preview of the idle frame checked; no gameplay test (user review pending).

### 2026-10-15: Correct scenery, camera and post scaling after pitch enlargement

- Fixed hard-coded parking coordinates that placed cars and parking paint inside the enlarged right goal area. Parking rows now move with the goal line.
- Made camera follow limits proportional to the pitch and increased collision/render post radius by 10%. Goal frame rendering shares that radius and retains fractional thickness. Type check, lint, production build and all 14 logic checks passed; user visual playtest pending.

### 2026-10-15: Pitch and goals enlarged by 10%

- Increased pitch length/depth, goal opening/crossbar/net depth and pitch markings by 10%; adjusted formations and kickoff positions for the larger field.
- Changed keeper reaction fixture to pitch-relative coordinates so its smother/shot scenario remains at the goal. Existing player size, camera and physics tuning retained. Type check, lint, production build and all 14 existing logic checks passed; user visual playtest pending.

### 2026-10-14: Latest shot-ball and keeper carrying sheets

- Replaced the authored shot-ball and keeper carrying assets with the latest supplied six-pose sheets; inspected both extracted previews.
- Updated all six carry hand anchors for the open-glove poses. Retained live-ball rendering behind gloves, shot trails, animation timing and physics. Type check, lint, production build and existing logic checks verified; user visual playtest pending.

### 2026-10-14: Six-pose goalkeeper dive replacement

- Replaced `public/art/player-dive-authored.png` with the latest six supplied poses in a three-column/two-row sheet; inspected `art-previews/dive-preview.png`. Uniform scale and common per-row ground references preserve raised hands and extended legs.
- Added dive5/dive6 atlas frames, updated source-column/recolor indexing without changing the two-column hurt layout, and spread five frames across the actual dive time with frame six held through recovery. New source reaches left, so rightward dives mirror it.
- Existing save reach, movement/recovery timing, ball trails and user tuning retained. Type check, lint, WSL build and existing logic checks run; user visual review pending.

### 2026-10-14: Shot-ball squash/stretch sequence, trails preserved

- Added `public/art/ball-shot-authored.png`, six isolated poses in row order; connected-component extraction avoids neighboring ball fragments. Inspected `art-previews/shot-ball-preview.png`.
- Boot preloads the sheet and ballArt registers 96x96 shot frames alongside the regular 64x64 rolling frames. `kickShot` and human keeper kicks reset a visual timer; Ball plays the six-frame sequence at 18 FPS, centered on the normal ball position, then returns to rolling.
- Existing ball trails/shadows, base size, shot physics and tuning are unchanged. Type check, lint, WSL build and existing logic checks run; user visual review pending.

### 2026-10-14: Gloved keeper carrying cycle and six-frame ball

- Added `public/art/player-carry-authored.png`, six aligned poses in a three-column/two-row source sheet; inspected `art-previews/keeper-carry-preview.png`. Kit atlases register a 12 FPS carry cycle, scaled with movement speed; stationary keepers keep the existing hold loop.
- Measured glove anchors per carry frame; Player publishes them and Ball draws behind the gloves while carrying, restoring normal ball rendering on release.
- Added `public/art/ball-authored.png`, six consistently sized 64x64 frames; inspected `art-previews/ball-preview.png`. Boot preloads it and ballArt registers all frames. Rolling advances by traveled distance, with display size, shadows, trails, possession and physics preserved.
- Type check, lint, WSL build and existing logic checks run; user visual playtest pending.

### 2026-10-14: Replacement side-profile keeper dive sheet

- Replaced `public/art/player-dive-authored.png` with the user's newest four poses, ordered across the top row then bottom row. Preserved transparent edges, common scale and per-row ground references; inspected `art-previews/dive-preview.png`.
- Existing left/right mirroring, save physics, shortened dive handling and landed recovery pose retained. No gameplay source changes. WSL build run for localhost.

### 2026-10-14: Ball-carrier recoil/fall on successful tackles

- Added transparent `public/art/player-hurt-authored.png` from the supplied four poses; inspected `art-previews/hurt-preview.png`. Boot preloads it and kit atlases include recolored hurt frames in two-column source layout.
- Successful tackles and keeper smothers call `Player.playHurt`. Rendering prioritizes the simulation-timed reaction, mirrors by the carrier's facing, and finishes with existing tackle get-up frames within the current stagger lock. No physics/contact/timing changes.
- Updated the existing logic-check player stub for the reaction method. Type check, lint, WSL build and existing logic checks run; user gameplay review pending.

### 2026-10-14: Keeper holding cycle and hand-aligned ball

- Added `public/art/player-hold-authored.png` from the supplied four poses and inspected `art-previews/keeper-hold-preview.png`. Boot preloads it and all kit atlases include the holding cycle.
- Keeper holding overrides idle/run with a 4 FPS loop after dive/tackle/action handling. Player publishes per-frame mirrored hand anchors; Ball renders centered between the hands with a holding-specific scale and hidden ground shadow, restoring its normal origin/scale/shadow on release.
- Holding/distribution/save physics and player/camera tuning are unchanged. The source shows no throw release poses, so throw behavior is retained pending actual throw artwork.
- Type check, lint, WSL build and existing logic checks run; user visual review pending.

### 2026-10-14: Authored goalkeeper dive

- Added transparent `public/art/player-dive-authored.png` with four extracted poses; inspected them in `art-previews/dive-preview.png`. Source poses separated by connected silhouettes to preserve overlapping feet/gloves, with a shared ground reference.
- Boot preloads the sheet and kit atlases include recolored dive poses. `startDive` records its simulation start and calls `Player.playDive`; rendering selects readiness/launch/flight during the actual dive and holds the landed pose for recovery, mirrored left. Removed the old rotation for authored dives; collision/save mechanics are unchanged.
- Expanded frame width to 224 px for outstretched gloves, retaining player world height/camera values and texture widths under 4096 px. Updated the existing logic-check player stub for `playDive`.
- Type check, lint, WSL build and existing logic checks run. User in-game review pending.

### 2026-10-14: Dedicated authored sliding tackle

- Added `public/art/player-tackle-authored.png` and inspected all eight poses in `art-previews/tackle-preview.png`. Wide frames preserve hands/boots and common row baselines.
- `startTackle` now calls `Player.playTackle`; rendering selects wind-up/slide/get-up frames from the actual simulation clock, holding the low pose longer after failure and suppressing the old sideways rotation during tackles. MatchScene supplies simulation time alongside visual time. Shooting retains its own completion listener.
- Expanded frame canvas to 192x128 without changing world height; packed kit atlases into 16 columns and run/tackle source sheets into two rows to remain within 4096 px widths. Updated the existing logic-check player stub for the new tackle method.
- Type check, lint, WSL build and 14 existing logic checks pass. User gameplay review pending; no automated browser gameplay testing.

### 2026-10-14: Downward diagonal running

- Added `public/art/player-run-down-diagonal-authored.png` from the supplied four poses, with a common vertical baseline. Inspected `art-previews/down-diagonal-run-preview.png`.
- Boot preloads the sheet, kit atlases recolor clothing and register an 8 FPS down-diagonal cycle. `Player.render` selects it for downward diagonals and mirrors for down-left, retaining direction hysteresis and the other movement views.
- Type check, lint and WSL build checked; user visual playtest pending. Player/camera values retained.

### 2026-10-14: Upward diagonal running

- Added `public/art/player-run-up-diagonal-authored.png` from the supplied four poses, preserving their common vertical reference and airborne foot positions. Prepared `art-previews/diagonal-run-preview.png` for inspection.
- Boot loads the new sheet; each kit atlas registers an 8 FPS upward-diagonal loop. `Player.render` selects it for upward diagonal headings and mirrors it for up-left, while front/back vertical runs stay unmirrored. Existing player/camera settings retained.
- Type check, lint and WSL production build checked; user in-game review pending.

### 2026-10-14: Back/front running for up/down movement

- Added aligned transparent `player-run-up-authored.png` and `player-run-down-authored.png`, each four frames at a common foot baseline. Inspected all eight in `art-previews/vertical-run-preview.png`.
- Boot loads the sheets; player atlases recolor clothing for every kit and register 8 FPS vertical animations. `Player.render` selects front/back/side by heading with hysteresis and disables horizontal flipping for vertical runs. Texture generation is skipped when a kit atlas already exists on match restart.
- Type check, lint and WSL build run. User in-game visual review remains pending; idle/shoot still use existing side artwork.

### 2026-10-14: Combined run sheet replaces Run 1 and Run 2

- Replaced `public/art/player-run-authored.png` with all eight poses from the user's latest two-row sheet. Kept common 640x724 cells, a uniform scale, transparent background and shared foot baseline; row split includes the complete first-row boot.
- Inspected all eight extracted frames in `art-previews/run-cycle-preview.png`. Existing 16 FPS run loop, kit recoloring, idle/shoot and user-selected camera/player scale retained. WSL build run for localhost.

### 2026-10-14: Run 2 and shooting artwork integrated

- Extended `public/art/player-run-authored.png` to eight frames using the supplied Run 2 poses. Added the four-frame `player-shoot-authored.png`; connected silhouettes were separated without clipping the overlapping contact/follow-through poses.
- Boot preloads shooting, and player atlases composite authored idle/run/shoot for every kit. Eight run frames at 16 FPS preserve the half-second stride; shooting remains 14 FPS. Expanded frame width to 120 px for extended limbs, preserving world height and the user's camera settings.
- Visually inspected idle/Run 2/shoot in `art-previews/actions-preview.png`. Type check, lint and WSL production build checked; user gameplay review pending.

### 2026-10-14: Supplied Run 1 animation integrated

- Added `public/art/player-run-authored.png`, four aligned transparent poses. Boot loads it and player atlases use it for the active running loop with clothing recoloring per kit.
- Kept user-selected player scale and camera values. Four frames at 8 FPS retain the earlier stride duration; speed scaling still comes from `Player.render`. Idle retains the supplied artwork and shooting is unchanged.
- Type check, lint and WSL build run; user gameplay review remains pending.

### 2026-10-14: Rebuilt user-selected character size

- User set `PLAYER_PX = 3.0 / DETAIL`, giving 96 px world height, about 9% larger than before. Preserved the user's source values.
- `npm run build` passed in WSL; localhost serves the rebuilt files. Existing Phaser bundle-size warning remains.

### 2026-10-14: Authored idle sprites integrated into the game

- `BootScene` preloads the supplied idle PNG before the menu. `playerArt` composites the four aligned source frames into each kit atlas, preserving sprite scale and ground origin; idle loops at the existing 4 FPS and includes the blink frame.
- Home retains the original pink pixels; away/keeper sheets recolor clothing highlights/shadows while retaining skin, hair, boots and trim. Run/shoot frames remain generated until compatible authored frames are supplied.
- Type check, lint and WSL production build verified; the PNG is included in `dist/client/art`. In-game visual playtest is the user's.

### 2026-10-14: User-supplied idle sheet prepared for review

- Preserved the supplied transparent artwork; extracted and horizontally centered four frames while keeping their common y=695 foot baseline. Added `public/art/player-idle-authored.png` and frame metadata, plus an idle PNG in `art-previews/`.
- Added `/player-idle-review.html` and external preview JavaScript with an enlarged view, adjustable gameplay-size view, animation and pause. Copied the review assets to the current localhost build. JavaScript syntax check passes.
- Existing in-game generated art remains active until this idle base is reviewed; no gameplay changes or automated gameplay testing.

### 2026-10-14: Detailed full-body sprite reference

- `art/playerArt.ts`: 96x128 textures, newly drawn procedural head with swept hair clusters, ear inset, white eyes/dark pupils, nose and short beard. Broader shoulders, longer jersey, clipped fabric folds, shorts seams, cuff/armband badge, sock stripes and layered boots. Preserves world size and animation counts/rates; visual neck/shoulder anchors change for adult proportions.
- Polygon rasterization is bounded to each shape and supports masks for clothing folds. Exported the transparent 96x128 idle sprite and enlarged review image in `art-previews/`; gameplay still uses generated textures.
- Generated frame sheets inspected; type check, lint and WSL build verified. Localhost uses rebuilt `dist/client`; user visual playtest pending.

### 2026-10-14: Closer match to the supplied character sprite sheet

- `art/playerArt.ts`: three-quarter face with two eyes, warm skin/jaw shading, swept brown hair, angular jersey, sponsor stripe/chest marks, dark armband, pink home kit and muted away/keeper kits. Existing poses, animation rates and player world size retained.
- `ui/palette.ts`: named character-specific skin, hair and kit ramps; existing scenery/HUD colors retained.
- All 15 home frames inspected in a generated contact sheet, plus representative frames from all four kits. Type check, lint and WSL production build checked; localhost serves the rebuilt `dist/client` for the user's visual playtest.

### 2026-10-14: Reference-inspired character detail pass on `assests`

- `art/playerArt.ts`: 48x64 frames with the existing poses and world size; redesigned hair/face, narrower torso and limbs, shaded skin, collar/crest/folds, kit highlights, sock trim and layered boots. Uses the existing palette and four team/role kits.
- Idle/run/shoot frame counts and rates, movement, projection and controls are unchanged. No animation refinement or gameplay changes.
- Visually inspected generated sprite previews. Type check and lint pass. Production build passes in WSL (Windows dependencies lack the native Rolldown binding); existing bundle-size warning remains. No automated gameplay test; user playtest pending.

### 2026-10-13: Attacking plan for our team, late AI reactions (feints work) (user requests; not playtested)

- User: "make our teammates more attacking, the whole plan should be more aggressive"; "add delay to opponent reaction when we make an action, it is too difficult to fake them"; "attackers go ahead when we have possession and track back otherwise, defenders and the midfielder likewise".
- **Team plans** (`TACTICS` in tuning, `TeamStyle` + `TeamBrain.style`, third constructor argument, default balanced): `pushAttack` / `dropDefend` per formation slot replace `AI.attackPush` / `defendDrop`; `outletForward`, `runAhead` (was `AI.runAhead`), `giveGoChance` / `giveGoFrom` (were in `AI`), `throughMargin` (was `AI.throughMargin`), `passProgress` (was a fixed 0.5), `pressHigh` (skips `pressGapDeep`), `pressGapScale`. MatchScene: home `TACTICS.attacking`, away `TACTICS.balanced` (= the old numbers).
- **Runner:** the forward slot is the runner whenever it is free (else the furthest upfield), at its pushed-up spot or `runAhead` ahead of the ball, whichever is further.
- **Late reading:** `Player.recordSeen` (each fixed step, MatchScene after movement; a ring of `AI.readMaxSec` 0.5 s) and `Player.seenAgo(sec)`; `LEVELS.readSec` 0.35 / 0.25 / 0.15 (`BrainSkill.readSec`) used by `pressPoint`, `carrierIdle` and `wantsTackle` (lunge aimed at where it thinks the ball is). `TACKLE.jukeDeg` 120 -> 90.
- Checks: type check, lint, build and the 14 logic checks pass (the juke check's label now says 90). No gameplay testing (user request).

### 2026-10-13: More stamina, better keepers, situational AI shooting, golden-goal restart (user requests; not playtested)

- **Stamina +30%:** `STAMINA.drainPerSec` 16 -> 12.3.
- **Keepers** (`keeper.keeperStick`): angle-bisector positioning (the bisector of the ball-post-post angle meets the goal line where it splits the mouth in the ratio of the ball's distances to the posts); during a shot it side-steps along its line toward the crossing point at `KEEPER.shuffleStick` 0.5 (was: stood still) until `cpuKeeperReact` dives. Reaction, dive, reach and catch chances unchanged.
- **AI shooting** (`ai.ts` `decideCarry`, new `shotQuality`, `TeamBrain.appetite`): replaces the fixed "closer = better" shoot score (and the one-on-one bonus, `AI.oneOnOneRange / oneOnOneBonus` removed) with chance quality vs the quality the moment asks for (`AI.shotPatience` 0.55 .. `shotHurry` 0.12 by hurry: pressure, a crowd within `crowdDist` 160, someone in the way within `shotWayAhead` 140), x a random appetite per possession (`appetiteMin` 0.7 .. `appetiteMax` 1.3). `AI.shootRange` 560 -> 760. New `shotNearDist` 150, `shotFarDist` 800, `shotBlockedFactor` 0.3, `shotBlockedHurry` 0.5, `shotWeight` 1.1, `shotScoreCap` 1.6.
- **Golden goal** (`MatchFlow`): new phase `break` (frozen, time scale 0, banner GOLDEN GOAL) for `MATCH.goldenBreakSec` 2 (replaces `goldenBannerSec` and `goldenBannerLeft`), then `kickoff` with a reset; the kickoff team alternates; the clock is the fresh `goldenGoalSec` 30 and starts with the kickoff pass.
- Checks: type check, lint, build and the 14 logic checks pass. No gameplay testing (user request).

### 2026-10-13: Less crowding, calmer AI movement, wider camera (user request; not playtested)

- User: "how to make this game more smooth, it feels so overcrowded at times"; then "fix them" for the proposed list.
- **Less drift to the ball:** `AI.shiftX` 0.5 -> 0.35, `shiftY` 0.35 -> 0.2.
- **Our ball stretches the play:** attacking spots 1.6x further out from the middle (`AI.attackWidth`, `TeamBrain.spot`), `supportMinDist` 170 -> 240, `openDist` 100 -> 140, `spaceDist` 90 -> 150 (and it now applies to spot jobs only, not to markers).
- **Looser defending shape:** `zoneCompact` 0.35 -> 0.2; the forward (last `FORMATION` slot) holds an undropped outlet spot when defending (`zoneSpot`).
- **Calm movement:** positioning jobs glide to their spot (`TeamBrain.aims`, `AI.aimEaseRate` 3, `aimSnapDist` 250) and, standing, set off again only once it is `restartDist` 45 px away (`arrive(..., calm)`, `settledSpeed` 15).
- **Camera:** `CAMERA.zoom` 1 -> 0.9, `airZoom` 0.88 -> 0.84.
- Checks: type check, lint, build and the 14 logic checks pass. No gameplay testing (user request).

### 2026-10-13: Presser contains instead of shadowing; idle carriers attacked; counter-attacks; kickoff waits for the pass (user requests; not playtested)

- User: "when our player has the ball the opponent AI follows it like a shadow, which leaves no room to pass to the player behind"; "when play is idle make the opponent attack your player, get the ball and go through on goal"; "unless I click pass the game shouldn't start (neither AI nor time clock)".
- **Presser** (`ai.ts` `pressPoint`, `steer`): its spot is computed when its team thinks (was: every step, mirroring the carrier), no longer follows a retreating carrier back into him, and keeps more distance: `AI.pressGapClose` 40 -> 85, `pressGap` 70 -> 95, plus `pressGapDeep` 170 deep in the carrier's own half (`pressDeepFrom` 1200 / `pressDeepFull` 1700). Causes found: at 40 px the presser stood almost on the ball (the ball sits in front of the carrier), so a pass back was cut out at once (within the 22 px intercept radius) or chipped over it.
- **Pass chips** (`actions.strikePass`): only over an opponent the ball still has to pass (`PASS.chipFromAhead` 30), not one beside or behind the passer.
- **Idle carrier attacked** (`carrierIdle`, `AI.idleSpeed` 40, `idleBreakSpeed` 120, `idleSec` 1.5, `idleGap` 30, `idleTackleBoost` 2, `idleDoubleSec` 2.5): the presser goes to the ball in front of it and tackles more; later a second presser comes from behind. `wantsTackle` takes the idle time; `pickPresser` keeps a `mainPresser` (two pressers no longer swap).
- **Counter-attacks** (`turnoverAt`, `AI.counterSec` 3, `counterSpace` 250, `counterBonus` 0.35): an AI carrier that has just won the ball from the other side dribbles straight at goal when there is space (`dribbleHeading(..., direct)`).
- **Kickoff waits for the pass** (`MatchFlow.awaitingKickoff` / `kickedOff`, `playersFrozen`, banner PASS TO START, GO! after the pass; `MatchScene.resetForKickoff` gives the kicker the ball with `gainBall`; `stepActions` allows only PASS while waiting; `cpuKickoff` after `MATCH.cpuKickoffSec` 0.8). The clock no longer starts the moment the kicker touches the ball.
- Checks: type check, lint, build and the 14 logic checks pass. No gameplay testing (user request).

### 2026-10-13: Easier passing to your own players (user request; not playtested, the user tests)

- User: "make passing more easy to own teammates, AI can easily intercept it or it does not even reach the intended player".
- **Receive assist** (`MatchScene.humanSteer` / `startReceiveAssist`, `PASS.receiveAssist`, `assistTakeoverDeg` 40): the cause of "it doesn't reach him": control moves to the receiver at release while the stick is still pushed the way you passed, so he ran away from the ball. Now he comes to meet it (`interceptPoint`, sprinting when contested) until a new stick input. Also for keeper throws (yours and auto-distributed ones).
- **Quicker passes:** `PASS.arriveSpeed` 170 -> 230, `maxSpeed` 950 -> 1100 (less time to cut them out).
- **Straighter passes:** `PASS.errorDeg` 3 -> 1.5, `pressureErrorDeg` 8 -> 4; `LEVELS.passErrorScale` doubled (2.6 / 2 / 1.4) so CPU passes stay as accurate as before.
- **Harder to intercept:** `POSSESSION.interceptRadius` 22 (was the 34 control radius) for opponents while a pass is faster than `interceptFullBelow` 200 px/s; the receiver's first-touch bonus 10 -> 22 px (`possession.ts`).
- **The other side reacts late to a pass:** `LEVELS.passReactSec` 0.45 / 0.32 / 0.22 (`TeamBrain.delay`, `MatchScene.passReaction` after every pass and throw, both teams); a CPU player who wins the ball is woken at once (`onGained`).
- **No hopeless lunges:** `chaseOrder` sends a chaser goal-side of the opponent's intended receiver when that receiver gets to the ball 0.2 s+ sooner, anywhere on the pitch (was: only in its own half).
- Pass target choice is unchanged (nearest teammate in the stick direction, an earlier user decision).
- Checks: type check, lint, build and the 14 logic checks pass. No gameplay testing (user request).

### 2026-10-13: AI overhaul from two reference repos (user request; not playtested, the user tests)

- User: "our game seems so robotic, every AI player marks our respective player, which makes the game unplayable"; asked to implement ideas 1-9 from reading HTANV/Soccer-Unity and tshrjn/openFIFA (no code copied; see Decisions).
- **Zonal defence** (`ai.ts` `assignDefence` / `zoneSpot` / `markPoint`): replaces "everyone marks the most dangerous opponents". At most 2 markers (`AI.maxMarkers`), only for opponents within 900 px of our goal line (`markZone`, +120 to keep one), never everyone; markers keep their man; mark gap 50 + 0.12 x the man's distance from the ball (max 170); everyone else holds a zone pulled 35% toward the ball-to-goal line.
- **1. Chasing:** `chaseOrder`: jogs when clearly first (0.5 s), goal-side spot when an opponent is 0.2 s quicker in our half; `arrive` gained a relaxed (never sprint) mode.
- **2. Shooting:** `shotTarget` (most open of 5 spots by angle to keeper / defenders), through-on-goal bonus, `chipShot` (chips a keeper 110+ px off its line, charge picked with the simulated flight `actions.chipFlight`); the shoot `CarryAction` has `chip`, MatchScene swipes up for it.
- **3. Dribbling:** pressure by closing time (`pressureOn`, replaces `AI.pressureNear`; opponents in a tackle ignored), upfield-then-cut-in heading (`dribbleHeading`), avoidance turn round several defenders (`avoidTurn`, replaces `AI.dribbleDodge`), direction eased per think (`carryDir`).
- **4. Attacking movement:** give-and-go (`passAndRun`, after AI and human passes), show for the ball (`showSpot`, role 'show'), through balls (pass `CarryAction` `through`, `actions.kickThroughPass` / `throughSpot` / `passTravelTime`; `kickPass` now shares `strikePass` with it, same behaviour).
- **5. Rest defence:** role 'rest' (`restPoint`): the deepest player stays goal-side of their most advanced one while attacking.
- **6. Switching:** `TeamBrain.switchTarget()` first, then soonest to the ball by `interceptPoint` (was: nearest).
- **7. Difficulty:** `LEVELS.posError` 70 / 30 / 12 px (per-player spot error renewed every ~3 s, `refreshErrors` / `withError`), `LEVELS.keeperDiveError` 30 / 12 / 5 px (`cpuKeeperReact` takes it).
- **8. Keeper catches by chance:** `KEEPER.parryAbove` replaced by `catchSureBelow` 420 / `catchNoneAbove` 900 / `diveCatchFactor` 0.75.
- **9. Front-only AI tackles:** `wantsTackle` returns null from behind (`AI.tackleBehindFactor` removed).
- Checks: type check, lint, build and the 14 existing logic checks pass. No gameplay testing (user request).

### 2026-10-13: Phase 3 step 6 - code audit for the regression checks (no automated gameplay testing, user request)

- Reviewed the Phase 3 code against the plan's regression list (kickoff / reset, control ownership, switching, tackles, keepers, restarts, per-step cost). Fixes:
  - **Keeper reaction carried over between threats:** a keeper setting itself to smother a carrier in its box kept the same countdown when the carrier shot, so close-range shots got a shortened reaction. The timer now restarts when the threat changes kind (`Player.reactSmother`).
  - **Queued AI actions survived a kickoff:** a CPU pass / shot queued before a goal could fire instantly if the same player got the ball at the restart (no first touch). `TeamBrain.reset()` at every kickoff clears orders, queued tackles and actions.
  - **AI decided for a ball the human controls:** with our keeper under the human's control and the ball at its feet, the home brain still queued (discarded) decisions and a stale carry order. It now skips any `controlled` owner.
  - **Chasing a ball that is out:** during the 0.9 s before a goal kick, players and keepers ran after the ball behind the goal. No chaser and no keeper claim while `ball.out`.
  - Per-step player-list copies removed (`MatchScene.outfield`).
- Added the `SIM` frame-cost line to the debug overlay (tap the FPS readout) for the phone playtest.
- Added `checks/logic-check.ts` + `npm run test:logic` (14 checks, all pass; the keeper check fails without the fix).
- Checks: type check, lint, build, test:logic all pass. No browser / gameplay runs.

### 2026-10-13: Status file refreshed for the hand-off

- Removed stale Phase 2 statements (teammates never running by themselves, no AI / tackles, the aim assist, the separate aim arrow, the away kickoff with no away team, the old "no commits" git note) and rewrote the fixed-step order for Phase 3. Added the fast-forward testing technique and the batch tests used in Phase 3 to "How to run and verify", and a hand-off note at the top of "Next up". No code changes.

### 2026-10-13: Phase 3 step 5 - goalkeepers and difficulty

- `keeper.ts` reworked (shared by both keepers): `keeperStick` (positioning moved from `MatchScene.keeperPositionStick`, plus claiming and rushing out), `cpuKeeperReact(k, ball, time, reactSec, rand)` (shot dives with a per-level reaction and +-0.04 s jitter, plus smother dives), `stepKeeperHands` (was `stepDummyKeeper`; adds the smother and the throw-or-punt distribution). New `KeeperEvent`s 'smothered' and 'punted'. `KEEPER.reactSec` moved to `LEVELS.keeperReactSec`.
- New `LEVELS` table (easy / normal / hard): think rate, tackle chance, shot charge noise, decision noise, pass error scale, shot aim spread, marking distance scale, keeper reaction. `AI.thinkSec`, `tackleChance`, `shotChargeNoise`, `decisionNoise` and the mate* values were folded into it; `BrainSkill` is a row. `kickPass` takes an `errorScale`.
- Fairness: `STAMINA.trailingRegen` 1.15 (`stepPlayer(..., regenScale)`). Result screen: TACKLES now counts tackles won by the human's player (was always 0).
- AI fixes found while testing: pressure ignores staggered / downed opponents (after winning a tackle the AI always panicked into a pass because the player it had just tackled counted as pressure); AI shots get a placement spread (every AI shot was a perfect corner: our keeper saved 0 of 5-6 a match). Easy pass error 1.6 -> 1.3.
- Keeper reaction tuned with shot tables (results in Current state). At first normal 0.35 s sat exactly on the edge for a corner from 450 px (the same shot was saved or scored depending on one 1/60 s step), so 0.5 / 0.4 / 0.32 s plus a random +-0.04 s.
- Verified (preview): shot tables per level; claims 8/8; 1v1 table; distribution throws to the open midfielder; AI-vs-AI matches (our side driven by the home brain through the controls): easy 0-1 (CPU 12 shots, our keeper 8 saves), normal 0-1 (CPU 18 shots, 9 saves), hard 0-4 (CPU 10 shots). No errors, nothing stuck.

### 2026-10-13: Phase 3 step 4 - AI carriers and tackles

- New `systems/tackle.ts` (phases, lunge, contact, chance with modifiers, juke, stagger / stumble / first-touch priority) and `TACKLE` tuning. Player fields: `tackleAt`, `tackleUntil`, `tackleDir`, `tackleSprint`, `tackleDone`, `stumbling`, `jukeRef`, `staggerUntil`, `tackleReadyAt`, `wantDir`. Ball: `priority` / `priorityUntil` (possession skips everyone else meanwhile).
- `ai.ts`: carriers score shoot / pass / dribble / clear (`decideCarry`); passes and shots are handed to `MatchScene.stepAiCarriers` (`takeAction`); the presser decides tackles (`wantsTackle`, `tackles` queue). `BrainSkill` per team (think rate, tackle chance, shot charge noise). `TeamView` gains `oppKeeper`, `canTackle`, `rand`.
- `MatchScene`: lunges move bodies, start-up / recovery / stumble / stagger stop the player; tackles resolve before the ball moves; B1 = TACKLE for the human. The away stand-in (`stepAwayCarrier`, `AWAY_CLEAR_SEC`) is gone.
- `possession.ts`: a pass in flight can't be taken by the passer's other teammates; a deflection clears receivers.
- Tuning found by testing: won-tackle pop (see Current state); `AI.pressureNear` 90 -> 60 (at 90 every human tackle met an AI pass: 39 of 40); shoot vs pass scores rebalanced (the AI shot 0-3 times a match while passing 50 times; now 4 / 6 shots on normal / hard).
- Verified (fast-forwarded matches in the preview, idle human): no errors, nothing stuck. Normal: 33 passes, 4 shots, 52 tackles (22 won), 0-3. Hard: 48 passes, 6 shots, 62 tackles, 0-3. Easy: 12 passes, 0 shots. Human tackling an AI carrier (40 runs, varied angles): 19 won (all ended with the tackler on the ball), 11 failed, 9 times the AI passed first. Human dribbling straight at the press: tackled in 0.4-3.6 s; reversing the stick as a tackle starts (juke) beat every tackle.

### 2026-10-13: Phase 3 steps 2-3 - AI hand-over and shared outfield AI

- New `systems/ai.ts`: `TeamBrain` (think = role assignment at a team-level cadence; steer = per-step stick + sprint toward the role target), `interceptPoint`, roles chase / press / mark / cover / support / run / carry. New `AI` tuning block. `MatchScene`: `teamView()`, both brains think then steer every live step; `outfieldStick` removed; `setControlled` wakes the brains; ?debug role labels.
- The Phase 2 rule 'nobody runs toward the ball by themselves' is replaced by the AI (the user asked for AI teammates in Phase 3).
- Tuning after testing: `pressGap` 40 -> 70 and `pressLeadSec` 0.4 (the presser was standing on the carrier, blocking the dribble; now it jockeys at about 73 px, backing off).
- Verified (scripted, preview): at most one chaser per team at any time; our AI midfielder won a loose ball and control moved to him, with the old human player becoming the runner; with the away team on the ball our human counted as presser and the AI teammates marked; the away clearance was won by our chaser; our kickoff ball was kept. Whole sim step with AI: 0.056 ms.

### 2026-10-13: Phase 3 step 1 - away team on the pitch (5v5)

- Plan chosen: v3 plus parts of v2 (see Current state). `MatchScene.away`: 4 CPU outfielders mirrored from `FORMATION.outfield`. They're in `everyone`, possession, separation, constraints and `clearReceivers`. `opponentsOf` covers both whole teams; the away keeper throws to them.
- Kickoff: the conceding side kicks off with its forward next to the ball; the other side's forward waits outside the centre circle (`FORMATION.defendKickoffX`).
- `outfieldStick(p)` is the AI hook for non-human outfielders (NO_MOVE for now). `stepAwayCarrier` is a stand-in that clears the ball for an away carrier (chipped `kickShot` toward our goal after 0.7 s) until AI carriers and tackles exist.
- Verified (scripted, preview): 10 players at kickoff and after home and away goals, both kickoffs correct, the away kickoff lofted over our forward and play continued; the away goal kick was thrown to an away outfielder, who cleared.

### 2026-10-13: Pointer stretches into the charge arrow; weighted passes (user request)

- **One arrow, not two:** the separate aim arrow drawn from the ball while charging is gone (`updateAimArrow`/`drawGroundArrow`/`aimArrow` removed; the label part is now `updateShotText`). Instead the ring's own pointer stretches: while SHOOT / KICK / a weighted PASS charges, its head slides outward along the strike direction (up to `POINTER_STRETCH` 190 world px, ease-in `POINTER_EASE` 1.6 so it speeds up as the charge builds) with a tapering shaft behind it, in the charge colours. The pointer now always sits just outside the gauge (`POINTER_GAP` 19), so nothing jumps when charging starts. `SHOOT.aimArrow` false keeps the pointer short.
- **Weighted pass:** PASS is now press-and-release. A tap (<= `PASS.weightTapSec` 0.12 s) is exactly the old pass (pace fitted to the distance). Held, the charge fills from the tap time to `weightChargeSec` 0.9 s (`actions.passWeight`) and picks how far the ball rolls before slowing to `arriveSpeed`: `weightMinDist` 100 to `weightMaxDist` 1300 as charge^`weightCurve` 1.5 (finer control of short passes; a 340 px pass is weighed right at about 0.33 s), struck at up to `weightMaxSpeed` 1150. Target choice (on release), lead, aim error, chip-over-a-blocked-lane, wind-up and control-to-receiver are unchanged (`kickPass(..., weight)`; `actions.idealPassWeight`). While charging, the ring gauge fills, the segments that would weigh it right glow green, and the pointer/gauge are white (under-hit), green (within `weightGoodBand` 0.09) or red (over-hit), pointing at the target. PASS and SHOOT charges exclude each other. Keeper throws are not weighted.
- Verified in the preview (340 px pass back): tap = old pass, received; 0.2 s hold = under-hit, stopped about 70 px short; 0.3-0.38 s = green, received; 0.5-0.75 s = red, struck at 760-1090 px/s. **Note:** an over-hit pass is still trapped, because the receiver keeps its guaranteed first touch (unchanged on purpose: "do not mess with fundamental passing logic"). Over-hitting only matters once heavy passes can bounce off, which would be a later decision.

### 2026-10-13: After a shot, control follows the player closest to the ball (user fix request)

- Replaced the one-off switch 0.35 s after a shot (to the nearest teammate other than the shooter, which could pick someone who was not actually the closest) with continuous following: `followShotUntil` (sim time), checked at the top of `stepActions`. Each step the closest outfielder to the loose ball takes control if it is 30 px closer than the current one (`SHOOT.followShotMargin`; always from the keeper). Ends on possession, a dead ball (after a last pick), a manual SWITCH (`switchPlayer` clears it), kickoff reset, or `SHOOT.followShotMaxSec` 4. `SHOOT.afterShotSwitchSec` removed.
- Verified with a scripted shot through the team: control went shooter -> the teammate the ball passed (when 250 vs 198 px) -> the player near the landing spot, who then gained the ball.

### 2026-10-13: Player sprites reworked from a style reference (user request)

- The user supplied an 8-bit-football style sheet (big bearded head, side-on, idle x3, run x8, shoot wind-up/contact/follow-through/recovery). It is another artist's work showing a recognisable footballer, so the sprites are **original art in that style**, not traced: generic face, our kits.
- `art/playerArt.ts` rewritten: frames are **posed skeletons** (hip, neck, knees, ankles, toes, shoulders, elbows, hands) rasterised into a 24x32 char grid (`Grid`: pixel capsules, back limbs in shade colours, near limbs with a darker rim where they cross the body, the back of the shirt shaded, one silhouette outline), then painted with the kit palette. The run is a procedural 8-frame gait (`runLeg` / `runArm`: thigh +-40 deg, knee folds on the forward swing, arms opposite); idle and shot poses are explicit joint lists. Each pose is grounded so its lowest boot touches row 29; a soft alpha shadow sits under the feet. Kits gained shade colours (`shirtShade`, `shortsShade`, `sockShade`).
- Sprites are drawn at `PLAYER_PX` 2.75 world px per art pixel (finer than PX 4) so a 32-row frame is 88 world px tall, a bit under the crossbar; `PLAYER_HEIGHT` and `PLAYER_ORIGIN_Y` (30/32, the boot line) replace `PLAYER_H * PX` / origin 1 in `Player` and the shot label.
- Anims: idle (idle1, 2, 3, 2 at 4 fps), run (8 frames at `RUN_FPS` 16, scaled by speed / 220), shoot (4 frames at 14 fps, once).
- Iterations, found by reading frames back from the texture and by in-game close-ups (camera zoom 3): per-limb outlines blacked out the narrow torso (now one silhouette outline + rims); the head had a double outline and read as long hair (now fill-only, short hair, bigger face); idle arms sat over the chest (moved to the sides); the shirt shading covered half the shirt (narrowed).

### 2026-10-12: New player sprites (user-supplied art)

- `art/playerArt.ts` replaced with the user's 18x26 sprites (was 10x16): 8 frames per kit (`idle1`, `idle2`, `run1`, `run2`, `shoot_windup`, `shoot_contact`, `shoot_follow`, `shoot_recover`). Kits gained socks, an accent (armband) colour and white boots. New anims `idleAnim` (2 frames, 3 fps loop), `runAnim` (run1, idle1, run2, idle1 at 10 fps), `shootAnim` (4 frames at 12 fps, once). Added `IDLE_FRAME`.
- Fixes needed to integrate it: the old `'idle'` frame no longer exists (`Player` now starts on `IDLE_FRAME` and loops the idle anim when standing); `FRAME_MAPS[frame] ?? []` for the strict index check; the unused palette key `o` dropped. All rows verified 18 wide and 26 tall.
- `Player.playShoot()` plays the strike once (a `shooting` flag holds off run/idle until `ANIMATION_COMPLETE`); called on shots and on keeper kicks.
- Players are now 26 art px tall (104 world px, was 64), so they look about 1.6x bigger. The overhead arrow and stamina bar follow `PLAYER_H`; the shot label was at a fixed height of 70 (inside the taller sprite) and now sits at `PLAYER_H * PX + 48`.

### 2026-10-12: FIFA-style ring with pointer and gauge; control moves after a shot (user request, reference screenshot)

- The full-length facing arrow was replaced by a ground ring with a short pointer (like the reference): `MatchScene.updateGroundMarker`, `marker` Graphics, `RING_RADIUS` 44. While SHOOT / KICK charges a segmented gauge (`GAUGE_SEGMENTS` 24) fills round the ring in the aim arrow's colours and the pointer follows the strike direction; helpers `currentCharge()`, `strikeDirection()`, `chargeColor()` are shared with the aim arrow. `FACING_ARROW_*` constants removed. (An earlier 26 px ring sat under the player's sprite and was invisible.)
- **After a shot control moves** to the teammate nearest the ball (shooter excluded): `pendingShotSwitch`, `SHOOT.afterShotSwitchSec` 0.35, `nearestOutfielder(x, y, except?)`. Verified: shooter at x 1176, ball 1753 after 0.7 s, control passed to the player at x 840 (nearest to the ball).
- Testing note: the preview's emulated 1280x720 viewport screenshots the game as a tiny corner; zoom with `scene.cameras.main.setZoom(3).centerOn(...)` to inspect small markers.

### 2026-10-12: Facing arrow replaces the ring under the player (user request)

- Removed the yellow ring under the controlled player (`Player.ring`, `MARKER_RING`). In its place `MatchScene.updateAimArrow` draws a persistent white arrow on the ground along the player's `heading`; the existing arrow drawing was extracted into `drawGroundArrow()` (also used by the charging aim arrow). Hidden while SHOOT / KICK is pressed with the ball (the charging arrow, with its white / green / red logic, shows instead) and back on release. Not drawn at full time.
- The pass-target ring (blue) and the overhead yellow arrow are unchanged.

### 2026-10-12: Analog swipes, shot label, CPU keeper dives (user feedback: shots lacked control, too easy to score, swipes not working properly)

- Checked with real pointer events (portrait, rotated layout): swipes registered correctly. The problems were the design: all-or-nothing types, a thumb hiding the feedback, and a keeper that never dived.
- **Analog swipe:** `Controls.swipe` is now a vector `SwipeVec` (each axis -1..1, from the press point; `SHOOT.swipeDeadPx` 10, `swipeFullPx` 70). `actions.shotShape()` turns it into chip / power / curl amounts that scale each effect and mix. `kickShot(..., swipe)` blends the driven strike toward a lob by `chip`. `SHOT_FOR_SWIPE` / `ShotType` were removed. The keeper KICK uses the same amounts (punt / drive / curl, no launch offset any more; `KEEPER.curlKickDeg` removed).
- **Shot label above the shooter** while charging (`MatchScene.shotText`, `actions.shotLabel`). The ActionButtons arrows grow with the amount.
- **CPU keeper reaction dive** `keeper.cpuKeeperReact` + `Player.reactAt`; `KEEPER.reactSec` 0.35, `reactMinSpeed`, `reactHorizonSec`, `reactMargin`; new `standReachHeight` 96 (diving keeps 120); `maxOut` 100 -> 60. Tuned by scripted batches (results under Stand-in keepers): 0.25 s reaction and 100 px out saved almost everything.
- Testing note: when batch-testing shots, clear `controls.move` right after the shot and stop the trial at the keeper's first touch; otherwise the scripted shooter dribbles parried rebounds into the net and they count as goals.

### 2026-10-12: Skill-based shooting, no assist (user request; same 4-swipe layout)

- `kickShot` rewritten: the ball leaves exactly along the stick (or facing). Removed `shotTargetY` (goal snapping), `launchForCurl`/`simulateCrossing`/`curlSpin` (auto-curl onto a target), the chip's auto-ranging `kickChip`, the automatic 6° curve on normal shots, random lift variance and distance-based error.
- Accuracy is now timing: green band (`SHOOT.perfectBand` below `sweetSpot`) = perfect strike (0.5° max), otherwise 2°, over-hit +5°; body factors (sprint 3°, across 5°, pressure 3°). Type scales: chip 0.7, curl 0.8, power 1.4.
- CHIP: charge sets pace (450-900) and lift (450-750); CURL: fixed `curlSpin` 1.1 rad/s; POWER unchanged (dip).
- New exported `shotDirection()` and `isPerfectCharge()`; `MatchScene.updateAimArrow()` draws the strike-direction arrow while charging (also for keeper KICK, white). The ActionButtons green band uses `SHOOT.perfectBand`.
- SHOOT keys removed: `assistRange`, `awayFromGoalDeg`, `farSideAim`, `postInset`, `curveDeg`, `baseErrorDeg`, `powerErrorDeg`, `distanceErrorDeg`, `liftVariance`, `chipMin/MaxFlightSec`, `chipLandBehind`, `chipRangeError`, `chipOverHitRange`, `curlDeg`, `curlMaxSpin`.

### 2026-10-12: Better shooting, more stamina, keeper KICK swipes (user request)

- **Shot aim rework:** in range (1100 px) every shot goes at the goal and the stick picks the spot (`actions.shotTargetY`); it used to follow the facing unless the stick was within 25° of the goal, so shots while running across went sideways. `SHOOT.aimAssistDeg` replaced by `assistRange`, `awayFromGoalDeg`, `farSideAim`.
- **POWER dips:** new `Ball.dip` (extra gravity until first landing, reset wherever spin is reset and on landing), power lift 1.1 -> 1.3x, error 1.5 -> 1.4x.
- **Ball trail** (`Ball.renderTrail`) above 650 px/s, so curl, dip and loft are visible.
- **Swipe threshold** 24 -> 18 px.
- **Keepers off their line** (`MatchScene.keeperPositionStick` replaces `returnToSpot`): `KEEPER.lineOut/maxOut/outFarDist/outNearDist`. This also applies to our keeper when we don't control it (it moves along with the ball in front of its goal; it doesn't chase the ball).
- **Keeper KICK swipes:** PUNT / DRIVE / CURL (`KEEPER.punt*`, `drive*`, `curlKick*`); the ActionButtons hints show on KICK with those names.
- **Stamina:** drain 35 -> 16/s (about 6 s of sprint), regen 20 -> 30/s, delay 0.8 -> 0.4 s, unlock 30 -> 20.

### 2026-10-12: Swipe map changed (user request: up chip, down power, left/right curl)

- `SHOT_FOR_SWIPE`: up `chip`, down `power`, left `curlLeft`, right `curlRight`. LOW and the far-post-only FINESSE removed; `ShotType` is 'normal' | 'chip' | 'power' | 'curlLeft' | 'curlRight'.
- Curl direction comes from the swipe (positive spin = bends to the shooter's right); a neutral stick aims at the corner on the bend side. SHOOT `finesse*`/`low*` replaced by `curl*` (curlDeg 22 -> 26, max spin 1.4 -> 1.6) and `powerOverHit` 1.3.
- Button labels: CHIP up, POWER down, CURL left and right.

### 2026-10-12: Swipe shots on the SHOOT button (user request: PES-mobile style)

- `Controls.swipe` ('none' | 'up' | 'down' | 'left' | 'right'), reset on each SHOOT press; `setSwipe()`. Keyboard T / G / F / H press SHOOT with a swipe.
- `ActionButtons`: tracks the SHOOT pointer's slide from its press point (`POINTER_MOVE`, also checked on release for quick flicks); arrows and labels around the button; the chosen type's name replaces SHOOT while held.
- `actions.kickShot(..., type)` with `ShotType` 'normal' | 'chip' | 'low' | 'finesse' | 'power' and `SHOT_FOR_SWIPE`; new `kickChip()`, `curlSpin()` and `launchForCurl()`/`simulateCrossing()` (a 2D copy of the stepFreeBall rules, secant steps on the miss). The first version used a closed-form launch offset that bent too little (a curl aimed at the far post finished at the keeper).
- Side labels (CURL, POWER) sit above their arrows; beside them POWER ran off the 1280 px edge.
- Verified (preview, random error off): curls from (1700,400), (1700,900) and (1800,1000) crossed exactly at the far post (y 756 / 544) and scored; chips dropped into the net about 5 high at the line, and over-hit chips went over; low shots stayed at height 0; power shots left at 1100-1525 px/s, and a full-charge one went over the bar. New `SHOOT.*` swipe numbers; `BALL.spinMinSpeed` 500 -> 300.
- `MatchScene.stepActions` passes `SHOT_FOR_SWIPE[controls.swipe]`. Keeper KICK ignores swipes.

### 2026-10-12: No automatic runs; markings always visible (user feedback)

- **Removed the receiver auto-run** (`MatchScene.interceptMove` deleted). Only the controlled player moves, by the stick. Audit of other automatic movement:
  - uncontrolled keepers still walk back to their goal-line spot (`returnToSpot`); that's not toward the ball;
  - keepers only turn to face the ball (no movement);
  - body collision pushes are physics, not runs;
  - nothing else moves players on its own.
- **Pitch markings flickered:** they were 1 art pixel (4 world px) in the ground texture, under 2 screen px far from the camera, and nearest sampling dropped them as the camera moved. They are now drawn by the new `render/PitchLines.ts` as projected Graphics lines each frame (width = 4 world px x perspective scale, clamped 2-6 px; long lines split into 80 px segments so the width follows the perspective). `pitchArt.paintChalk` was removed; the basketball/parking lines stay painted.
- Verified in a local preview: after a pass (received, control moved) and after a dead pass, every outfielder moved 0 px on its own; mid-pan screenshot shows all markings solid.

### 2026-10-12: Keeper can leave the box (user request)

- New `Player.holding` (ball in the keeper's hands). `keeper.inOwnBox()` was added. `keepInBox()` now applies only while holding; otherwise keepers use `constrainMove` like outfielders.
- `stepDummyKeeper` catches and parries only when the keeper is inside its own box, sets/clears `holding`, and ignores feet possession.
- `stepPossession` now gets the keepers too: it skips a keeper inside its box (hands rules) and treats one outside like an outfielder; a keeper owner is "held" only while `holding`.
- `MatchScene`:
  - routes a keeper with the ball at its feet to the outfield actions (PASS/SHOOT);
  - labels: THROW/KICK in hands, DIVE/SWITCH without the ball, PASS/SHOOT at its feet;
  - throw/kick and the restart set or clear `holding`.
- Verified in a local preview:
  - the keeper runs out to x 539 (box edge 300);
  - outside, a slow ball is taken at the feet (z 0, PASS/SHOOT), dribbled and passed (control to the receiver);
  - inside, a ball is caught in the hands (THROW/KICK);
  - holding, it stops at x 286 on the box edge;
  - switched away while stranded at (700, 500), it runs back toward its spot.

### 2026-10-12: Pass target, dead passes, keeper switching and controls (user feedback)

1. **Pass target = the nearest teammate in the stick direction.** `choosePassTarget(passer, teammates, move)` (the opponents parameter was dropped) uses widening cones (`PASS.coneStepsDeg`). The weighted angle/closeness/space scoring and its PASS fields were removed.
2. **No auto-run after a pass dies:** `MatchScene.step` clears receivers once the loose ball is slower than `PASS.receiverStopBelow`.
3. **Keeper switching:**
   - holding SWITCH for `INPUT.keeperHoldSec` jumps to the keeper (`switchHoldArmed`, armed by a SWITCH press);
   - a threat (ball toward our goal faster than `INPUT.keeperThreatSpeed`, in our third) puts the keeper first in the cycle.
4. **Keeper controls:**
   - smart dive with the stick centred (`diveTarget`, toward the predicted crossing on the keeper's line); `startDive(..., distance)` shortens the dive so it doesn't overshoot;
   - KICK is held to charge (`KEEPER.kickMinSpeed`/`kickMinLift` up to `kickSpeed`/`kickLift`); the charge ring's `sweetSpot` flag gives plain colours for kicks;
   - keepers face the ball when standing.

- Verified in a local preview:
  - stick right picks the nearest teammate that way (not a farther one dead ahead); stick up picks the one above;
  - a dying pass: the receiver stops (speed 0, no longer receiving);
  - a tap SWITCH in midfield goes to an outfielder; a hold goes to the keeper; under threat a tap goes to the keeper;
  - smart dives at about 20/90/150 px offsets were all caught without overshooting;
  - kick tap 528 px/s (lift 145), full 869 px/s (lift 350).
- **Note:** `npm run prettier -- <file>` formats the WHOLE repo (the script is `prettier --write .`). This happened once here, so all source files and the Markdown tables are now Prettier-formatted (formatting only; build verified).

### 2026-10-12: Keeper control via SWITCH, and DIVE (user request)

- SWITCH candidates now include the home keeper (sorted by distance to the ball, as before).
- While the human controls the keeper without the ball, it stays controlled (previously control bounced straight back to an outfielder). B1 = DIVE (`keeper.startDive`), B2 = SWITCH. Labels are DIVE/SWITCH, and THROW/KICK with the ball.
- New KEEPER `diveSpeed`, `diveSec`, `diveRecoverSec`, `diveReach`.
- `keeper.stepKeeperBody()` moves the keeper through a dive and holds it during recovery. `stepDummyKeeper` uses `diveReach` while diving.
- New Player fields `diveUntil`/`recoverUntil`/`diveDir`/`lying`; a lying keeper's sprite is rotated about 80°.
- The keeper sprints with the stick like outfielders.
- Verified in a local preview:
  - SWITCH with the ball loose near our goal -> keeper, with DIVE/SWITCH labels;
  - the keeper walks and stops at the box edge (y 364);
  - a dive from (40, 650) caught a far-corner ball at y 482, with THROW/KICK labels after;
  - KICK -> control to an outfielder; SWITCH -> keeper -> SWITCH -> outfielder.

### 2026-10-12: Stronger shots shaped by the run (user feedback: shots too weak; FIFA-like momentum)

- SHOOT: `tapSpeed` 600 -> 900, `fullSpeed` 850 -> 1250, `tapLift` 140 -> 120, `fullLift` 520 -> 420. Air drag is unchanged, so range stays bounded: a full shot travels about 1360 px, and about 1600 px off a sprint. A full shot covers 450 px in about 0.43 s (was 0.67 s), simulated.
- New SHOOT `runCarry` 0.5, `runLift` 0.35, `acrossPowerLoss` 0.3, `acrossErrorDeg` 6, used in `kickShot` from the shooter's heading and speed relative to the aim.
- POSSESSION `maxControlSpeed` 750 -> 1000, so faster shots at a teammate can still be controlled.
- Verified by stepping the real sim:
  - launch at 70% charge: standing 1145 px/s (lift 311); jogging toward goal 1255 (432); sprinting toward goal 1310 (429); running across 973; running away 692;
  - from 450 px at the corner: standing 61% goals; sprinting 53% (16/80 wide); running across 49%.

### 2026-10-12: Realistic shooting: misses, posts, over the bar (user feedback: every on-target shot went in)

- `actions.kickShot(ball, shooter, move, charge, opponents, rand)`:
  - random sideways error from base, power, distance, sprint and pressure (new `SHOOT.*ErrorDeg`), with a triangular spread;
  - lift variance (`liftVariance`) and an over-hit past `sweetSpot` adding up to `overHitLift`.
- `ballPhysics.collideBall`: crossbar bounce; a ball over the bar or over an end wall sets `ball.out` / `contact.out` (new `Ball.out` field) and is no longer collided.
- `MatchScene`: on `contact.out`, `flow.flash('OVER THE BAR' | 'OUT')`, and after `SHOOT.outRestartSec` `restartWithKeeper()` gives the defending keeper the ball on its spot (ours becomes human-controlled). Possession is skipped while the ball is out.
- `MatchFlow.flash(text, sec)`: a short banner during live play.
- `ActionButtons`: the charge ring is white, then green in the sweet spot, then red when over-hitting.
- Verified by stepping the real simulation (80 shots per case, with the stand-in keeper):
  - 250 px corner tap 100% goals; sweet spot 98%; over-hit 0% (over the bar 71, crossbar 7);
  - 450 px corner sweet spot 61% (wide 9, post 5, keeper 10); over-hit 0%; at the keeper 21%;
  - 750 px corner 54% (wide 12, keeper 17).
  - In live play: an over-hit showed OVER THE BAR at a height of 161, then the CPU keeper restarted from its spot.
- **Testing note:** when stepping `m.step()` by hand with the scene paused, set `m.controls.move` directly. `controls.sample()` only runs in the render update, so `touchStick` alone is ignored, which made shots go straight and skewed the first batches. Also reset `flow.clock` per trial so long batches don't hit full time.

### 2026-10-12: Smooth camera, no pixel stepping (user feedback)

- **Root cause 1 (everything "chunky"):** `pixelArt: true` forced `roundPixels`, so every sprite and every projected ground vertex was rounded to whole pixels on its own each frame, and moving objects stepped against the background. `main.ts` now uses `antialias: false` (still crisp) with `roundPixels: false`.
- **Root cause 2 (camera in steps):** `CameraRig` had a hard 60 px dead zone (stand still, then lurch) and a look-ahead taken straight from the ball's instant velocity, which flickers during dribble taps and turns. It is now a critically damped smooth-damp follow (`CAMERA.followSec`) with a filtered look-ahead (`CAMERA.lookAheadSmoothSec`); `CAMERA.lerp` and `CAMERA.deadZone` were removed.
- The stamina bar position and the joystick parts are no longer snapped to the 4 px grid (they moved in visible 4 px steps).
- Verified in a local preview: `cameras.main.roundPixels` is false; the art stays crisp; over 299 frames of zig-zag/sprint/reversal dribbling there were 0 camera stop-starts, and the camera's speed changed by about 5 px/s per frame (median), 34 at most.

### 2026-10-12: FIFA-style movement and dribble rework (user feedback: "rigid and chunky")

- `movement.stepPlayer`: momentum locomotion.
  - New PLAYER `accel`/`accelWithBall`/`decel`, speed-dependent turning (`turnRateSlow`/`turnRateFast`, `turnWithBallFactor`), a pivot when slow (`pivotBelowSpeed`/`pivotRate`), and an ease-off on large heading error (`slowTurnFromDeg`/`stopTurnAtDeg`).
  - Removed `instantTurnAbove`, `turnRate`, `snapTurnBelowSpeed`, `turnRateWithBall` and `turnRateSprintWithBall`.
- `possession.dribble`: close control replaces the spring.
  - The ball sits at `dribbleAngle`/`dribbleDist` around the carrier (new Player fields, replacing `touchLead`). The angle follows the facing at `DRIBBLE.swingRate`; the distance eases (`settleRate`) to `closeLead`/`walkLead`/`sprintLead` plus smooth taps (`walkTouch`/`sprintTouch`).
  - `gainBall` cushions the first touch (`cushionPerSpeed`/`cushionMax`). The DRIBBLE spring fields were removed.
- `geometry.rotateTowards` is now shared (moved out of movement.ts).
- Verified in a local preview (sampled every sim step via `?debug`):
  - accel 0 -> 192 px/s in about 0.2 s;
  - jogging lead 29-31 px with at most 0.44 px of change per step;
  - 180° turn: the ball stays ≥ 26 px from the feet, speed dips to 44 then recovers, possession kept;
  - sprint lead 47-53 px;
  - a pass reception cushions (ball distance 43 -> 20 eases over about 0.35 s).

### 2026-10-12: Phase 2 feedback: ball feel, smooth dribble, keeper control, collisions

User feedback, items 1-7:

1. **Rebounds too strong:** wall/fence/post bounce 0.8 -> 0.5; fast ball off a player keeps 0.2 (was 0.35); keeper parry 0.25 (was 0.35).
2. **Shots crossed the whole court:**
   - ground drag 0.55 -> 0.35/s, plus new `BALL.rollFriction` 40 px/s²;
   - air drag 0.92 -> 0.5/s; bounce 0.55 -> 0.4; full shot 950 -> 850, tap 650 -> 600;
   - pass strike speed is now solved from the physics (`passSpeed()`, bisection on the closed-form roll distance) to arrive at about 170 px/s: `PASS.speedPerPx` was replaced by `arriveSpeed`; min/max 300/950.
   - Verified: a full shot from x=322 stopped at x=1325 (was about 1700 px of travel); a tap travelled about 525 px; 300/600/900 px passes were all received.
3. **Dribble not smooth:** the lead profile is now a smooth `(1 - cos)` out-and-back (the old `sin` profile jolted at every touch); the spring tracks the target's velocity including the lead's rate; stiffer spring (900, 9000 cap); leads shortened (30-46 walk, 58 sprint, rest 24). Measured: a smooth 26 -> 49 lead wave.
4. **A shot at a teammate wasn't controlled:** `maxControlSpeed` 450 -> 750 and `maxControlHeight` 20 -> 40. Verified: a tap shot at a teammate 250 px away was controlled, and control moved to them.
5. **Shots too flat:** tap lift 60 -> 140, full lift 360 -> 520 (peaks about 92-96, under the bar). New ball shadow (`BALL_SHADOW_KEY`) so height reads in perspective.
6. **Keeper controls:**
   - when our keeper catches the ball, the human controls it (moves within its box via `keepInBox`); THROW (B1) to the ring-marked teammate; KICK (B2) as a long lofted ball;
   - control then passes to the receiver / the nearest outfielder;
   - it auto-throws after 6 s (`KEEPER.humanHoldMaxSec`);
   - uncontrolled keepers walk back to their goal-line spot (found when a keeper left off its line conceded an own goal in testing).
   - Verified: catch -> control -> walk -> throw -> keeper returns to (45, 649); kick peaks at 95 and is collected by an outfielder.
7. **Player collision:** new `systems/collisions.ts` (`separatePlayers`, body radius 16), run after movement; outfielders are re-constrained with `constrainMove` and keepers with `keepInBox`. Verified: stacked players end 32 apart.

### 2026-10-12: Phase 2: ball, dribbling, pass, shoot, keepers, match flow

- `tuning.ts`:
  - new MATCH timings, plus FORMATION, BALL, POSSESSION, DRIBBLE, PASS, SHOOT, KEEPER and INPUT;
  - with-ball turn rates in PLAYER;
  - `CROWD` moved above `CAMERA` so the camera comment sits with `CAMERA` again.
- `types.ts`: `Team` moved here from `playerArt`.
- New entity: `entities/Ball.ts`.
- New systems: `ballPhysics`, `possession`, `actions`, `keeper` (stand-in), `MatchFlow`, `geometry`.
- New UI: `ui/ActionButtons.ts`. New art: `art/ballArt.ts`. New renderer: `render/Court.ts`, which took the court and scenery construction out of `MatchScene`.
- `Player`: role (outfield/keeper), kits per role (keeper kits green/yellow), possession and dribble fields, `receiving`, pass-target ring, `placeAt()`; `render()` now takes the time.
- `Controls`: buttons (press, release, held, buffer age, consume) and J/K keys.
- `movement.stepPlayer` takes `hasBall` (with-ball speeds and turn rates).
- `HudScene`: scoreboard, clock (red pulse under 10 s, GOLDEN GOAL), centre banners and action buttons; the debug text moved under the scoreboard; buttons are released on pause, blur and hide.
- `MatchScene` rewritten around the fixed-step order above; `?debug` testing hook in `main.ts`.
- Verified in a local preview with scripted scenarios:
  - kickoff possession starts the clock;
  - a half-charged shot (about 800 px/s) into the top corner scored, the net held the ball, and play reset with the CPU kicking off;
  - the pass preview follows the stick to each teammate; a pass at about 420 px/s moved control to the receiver, who collected it;
  - the dribble lead oscillated 42-63 px;
  - the keeper caught a 649 px/s tap shot, held it 1 s and threw it out; it parried a full-power shot at about 330 px/s;
  - the far and end walls bounced the ball; a ball in the left net scored for the CPU with home kicking off;
  - golden goal at 0-0;
  - full time at 1-0 showed the Result screen ("YOU WIN! 1 - 0", shots and passes counted);
  - Play again started a clean 0-0 / 90 s match;
  - the GOAL! banner showed with the score updated.

### 2026-10-12: Smaller crowd, spacing in tuning.ts (user request)

- New `CROWD` block in `shared/tuning.ts` (`minGap` 70, `extraGap` 40), used by `render/Crowd.ts`: about 29 spectators per row, about 58 in total.

### 2026-10-12: Thick walls, inside-the-net movement fix, crowd (user feedback)

- Removed the goal recess walls (user request). End walls and the far wall are now solid 32-thick blocks with coping on top and camera-facing end faces; the far wall's facade rises from the back of the wall.
- `Goal` split into three depth layers with `NEAR_WALL_DEPTH`.
- Fixed the player "springing" out of the net: `constrainMove(fromY, toX, toY)` resolves axes separately.
- New crowd: `render/Crowd.ts` plus 12 spectator variants.
- `HudScene` releases the joystick on game BLUR/HIDDEN.

### 2026-10-12: Goal recesses, scenery, walk into the goal (user feedback)

- End walls wrapped the goal as a recess (later removed); `endWallHeight` 100 -> 120.
- Basketball court behind the left goal and a car park behind the right one (`art/sceneryArt.ts`, `render/Billboard.ts`).
- Players can walk into a goal through the mouth.
- Per-match lists are reset in `init()` (Phaser reuses scenes); the RESUME listener is removed on shutdown.

### 2026-10-12: Broadcast (FIFA-style) perspective camera

- New `render/`: `Projector`, `ProjectedPlane`, `Goal`. `art/pitchArt.ts` repainted for 3D. `CameraRig` drives the projector focus. `Player` renders via the projector. `main.ts` uses `Phaser.WEBGL`.

### 2026-10-12: Phase 1: pitch, camera, joystick, one player

- New `art/`, `systems/` (`FixedStep`, `Controls`, `movement`, `CameraRig`), `entities/Player.ts`, `ui/Joystick.ts`, `scenes/HudScene.ts`; `MatchScene` rewritten.

### 2026-10-12: Phase 0 improvements: forced landscape and retro pixel art

- `ui/landscape.ts`, `ui/palette.ts`, `ui/pixelFont.ts`, `ui/backdrop.ts`; pixel-art `TextButton`; restyled scenes and splash; `public/ball.svg`; `context?.username` guard. Created this file.

### 2026-10-12: Phase 0: GameMaker template replaced with Phaser

- Removed the GameMaker runner, the setup scripts and `docs/`; added `phaser@3.90.0`, the boot and the Boot/Menu/Match/Result scenes, `shared/tuning.ts` and `shared/types.ts`; updated `AGENTS.md` and `README.md`.
