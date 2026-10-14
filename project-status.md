# Street Soccer: Project Status

Hand-off notes for any developer or AI model picking up this project. **Update this file after every change**: add a changelog entry at the top of the changelog, and keep "Current state", "Decisions" and "Next up" accurate.

- **Source plan:** `Street Soccer MVP Plan.md` (by @ketan, Oct 12, 2026; kept outside the repo in the user's Downloads). It defines scope, tuning numbers, controls, AI and the 5-week build plan.
- **Repo rules:** see `AGENTS.md` (Devvit rules, code style: type aliases, named exports, no type casts).
- **Look target:** the user wants the camera angle of a FIFA-style TV broadcast camera: elevated beside the near touchline, perspective, touchlines horizontal, side lines converging. The rendering is built around this (see "Broadcast camera" below), in a retro pixel-art style ("Mode 7"-like).

## Current state

**Smaller player sheets for playtest (2026-10-15, `assests`):** release player animation WebP sheets now use quality 98, while both ball sheets remain lossless and editable source PNGs remain unchanged. `scripts/optimize_art.py` verifies identical alpha and bounds visible per-channel color error for every player sheet. The 17 release sheets fell from 9.41 to 5.50 MiB; the complete `dist/client` fell from 10.69 to 6.77 MiB (36.7% further reduction). Production build passed. A side-by-side run frame looked nearly identical, but the small color changes can affect alternate-kit recoloring; test home, away and keeper animations in Reddit playtest before merging this trial to `main` or publishing.

**Local branch integration (2026-10-15):** all authored sprites, player/ball animation work, court and goal updates, celebrations, and the first Reddit build optimization from `assests` were merged into `main` at `af66544`; handoff notes followed at `73da3c0`. Type check, lint, production build and all 14 logic checks passed before that merge. `origin/main` now matches `73da3c0`; the smaller quality-98 trial is only on `assests`.

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
  - scoreboard pill "YOU x - y CPU" (top left), clock (top centre; red and pulsing in the last 10 s, GOLDEN GOAL label), centre banners;
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

- Trial quality-98 WebP on player release sheets in `assests` to reduce Reddit download size while keeping exact alpha and lossless ball art. Preserve the editable PNG originals. The slight RGB changes make an alternate-kit visual playtest necessary before integrating this trial into `main`.

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
  - Crisp textures via `antialias: false` (nearest filtering) with `roundPixels: false`. Do NOT use `pixelArt: true`: it forces roundPixels, and rounding each sprite and ground vertex separately under the moving perspective camera made everything step and shimmer against each other. One art pixel = `PX` = 4 world px; only named colours from `PAL` (base PICO-8 plus character ramps added for the supplied reference). Don't snap HUD or overlay positions to the PX grid either: that made the stamina bar and joystick knob move in 4 px steps.
  - Text uses the generated bitmap font. Only capitals exist: **`setText()` does not upper-case, so do it yourself.**
  - Everything is generated in code (placeholder art until real atlases exist).
- **HUD is a separate scene** (`Hud`, registered last), fed by a plain `MatchHudState` object.
- **Fixed 60 Hz simulation with render interpolation.** The elapsed time per frame is capped at 5 steps; the accumulator resets on resume. Hit-stop and slow motion scale the time fed to `FixedStep`, so the sim stays deterministic per step.
- **Camera motion is continuous** (user feedback: the camera moved in steps): no hard dead zone (it made the camera stand still and then lurch). The focus follows its target with a critically damped smooth-damp (`CAMERA.followSec` 0.35), and the look-ahead is low-pass filtered (`lookAheadSmoothSec` 0.45), so dribble taps and turns can't jolt it. Runs per render frame with real dt. Measured over a zig-zag dribble with a reversal: 0 stop-starts, and the camera's speed changes by about 5 px/s per frame (median), 34 at most.
- **Movement feels FIFA-like, not instant** (user feedback: movement with the ball felt rigid and chunky). This overrides the plan's "no acceleration ramp": speed ramps up (0 -> jog in about 0.2 s, which is still responsive), turning rate drops with speed (wide arcs when sprinting, a quick pivot when slow), and the further the heading is off the stick (45° -> 150°), the more the player eases off. So a reversal plants, turns and re-accelerates instead of snapping round.
- **Dribble model (close control).** The previous model (a spring pulling the ball to a point ahead of the facing, with large out-and-back touches) felt chunky: on turns the target swung round and the ball cut through the player's body. Now the ball is placed relative to the carrier by an angle that follows the facing at a limited rate (dragged round in an arc) and a distance that eases to a speed-dependent lead with small smooth taps. Its velocity is derived from its motion. Measured: jogging lead 29-31 px with at most 0.44 px change per step; a 180° turn keeps the ball at least 26 px from the feet; sprint lead 47-53 px. The carrier loses the ball beyond 110 px (leash).
- **Ball control limit raised from the plan's 450 to 1000 px/s and 40 high** (user request: a shot at a teammate should be controlled). The intended receiver of a pass always controls it (automatic first touch).
- **Shooting is skill-based, no assist** (user request, replacing the earlier aim assist): the ball leaves along the stick; accuracy comes from charge timing; swipes on SHOOT shape it (analog chip / power / curl). The AI uses the very same `kickShot` and `kickPass`.
- **One shared AI for both teams** (user picked plan v3 + parts of v2): a team-level `TeamBrain` assigns roles, players steer with the normal movement code; difficulty only changes the CPU's `LEVELS` row. Tackles are the same code for the human and the AI.
- **Button contexts and buffering:**
  - B1 = PASS / TACKLE, B2 = SHOOT (hold to charge) / SWITCH.
  - A press is kept for 150 ms only when the ball is loose within 60 px of the controlled player, so it can become a pass or shot on gaining the ball. Otherwise it acts on the spot (switch/tackle).
  - Shot charge is timed in real time from the press.
- **Goalkeepers share one AI** (keeper.ts) for both sides; saves only come from real reach and dive timing. Difficulty changes reaction time only (no reach or speed boosts). The human can control ours (via SWITCH or when it catches the ball), including a DIVE (user request); the Phase 3 plans assumed an AI-only keeper, and the user hasn't decided yet whether to keep keeper control.
- **Difficulty = one table (`LEVELS`)** for the CPU; our AI teammates and keeper always play at normal. Same movement and physics at every level (v3: "no impossible movement or guaranteed saves"); only reaction (think rate, keeper reaction), decisions (score noise), accuracy (pass error, shot charge and placement, keeper dive error) and positioning (marking distance, positioning error) change.
- **Team plans (`TACTICS`, `TeamBrain.style`)** (user request: "make our teammates more attacking, the whole plan more aggressive; attackers go ahead with the ball and track back without it, defenders and the midfielder come forward too"): our AI teammates play `attacking` (every slot pushes well up with the ball and drops back without it, the forward always runs ahead, more one-twos, riskier through balls, more forward passing, pressing high and tighter); the CPU keeps `balanced` (the previous behaviour), so the difficulty levels are unchanged.
- **AI reacts late to the opposing carrier** (user request: "it is too difficult to fake them"): `LEVELS.readSec` delay on what the pressing / tackling AI sees, plus juke 120 -> 90 degrees. Applies to both sides (ours reads CPU carriers at normal).
- **Stamina +30% for everyone** (user request): `STAMINA.drainPerSec` 16 -> 12.3 (about 8 s of sprint from full instead of 6); regen, delay and thresholds unchanged, so it refills as fast as before.
- **Keeper improvements kept modest** (user: "don't make it overpowered that nobody can score"): better angle positioning and a walking side-step while it reacts, but the same reaction times, dive and reach.
- **Less crowding round the ball** (user feedback: "it feels so overcrowded at times"): the shape slides less with the ball, our team stretches wide, the defending zones close the middle less, the defending forward stays up, positioning jobs move calmly, and the camera is zoomed out to 0.9. Player sprites were left at their size (optional idea, not asked for).
- **Kickoffs wait for the kickoff pass** (user request: "unless I click pass the game shouldn't start, neither AI nor time clock"). The CPU kicks off by itself after a short pause, so a CPU kickoff never needs input.
- **Contain, then punish idling** (user feedback: the presser "follows like a shadow, no room to pass to the player behind"; user request: an idle carrier should be attacked and the CPU go through on goal): the presser keeps a real distance and reacts at its think rate, but a carrier standing on the ball for 1.5 s is closed down and tackled, and a won ball turns into a counter-attack.
- **Receive assist despite the Phase 2 "no automatic runs" rule** (user request: "make passing more easy, the AI can easily intercept it or it does not even reach the intended player"): the old rule left the receiver on the stick, which was still pushed the way you passed, so he ran away from the ball. The assist only moves him toward the ball until you touch the stick in a new way; `PASS.receiveAssist: false` turns it off.
- **Zonal defence, not man-to-man** (user complaint: "every AI player marks our respective player, which makes the game unplayable"): one presser, at most 2 markers and only in the 900 px danger zone near goal, everyone else holds a zone pulled toward the middle; markers sag off when their man is far from the ball. This leaves natural space to build play in your own half.
- **Ideas from reference repos, not code** (user asked to read github.com/HTANV/Soccer-Unity and github.com/tshrjn/openFIFA): Soccer-Unity (the FStudio football-simulator match engine, C#, no license file) gave the ideas: chase caution / relax, most-open-spot shooting and chips over a keeper off its line, pressure by closing time, avoidance steering and zone-based dribble direction, give-and-go, showing for the ball, through balls with a race check, rest defence, switching to the AI's chosen player, positioning error, chance-based catches, front-only AI tackles. openFIFA's AI (nearest chases, others return to formation, always-successful tackles) was simpler than ours: nothing taken. Everything was re-implemented in our own systems (its C# / Unity / 3D / 11v11 code doesn't fit, and Soccer-Unity has no license).
- **Ball feel tuned by simulation, not the plan's numbers** (user feedback: shots crossed the whole court, rebounds too strong, shots too flat). The plan's 0.55/s drag let a lifted 950 px/s shot travel about 1700 px. The ground/air drag, friction and bounce were picked with a scratch simulator of `stepFreeBall` so a full shot travels about 1000 px while 300-900 px passes still arrive (verified in game).
- **Switch was pulled forward from Phase 3** because teammates exist now. The 0.2 s speed boost on switch is still to do.
- **Debug hook:** `?debug` in the URL sets `window.__game` and shows each outfielder's AI role (or TACKLE / DOWN / STAGGER) over its head. Use `__game.scene.getScene('Match')` to read or set state in tests (ball, home, away, homeKeeper, awayKeeper, controlled, flow, homeBrain/awayBrain.orders, controls.press/release, controls.touchStick, chargeSince).
- **Devvit `context` may be undefined** outside Reddit (local preview), so read it as `context?.username`.

## How to run and verify

The user runs the game commands themselves in WSL (`npm run dev` for the Reddit playtest). An AI assistant should not start the playtest; just tell the user which command to run.

Checks the assistant can run (through WSL, since `node_modules` was installed there):

- `npm run test:types`, `npm run lint`, `npm run build`
- `npm run test:logic`: `checks/logic-check.ts`, logic checks of the Phase 3 rules (tackle timeline, chances, juke, contact; keeper reaction restart; AI brain: no decisions for the human's ball, no chase when out, reset; pass weight; difficulty table) on hand-made players, no game or browser. It is bundled with rolldown first, because the source imports have no file extensions (which is also why `npm run test:unit` can't import game modules). Not linted or type-checked (outside `src/`).
- **User preference (stage 6 on):** no automated gameplay testing in the browser preview; check syntax (types, lint, build) and logic (code review, `test:logic`) only. The gameplay testing techniques below are kept for reference.
- From Git Bash, prefix with `MSYS_NO_PATHCONV=1 wsl --cd "/mnt/f/code ball/street-soccer" -- bash -lc "..."`, or the `/mnt/f` path gets mangled.
- Local visual check: serve `dist/client` with any static server on port 4173 and open it. The game runs as a guest outside Reddit.
  - In the Claude desktop app, `F:\code ball\.claude\launch.json` has a `dist-preview` config, which uses a scratchpad `serve.mjs` that may no longer exist.
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

- Push `assests` if the smaller build should be available remotely, run `npm run dev` from this checkout, and visually check all kits (especially recolored away/keeper sprites), celebrations, dives, tackle/hurt, carrying and shooting before merging the compression trial into `main`.

- Review the merged `main` build in-game and on a phone; the smaller `assests` trial must be checked separately before another release.

- Test a fresh match and a second match on localhost/Reddit mobile to confirm lossless sheet loading and atlas reuse after source textures are released. Record cold start time and memory on a phone before considering smaller source dimensions or build-time atlas generation.

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

1. Match start: menu -> each difficulty; 10 players; tap the FPS readout and note FPS and the `SIM` line during busy play.
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
