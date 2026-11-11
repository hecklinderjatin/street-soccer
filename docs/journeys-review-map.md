# Street Soccer: proposed Journeys map

Status: implemented for review, **enabled by default at the app owner’s request**. This document does not
claim Reddit approval or allowlisting. No review request has been submitted by
the implementation.

One journey represents one intentionally started match attempt. The feed's AI
preview, opening settings, reading the briefing, and canceled presses never
start a journey. A fresh ID is requested for every rematch.

| Moment                                                                                                      | SDK event                                   | Custom data                                                               |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| Interactive lobby, settings, or match briefing is ready (once per page)                                     | `App.Ready`                                 | None                                                                      |
| Player releases Play Match on the initial controls page, or commits to a later play/settings/rematch button | `Journey.Start`, then `Journey.Interaction` | `match_started` or `rematch_started`; fixed settings below                |
| A terminal match result is reached, including a failed challenge                                            | `Journey.Interaction`, then `Journey.End`   | `match_completed`; outcome, goals for/against, elapsed live-clock seconds |
| Player releases Quit in the pause menu of a started match                                                   | `Journey.Interaction`, then `Journey.End`   | `match_quit`; the same bounded outcome/score/time fields                  |

For this map, `complete: true` means the **attempt finished and reached results**,
not that the player won. `game.win` separately records a win/challenge clear;
`game.score` is the player's final goals in normal matches, or final points in Free Kick Challenge/Infinity. Explicit quits use `complete: false`
and omit `game`. The `outcome` value distinguishes win/loss/draw/cleared/failed/completed/quit.
There are no progress events or per-input events in this version.

## Free Kick lifecycle

Challenge, Infinity and Practice use the same tracker as normal matches. Reading either
briefing page or choosing a Practice level does not start an attempt. Releasing
START GAME or PLAY starts it; the first shot is a guarded fallback. Challenge
ends once on clear/failure, with points as SDK game score. Infinity ends on exhausted lives as `completed`, with `complete:true`, `game.win:false` and final points. Its start metadata uses `freekick-infinity`, initial Easy/level 2, zero goal target and creator-defined lives. Practice ends only
on explicit Quit/Restart, as incomplete (`outcome: quit`, no SDK game result).
Practice retries and New Spot keep the same journey and remain unranked.
Pause/help do not end or duplicate attempts. Restart ends the current started
attempt as quit; Restart/Play Again prepare a fresh tracker and wait for the
next explicit start. No shot-by-shot progress events are emitted.

## Allowed custom fields

- `mode`: classic, daily (legacy), casual, comeback, shield, rampage, chaos,
  freekick-challenge, freekick-practice, freekick-infinity.
- `difficulty`: noob, easy, normal, hard, pro, rising (Rampage).
- `durationSec`: configured integer, 30–300 for normal matches; 0 for untimed Free Kick.
- Free Kick start fields: `level` 1–10, `goalTarget` 1–20 and `lives` 1–10
  for Challenge. Infinity uses target 0 and positive lives. Practice uses its selected level and zero target/lives (unlimited).
- `rematch`: boolean; true for rematches and Free Kick restarts after the first attempt.
- `outcome`: win, loss, draw, cleared, failed, completed (Infinity), quit.
- `goalsFor` / `goalsAgainst`: integers, 0–99 for normal matches. Free Kick uses
  goals/misses respectively, bounded to 100,000; `points` is an integer 0–60,000,000.
  Free Kick results include their fixed `mode` to select the appropriate schema.
- `elapsedSec`: live match-clock seconds, integer 0–330 including Classic/Casual
  golden goal; excludes pauses and goal celebrations. Free Kick uses active game
  seconds (including between-shot play), bounded to 86,400; paused panels stop its clock.

The backend rebuilds these fields from an allowlist. It does not forward raw
request JSON. Action names are fixed in server code and details contain only
the fields above. No team names, usernames, Reddit IDs, comments, free text,
device identifiers, formations or individual button/movement events are added
to custom fields. Reddit's SDK supplies its standard app/installation/user/post
context independently; this is not anonymous analytics.

## Boundaries and failure behavior

- Only the Reddit analytics SDK (`@devvit/analytics/server/reddit`) emits events.
  Hono routes adapt our small event vocabulary; no generic interaction endpoint
  is exposed. No PostHog collector is configured or imported by the game.
- IDs exist only inside the active attempt's in-memory tracker. No analytics
  cookies, localStorage, sessionStorage, custom Redis records or user profiles
  are created by this integration.
- Analytics does not affect scoring, completed-game counting, leaderboards or
  gameplay. Client requests run in the background, time out after two seconds,
  and are not retried. An unapproved/denied start produces no subsequent events.
- Each client attempt starts/ends at most once. Late replies stay attached to
  their own attempt rather than a rematch. Reddit handles server receipt
  validation, contextual attribution and platform limits.
- Closing, refreshing, losing connection or backgrounding the app is not
  classified as an explicit quit. An interrupted attempt may have no end event.
- Gameplay numbers are client-reported analytics, not an authoritative record
  for rankings or rewards. Reddit manages platform telemetry and its retention;
  our existing deletion action continues to cover the app's own Redis records.

## Review and activation

1. Submit this map through Reddit's Journeys review process and obtain approval
   and app allowlisting. Confirm the current submission channel with Reddit's
   developer team; the documentation does not specify it.
2. Normal builds now enable Journeys in both client and server.
   `permissions.journeys` is declared in `devvit.json`. Reddit still gates
   ingestion: non-allowlisted starts are dropped and produce no follow-up events.
   A deployed enabled build can begin receiving accepted receipts after approval
   without another code toggle.
3. Verify acceptance on the approved app. Playtest versions may receive the
   SDK's `JOURNEY_RECEIPT_DENIED_PLAYTEST` status; local mocks cannot establish
   live telemetry readiness. Deployment, publishing and review submission are
   separate from this code change.
4. To disable, explicitly set `STREET_SOCCER_JOURNEYS_ENABLED=false` and
   rebuild/redeploy both client and server. Disabled builds send no Journeys
   requests; the backend also returns empty responses without invoking the SDK.

Local checks: `npm run test:freekick-infinity-browser` covers the Infinity entry’s start, progression, continued Pro play, terminal save/boards, replay/restart/quit and Journeys using mocked endpoints. `npm run test:freekick-journeys-browser` serves actual Free Kick
source with mocked endpoints, checking Challenge/Practice start, pause, New Spot,
restart, results, replay, explicit quit and denied receipts without an app build.
`npm run test:journeys` covers the Hono/SDK boundary with a mock
transport. `npm run test:journeys-browser` tests a running normal (enabled) build,
including rejection, offline and timeout handling. It intercepts all telemetry
routes, so no analytics reaches Reddit. To verify the kill switch, build with
`STREET_SOCCER_JOURNEYS_ENABLED=false npm run build`, then run
`EXPECT_JOURNEYS=false npm run test:journeys-browser`. Restore a normal build
after testing.

Sources: [Devvit Journeys](https://developers.reddit.com/docs/capabilities/analytics/devvit-journeys)
and its [official documentation source](https://github.com/reddit/devvit-docs/blob/main/docs/capabilities/analytics/devvit-journeys.md),
plus the installed `@devvit/analytics@0.15.3` API.
