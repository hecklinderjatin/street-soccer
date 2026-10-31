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
`game.score` is the player's final goals. Explicit quits use `complete: false`
and omit `game`. The `outcome` value distinguishes win/loss/draw/cleared/failed/quit.
There are no progress events or per-input events in this version.

## Allowed custom fields

- `mode`: classic, daily (legacy), casual, comeback, shield, rampage, chaos.
- `difficulty`: noob, easy, normal, hard, pro, rising (Rampage).
- `durationSec`: configured integer, 30–300.
- `rematch`: boolean, true only for the result screen's rematch action.
- `outcome`: win, loss, draw, cleared, failed, quit.
- `goalsFor` / `goalsAgainst`: integers, 0–99.
- `elapsedSec`: live match-clock seconds, integer 0–330 including Classic/Casual
  golden goal; excludes pauses and goal celebrations.

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

Local checks: `npm run test:journeys` covers the Hono/SDK boundary with a mock
transport. `npm run test:journeys-browser` tests a running normal (enabled) build,
including rejection, offline and timeout handling. It intercepts all telemetry
routes, so no analytics reaches Reddit. To verify the kill switch, build with
`STREET_SOCCER_JOURNEYS_ENABLED=false npm run build`, then run
`EXPECT_JOURNEYS=false npm run test:journeys-browser`. Restore a normal build
after testing.

Sources: [Devvit Journeys](https://developers.reddit.com/docs/capabilities/analytics/devvit-journeys)
and its [official documentation source](https://github.com/reddit/devvit-docs/blob/main/docs/capabilities/analytics/devvit-journeys.md),
plus the installed `@devvit/analytics@0.15.1` API.
