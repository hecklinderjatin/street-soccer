// Injected before the game loads (Playwright addInitScript) on ?film pages.
// Makes a match reproducible and frame-steppable for the trailer:
// - Math.random is a seeded generator (reseeded when a match starts)
// - performance.now and requestAnimationFrame run on a virtual clock that
//   only moves when the recorder calls __film.step, so every video frame is
//   exactly one step of game time, however slow the machine renders
// - an event log of the match (kicks, passes, shots, saves, tackles, goals)
(() => {
  let state = 1;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = random;

  let now = 0;
  performance.now = () => now;
  let queue = [];
  window.requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  window.cancelAnimationFrame = () => {};
  // While booting, Phaser's own loop runs on the virtual clock. From the
  // first match on, its loop is stopped and the game is stepped directly
  // with the exact frame time: Phaser's TimeStep smooths deltas and clamps
  // them while the page is "unfocused", which made runs differ.
  let direct = false;
  const tick = (ms) => {
    now += ms;
    if (direct) {
      window.__game.step(now, ms);
      return;
    }
    const callbacks = queue;
    queue = [];
    for (const cb of callbacks) cb(now);
  };

  const game = () => window.__game;
  const match = () => game()?.scene.getScene('Match');

  let frame = 0;
  let events = [];
  let prev = null;
  let demoSet = false;
  let hudClean = false;
  const teamOf = (p) => (p ? p.team : null);
  const idOf = (s, p) => (p ? s.everyone.indexOf(p) : -1);

  // One snapshot per video frame; events are the differences.
  function record(s) {
    const b = s.ball;
    const cur = {
      owner: b.owner,
      strikes: b.strikes,
      pendingShot: b.pendingShot,
      score: s.flow.score.home + s.flow.score.away,
      tackles: s.everyone.map((p) => p.tackleAt),
      celebrating: s.everyone.some((p) => p.celebrating),
    };
    const e = (type, data) => events.push({ f: frame, t: s.simTime, type, ...data });
    if (prev) {
      if (cur.strikes !== prev.strikes)
        e('kick', { team: teamOf(prev.owner), by: idOf(s, prev.owner), speed: Math.round(b.speed), z: Math.round(b.z) });
      if (cur.owner !== prev.owner && cur.owner)
        e('gain', {
          team: cur.owner.team,
          by: idOf(s, cur.owner),
          keeper: cur.owner.role === 'keeper',
          holding: cur.owner.holding,
        });
      if (cur.pendingShot && !prev.pendingShot)
        e('shot', { team: teamOf(prev.owner) ?? teamOf(b.lastTouch), speed: Math.round(b.speed), z: Math.round(b.z), vz: Math.round(b.vz ?? 0) });
      if (!cur.pendingShot && prev.pendingShot && cur.score === prev.score) {
        const keepers = [s.homeKeeper, s.awayKeeper];
        const k = keepers.find(
          (k) =>
            k === cur.owner ||
            s.simTime - k.diveAt < 1.2 ||
            s.simTime - k.jumpAt < 1.2 ||
            s.simTime - k.blockAt < 1.2
        );
        e('shotEnd', {
          save: !!k,
          keeper: k ? k.team : null,
          dive: k ? s.simTime - k.diveAt < 1.2 : false,
          x: Math.round(b.x),
          y: Math.round(b.y),
        });
      }
      cur.tackles.forEach((at, i) => {
        if (at !== prev.tackles[i]) e('tackle', { team: s.everyone[i].team, by: i, carrier: idOf(s, prev.owner) });
      });
      if (cur.score > prev.score)
        e('goal', { home: s.flow.score.home, away: s.flow.score.away });
      if (cur.celebrating && !prev.celebrating) e('celebrate', {});
    }
    // Movement of each side's outfielders this frame (opposition activity).
    let moveHome = 0;
    let moveAway = 0;
    for (const p of s.outfield) {
      if (p.team === 'home') moveHome += p.speed;
      else moveAway += p.speed;
    }
    events.push({
      f: frame,
      type: 'pos',
      bx: Math.round(b.x),
      by: Math.round(b.y),
      bz: Math.round(b.z),
      own: teamOf(b.owner),
      mh: Math.round(moveHome / 4),
      ma: Math.round(moveAway / 4),
      phase: s.flow.phase,
      clock: Math.round(s.flow.clock),
    });
    prev = cur;
  }

  // HUD for the trailer: only the scoreboard, clock and goal banner. Hides
  // the touch stick and buttons, minimap, FPS readout and the top-right
  // sound / help / pause buttons.
  function cleanHud() {
    const h = game().scene.getScene('Hud');
    if (!h || !h.sys.isActive() || !h.scoreText) return;
    hudClean = true;
    const keep = new Set([h.scoreText, h.clockText, h.goldenText, h.bannerText, h.bannerShadow]);
    for (const o of h.children.list) {
      if (keep.has(o)) continue;
      const topRight = o.x > 960 && o.y < 120;
      if (o === h.debugText || o.y > 300 || topRight) o.setVisible(false);
    }
    for (const part of [h.joystick, h.actionButtons, h.minimap])
      for (const v of Object.values(part ?? {}))
        if (v && typeof v.setVisible === 'function') v.setVisible(false);
    // The minimap's pitch is a graphics drawn just before its dots.
    const list = h.children.list;
    const dots = list.indexOf(h.minimap?.dots);
    if (dots > 0) list[dots - 1].setVisible(false);
    h.debugText?.setVisible(false);
    // The FPS text is rewritten every frame; keep it empty.
    if (h.debugText) h.debugText.setText = () => h.debugText;
  }

  window.__film = {
    seed(n) {
      state = n | 0;
    },
    // True once Boot has finished preparing the art (it stops itself).
    booted() {
      const g = game();
      return !!g && !!g.scene.getScene('Boot') && !g.scene.isActive('Boot');
    },
    start(config, seed) {
      const g = game();
      if (!direct) {
        g.loop.stop();
        direct = true;
      }
      g.scene.stop('Menu');
      state = seed | 0;
      frame = 0;
      events = [];
      prev = null;
      demoSet = false;
      hudClean = false;
      g.scene.start('Match', config);
    },
    // Hide or show every scene (hidden: the match runs without drawing).
    setVisible(on) {
      for (const sc of game().scene.getScenes(false)) sc.sys.setVisible(on);
    },
    // Advance `n` video frames of `ms` game time each; returns new events.
    step(n, ms) {
      for (let i = 0; i < n; i++) {
        tick(ms);
        const s = match();
        if (!s || !s.ready) continue;
        // AI plays both sides: demo mode from now on (the HUD and the full
        // camera came from starting as a normal match).
        if (!demoSet) {
          s.demo = true;
          demoSet = true;
          // Clean picture: after each update (before drawing) hide the
          // controlled player's arrow, stamina bar and pass-target rings.
          s.events.on('postupdate', () => {
            for (const p of s.everyone) {
              p.arrow.setVisible(false);
              p.barBg.setVisible(false);
              p.barFill.setVisible(false);
              p.targetRing.setVisible(false);
            }
          });

          continue;
        }
        if (!hudClean) cleanHud();
        frame++;
        record(s);
      }
      const out = events;
      events = [];
      return out;
    },
    // One video frame: step, then read the canvas in the same task (WebGL's
    // drawing buffer is still intact then), as a PNG data URL.
    stepCapture(ms) {
      const ev = this.step(1, ms);
      return { ev, png: game().canvas.toDataURL('image/png') };
    },
    frame: () => frame,
    ready: () => !!match()?.ready && demoSet,
    shake(ms, amount) {
      match()?.cameras.main.shake(ms, amount);
    },
  };
})();
