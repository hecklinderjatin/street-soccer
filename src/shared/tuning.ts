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
  width: 2400, // playing area width, goals at left and right ends
  height: 1300, // playing area depth, wall along the far side, fence along the near side
  goalMouth: 260, // goal opening
  goalDepth: 60, // how far the net reaches behind the goal line
  goalHeight: 104, // crossbar height (about 1.35x a player once perspective is applied)
  wallHeight: 160, // brick wall standing on the far touchline
  backdropHeight: 440, // wall plus the apartment facade above it
  endWallHeight: 120, // walls on each goal line, either side of the goal
  wallThickness: 32, // depth of the solid walls (far wall and end walls), outward from the court
  fenceHeight: 96, // chain-link fence on the near touchline (see-through)
  groundPadX: 720, // street ground drawn beyond each goal line
  groundPadNear: 320, // pavement drawn beyond the near touchline
  centerCircle: 160, // centre circle radius
  boxDepth: 300, // big chalk box, depth from the goal line
  boxHeight: 600, // big chalk box, height
  goalAreaDepth: 100, // goalkeeper zone depth
  goalAreaHeight: 360, // goalkeeper zone height
} as const;

export const MATCH = {
  durationSec: 90, // regular time
  goldenGoalSec: 30, // extra time when level at full time
  kickoffFreezeSec: 1, // players frozen in formation before kickoff
  goBannerSec: 0.6, // "GO!" shown after the freeze
  goalHitStopSec: 0.3, // simulation frozen right after a goal
  celebrationSec: 2.5, // celebration before the reset
  slowMoSec: 1, // first part of the celebration runs in slow motion
  slowMoScale: 0.4, // slow-motion speed
  fullTimePauseSec: 1.8, // FULL TIME banner before the result screen
  goldenBannerSec: 1.5, // GOLDEN GOAL banner when extra time starts
} as const;

// Formation spots for the home team (attacking right, x toward 2400),
// a 2-1-1 shape plus the keeper. The away team mirrors these in Phase 3.
export const FORMATION = {
  keeper: { x: 40, y: 650 },
  outfield: [
    { x: 520, y: 420 }, // left back
    { x: 520, y: 880 }, // right back
    { x: 840, y: 650 }, // midfielder
    { x: 1120, y: 650 }, // forward
  ],
  kickoffSpot: { x: 1176, y: 650 }, // kicker's spot next to the ball when kicking off
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
  postRadius: 6, // goal posts as circles on the ground plane
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
  receiveBonusRadius: 10, // the intended receiver of a pass gets a bigger first touch
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
  arriveSpeed: 170, // a pass is struck so it still rolls at about this speed on arrival ...
  minSpeed: 300, // ... clamped to this range
  maxSpeed: 950,
  // Target: the NEAREST teammate inside a narrow cone around the stick; if
  // nobody is in it the cone widens step by step (then the whole circle).
  coneStepsDeg: [60, 110, 180, 360], // full cone widths tried in order
  leadFactor: 0.8, // aim at receiver position + velocity * travel time * this
  errorDeg: 3, // random aim error ...
  pressureErrorDeg: 8, // ... grows to this with an opponent close by
  pressureRadius: 80,
  chipLane: 60, // an opponent this close to the pass line turns it into a chip
  chipVz: 380, // vertical speed of a chip
  receiverStopBelow: 60, // the receiver stops running onto the pass once the ball is slower than this (px/s)
} as const;

export const SHOOT = {
  tapSpeed: 900, // quick low shot
  fullSpeed: 1250, // fully charged (covers 450 px in ~0.43 s)
  chargeSec: 0.6, // hold time for a full charge
  tapMaxSec: 0.12, // released faster than this = tap shot
  tapLift: 120, // vertical speed of a tap shot
  fullLift: 420, // vertical speed of a full charge (about 46 high by 450 px, standing)
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
  trailMinSpeed: 650, // a free ball faster than this draws a trail
  aimArrow: true, // show the strike direction (not the target) while charging
} as const;

// Phase 2 stand-in keeper: stands on the goal line, catches slow balls and
// parries fast ones. Phase 3 replaces it with the real goalkeeper AI.
export const KEEPER = {
  reach: 40, // ground distance at which the keeper gets to the ball
  reachHeight: 120, // highest ball it can reach while diving ...
  standReachHeight: 96, // ... and standing (just under the bar: a dropping chip can beat it)
  parryAbove: 650, // faster balls are parried, slower ones caught
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
  setAbove: 450, // a free ball faster than this (a shot): the keeper holds its position
  // CPU keeper reaction dive (cpuKeeperReact): sees a shot coming, waits
  // reactSec, then dives toward where it will pass, as far as needed.
  reactSec: 0.35,
  reactMinSpeed: 300, // slower balls toward goal don't trigger a dive
  reactHorizonSec: 1.2, // ignores balls further away in time than this
  reactMargin: 30, // also reacts to shots this far outside the posts
  diveSpeed: 480, // px/s lunge when the human dives (B1 while controlling the keeper)
  diveSec: 0.35, // dive length in time (~170 px)
  diveRecoverSec: 0.45, // down on the ground after a dive, can't move
  diveReach: 64, // reach while diving (normally `reach`)
} as const;

export const INPUT = {
  bufferSec: 0.15, // a button press is remembered this long
  bufferNearBall: 60, // only buffer a pass/shot press when the ball is this close
  switchCycleSec: 1, // switch presses within this cycle to the next nearest
  switchCooldownSec: 0.12, // ignore switch presses closer together than this
  keeperHoldSec: 0.35, // holding SWITCH this long jumps straight to our keeper
  keeperThreatSpeed: 250, // a ball moving toward our goal this fast (in our third) makes SWITCH pick the keeper first
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
  drainPerSec: 16, // while sprinting (about 6 s from full)
  regenPerSec: 30, // after the regen delay
  regenDelaySec: 0.4, // pause after sprinting before stamina refills
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
  focusMinX: 400, // focus point limits, so the view stays on the court
  focusMaxX: 2000,
  focusMinY: 400,
  focusMaxY: 960, // near touchline sits ~80% down the screen at this limit
  ballWeight: 0.6, // follow point = ballWeight * ball + (1 - ballWeight) * controlled player
  lookAhead: 120, // world px ahead of the ball in its direction of travel
  lookAheadFullSpeed: 300, // ball speed (px/s) at which the full look-ahead applies
  followSec: 0.35, // the focus eases onto its target in about this long (smooth, no steps)
  lookAheadSmoothSec: 0.45, // look-ahead is filtered over about this long, so taps and turns cannot jolt it
  zoom: 1, // default zoom
  airZoom: 0.88, // zoom while the ball is in the air on a long pass or shot (Phase 2)
  zoomReturnSec: 0.6, // time to ease back to the default zoom
} as const;
