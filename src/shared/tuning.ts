// Every gameplay number lives here, each with a short comment,
// so balancing never means hunting through code.
// Pixel sizes should be multiples of 4 (one art pixel) where they affect art.

export const VIEW = {
  width: 1280, // logical canvas width, scaled to fit the screen
  height: 720, // logical canvas height (16:9)
} as const;

export const SIM = {
  hz: 60, // fixed simulation rate, independent of render fps
  maxStepsPerFrame: 5, // cap catch-up steps after a long frame
} as const;

// World units are px on the ground plane: x along the pitch, y across it
// (0 = far touchline, height = near touchline), z up.
export const PITCH = {
  width: 2640, // playing area width, goals at left and right ends
  height: 1430, // playing area depth, wall along the far side, fence along the near side
  goalMouth: 300.3, // goal opening (+5% on 286, user request)
  goalDepth: 69.3, // how far the net reaches behind the goal line (+5%)
  goalHeight: 120.12, // crossbar height (+10%, then +5%)
  wallHeight: 160, // brick wall standing on the far touchline
  backdropHeight: 440, // wall plus the apartment facade above it
  endWallHeight: 138.6, // walls on each goal line, either side of the goal; scaled with the goal (+10%, +5%) so they stay ~15% above the crossbar
  wallThickness: 32, // depth of the solid walls (far wall and end walls), outward from the court
  fenceHeight: 96, // chain-link fence on the near touchline (see-through)
  groundPadX: 720, // street ground drawn beyond each goal line
  groundPadNear: 320, // pavement drawn beyond the near touchline
  centerCircle: 176, // centre circle radius
  boxDepth: 330, // big chalk box, depth from the goal line
  boxHeight: 660, // big chalk box, height
  goalAreaDepth: 110, // goalkeeper zone depth
  goalAreaHeight: 396, // goalkeeper zone height
} as const;

export const MATCH = {
  durationSec: 90, // regular time
  goldenGoalSec: 30, // extra time when level at full time
  kickoffFreezeSec: 1, // players frozen in formation before kickoff ...
  // ... then nothing moves and the clock waits until the kickoff pass
  // (user request): you press PASS ("PASS TO START"), or the CPU kicker
  // passes this long after the freeze.
  cpuKickoffSec: 0.8,
  goBannerSec: 0.6, // "GO!" shown after the kickoff pass
  goalHitStopSec: 0.3, // simulation frozen right after a goal
  celebrationSec: 2.5, // celebration before the reset
  slowMoSec: 1, // first part of the celebration runs in slow motion
  slowMoScale: 0.4, // slow-motion speed
  fullTimePauseSec: 1.8, // FULL TIME banner before the result screen
  goldenBreakSec: 2, // level at full time: the game pauses this long (GOLDEN GOAL banner), then a kickoff with a fresh goldenGoalSec clock
} as const;

// Formation spots for the home team (attacking right, x toward PITCH.width);
// the away team mirrors them.
export const FORMATION = {
  keeper: { x: 44, y: 715 },
  kickoffSpot: { x: 1296, y: 715 }, // kicker stays 24 px from the centred kickoff ball
  defendKickoffX: 1122, // defending forward waits outside the centre circle; mirrored for away
} as const;

// The outfield shapes a custom match can pick (2-1-1 is the default).
// Each slot has a line (TACTICS pushes / drops by line); the LAST slot is
// the forward: it takes the kickoff and is the CPU's outlet. Every other
// spot is in our half and outside the centre circle (176 px round 1320,
// 715): the forward is placed for kickoffs by kickoffSpot / defendKickoffX.
export type FormationLine = 'def' | 'mid' | 'fwd';
export type FormationSpot = { x: number; y: number; line: FormationLine };
export const FORMATIONS = {
  '2-1-1': [
    { x: 572, y: 462, line: 'def' }, // left back
    { x: 572, y: 968, line: 'def' }, // right back
    { x: 924, y: 715, line: 'mid' }, // midfielder
    { x: 1232, y: 715, line: 'fwd' }, // forward
  ],
  '1-2-1': [
    { x: 520, y: 715, line: 'def' }, // centre back
    { x: 880, y: 430, line: 'mid' }, // left mid
    { x: 880, y: 1000, line: 'mid' }, // right mid
    { x: 1232, y: 715, line: 'fwd' }, // forward
  ],
  '2-2': [
    { x: 572, y: 462, line: 'def' }, // left back
    { x: 572, y: 968, line: 'def' }, // right back
    { x: 1140, y: 470, line: 'fwd' }, // second striker, wide left
    { x: 1232, y: 900, line: 'fwd' }, // forward
  ],
  '1-1-2': [
    { x: 540, y: 715, line: 'def' }, // centre back
    { x: 880, y: 715, line: 'mid' }, // midfielder
    { x: 1150, y: 480, line: 'fwd' }, // second striker, wide left
    { x: 1232, y: 930, line: 'fwd' }, // forward
  ],
  '3-1': [
    { x: 560, y: 420, line: 'def' }, // left back
    { x: 500, y: 715, line: 'def' }, // centre back
    { x: 560, y: 1010, line: 'def' }, // right back
    { x: 1120, y: 715, line: 'fwd' }, // forward (outside the circle)
  ],
} as const satisfies Record<string, readonly FormationSpot[]>;

// Limits for a moderator's custom match (the post's settings form).
export const CUSTOM_MATCH = {
  minDurationSec: 30, // shortest match length offered
  maxDurationSec: 300, // longest (5:00)
  durationStepSec: 30, // lengths come in these steps
  maxStartGoals: 5, // most goals the AI can start with
  nameMaxLength: 10, // team label characters (fits the scoreboard)
  titleMaxLength: 120, // post title
  descriptionMaxLength: 200, // splash text under the title
} as const;

export const BALL = {
  radius: 10, // world px (drawn bigger than life so it reads on a phone)
  groundDrag: 0.35, // speed kept per second while rolling ...
  rollFriction: 40, // ... plus this constant slowdown (px/s^2), so a rolling ball comes to rest
  airDrag: 0.5, // speed kept per second in the air (full-power shot travels ~935 px in all, tap ~515)
  gravity: 1400, // px/s^2
  bounce: 0.4, // vertical speed kept on a bounce
  minBounceVz: 90, // slower landings stop bouncing
  wallBounce: 0.5, // speed kept off walls, fence and posts
  netBounce: 0.15, // the net soaks up a goal
  stopSpeed: 12, // a rolling ball slower than this stops
  postRadius: 6.93, // goal posts as circles on the ground plane; scaled with the goal (+5%)
  spinMinSpeed: 300, // only fast balls curve
  spinDecay: 0.3, // spin kept per second
  maxSpin: 0.3, // rad/s; with a typical shot this curves up to ~6 degrees
  deflectKeep: 0.2, // speed kept when a very fast ball hits a player
  inAirZoomHeight: 30, // ball higher than this (and fast) zooms the camera out
  inAirZoomSpeed: 450,
} as const;

export const POSSESSION = {
  controlRadius: 34, // feet-to-ball distance for gaining control
  maxControlHeight: 40, // ball must be lower than this (feet to chest)
  maxControlSpeed: 1000, // slower than this is controlled (passes, most shots), faster is deflected
  regainLockSec: 0.25, // after losing or releasing the ball
  receiveBonusRadius: 22, // the intended receiver of a pass gets a bigger first touch
  interceptRadius: 22, // an opponent cuts out a moving pass only this close to the ball (a loose ball: controlRadius) ...
  interceptFullBelow: 200, // ... until it has slowed under this (px/s): a dying pass is anyone's
  leash: 110, // the carrier loses the ball if it gets this far away
} as const;

// Close-control dribbling (FIFA-like): the ball sits just ahead of the feet,
// tapped forward in a small rhythm while jogging and knocked further ahead
// when sprinting. On turns it is dragged round the player in an arc.
export const DRIBBLE = {
  closeLead: 20, // ball distance from the feet when standing or creeping
  walkLead: 28, // at full jogging pace
  sprintLead: 42, // sprinting: the ball runs further ahead (more exposed)
  walkTouch: 5, // extra out-and-back on each touch while jogging (subtle taps)
  sprintTouch: 16, // knock-ons while sprinting
  touchEveryWalk: 0.3, // seconds between touches while jogging
  touchEverySprint: 0.22, // seconds between touches while sprinting
  swingRate: 620, // deg/s the ball can be dragged round the player on a turn
  settleRate: 12, // how quickly the ball eases to its distance (per second)
  cushionPerSpeed: 0.03, // first touch: a fast ball runs on this much per px/s ...
  cushionMax: 20, // ... up to this far, before settling back
} as const;

export const PASS = {
  windUpSec: 0.08, // between the press and the ball leaving
  arriveSpeed: 360, // a pass is struck so it still rolls at about this speed on arrival (was 170: slow passes were cut out; 230 -> 360, user: tap passes felt slow) ...
  minSpeed: 420, // ... clamped to this range (was 300)
  maxSpeed: 1200, // (was 1100)
  // Target: the NEAREST teammate inside a narrow cone around the stick; if
  // nobody is in it the cone widens step by step (then the whole circle).
  coneStepsDeg: [60, 110, 180, 360], // full cone widths tried in order
  leadFactor: 0.8, // aim at receiver position + velocity * travel time * this
  errorDeg: 1.5, // random aim error (the human's; the CPU's is x LEVELS.passErrorScale) ...
  pressureErrorDeg: 4, // ... grows to this with an opponent close by
  pressureRadius: 80,
  // Receive assist (user request: passes must reach their man). Control
  // moves to the receiver as the pass leaves, while the stick is still
  // pushed the way you passed, which used to run him away from the ball.
  // Now he comes to meet the ball until you steer him yourself: push the
  // stick again after centring it, or turn it this far from how it was
  // held when you passed.
  receiveAssist: true,
  assistTakeoverDeg: 40,
  // Receiver hold (user request): after a normal pass (not a through ball,
  // which is played into space to run onto), its intended receiver, of
  // either team and the human's player too, moves at most this fast until
  // the ball reaches it or this long has passed, so it waits for the ball
  // instead of running away from it. Small steps to meet it still work.
  receiveHoldSec: 1,
  receiveHoldSpeed: 80, // px/s, about a quarter of sprint speed
  chipLane: 60, // an opponent this close to the pass line turns it into a chip ...
  chipFromAhead: 30, // ... if the ball still has to pass it (this far along the line or more; not one beside or behind the passer)
  chipVz: 380, // vertical speed of a chip
  receiverStopBelow: 60, // the receiver stops running onto the pass once the ball is slower than this (px/s)
  // Weighted pass (user request): hold PASS to set the pace yourself. A tap
  // is the normal pass above (pace fitted to the distance); held, the charge
  // picks how far the ball rolls before slowing to arriveSpeed, so it can be
  // under-hit (stops short, run onto it) or over-hit (runs past). Target,
  // lead and aim error stay as above.
  weightTapSec: 0.12, // released faster than this = normal pass
  weightChargeSec: 0.9, // hold time for full pace (the charge fills from weightTapSec)
  weightMinDist: 100, // roll distance at the lightest weighted pass ...
  weightMaxDist: 1300, // ... and at full pace
  weightCurve: 1.5, // distance grows as charge^this: finer control of short passes
  weightMaxSpeed: 1150, // weighted passes may be struck harder than maxSpeed
  weightGoodBand: 0.09, // charge within this of the receiver's ideal = well weighted (gauge green)
} as const;

export const SHOOT = {
  tapSpeed: 900, // quick low shot
  fullSpeed: 1250, // fully charged (covers 450 px in ~0.43 s)
  chargeSec: 0.6, // hold time for a full charge
  tapMaxSec: 0.12, // released faster than this = tap shot
  tapLift: 120, // vertical speed of a tap shot
  fullLift: 600, // vertical speed of a full charge (was 420: only an inaccurate over-hit got high; now a green-zone strike from 350-450 px arrives ~50-87 high, the top corner; an over-hit goes over)
  // SKILL-BASED (user request: no help from the game). The ball leaves
  // exactly along the stick (the facing with the stick centred): no aim
  // assist, no snapping to the goal, no auto-ranging. Power = charge.
  // Accuracy comes from timing the release:
  sweetSpot: 0.8, // charge above this over-hits (the ring turns red): extra lift and error
  perfectBand: 0.2, // releasing within this below the sweet spot (green) = a perfect strike
  perfectErrorDeg: 0.5, // most a perfect strike strays
  normalErrorDeg: 2, // most any other strike strays ...
  overHitErrorDeg: 5, // ... plus this much at a full over-hit
  overHitLift: 180, // extra vertical speed at a full over-hit
  // Body shape (also skill: set yourself before you shoot):
  sprintErrorDeg: 3, // shooting while sprinting
  acrossErrorDeg: 5, // shooting straight back against the run (scales with the angle)
  pressureErrorDeg: 3, // an opponent within PASS.pressureRadius
  // Momentum (FIFA-like): the shooter's run feeds into the strike.
  runCarry: 0.5, // share of the run speed (along the shot) added to ball speed; negative when running away
  runLift: 0.35, // extra lift per px/s of run speed toward the shot (sprint shots fly higher)
  acrossPowerLoss: 0.3, // power lost shooting straight back against the run (scales with the angle)
  outRestartSec: 0.9, // after a ball goes over the bar, the defending keeper restarts after this
  followShotMaxSec: 4, // after a shot, control follows the outfielder closest to the loose ball for up to this long ...
  followShotMargin: 30, // ... switching only when another is this much closer (no flicker)
  // Swipe shots (PES-mobile layout, analog): while pressing SHOOT, slide
  // the thumb. Up = chip, down = power, left / right = curl. How FAR you
  // slide is how much of the effect the strike gets (diagonals mix, e.g. a
  // chipped curler). Hold to charge as usual; a flick works too.
  swipeDeadPx: 10, // screen px of thumb wobble ignored
  swipeFullPx: 70, // screen px of slide for the full effect
  // CHIP (up): blends the strike toward a lob. At a full swipe, charge sets
  // pace and loft, so you judge the distance yourself: first bounce about
  // 310 px at a tap, 700 px at the sweet spot, further when over-hit.
  chipMinSpeed: 450,
  chipMaxSpeed: 900, // at a full charge
  chipMinLift: 450,
  chipMaxLift: 750,
  chipErrorLess: 0.3, // stray reduced by this fraction at a full chip
  // CURL (left / right): sidespin bending the ball that way as the shooter
  // sees it. It leaves along the stick and bends away from that line, so
  // aim outside the post to bend it in; the longer it flies, the more it
  // bends.
  curlSpin: 1.1, // rad/s at a full swipe (decays with BALL.spinDecay)
  curlSpeedLoss: 0.2, // pace given up at a full curl
  curlLiftLoss: 0.25, // lift given up at a full curl
  curlErrorLess: 0.2, // stray reduced by this fraction at a full curl
  // POWER (down): a dipping rocket. Faster, struck with topspin that rises
  // then drops hard (extra gravity until it lands), less accurate;
  // over-hit still sends it over.
  powerSpeedGain: 0.22, // extra pace at a full swipe
  powerLiftGain: 0.3, // extra lift at a full swipe
  powerDip: 0.7, // extra gravity (fraction of normal) in the air, at a full swipe
  powerErrorMore: 0.4, // stray increased by this fraction at a full swipe
  powerOverHit: 0.3, // over-hit lift increased by this fraction at a full swipe
  // Finishing assist (human shots only, actions.assistedShotDirection):
  // a shot heading in or near the mouth is pulled toward the open side.
  assistRange: 700, // no assist from further than this from the goal centre ...
  assistFullRange: 400, // ... full assist this close (fading in between)
  assistMin: 0.1, // share of the way from the aimed spot to the open-side spot, random per shot from this ...
  assistMax: 0.9, // ... to this (the aim arrow shows the middle)
  assistInset: 45, // open-side spot this far inside the post
  assistMargin: 60, // also assists shots aimed this far outside the posts
  assistKeeperBand: 25, // aimed within this of the keeper: goes to the bigger gap
  trailMinSpeed: 650, // a free ball faster than this draws a trail
  aimArrow: true, // show the strike direction (not the target) while charging
} as const;

// Goalkeepers (systems/keeper.ts; both teams, and ours whenever the human
// isn't controlling it): positioning, claiming, rushing out, reaction dives
// and smothers, hands (catch / parry), distribution.
export const KEEPER = {
  reach: 38, // ground distance at which the keeper gets to the ball (was 40: shots just past it went in too rarely)
  reachHeight: 120, // highest ball it can reach while diving ...
  stretchReachHeight: 95, // ... down to this at a full-stretch dive (lower in between): top corners beat a long dive
  standReachHeight: 96, // ... and standing (just under the bar: a dropping chip can beat it)
  // Catch or parry: a ball slower than catchSureBelow is always caught;
  // faster, the catch chance falls to none at catchNoneAbove (parried
  // instead: rebounds), and is lower again while diving.
  catchSureBelow: 420,
  catchNoneAbove: 900,
  diveCatchFactor: 0.75, // x the catch chance in a dive (above catchSureBelow)
  parryKeep: 0.25, // speed kept on a parry
  holdSec: 1, // holds a caught ball this long before throwing it out
  throwSpeed: 560,
  throwLift: 160,
  lockAfterSec: 0.5, // ignores the ball this long after a parry or throw
  humanHoldMaxSec: 6, // a human-controlled keeper must release the ball within this
  kickSpeed: 900, // human keeper kick at full charge (hold KICK like a shot) ...
  kickMinSpeed: 520, // ... and at a tap
  kickLift: 420, // vertical speed of a full kick ...
  kickMinLift: 200, // ... and of a tapped one
  // KICK swipes (same swipes as SHOOT): up = high punt, down = driven
  // (fast and flat), left / right = curling kick.
  puntSpeedScale: 1.0,
  puntLiftScale: 1.5,
  driveSpeedScale: 1.3,
  driveLiftScale: 0.4,
  curlKickSpin: 0.9, // rad/s
  // Off its line (CPU keepers, and ours when not controlled): stands on the
  // line from goal centre toward the ball, further out the closer the ball.
  lineOut: 30, // px off the goal line with the ball far away ...
  maxOut: 60, // ... and with it close
  outFarDist: 1000, // ball this far from goal = lineOut
  outNearDist: 350, // ball this close = maxOut
  setAbove: 450, // a free ball faster than this (a shot): the keeper sets itself ...
  shuffleStick: 0.5, // ... side-stepping toward where it will cross at this stick (~140 px/s, a walk), until its dive ...
  shuffleDelay: 0.1, // ... starting only this long after it sees the shot (reading it; was at once, which smothered placed shots)
  // Keeper reaction dive (cpuKeeperReact): sees a shot coming, waits its
  // reaction time (LEVELS.keeperReactSec), then dives toward where it will
  // pass, as far as needed.
  reactJitter: 0.04, // reaction time +- up to this, random per reaction (borderline shots become a mix, not frame luck)
  reactMinSpeed: 300, // slower balls toward goal don't trigger a dive
  reactHorizonSec: 1.2, // ignores balls further away in time than this
  reactMargin: 30, // also reacts to shots this far outside the posts
  diveSpeed: 480, // px/s lunge when the human dives (B1 while controlling the keeper)
  diveSec: 0.35, // dive length in time (~170 px)
  diveRecoverSec: 0.45, // down on the ground after a dive, can't move
  diveReach: 64, // reach while diving (normally `reach`)
  // Jump save: a ball coming at the keeper too high to reach standing
  // (standReachHeight) but under jumpReachHeight: it jumps straight up
  // instead of diving. The AI times it so the top of the jump meets the
  // ball; ours jumps on the dive button with the stick centred.
  jumpSec: 0.5, // in the air this long ...
  jumpLandSec: 0.2, // ... then lands (can't move)
  jumpHeight: 18, // world px the body rises at the top (drawn)
  jumpReach: 48, // ground reach during the jump
  jumpReachHeight: 132, // highest ball it reaches at the top of the jump (bar 120)
  jumpLead: 0.25, // AI jumps when the ball is this many seconds away or less
  // Standing block: after a save made standing (catch or parry), and as a
  // standing tackle on a carrier right at its feet (instead of a smother
  // dive), the keeper plays its block pose, standing still.
  blockSec: 0.35,
  standTackleRange: 60, // a carrier this close (in its box): standing tackle ...
  standTackleReach: 50, // ... which takes the ball within this
  // Claiming: a loose ball the keeper reaches first, in or near its box.
  claimMargin: 0.15, // s it must beat every opponent by
  claimBoxMargin: 40, // the meeting point may be this far outside the box
  // Rushing out: an opposing carrier through on goal.
  rushDist: 450, // carrier this close to the goal centre (and nearer to goal than our outfielders) ...
  rushGap: 110, // ... the keeper comes out to this far from it (was 80: so close it blocked every angle) ...
  rushMax: 170, // ... at most this far off its line (staying in the box)
  smotherRange: 95, // dives at the ball of a carrier this close (in its box), after its reaction time
  // Distribution (a keeper holding the ball and not human-controlled).
  throwMinDist: 120, // throw candidates between these distances
  throwMaxDist: 800,
  throwOpenDist: 120, // a teammate with no opponent this close is open
  throwMinScore: 0.55, // best throw scoring below this: punt it long instead
  puntSpeed: 820, // a punt upfield
  puntLift: 520,
} as const;

// Outfield AI (Phase 3), one shared brain per team (systems/ai.ts). Each
// team re-assigns roles every think interval; players steer toward their
// role's target every step with the normal movement rules (same speeds,
// stamina and turning as the human).
export const AI = {
  // Formation: spots slide with the ball and with who has it. Kept low so
  // players hold their areas instead of everyone sliding to the ball (user
  // feedback: "it feels so overcrowded at times"; was 0.5 / 0.35).
  shiftX: 0.35, // spots move this fraction of the ball's offset from the centre (along the pitch) ...
  shiftY: 0.2, // ... and across it
  // (how far each slot pushes up with the ball / drops back without it is
  // the team's plan: TACTICS)
  attackWidth: 1.6, // with the ball spots also go this much further out from the middle (wide players near the touchlines)
  edgeMargin: 60, // spots stay this far inside the pitch
  // Reading the opponent's carrier: an AI reacts to where it was, how it
  // moved and faced LEVELS.readSec ago (user request: it followed every
  // feint at once), recorded up to this far back.
  readMaxSec: 0.5,
  // Calm movement (no fidgeting): a player standing at its spot only sets
  // off again once the spot is restartDist away, and spots glide to new
  // places (aimEaseRate per second) instead of jumping; a new job further
  // than aimSnapDist away is taken at once.
  restartDist: 45,
  settledSpeed: 15, // px/s: slower than this counts as standing at the spot
  aimEaseRate: 3,
  aimSnapDist: 250,
  posErrorSec: 3, // each player's positioning error (LEVELS.posError) is renewed about this often
  // Loose ball: one chaser per team (the quickest to reach it).
  chaseKeepSec: 0.25, // the current chaser keeps the job unless someone else is this much quicker
  interceptMaxSec: 2.5, // how far ahead the ball's roll is predicted
  chaseRelaxSec: 0.5, // no opponent can get there within this (s) of our chaser: it jogs (saves stamina)
  chaseLoseSec: 0.2, // an opponent this much quicker to it, in our half: the chaser takes a goal-side spot instead
  // Defending: one presser; a few markers near our goal; the rest hold zones
  // (zonal defence, not every player man-marking one of the attackers).
  // The presser contains, it doesn't shadow (user feedback: it followed the
  // carrier like a shadow and cut out every pass back). Its spot is worked
  // out when its team thinks (it reacts, it doesn't mirror every step) and
  // doesn't follow a carrier retreating toward its own goal.
  pressGap: 95, // the presser jockeys this far goal-side of a carrier on the move ...
  pressGapDeep: 170, // ... and this far off one deep in its own half (room to play out) ...
  pressDeepFrom: 1200, // ... from this far from the presser's goal line ...
  pressDeepFull: 1700, // ... fully from this far
  pressLeadSec: 0.4, // the presser aims where the carrier will be this soon (keeps its distance)
  pressKeep: 60, // the current presser keeps the job unless another is this much closer (px)
  humanPressDist: 130, // our human player this close to the carrier counts as our presser
  markGap: 50, // markers stand this far from their man, goal-side and toward the ball ...
  markSag: 0.12, // ... plus this much per px he is from the ball (tight near the ball, loose away from it) ...
  markGapMax: 170, // ... up to this
  markZone: 900, // only opponents this close to our goal line get a marker ...
  markZoneKeep: 120, // ... and a marked one keeps his marker until this much further out
  maxMarkers: 2, // at most this many markers; at least one other player always holds a zone
  zoneCompact: 0.2, // zone spots move this fraction toward the line from the ball to our goal (closing the middle; was 0.35)
  // Attacking: supporters spread into open space, the furthest forward runs ahead.
  openDist: 140, // a support spot this close to an opponent shifts away from them
  supportMinDist: 240, // supporters keep at least this far from the carrier
  spaceDist: 150, // teammates closer than this push their spots apart (cover / support / run / show)
  restGap: 110, // rest defence: our deepest player stays this far goal-side of their most advanced one ...
  restBehindBall: 150, // ... and at least this far behind the ball
  showPress: 0.35, // our carrier pressed this hard (pressureOn): the nearest teammate shows for the ball ...
  showDist: 200, // ... at a free spot this far from the carrier ...
  showClear: 90, // ... with no opponent this close to it ...
  showTries: 4, // ... trying the spots nearest that teammate first
  // After a pass the passer may burst forward for a return pass
  // (give-and-go): chance and from where up the pitch are the plan's
  // (TACTICS); the chance ramps up over this share of the pitch.
  giveGoRamp: 0.25,
  giveGoDist: 320, // the burst aims this far upfield ...
  giveGoInward: 0.25, // ... and this fraction of the way in toward the middle ...
  giveGoSec: 1.6, // ... for this long
  // Steering.
  arriveDist: 10, // within this of the target: stand (and face the ball)
  slowDist: 140, // closer than this the walk slows down toward the target
  sprintFar: 320, // sprint to a target further than this (any role)
  sprintChase: 60, // chasers / pressers sprint while further than this
  saveStaminaBelow: 30, // below this stamina only chasers / pressers sprint
  pressGapClose: 85, // gap to a slow carrier (pressGap at walking pace and above)
  // A carrier idle on the ball gets attacked (user request): standing
  // (slower than idleSpeed) this long, the presser goes in for the ball in
  // front of it and tackles more; longer, a second player closes in from
  // behind. Moving off faster than idleBreakSpeed ends it.
  idleSpeed: 40,
  idleBreakSpeed: 120,
  idleSec: 1.5,
  idleGap: 30, // the presser stands this far beyond the ball (DRIBBLE.closeLead in front of the carrier)
  idleTackleBoost: 2, // x the tackle chance (at most 0.95)
  idleDoubleSec: 2.5,
  // Counter-attack: for this long after winning the ball from the other
  // side, an AI carrier with space ahead runs straight at goal.
  counterSec: 3,
  counterSpace: 250, // ... with nobody within this ahead of it ...
  counterBonus: 0.35, // ... dribbling is worth this much more
  // Defending upgrades (user request, 2026-10-17):
  // (A) Recovery runs: a defender caught upfield of the ball (further than
  // LEVELS.recoverSlack) sprints back goal-side instead of walking to his
  // zone.
  recoverGoalSide: 40, // a recovering zone player aims at least this far goal-side of the ball
  // (B) Cover behind the presser, and handing over when he's beaten.
  beatenMargin: 20, // a player this far upfield of the carrier has been beaten (it got past him) ...
  beatenPenalty: 250, // ... and counts as this much further away when picking the presser (a goal-side teammate takes over)
  backupGap: 150, // the cover defender stands this far behind the presser's gap, on the line from the carrier to our goal ...
  backupMinFromGoal: 120, // ... never closer than this to our goal centre ...
  backupMinGap: 120, // ... and there is none if that leaves it less than this from the carrier (right at our goal: the keeper's job)
  // (C) Show him wide: the presser stands on the carrier's inside shoulder,
  // so the carrier is pushed toward the touchline, away from goal.
  showWide: 0.45, // the presser shifts this fraction of its gap toward the middle of the pitch ...
  showWideFull: 260, // ... fully with the carrier this far off the middle (none with him in the centre) ...
  showWideNear: 330, // ... none with him this close to our goal line (the box: straight goal-side) ...
  showWideFar: 560, // ... fully from this far
  // Tackles (the presser only, and only from the carrier's front or side:
  // from behind it gets goal-side first), checked each think (chance: LEVELS).
  tackleCooldownSec: 1, // after an attempt, at least this long before the next
  // Carrying (any AI player with the ball): a utility score per option,
  // each with some random variation (LEVELS.decisionNoise).
  carrySettleSec: 0.3, // first touch: no pass or shot sooner than this after gaining the ball
  shootRange: 760, // no shots from further than this from the goal centre
  // When to shoot (user request: not only from round the box; based on how
  // hard it is to score and on the situation): the shot's quality (0..1,
  // from distance, angle and how open the goal is) against what the moment
  // asks for: shotPatience with time and space (it works the ball closer:
  // a clinical finish), down to shotHurry when pressed, crowded or blocked
  // off (it shoots at once, from range too), x a random appetite per
  // possession. Roughly: unpressed it shoots from 250-440 px, pressed from
  // up to 600-670 px.
  shotNearDist: 150, // quality from distance: full this close ...
  shotFarDist: 800, // ... none from this far
  shotBlockedFactor: 0.3, // x quality with a defender in the shot line
  shotPatience: 0.55, // quality wanted with time and space ...
  shotHurry: 0.12, // ... and when fully pressed / crowded
  crowdDist: 160, // opponents this close count as a crowd (2 = half hurry, 3 = full)
  shotWayAhead: 140, // an opponent this close straight ahead toward goal blocks the way on ...
  shotBlockedHurry: 0.5, // ... = this much hurry
  appetiteMin: 0.7, // x the quality wanted, random per possession
  appetiteMax: 1.3,
  shotWeight: 1.1, // shoot score at exactly the quality wanted ...
  shotScoreCap: 1.6, // ... up to this many times that for a better chance
  shootInside: 30, // shot spots stay this far inside the posts
  shotPoints: 5, // spots across the goal mouth the AI picks its shot from (the most open one) ...
  shotPickNoiseDeg: 6, // ... with up to this much random preference
  shotClearMaxDeg: 45, // a spot's openness: the angle from its line to the nearest blocker, capped here ...
  shotClearDeg: 12, // ... and this much counts as fully open
  laneBlock: 35, // an opponent this close to the shot line blocks it
  shotCharge: 0.7, // aimed charge (middle of the perfect band), +- LEVELS.shotChargeNoise
  chipKeeperOut: 110, // chip the keeper when it is this far off its line ...
  chipMinGap: 140, // ... at least this far from the ball ...
  chipLateral: 70, // ... and this close to the shot line (in the way)
  chipClearance: 16, // the lob must pass this far above the keeper's standing reach ...
  chipUnderBar: 14, // ... and cross the goal line this far under the bar (or land within chipLandShort of it)
  chipLandShort: 80,
  chipChargeMin: 0.2, // charges tried, from this up to the sweet spot ...
  chipChargeStep: 0.05, // ... in these steps
  chipNoise: 0.4, // x LEVELS.shotChargeNoise: charge spread on a chip
  chipScore: 1.1, // base score of a chip (up to 0.4 more the further out the keeper)
  passMin: 100, // pass candidates between these distances
  passMax: 750,
  passLaneSafe: 60, // a pass lane this clear (px) counts as fully safe
  throughMinRun: 150, // through balls only to a teammate running upfield at least this fast ...
  throughAhead: 50, // ... aimed this far beyond where it will be when the ball arrives (and it must get there TACTICS.throughMargin s before any opponent)
  throughEdge: 70, // through-ball spots stay this far inside the pitch
  // Pressure on a carrier (pressureOn): how soon an opponent could be on it.
  // A jockeying presser counts a little, one sprinting in a lot; opponents
  // already in a tackle don't count (passing every time a tackle started
  // made tackles useless).
  pressureReach: 40, // px: closer than this counts as already there
  pressureBaseSpeed: 165, // px/s an opponent is taken to close at from standing ...
  pressureClosing: 0.35, // ... plus this share of how fast it is already closing in
  pressureSec: 0.12, // there this soon = full pressure (a standing opponent ~60 px away) ...
  pressureFarSec: 0.2, // ... none from this
  dribbleLook: 200, // dribble target this far ahead
  dribbleSprintSpace: 220, // sprint with the ball when the way ahead is this clear
  cutInFrom: 0.45, // dribble straight upfield before this share of the pitch, then cut in toward goal ...
  cutInFull: 0.8, // ... fully from this
  avoidDist: 200, // opponents this close (ahead and to the sides) turn the dribble away from them ...
  avoidTurnDeg: 70, // ... this much per unit of (distance-weighted) closeness ...
  avoidMaxDeg: 50, // ... at most this much
  dribbleBlend: 0.55, // each think the dribble direction turns this fraction toward the new choice (no zig-zag)
  clearCharge: 0.6, // a clearance: the normal shot at this charge ...
  clearChip: 0.7, // ... with this much swipe-up (lofted over players)
} as const;

// Team game plans (TeamBrain style). Our AI teammates play the attacking
// plan (user request: "make our teammates more attacking, the whole plan
// more aggressive; attackers go ahead when we have the ball and track back
// otherwise, defenders and the midfielder come forward too"); the CPU plays
// the balanced plan (as before). Pushes and drops are per formation line
// (FORMATIONS: defenders, midfielders, forwards).
export const TACTICS = {
  attacking: {
    pushAttack: { def: 330, mid: 420, fwd: 480 }, // with the ball, each slot's spot goes this far upfield (defenders to about halfway, the forward high) ...
    dropDefend: { def: 110, mid: 200, fwd: 260 }, // ... without it, this far back (everyone tracks back, the forward too)
    outletForward: false, // defending: the forward tracks back (no outlet left up)
    runAhead: 340, // the forward runs at least this far ahead of the ball (or its pushed-up spot if further)
    giveGoChance: 0.85, // after a pass, chance the passer bursts forward for a return pass ...
    giveGoFrom: 0.2, // ... none before this share of the pitch (full chance AI.giveGoRamp further up)
    throughMargin: 0.08, // through balls when the runner gets there this many s before any opponent (riskier)
    passProgress: 0.7, // pass score per unit of forward progress (more forward passes)
    pressHigh: true, // presses close even deep in the carrier's own half (no AI.pressGapDeep)
    pressGapScale: 0.85, // x the presser's gap (tighter)
  },
  balanced: {
    pushAttack: { def: 140, mid: 140, fwd: 140 },
    dropDefend: { def: 100, mid: 100, fwd: 100 },
    outletForward: true, // defending: the forward stays up (an outlet, one body fewer round the ball)
    runAhead: 280,
    giveGoChance: 0.6,
    giveGoFrom: 0.3,
    throughMargin: 0.15,
    passProgress: 0.5,
    pressHigh: false,
    pressGapScale: 1,
  },
} as const;

// Difficulty: how sharp the CPU team is (our AI teammates and our keeper
// always play at normal). Same movement, physics and rules at every level
// (no speed boosts or guaranteed saves): only reaction, decisions,
// accuracy and positioning change.
export const LEVELS = {
  easy: {
    thinkSec: 0.3, // re-thinks this often (reaction)
    readSec: 0.35, // reacts to the opponent's carrier as it was this long ago (feints and sudden turns fool it)
    tackleChance: 0.25, // presser goes in, per think while in range
    shotChargeNoise: 0.25, // shot charge spread around AI.shotCharge
    decisionNoise: 0.25, // option scores x (1 +- this): worse choices
    passErrorScale: 2.6, // x PASS.errorDeg (the human's, halved when passing was made easier: the CPU's stays as it was)
    passReactSec: 0.45, // the opponent's pass is only seen this long after it is struck
    aimSpread: 110, // shots aimed up to this much in from the AI.shootInside spot toward the centre (keeper-side misses)
    markGapScale: 1.5, // x AI.markGap: looser marking
    posError: 70, // px each player's spot is off by at most (renewed every AI.posErrorSec): natural gaps
    recoverSlack: 150, // px a defender may be upfield of the ball before he sprints back goal-side (AI recovery runs)
    keeperReactSec: 0.5, // keeper reaction to a shot / a carrier through on goal (+- KEEPER.reactJitter)
    keeperDiveError: 30, // px a keeper's dive may fall short or overshoot by
  },
  normal: {
    thinkSec: 0.2,
    readSec: 0.25,
    tackleChance: 0.45,
    shotChargeNoise: 0.12,
    decisionNoise: 0.1,
    passErrorScale: 2,
    passReactSec: 0.32,
    aimSpread: 70,
    markGapScale: 1,
    posError: 30,
    recoverSlack: 60,
    keeperReactSec: 0.4,
    keeperDiveError: 12,
  },
  hard: {
    thinkSec: 0.12,
    readSec: 0.15,
    tackleChance: 0.65,
    shotChargeNoise: 0.05,
    decisionNoise: 0.05,
    passErrorScale: 1.4,
    passReactSec: 0.22,
    aimSpread: 40,
    markGapScale: 0.85,
    posError: 12,
    recoverSlack: 20,
    keeperReactSec: 0.32,
    keeperDiveError: 5,
  },
} as const;

// Tackles (B1 without the ball, and the AI's presser). Start-up, then a
// lunge (active), then recovery. During the lunge the ball of an opposing
// carrier within reach in front is contested: a success chance with
// modifiers decides (a juke dodges it). Win: the ball pops out, the carrier
// staggers, the tackler has first touch for a moment. Fail: a stumble.
export const TACKLE = {
  windupSec: 0.1, // start-up (no contact yet)
  activeSec: 0.15, // the lunge, when contact counts
  recoverSec: 0.35, // after a lunge that touched nothing
  lungeDist: 70, // px covered by the lunge
  reach: 48, // ball within this of the tackler ...
  arcDeg: 70, // ... and within this of the lunge direction = contact
  baseChance: 0.55, // success chance on contact, plus:
  frontBonus: 0.15, // coming from the carrier's front or side ...
  behindPenalty: 0.3, // ... or minus this from behind
  frontArcDeg: 110, // tackler within this of the carrier's facing = front / side
  carrierSprintPenalty: 0.15, // the carrier was sprinting (harder to catch)
  tacklerSprintBonus: 0.1, // the tackler went in at a sprint
  jukeDeg: 90, // carrier's stick turned this much since the tackle started = dodged (was 120: hard to fake, user feedback)
  popSpeed: 110, // won: the ball is knocked loose at this speed ...
  popAhead: 40, // ... toward the point this far ahead of the tackler on its lunge line
  staggerSec: 1.0, // ... the carrier falls and gets up (cannot move or touch the ball); was 0.5, raised so the 8-pose fall reads (user choice)
  priorityTackleSec: 0.35, // ... and the tackler has first touch this long
  winRecoverSec: 0.1, // won: back on its feet this soon
  stumbleSec: 0.6, // failed: down this long
  kickoffGraceSec: 0.5, // no AI tackles this soon after kickoff
} as const;

export const INPUT = {
  bufferSec: 0.15, // a button press is remembered this long
  bufferNearBall: 60, // only buffer a pass/shot press when the ball is this close
  switchCycleSec: 1, // switch presses within this cycle to the next nearest
  switchCooldownSec: 0.12, // ignore switch presses closer together than this
  keeperHoldSec: 0.35, // holding SWITCH this long jumps straight to our keeper
  keeperThreatSpeed: 250, // a ball moving toward our goal this fast (in our third) makes SWITCH pick the keeper first
  lostBallSwitchSec: 4, // after the CPU tackles the ball off our player: for this long (or until we win it back) SWITCH picks the outfielder who can reach the ball soonest...
  chaseAssist: true, // ... and that player runs at the ball by himself until the human steers him (as the receive assist)
} as const;

export const PLAYER = {
  radius: 14, // feet radius for keeping players inside the pitch
  bodyRadius: 16, // players closer than twice this push each other apart
  walkSpeed: 220, // px/s at full walk (stick just under the sprint ring)
  sprintSpeed: 330, // px/s while sprinting
  walkWithBallSpeed: 205, // px/s while dribbling
  sprintWithBallSpeed: 290, // px/s while dribbling at a sprint
  minWalkFraction: 0.25, // walk speed just outside the dead zone, as a fraction of walkSpeed
  // Momentum (FIFA-like): speed ramps up and down, turns curve at speed.
  accel: 1500, // px/s^2 speeding up (0 -> jog in ~0.15 s)
  accelWithBall: 1150, // a touch slower with the ball
  decel: 1800, // px/s^2 slowing down / stopping
  turnRateSlow: 900, // deg/s turning at jogging pace and below
  turnRateFast: 380, // deg/s turning at full sprint (wider arcs)
  turnWithBallFactor: 0.85, // turning is a little slower with the ball
  pivotBelowSpeed: 70, // px/s; slower than this the player pivots on the spot ...
  pivotRate: 1080, // ... at this rate (deg/s)
  slowTurnFromDeg: 45, // heading error where the player starts easing off ...
  stopTurnAtDeg: 150, // ... to a plant-and-turn stop at this error (sharp turns brake)
} as const;

export const STAMINA = {
  max: 100, // full stamina
  drainPerSec: 12.3, // while sprinting (about 8 s from full; was 16 / ~6 s: +30% stamina for everyone, user request)
  regenPerSec: 30, // after the regen delay
  regenDelaySec: 0.4, // pause after sprinting before stamina refills
  trailingRegen: 1.15, // fairness: the team behind on the scoreboard refills this much faster
  unlockAt: 20, // after hitting 0, sprint stays locked until stamina reaches this
} as const;

export const STICK = {
  radius: 112, // joystick radius in screen px
  deadZone: 0.12, // fraction of radius ignored around the centre
  sprintAt: 0.85, // fraction of radius past which the player sprints
} as const;

// Spectators behind the near fence. Per row: about 2640 / (minGap + extraGap / 2).
export const CROWD = {
  minGap: 70, // world px between neighbours at least
  extraGap: 40, // plus up to this much random extra (avg spacing 90 -> ~29 per row)
} as const;

// Broadcast camera: sits above the near touchline looking at the pitch with
// perspective, like a TV football camera. It pans to keep the focus point
// (on the ground) in the centre of the screen.
export const CAMERA = {
  tiltDeg: 35, // how far the camera looks down from horizontal
  fovDeg: 40, // vertical field of view
  focusScale: 0.85, // screen px per world px at the focus point (sets camera distance)
  nearClip: 60, // world px; anything closer to the camera is clamped
  focusMinX: PITCH.width / 6, // follow limits proportional to pitch dimensions
  focusMaxX: (PITCH.width * 5) / 6,
  focusMinY: (PITCH.height * 4) / 13,
  focusMaxY: (PITCH.height * 48) / 65, // preserve the near-touchline framing on resized pitches
  ballWeight: 0.6, // follow point = ballWeight * ball + (1 - ballWeight) * controlled player
  lookAhead: 120, // world px ahead of the ball in its direction of travel
  lookAheadFullSpeed: 300, // ball speed (px/s) at which the full look-ahead applies
  followSec: 0.35, // the focus eases onto its target in about this long (smooth, no steps)
  lookAheadSmoothSec: 0.45, // look-ahead is filtered over about this long, so taps and turns cannot jolt it
  zoom: 1, // default zoom (was 1: zoomed out a little, less crowded on screen)
  airZoom: 0.84, // zoom while the ball is in the air on a long pass or shot (Phase 2)
  zoomReturnSec: 0.6, // time to ease back to the default zoom
  celebrateZoom: 1.6, // goal celebration: the camera closes in on the scorer ...
  celebrateLift: 80, // ... aiming this far beyond its feet (world px), so the whole body is centred
} as const;
