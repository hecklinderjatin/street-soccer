# Street Soccer: Project Status

Hand-off notes for any developer or AI model picking up this project. **Update this file after every change**: add a changelog entry at the top of the changelog, and keep "Current state", "Decisions" and "Next up" accurate.

- **Source plan:** `Street Soccer MVP Plan.md` (by @ketan, Oct 12, 2026; kept outside the repo in the user's Downloads). It defines scope, tuning numbers, controls, AI and the 5-week build plan.
- **Repo rules:** see `AGENTS.md` (Devvit rules, code style: type aliases, named exports, no type casts).
- **Look target:** the user wants the camera angle of a FIFA-style TV broadcast camera: elevated beside the near touchline, perspective, touchlines horizontal, side lines converging. The rendering is built around this (see "Broadcast camera" below), in a retro pixel-art style ("Mode 7"-like).

## Current state

**Phase 2 (ball, dribbling, pass, shoot, goals, match flow) is done** and verified in a local preview with scripted scenarios. It still needs a real-phone playtest in Reddit. **Phase 3 (5v5 with AI) is in progress: steps 1-5 of 6 (away team, AI hand-over, shared outfield AI, AI carriers + tackles, keepers + difficulty) are done; step 6 is the phone playtest.** The user picked plan v3 (one shared AI for both teams, opponents first) plus v2's tackle rules, steering, debug overlay and regression matrix. Build order: 1 away team + resets, 2 released players hand over to AI, 3 shared outfield AI (support, recover, chase/intercept, one presser, mark/cover), 4 AI carriers (pass/shoot/dribble) + tackles (human B1 too), 5 keepers + Easy/Normal/Hard, 6 phone playtest. Keeper control stays for now (the plans assume the keeper is AI-only; the user hasn't decided).

What works now:

- Inline splash post in the feed (`splash.html`), retro styled, with a Play button that opens the game in expanded mode.
- Scene flow: Boot -> Menu (difficulty picker + Play) -> Match + Hud (overlay) -> Result (Play again / Menu). The pause menu's Quit goes back to Menu.
- **Court (perspective view):**
  - textured ground, the far wall with graffiti and an apartment facade, thick end walls with the goals in the gaps;
  - 3D goals with nets, a see-through fence on the near touchline, a crowd behind it;
  - a basketball court and a car park beyond the goal lines.
- **Teams (5v5):** home 4 outfield players in a 2-1-1 shape (red) plus a keeper (green); away (CPU) 4 outfield players in the mirrored shape (blue, `MatchScene.away`) plus a keeper (yellow). All 10 are in `everyone` (collisions, possession, rendering) and both outfield teams are constrained and stepped. Outfielders the human isn't controlling are driven by the **shared outfield AI** (below). Kickoff: the kicking side's forward stands next to the ball and the other side's forward waits outside the centre circle (`FORMATION.defendKickoffX` 1020, mirrored). `opponentsOf` now includes the opposing outfielders, which affects shot/pass pressure and chips over a blocked pass lane. The away keeper throws to the away outfielders.
- **Outfield AI (`systems/ai.ts`, `AI` in tuning):** one `TeamBrain` per side, the same code for both. It re-assigns roles every `AI.mateThinkSec` 0.15 s (ours) or `AI.thinkSec` 0.3/0.2/0.12 s by difficulty (CPU). Every step each AI player steers to its role's target through the normal `stepPlayer` (same speeds, turning, stamina, no teleports); standing still, it faces the ball. Only runs while live (not during freezes or celebrations).
  - **Loose ball:** one **chaser** per team: whoever reaches the ball first at a sprint along its predicted roll (`interceptPoint`); an intended receiver of ours always goes. If our human is quickest, no AI chases. The current chaser keeps the job unless someone is 0.25 s quicker. Others **cover** formation spots.
  - **Opponent on the ball:** one **presser** jockeys 70 px goal-side of the carrier, aiming where the carrier will be in 0.4 s, so it backs off as the carrier advances (no tackles until step 4). If our human is within 130 px of the carrier, they are our presser and no AI presses. The rest **mark** the most dangerous opponents (closest to our goal; nearest free player each), 50 px goal-side and leaning toward the ball; leftovers **cover** dropped-back spots.
  - **Own ball:** **support** spots pushed 140 px upfield, moved out of the way of the nearest opponent (100 px) and kept 170 px from the carrier; the furthest-forward supporter is the **runner**, 280 px ahead of the ball.
  - Formation spots slide with the ball (0.5 along, 0.35 across). Teammates within 90 px push their targets apart (not chasers or pressers). Sprinting: chasers and pressers beyond 60 px, anyone beyond 320 px, saving stamina below 30.
  - **Hand-over (step 2):** `setControlled` wakes both brains, so the released player gets an AI role on the next step and the new one drops its role. Our AI players can win loose balls; control then follows the ball to them, as before.
  - **?debug:** each outfielder shows its role over its head (HUMAN for yours; `updateRoleText`).
- **AI carriers (`TeamBrain.decideCarry`, executed by `MatchScene.stepAiCarriers`):** any AI player with the ball (an AI keeper with it at its feet too) scores its options at each think, each score x (1 +- `decisionNoise`, by level). Pressure counts only opponents able to act (not staggered or down):
  - **shoot** within 560 px of the goal centre: 1.7 x closeness + 0.45 with a clear line (an opponent within 35 px of it: -0.8), minus a wide-angle penalty; aims 30 px inside the post away from the keeper, pulled toward the centre by up to `aimSpread` 110 / 70 / 40 px (easy / normal / hard); charge 0.7 +- 0.25 / 0.12 / 0.05 through the normal `kickShot` (same aim error and keeper reactions);
  - **pass** to a teammate 100-750 px away: 0.15 + 0.5 x progress + 0.3 x open + 0.3 x lane safety, -0.2 over 500 px, +0.3 under pressure (an opponent within 60 px); the normal `kickPass` (auto weight, lead, chip over a blocked lane);
  - **dribble** (not keepers) 200 px toward goal, sidestepping 110 px round the nearest player in the way; 0.45 + 0.5 x space ahead, -0.4 under pressure; sprints with 220 px of space;
  - **clear**: a lofted kick upfield (`kickShot` at 0.6 with swipe-up 0.7): 0.55 under pressure in our half, 0.35 for a keeper, else 0.05.
  Passes and shots wait for the first touch to settle (0.3 s after gaining it).
- **Tackles (`systems/tackle.ts`, `TACKLE` in tuning), the human and the AI alike:** start-up 0.10 s (slows), lunge 0.15 s (70 px), recovery 0.35 s. Contact = an opposing carrier's ball within 48 px and within 70 degrees of the lunge, during the lunge (one per tackle). Success chance 55%, +15% from the carrier's front/side (within 110 degrees of its facing) or -30% from behind, -15% if the carrier sprints, +10% if the tackler went in at a sprint. **Juke:** the carrier's stick (or AI direction, `Player.wantDir`) turned more than 120 degrees since the tackle started = always fails. **Won:** the ball is knocked loose at 110 px/s toward a point 40 px ahead on the lunge line, where the sliding tackler collects it (first touch is the tackler's for 0.35 s, `Ball.priority`); the carrier staggers 0.5 s (no moving or touching the ball); the tackler is up after 0.1 s. **Failed:** the tackler stumbles 0.6 s (drawn on its side). Deviation from the plan's 300 px/s pop: popping along the lunge sent the ball away from the tackler to the carrier's teammates; a random-side nudge often took it out of reach. Now every won tackle in tests ended with the tackler on the ball.
  - **Human:** B1 (TACKLE) without the ball lunges along the stick (the facing with it centred); not at a teammate's ball.
  - **AI:** only the presser, when the ball (predicted 0.17 s ahead) is within lunge reach: a chance per think of 0.25 / 0.45 / 0.65 (easy / normal / hard; ours normal), x0.3 from behind; 1 s cooldown; none in the first 0.5 s after kickoff (`liveSince`). The presser closes to 40 px of a standing carrier (70 px at walking pace and above) so a shielding carrier can be reached.
- **Pass in flight belongs to its receiver:** while a pass travels, the passer's other teammates can't take it (opponents can intercept); a deflection frees it. Needed because AI teammates now stand in passing lanes (an AI pass was cut out at 904 px/s by a teammate next to the passer).
- **Ball** (`entities/Ball.ts`, `systems/ballPhysics.ts`):
  - 3D position and velocity: rolling drag 0.35/s plus 40 px/s² rolling friction, air drag 0.5/s, gravity 1400, bounce 40%, spin curve. A full-power shot travels about 1000 px in all (it no longer crosses the court); a tap about 525 px;
  - 50% bounce off the far wall, near fence, end walls and posts;
  - enters a goal only through the mouth, under the bar (fully over the line = goal, then the net holds it); at bar height it hits the crossbar and comes back; over the bar, or over an end wall (higher than 120), it goes out behind the goal. An OVER THE BAR / OUT banner shows, and after 0.9 s the defending keeper restarts with the ball in hand (ours is then human-controlled);
  - drawn with two rolling frames, lifted and scaled with height, plus a ground shadow that shrinks and fades as it rises (added early at the user's request, so height reads in perspective).
- **Possession** (`systems/possession.ts`):
  - control within 34 px, below 40 px high (feet to chest) and under 1000 px/s, so passes and most shots at a teammate are controlled; faster balls deflect off the player (20% speed kept); 0.25 s regain lockout;
  - the intended receiver of a pass always controls it, with a +10 px first-touch bonus;
  - **close-control dribbling (FIFA-like):** the ball's place around the carrier is an angle plus a distance. The distance is about 20 px at the feet when slow, about 28-30 jogging and about 42-53 sprinting, with small rhythmic taps or sprint knock-ons (smooth, no jolts). The angle follows the facing at a limited 620 deg/s, so on turns the ball is dragged round the player in an arc. The first touch is cushioned (a fast ball runs on a little, then settles);
  - **momentum movement:** speed ramps (accel 1500, or 1150 with the ball; decel 1800); turns are fast when slow (a 1080 deg/s pivot under 70 px/s) and wider at speed (900 -> 380 deg/s, x0.85 with the ball); sharp direction changes brake (plant and turn); with-ball speeds 205/290 px/s.
- **Controls:**
  - two context buttons (HUD bottom right) plus J/K: PASS/SHOOT with the ball, TACKLE/SWITCH without;
  - 150 ms press buffer when the ball is close;
  - control follows the ball (gaining it switches control to the carrier).
  - **Controlled player marker (FIFA-style, `MatchScene.updateGroundMarker`):** the yellow arrow overhead plus a **ground ring** (radius 44 world px, dark translucent disc, white outline) with a **pointer** on it toward the facing direction (`heading`). While SHOOT / KICK charges, the pointer follows the strike direction, a **24-segment gauge** fills round the ring (white, green in the perfect band, red when over-hit, white for a keeper kick) and **the pointer itself stretches out into the aim arrow** (ease-in, up to 190 px; one arrow, no second arrow from the ball). The same happens for a held (weighted) PASS, pointing at the target, with the right-weight segments glowing green. The ring is drawn as projected points every frame at depth y - 0.5 (under the player).
- **Pass** (`systems/actions.ts`):
  - target = the **nearest** outfield teammate in the stick direction (the facing when the stick is centred): a 60° cone first, widening to 110°, 180° and then all round if nobody is in it (`PASS.coneStepsDeg`). A pulsing blue ring marks the target while you hold the ball;
  - 0.08 s wind-up; **tap** = strike speed solved from the ball physics so the pass arrives at about 170 px/s (clamped 300-950); **hold = weighted pass**: the charge (0.9 s full) sets how far it rolls (100-1300 px, curved, up to 1150 px/s), so it can stop short or run past (gauge green when well weighted); leads the receiver; 3° error (8° under pressure); chips over a blocked lane;
  - control moves to the receiver at release. **Nobody runs toward the ball by themselves** (user preference): only the controlled player moves, by the stick. The receiver keeps a guaranteed first touch while the pass travels, dropped once the loose ball is slower than 60 px/s;
- **Shoot (skill-based, user request: no help from the game; `actions.kickShot`):** the ball leaves **exactly along the stick** (the facing with the stick centred). No aim assist, no snapping to the goal, no auto-ranging, no automatic curve. Tap = 900 px/s (lift 120); hold up to 0.6 s for up to 1250 px/s (lift 420). **The run feeds the strike (FIFA-like):** half the run speed along the shot is added to ball speed (subtracted when running away); 0.35 x that run speed is added as lift; shooting back across the run loses up to 30% power. **Accuracy = timing:** releasing in the green band (charge 60-80%) is a perfect strike (strays at most 0.5°); any other release strays up to 2°; over-hitting past 80% adds up to +5° stray and +180 lift (over the bar). Sprinting +3°, straight back across the run +5° (scaled), a defender within the pressure radius +3°. Stray is a triangular spread (mostly small); there is no random lift. While charging, the ring pointer stretches into an **aim arrow** showing the strike direction only (white / green perfect / red over-hit; `SHOOT.aimArrow` turns it off). A free ball faster than 650 px/s draws a fading trail.
- **Swipe shots (PES-mobile layout, ANALOG):** while pressing SHOOT, slide the thumb: up = CHIP, down = POWER, left / right = CURL. **How far you slide is how much of the effect** (10 px of wobble ignored, full at 70 px; `Controls.swipe` is a vector, `actions.shotShape`), and diagonals mix (e.g. up-right = a chipped curler). It follows the thumb until release, so sliding back takes effect away. Hold to charge as usual; a flick works too (but a flick is a low-charge strike). The arrows around the button grow and turn yellow with the amount, and because the thumb hides the button, **a label above the shooter** spells out the shape while charging (e.g. `CHIP 70 CURL R 70`, `SHOT` with no swipe; `actions.shotLabel`). Keyboard: T / G / F / H = SHOOT with a full swipe up / down / left / right.
  - **Up = CHIP:** blends toward a lob whose pace (450-900) and loft (450-750) the charge sets. At a full swipe the first bounce is about 310 px at a tap and about 700 px at the sweet spot, so you judge the distance. Stray -30% at full.
  - **Down = POWER:** +22% pace and +30% lift with topspin (`ball.dip` up to 0.7 extra gravity until it lands), stray +40%, and over-hit lift +30% at full.
  - **Left / Right = CURL:** sidespin up to 1.1 rad/s (decaying) bending that way **as the shooter sees it** (moving right on screen, a left curl bends up the screen). It leaves along the stick and bends away from that line, so aim outside the post. -20% pace, -25% lift, stray -20% at full.
  - No swipe = the plain shot above (no spin). `BALL.spinMinSpeed` is 300 so curlers keep bending as they slow.
- **Switch:** a tap goes to the teammate nearest the ball, the keeper included; repeat taps within 1 s cycle; 0.12 s cooldown. **Holding SWITCH (0.35 s)** jumps straight to our keeper. When the ball is heading toward our goal (faster than 250 px/s, in our third), a tap picks the keeper first. **After a shot** control follows the outfielder **closest to the loose ball**, re-checked every step as the ball travels (the shooter keeps it while still closest; another takes over once 30 px closer, `SHOOT.followShotMargin`). It ends when someone gains the ball, when the ball has died (after a last pick), when the player presses SWITCH, or after 4 s (`followShotMaxSec`; `MatchScene.followShotUntil`).
- **Goalkeepers** (`systems/keeper.ts`, `KEEPER` in tuning; both teams, and ours whenever the human isn't controlling it):
  - **Positioning** (`keeperStick`): on the line from its goal centre toward the ball, 30 px off the line with the ball 1000+ px away, up to 60 px out with it 350 px away (within the mouth's width). Once a shot is struck (free ball faster than 450 px/s) it holds its position (saving is the dive).
  - **Claiming:** a loose ball slower than 450 px/s that it can meet in its box (or 40 px outside) at least 0.15 s before any opponent, and before any teammate: it sprints to the meeting point (`ai.interceptPoint`). Tested: 8/8 balls rolling into the box with an attacker 350 px behind were claimed.
  - **Rushing out:** an opposing carrier within 450 px of goal with none of the keeper's outfielders nearer the goal: it comes out toward the carrier (to 80 px from it, at most 170 px off its line, inside its box).
  - **Reaction** (`cpuKeeperReact`, reaction `LEVELS.keeperReactSec` 0.5 / 0.4 / 0.32 s +- 0.04 random; ours always 0.4): a shot heading for its goal (faster than 300 px/s, on target or within 30 px of a post, under its reach height, arriving within 1.2 s): a sideways dive toward where it will pass, only as far as needed (straight-line prediction, so a late curler can beat it); a carrier close in its box (95 px): a **smother** dive at the ball. Diving with an opposing carrier's ball in reach in its box takes it (the carrier staggers 0.5 s, like a lost tackle). Standing it reaches 96 high, diving 120. Catch at or below 650 px/s, parry faster (25% speed).
  - **Shot table** (perfect-timed shots from straight in front, 12 each, goals; corner = aimed 105 px off centre, mid = 60, weak = 20% charge): easy: 450 px corner 12, mid 12, central 0, weak corner 10; 300 px corner 12, mid 0, weak 12. Normal: 450 corner 12, mid 5, central 0, weak 0; 300 corner 12, mid 0, weak 12. Hard: 450 everything saved; 300 corner 12, weak 12, mid 0. So placement, power and distance decide; hard asks you to get closer.
  - **1v1** (normal, the human dribbling at goal through the middle): shooting at a corner within 420 px (keeper still on its line) 12/12 goals; within 330 px (keeper rushed out to ~170 px) 12/12; waiting until 250 px: 2/12 (it's on top of you); dribbling on without shooting: smothered 8/8.
  - **Distribution** (holding the ball, not human-controlled: after 1 s; a human-controlled keeper auto-distributes after 6 s): throws (the normal pass, lofted) to the best teammate 120-800 px away scored on openness (no opponent within 120 px), lane safety and progress; if nothing scores 0.55, a long punt (820 px/s, lift 520) upfield toward the most advanced teammate's side. Control goes to the throw's receiver, or the outfielder nearest where a punt is heading.
  - **You can control your keeper:** SWITCH to it (hold SWITCH to jump straight there), or it catches the ball. Without the ball you can move it anywhere, **out of its box too** (sprint allowed). Hands only inside its own box: it catches, parries and holds there, can't carry a held ball out (`keepInBox` while `holding`), and outside the box it plays with its feet like an outfielder (dribble, PASS/SHOOT; fast balls deflect), and it faces the ball when standing. **B1 = DIVE:** along the stick (a full 0.35 s lunge at 480 px/s), or with the stick centred a smart dive toward where the ball will cross the keeper's line, only as far as needed. Reach while diving is 64 (normally 40), then 0.45 s down (drawn on its side). B2 = SWITCH out. With the ball: B1 = THROW to the ring-marked teammate; **B2 = KICK, held to charge** (tap = 520 px/s low clearance, full = 900 px/s lofted; the ring is white then yellow). **KICK takes the same swipes:** up = PUNT (1.5x lift), down = DRIVE (1.3x speed, 0.4x lift), left/right = CURL (bends 18° that way, spin 0.9 rad/s). Control then passes to the receiver or the nearest outfielder. It auto-throws after 6 s.
- **Player collision** (`systems/collisions.ts`): bodies of radius 16 push apart (half each) after movement; then court and box limits are re-applied.
- **Match flow** (`systems/MatchFlow.ts`):
  - kickoff with a 1 s READY freeze, then GO!; the 90 s clock starts at the first touch;
  - goal = 0.3 s hit-stop, 1 s slow motion at 0.4x, 2.5 s celebration, then a reset with the conceding team kicking off;
  - full time: level -> 30 s golden goal (next goal wins), still level -> draw; then a FULL TIME banner and the Result screen with goals, shots and passes.
- **HUD:**
  - scoreboard pill "YOU x - y CPU" (top left), clock (top centre; red and pulsing in the last 10 s, GOLDEN GOAL label), centre banners;
  - floating joystick, action buttons, pause; FPS/debug under the scoreboard.
- Type check, lint and build all pass.

Not yet built (Phase 3):

- No away outfield team, so after a home goal the "away kickoff" just leaves the ball on the centre spot.
- TACKLE does nothing yet, and there's no AI.
- No switch speed boost.

The server still has the template's demo endpoints (`/api/state`, `/api/score`, `/api/leaderboard` with Redis); Phase 5 replaces them with `/api/init` + `/api/challenge` and removes Redis.

## Phase roadmap

| Phase | Scope                                                                                                                                                                      | Status                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 0     | Replace GameMaker template with Phaser, scene skeleton, landscape, pixel style                                                                                             | Done                                                  |
| 1     | Fixed 60 Hz loop, 2.5D (x, y, z) model, pitch 2400x1300, camera, floating joystick, keyboard fallback, one player with walk/sprint/stamina                                 | Done, plus the broadcast camera                       |
| 2     | Ball physics, possession and dribble touches, context buttons (+ J/K keys), pass (target ring), shoot (charge), goals and match flow (clock, kickoff, golden goal, Result) | Done (awaiting phone playtest); switch included early |
| 3     | Away 5v5 team, tackle, AI state machine (Chase/Support/Mark/Carry), real goalkeepers, difficulty levels, fairness helpers, switch boost                                    | In progress (steps 1-5/6)                                 |
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
      Player.ts             sim fields (position, heading, speed, stamina, lockUntil, dribble touch state, receiving, passTarget) + render
      Ball.ts               3D sim fields, owner, lastTouch, inNet + render (rolling frames, lift with height)
    systems/
      FixedStep.ts          60 Hz accumulator; returns the interpolation alpha
      Controls.ts           input bridge: joystick (touchStick), keyboard (WASD/Shift/J/K), button press/hold/buffer state
      movement.ts           stepPlayer(): momentum (accel/decel, speed-dependent turning, plant-and-turn), speeds with/without ball, stamina; constrainMove()
      ballPhysics.ts        stepFreeBall() (gravity, bounce, drag, spin) and collideBall() (walls, fence, posts, nets, goal detection)
      possession.ts         stepPossession(): control/deflect for a loose ball, close-control dribble (angle + distance around the carrier); gainBall (cushioned)/releaseBall
      actions.ts            choosePassTarget(), kickPass(), kickShot() (aim assist, curve)
      keeper.ts             goalkeepers: keeperStick() (position / claim / rush), cpuKeeperReact() (shot dives, smothers), stepKeeperHands() (catch / parry / smother / hold / distribute), startDive(), stepKeeperBody(), keepInBox(), inOwnBox()
      ai.ts                 TeamBrain: shared outfield AI for both teams (role assignment + steering: chase/press/mark/cover/support/run/carry), carrier decisions (decideCarry), AI tackle intent, interceptPoint()
      tackle.ts             tackles for everyone: startTackle(), stepLunge(), resolveTackle() (contact, success chance, juke, win/fail), tacklePhase()
      collisions.ts         separatePlayers(): body-circle push-apart
      MatchFlow.ts          kickoff/live/goal/fulltime state machine, clock, score, golden goal, banners, time scale
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
    tuning.ts               every gameplay number: VIEW, SIM, PITCH, MATCH, FORMATION, BALL, POSSESSION, DRIBBLE, PASS, SHOOT, KEEPER, INPUT, PLAYER, STAMINA, STICK, CROWD, CAMERA
    types.ts                Difficulty, Team ('home' human / 'away' CPU), MatchConfig, MatchResult
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
- Formation (home): left back (520, 420), right back (520, 880), midfielder (840, 650), forward (1120, 650), keeper (40, 650). At a home kickoff the forward stands at (1176, 650) by the ball on the centre spot (1200, 650). The CPU keeper is at (2360, 650).
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
- Fence 1e6; crowd 1e6 + 1 + y; overhead arrow and stamina bar 2e6; shot label 3e6. The HUD is a separate scene, always on top. The ground marker (`MatchScene.marker`) sits at depth y - 0.5; the charging aim arrow (`aimArrow`) at ball y + 0.3.

**Fixed step (MatchScene.step), in the plan's order:**

1. Save previous positions.
2. Movement: `stepPlayer` for home outfielders. The controlled player follows the stick; receivers auto-run to the intercept point unless steered; everyone holds still while `flow.playersFrozen`.
3. Free ball physics (`stepFreeBall`) if nobody owns it.
4. While live, possession: `stepPossession` (control, deflect, or dribble the carrier), then `stepKeeperHands` for both keepers.
5. `collideBall`; on a goal: release, clear actions, `flow.onGoal`.
6. While live, actions (`stepActions`): a pending pass fires after the wind-up; B1 = pass; B2 = charge/shoot or switch; presses are buffered.
7. `flow.tickClock(dt)`.

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

- **Phaser 3 only, no GameMaker.** The project was generated from the GameMaker Devvit template; all GameMaker runner files were removed. Only Phaser.js (Three.js optional later) is allowed.
- **Server stays Hono** (the template's framework), not Express as the plan says. Same `/api/*` endpoints.
- **Broadcast camera (perspective) instead of a top-down view** (user request, FIFA-like screenshots).
  - The simulation stays 2D on the ground plane; only rendering is 3D. `Projector` is a pinhole camera that sits on the near side, raised, looking toward the far side and tilted down by `CAMERA.tiltDeg` (35°), with `fovDeg` 40°.
  - It never yaws, so x-lines stay horizontal and y-lines converge. `focusScale` (0.85) sets the camera distance. The air zoom of 0.88 pulls the camera back while the ball is high and fast.
  - **Ground and walls** are `ProjectedPlane`s: a Phaser Mesh grid whose vertices' `vx/vy` we overwrite each frame with projected screen positions. The mesh is removed from the update list so its own 3D `preUpdate` never runs. A dense grid (ground 40x18) hides affine warping. The Mesh needs WebGL, so the game is `Phaser.WEBGL`.
  - **Sprites are camera-facing billboards**, scaled by `PX * projected scale`. Vertical geometry is foreshortened by about cos(tilt), so the goal height is 104.
  - **Camera focus clamps** (x 400..2000, y 400..960) keep the view on the court.
- **Forced landscape via CSS rotation, not the Screen Orientation API.** `screen.orientation.lock` needs fullscreen, which the Reddit webview doesn't give. So `ui/landscape.ts` scales/rotates the fixed 1280x720 `#game` box; Phaser runs in `Scale.NONE`; `input.transformPointer` is wrapped to map touches back through the rotation; the layout is re-checked every frame.
- **Retro pixel art style.**
  - Crisp textures via `antialias: false` (nearest filtering) with `roundPixels: false`. Do NOT use `pixelArt: true`: it forces roundPixels, and rounding each sprite and ground vertex separately under the moving perspective camera made everything step and shimmer against each other. One art pixel = `PX` = 4 world px; only colours from `PAL`. Don't snap HUD or overlay positions to the PX grid either: that made the stamina bar and joystick knob move in 4 px steps.
  - Text uses the generated bitmap font. Only capitals exist: **`setText()` does not upper-case, so do it yourself.**
  - Everything is generated in code (placeholder art until real atlases exist).
- **HUD is a separate scene** (`Hud`, registered last), fed by a plain `MatchHudState` object.
- **Fixed 60 Hz simulation with render interpolation.** The elapsed time per frame is capped at 5 steps; the accumulator resets on resume. Hit-stop and slow motion scale the time fed to `FixedStep`, so the sim stays deterministic per step.
- **Camera motion is continuous** (user feedback: the camera moved in steps): no hard dead zone (it made the camera stand still and then lurch). The focus follows its target with a critically damped smooth-damp (`CAMERA.followSec` 0.35), and the look-ahead is low-pass filtered (`lookAheadSmoothSec` 0.45), so dribble taps and turns can't jolt it. Runs per render frame with real dt. Measured over a zig-zag dribble with a reversal: 0 stop-starts, and the camera's speed changes by about 5 px/s per frame (median), 34 at most.
- **Movement feels FIFA-like, not instant** (user feedback: movement with the ball felt rigid and chunky). This overrides the plan's "no acceleration ramp": speed ramps up (0 -> jog in about 0.2 s, which is still responsive), turning rate drops with speed (wide arcs when sprinting, a quick pivot when slow), and the further the heading is off the stick (45° -> 150°), the more the player eases off. So a reversal plants, turns and re-accelerates instead of snapping round.
- **Dribble model (close control).** The previous model (a spring pulling the ball to a point ahead of the facing, with large out-and-back touches) felt chunky: on turns the target swung round and the ball cut through the player's body. Now the ball is placed relative to the carrier by an angle that follows the facing at a limited rate (dragged round in an arc) and a distance that eases to a speed-dependent lead with small smooth taps. Its velocity is derived from its motion. Measured: jogging lead 29-31 px with at most 0.44 px change per step; a 180° turn keeps the ball at least 26 px from the feet; sprint lead 47-53 px. The carrier loses the ball beyond 110 px (leash).
- **Ball control limit raised from the plan's 450 to 750 px/s and 40 high** (user request: a shot at a teammate should be controlled). The intended receiver of a pass always controls it (automatic first touch).
- **Shot aim assist** uses where the stick line crosses the goal line, clamped 24 px inside the posts, not just "goal centre". So pointing at a corner aims at that corner, while straight down the middle hits the keeper. Curve: the shot launches half the bend off-line, and its spin brings it back across.
- **Button contexts and buffering:**
  - B1 = PASS / TACKLE, B2 = SHOOT (hold to charge) / SWITCH.
  - A press is kept for 150 ms only when the ball is loose within 60 px of the controlled player, so it can become a pass or shot on gaining the ball. Otherwise it acts on the spot (switch/tackle).
  - Shot charge is timed in real time from the press.
- **Goalkeepers share one AI** (keeper.ts) for both sides; saves only come from real reach and dive timing. Difficulty changes reaction time only (no reach or speed boosts). The human can control ours (via SWITCH or when it catches the ball), including a DIVE (user request); the Phase 3 plans assumed an AI-only keeper, and the user hasn't decided yet whether to keep keeper control.
- **Difficulty = one table (`LEVELS`)** for the CPU; our AI teammates and keeper always play at normal. Same movement and physics at every level (v3: "no impossible movement or guaranteed saves"); only reaction (think rate, keeper reaction), decisions (score noise), accuracy (pass error, shot charge and placement) and positioning (marking distance) change.
- **Ball feel tuned by simulation, not the plan's numbers** (user feedback: shots crossed the whole court, rebounds too strong, shots too flat). The plan's 0.55/s drag let a lifted 950 px/s shot travel about 1700 px. The ground/air drag, friction and bounce were picked with a scratch simulator of `stepFreeBall` so a full shot travels about 1000 px while 300-900 px passes still arrive (verified in game).
- **Switch was pulled forward from Phase 3** because teammates exist now. The 0.2 s speed boost on switch is still to do.
- **Debug hook:** `?debug` in the URL sets `window.__game`. Use `__game.scene.getScene('Match')` to read or set state in tests (ball, home, controlled, flow, controls.press/release, controls.touchStick).
- **Devvit `context` may be undefined** outside Reddit (local preview), so read it as `context?.username`.

## How to run and verify

The user runs the game commands themselves in WSL (`npm run dev` for the Reddit playtest). An AI assistant should not start the playtest; just tell the user which command to run.

Checks the assistant can run (through WSL, since `node_modules` was installed there):

- `npm run test:types`, `npm run lint`, `npm run build`
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

## Known issues / notes

- Weighted passes: over-hitting has no downside yet, because the receiver always traps a pass (guaranteed first touch). Whether heavy passes should bounce off is the user's call.
- The Vite build warns that `game.js` is over 500 kB. That's Phaser (about 1.2 MB minified); harmless. The splash bundle stays tiny.
- Git has no commits: the machine has no git user.name/email set, so the initial commit failed. Set an identity, then commit per phase.
- `devvit.json` still has the template's "Example form" menu item (removed in Phase 5).
- Goal depth sorting is per layer, so in rare overlaps a player in front of the goal can be drawn behind the crossbar.
- Phaser Mesh has no canvas renderer, so the game requires WebGL.
- The ball's shadow is a simple oval (no light direction); fine for now.
- Away kickoff with no away team: the ball waits on the centre spot until a home player takes it.
- The far wall and near fence are still infinitely tall for the ball; only the end walls have a height (120) for the ball to clear.

## Next up

**Phase 3:**

- ~~Away team~~, ~~AI hand-over~~, ~~shared outfield AI~~, ~~AI carriers and tackles~~, ~~keepers and difficulty~~ (done, steps 1-5). **Next: step 6,** phone playtest in Reddit (all three levels; check frame rate with 10 players, control ownership after resets, both kickoff directions).
- **Open decision (user):** keep human keeper control, or make the keeper AI-only (both Phase 3 plans assume AI-only).
- **Switch boost:** 0.2 s speed boost toward the ball.

## Changelog

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
