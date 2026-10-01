/* =========================================================
   REMOIRE — THE MOON
   Scroll-driven sequence.

   One overall progress value (0 → 1) for the whole scene.
   Each beat reads its own slice of that progress, eases it,
   and writes the result as a CSS custom property on the
   sticky stage. style.css turns those values into visuals.

   Stop scrolling → everything stops.
   Scroll back   → everything reverses.
========================================================= */

(() => {
  "use strict";

  /* =========================================
     TIMELINE
     Start / end of each beat, as a share of the whole
     scroll (0 = top of the page, 1 = the very end).
     Tune the pacing here — nothing else needs changing.
  ========================================= */

  const TIMELINE = {
    r:        [0.03, 0.20],   // R grows (after a short still moment)
    word:     [0.10, 0.24],   // REMOIRE fades in and rises
                              // 0.24 → 0.33  hold: complete identity
    lunar:    [0.33, 0.50],   // lunar world emerges from the black
    zoom:     [0.33, 0.82],   // very slow push into the landscape
    brandOut: [0.45, 0.54],   // identity leaves once the Moon is clear
                              // 0.54 → 0.57  empty lunar landscape
    smoke:    [0.56, 0.66],   // smoke begins to rise out of the crater
    dim:      [0.60, 0.70],   // environment settles slightly darker
    bottleIn: [0.62, 0.76],   // bottle rises out of the crater, in silhouette
    lit:      [0.76, 0.84],   // light slowly reaches the bottle
    smokeOut: [0.78, 0.90],   // smoke thins to a low haze (never fully gone)
    soon:     [0.835, 0.88],  // COMING SOON
    list:     [0.885, 0.935], // WHEN THE MOON RISES (waiting list)
                              // 0.935 → 1  final hold
  };

  /* =========================================
     WAITING LIST — KLAVIYO
     Paste the two codes from your Klaviyo account here.
     Both are public and safe to be in this file.
     NEVER paste a Klaviyo *private* API key here.

     While either is empty, the site runs in test mode:
     the whole sequence plays, but nothing is saved.
  ========================================= */

  const KLAVIYO_PUBLIC_KEY = "WtPvNR";   // Settings → API keys → Public API key / Site ID (6 characters)
  const KLAVIYO_LIST_ID = "TZZPtN";      // Your waiting list → Settings → List ID (6 characters)
  const KLAVIYO_REVISION = "2026-07-15";
  const SIGNUP_SOURCE = "remoire.co — coming soon";

  /*
    How softly the scene follows the scroll, in seconds.
    Higher = more glide. 0 = follows the scroll exactly.
  */
  const SMOOTHING = 0.16;

  // Scroll hint fades out over this part of the scroll
  const SCROLL_CUE_FADE = [0.0, 0.02];

  // How much smoke remains once it has thinned (0 → 1)
  const SMOKE_HAZE = 0.4;


  /* =========================================
     ELEMENTS
  ========================================= */

  const scene = document.querySelector(".brand-scene");
  const stage = document.querySelector(".brand-sticky");
  const form = document.querySelector(".waitlist");

  if (!scene || !stage) return;


  /* =========================================
     HELPERS
  ========================================= */

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // Share of progress between start and end, 0 → 1
  const range = (p, [start, end]) => clamp((p - start) / (end - start), 0, 1);

  // Slow in, slow out
  const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* =========================================
     LOADING CRESCENT
     Shown only on slow connections. The crescent waxes towards
     full as the moon, the bottle and the type arrive.
  ========================================= */

  (() => {
    const html = document.documentElement;
    const lit = document.querySelector(".loader-lit");
    let target = 0, shown = 0, done = false, doneAt = 0, finished = false;
    const shownSince = () => html.classList.contains("show-loader");

    // Waxing moon: 0 = new, 1 = full
    const phasePath = (p) => {
      const r = 17, rx = (r * Math.abs(1 - 2 * p)).toFixed(2);
      const sweep = p < 0.5 ? 0 : 1;
      return `M 20 3 A 17 17 0 0 1 20 37 A ${rx} 17 0 0 ${sweep} 20 3 Z`;
    };

    const parts = [];
    const add = (weight, promise) => {
      parts.push(weight);
      promise.catch(() => {}).then(() => { target += weight; check(); });
    };
    const loadImage = (src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = src; });
    const imgReady = (img) => img.complete ? Promise.resolve() : new Promise((res) => { img.addEventListener("load", res, { once: true }); img.addEventListener("error", res, { once: true }); });

    add(0.45, loadImage("assets/moon-background.webp"));
    const bottle = document.querySelector(".bottle-lit");
    add(0.3, bottle ? imgReady(bottle) : Promise.resolve());
    const marks = [...document.querySelectorAll(".brand-lockup img")];
    add(0.1, Promise.all(marks.map(imgReady)));
    add(0.15, document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());

    function check() {
      if (done || target < 0.999) return;
      done = true;
      doneAt = performance.now();
    }

    // Never keep anyone waiting forever
    setTimeout(() => { target = 1; check(); }, 12000);

    const start = performance.now();
    function tick(now) {
      // Drift gently ahead of what has loaded, never quite reaching it
      const creep = Math.min(0.12, (now - start) / 30000);
      const aim = done ? 1 : Math.min(0.94, Math.max(0.05, target + creep));
      shown += (aim - shown) * (reducedMotion.matches ? 1 : 0.08);
      if (lit) lit.setAttribute("d", phasePath(Math.max(0.04, shown)));

      if (done && (shown > 0.995 || !shownSince()) && !finished) {
        finished = true;
        html.classList.remove("is-loading");
        // Hold the full moon a moment before it fades
        setTimeout(() => html.classList.add("is-loaded"), shownSince() ? 350 : 0);
        return;
      }
      if (!finished) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  // Keep the copyright year current
  const yearEl = document.querySelector(".copyright-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());


  /* =========================================
     MEASUREMENT
     Measured once, and again only when sizes change —
     never inside the scroll handler.
  ========================================= */

  let sceneTop = 0;
  let scrollDistance = 1;

  function measure() {
    const rect = scene.getBoundingClientRect();
    sceneTop = rect.top + window.scrollY;

    // Stage height (lvh) is stable while mobile toolbars
    // collapse, unlike window.innerHeight.
    scrollDistance = Math.max(1, scene.offsetHeight - stage.offsetHeight);
  }


  /* =========================================
     SMOKE
     Soft, slow puffs rising out of the crater, drawn on two
     canvases (behind and in front of the bottle). The amount
     of smoke follows the scroll; its drift is ambient.
     Rendered at reduced resolution — smoke is soft anyway.
  ========================================= */

  const smoke = (() => {
    const back = document.querySelector(".smoke-back");
    const front = document.querySelector(".smoke-front");
    const bottleEl = document.querySelector(".bottle");
    const none = { setLevel() {}, resize() {}, setPointer() {}, puff() {}, sparkle() {}, setMapper() {}, gather() {}, nib() {}, strike() {}, flight(o) { if (o && o.onArrive) setTimeout(o.onArrive, 0); }, burst() {} };
    if (!back || !front || !bottleEl || !back.getContext) return none;

    const ctxBack = back.getContext("2d");
    const ctxFront = front.getContext("2d");

    // Dust and sparks get their own full-sharpness layer
    const fxCanvas = document.createElement("canvas");
    fxCanvas.className = "smoke smoke-fx";
    fxCanvas.setAttribute("aria-hidden", "true");
    front.after(fxCanvas);
    const ctxFx = fxCanvas.getContext("2d");
    let fxScale = 1;
    const RES = 0.5;              // canvas pixels per CSS pixel
    // Gold smoke: tones from the wordmark and the bottle's base light
    const COLOURS = ["214, 174, 112", "231, 195, 128", "190, 150, 92", "222, 204, 170"];

    let w = 0, h = 0;             // canvas size (device px)
    let originX = 0, originY = 0; // canvas position on screen (CSS px)
    let ptr = null;               // pointer, in canvas px
    let ptrSpeed = 0;             // how fast it is moving (canvas px / s)
    let ptrTime = 0;
    let src = { x: 0, y: 0, spread: 0, size: 0 };
    let level = 0;
    let particles = [];
    let fx = [];                  // one-off effects: dust puffs and gold sparks
    let bfx = [];                 // effects pinned to the bottle (engraving)
    let nibState = null;          // the etching point, in bottle units
    let mapper = null;            // () => the bottle drawing's box on screen
    let fxRect = { left: 0, top: 0 };   // where the effects canvas sits on screen
    let running = false;
    let last = 0;
    let idleSince = 0;

    // --- Puff textures: lumpy, soft, never a perfect circle ---
    const sprites = [];
    for (let i = 0; i < 4; i++) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const COLOUR = COLOURS[i % COLOURS.length];
      for (let j = 0; j < 9; j++) {
        const x = 64 + (Math.random() - 0.5) * 44;
        const y = 64 + (Math.random() - 0.5) * 44;
        const r = 18 + Math.random() * 34;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${COLOUR}, 0.16)`);
        grad.addColorStop(0.45, `rgba(${COLOUR}, 0.06)`);
        grad.addColorStop(1, `rgba(${COLOUR}, 0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      sprites.push(c);
    }

    // A tiny bright point of gold, for sparks
    const spark = document.createElement("canvas");
    spark.width = spark.height = 32;
    {
      const g = spark.getContext("2d");
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, "rgba(255, 246, 225, 1)");
      grad.addColorStop(0.25, "rgba(240, 205, 145, 0.85)");
      grad.addColorStop(1, "rgba(216, 169, 100, 0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
    }

    function resize() {
      const rect = back.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      w = back.width = front.width = Math.max(1, Math.round(rect.width * RES));
      h = back.height = front.height = Math.max(1, Math.round(rect.height * RES));
      fxScale = Math.min(window.devicePixelRatio || 1, 2);
      fxCanvas.width = Math.max(1, Math.round(rect.width * fxScale));
      fxCanvas.height = Math.max(1, Math.round(rect.height * fxScale));

      // Source = the crater floor under the bottle's final position
      const b = bottleEl.getBoundingClientRect();
      src = {
        x: (b.left + b.width / 2 - rect.left) * RES,
        y: (b.bottom - b.height * 0.052 - rect.top) * RES,   // the base line
        spread: b.width * 1.4 * RES,
        size: b.width * 1.3 * RES,
      };
      draw();
    }

    function spawn(isFront) {
      const s = src.size;
      return {
        front: isFront,
        x: src.x + (Math.random() - 0.5) * src.spread * (isFront ? 0.8 : 1),
        y: src.y + (Math.random() - 0.35) * s * 0.08,
        vx: (Math.random() - 0.5) * s * 0.02,
        vy: -s * (isFront ? 0.02 : 0.045 + Math.random() * 0.05),
        size: s * (0.2 + Math.random() * 0.25),
        grow: s * (0.035 + Math.random() * 0.045),
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.12,
        age: 0,
        life: isFront ? 7 + Math.random() * 4 : 10 + Math.random() * 7,
        peak: isFront ? 0.3 : 0.4 + Math.random() * 0.24,
        sway: Math.random() * Math.PI * 2,
        ox: 0,                    // push from the pointer, drifts back
        oy: 0,
        sprite: sprites[(Math.random() * sprites.length) | 0],
      };
    }

    // Target number of puffs for the current amount of smoke
    const targetCount = () => Math.round(level * 48);

    function step(dt) {
      // Keep the population matched to the level, spawning gradually
      const want = targetCount();
      const alive = particles.length;
      if (alive < want && Math.random() < dt * 7) {
        particles.push(spawn(Math.random() < 0.35));
      }

      // The pointer parts the smoke; only while it is moving
      const reach = src.size * 0.5;
      const moving = ptr ? Math.min(1, ptrSpeed / (src.size * 1.5)) : 0;
      ptrSpeed *= Math.exp(-dt * 6);

      for (const p of particles) {
        if (moving > 0.02) {
          const dx = p.x + p.ox - ptr.x;
          const dy = p.y + p.oy - ptr.y;
          const d = Math.hypot(dx, dy);
          if (d < reach && d > 0.01) {
            const f = (1 - d / reach) * src.size * 2.2 * moving * dt;
            p.ox += (dx / d) * f;
            p.oy += (dy / d) * f * 0.7;
          }
        }
        const settle = Math.exp(-dt * 0.45);
        p.ox *= settle;
        p.oy *= settle;

        p.age += dt;
        p.x += (p.vx + Math.sin(p.age * 0.4 + p.sway) * src.size * 0.006) * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
        p.rot += p.spin * dt;
      }
      particles = particles.filter((p) => p.age < p.life);

      // Dust and sparks: simple drift, drag and a little gravity
      for (const f of fx) {
        f.age += dt;
        const drag = Math.exp(-dt * f.drag);
        f.vx *= drag;
        f.vy = f.vy * drag + f.gravity * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.size += f.grow * dt;
      }
      fx = fx.filter((f) => f.age < f.life);

      for (const b of bfx) {
        b.age += dt;
        if (b.kind === "flight") {
          const t = Math.max(0, Math.min(1, (b.age - b.delay) / b.dur));
          const e = b.ease ? b.ease(t) : t;
          const u = 1 - e;
          b.x = u * u * b.sx + 2 * u * e * b.cx + e * e * b.tx;
          b.y = u * u * b.sy + 2 * u * e * b.cy + e * e * b.ty;
          if (b.trail && b.age > b.delay && t < 1 && Math.random() < dt * 60) {
            sparkAt(b.x - fxRect.left, b.y - fxRect.top, 60, 0.7);
            const last = fx[fx.length - 1];
            last.size = 2 + Math.random() * 3;
            last.vy = -4 - Math.random() * 6;
            last.vx = (Math.random() - 0.5) * 8;
            last.life = 0.8 + Math.random() * 0.8;
          }
          if (t >= 1 && b.onArrive) { const cb = b.onArrive; b.onArrive = null; cb(); }
        }
        if (b.kind === "chip") {
          b.vy += 900 * dt;
          b.ox += b.vx * dt;
          b.oy += b.vy * dt;
        }
      }
      bfx = bfx.filter((b) => b.age < b.life);
    }

    function paint(ctx, isFront) {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (p.front !== isFront) continue;
        const t = p.age / p.life;
        // fade in over the first 25%, then thin out as it rises
        const fade = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
        const a = fade * p.peak * level;
        if (a <= 0.003) continue;
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(p.x + p.ox, p.y + p.oy);
        ctx.rotate(p.rot);
        ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function paintFx(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      ctx.setTransform(fxScale, 0, 0, fxScale, 0, 0);   // effects are stored in CSS px
      for (const f of fx) {
        const t = f.age / f.life;
        let a = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        if (f.twinkle) a *= 0.65 + 0.35 * Math.sin(f.age * 18 + f.phase);
        a *= f.peak;
        if (a <= 0.003) continue;
        ctx.globalAlpha = a;
        ctx.globalCompositeOperation = f.additive ? "lighter" : "source-over";
        ctx.drawImage(f.sprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
      }
      if (bfx.length || nibState) paintBottleFx(ctx);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // Engraving effects live in the bottle's own units (900 × 1128),
    // so they stay locked to the letters through scroll and parallax.
    function paintBottleFx(ctx) {
      const box = mapper ? mapper() : null;
      const me = fxRect;
      const hasBox = !!(box && box.width);
      const kx = hasBox ? box.width / 900 : 1, ky = hasBox ? box.height / 1128 : 1;
      const X = (x) => (hasBox ? box.left : 0) - me.left + x * kx;
      const Y = (y) => (hasBox ? box.top : 0) - me.top + y * ky;
      ctx.globalCompositeOperation = "lighter";
      for (const b of bfx) {
        if (b.kind === "flight") {
          if (b.age < b.delay) continue;
          const t = Math.min(1, (b.age - b.delay) / b.dur);
          const a = Math.min(1, t * 5) * (b.fadeOut ? 1 - Math.max(0, (t - 0.75) / 0.25) : 1) * b.peak;
          if (a <= 0.01) continue;
          ctx.globalAlpha = a;
          const r = b.size;
          ctx.drawImage(spark, b.x - me.left - r / 2, b.y - me.top - r / 2, r, r);
          if (b.core) ctx.drawImage(spark, b.x - me.left - r / 6, b.y - me.top - r / 6, r / 3, r / 3);
          continue;
        }
        if (b.kind === "sflash") {
          const t = b.age / b.life;
          const r = b.size * (0.3 + (1 - Math.pow(1 - t, 3)) * 0.7);
          ctx.globalAlpha = (1 - t) * 0.95;
          ctx.drawImage(spark, b.x - me.left - r / 2, b.y - me.top - r / 2, r, r);
          continue;
        }
        if (!hasBox) continue;
        if (b.kind === "dust") {
          if (b.age < b.delay) continue;
          const t = Math.min(1, (b.age - b.delay) / b.dur);
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const u = 1 - e;
          const x = u * u * b.sx + 2 * u * e * b.cx + e * e * b.tx;
          const y = u * u * b.sy + 2 * u * e * b.cy + e * e * b.ty;
          const out = Math.max(0, Math.min(1, (b.age - b.fadeAt) / 0.5));
          const tw = 0.7 + 0.3 * Math.sin(b.phase + b.age * 20);
          const a = Math.min(1, t * 4) * (1 - out) * tw * 0.9;
          if (a <= 0.01) continue;
          ctx.globalAlpha = a;
          const r = b.size * (t < 1 ? 1 : 0.8);
          ctx.drawImage(spark, X(x) - r / 2, Y(y) - r / 2, r, r);
        } else if (b.kind === "flash") {
          const t = b.age / b.life;
          const r = 4 + (1 - Math.pow(1 - t, 3)) * 22;
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.drawImage(spark, X(b.x) - r / 2, Y(b.y) - r / 2, r, r);
        } else if (b.kind === "chip") {
          const t = b.age / b.life;
          ctx.globalAlpha = (1 - t) * 0.95;
          ctx.drawImage(spark, X(b.x) + b.ox - 1.5, Y(b.y) + b.oy - 1.5, 3, 3);
        }
      }
      if (nibState && nibState.a > 0.01) {
        const x = X(nibState.x), y = Y(nibState.y);
        ctx.globalAlpha = nibState.a;
        ctx.drawImage(spark, x - 8, y - 8, 16, 16);
        ctx.drawImage(spark, x - 2.5, y - 2.5, 5, 5);
      }
    }

    function draw() {
      paint(ctxBack, false);
      paint(ctxFront, true);
      paintFx(ctxFx);
    }

    function frame(now) {
      fxRect = fxCanvas.getBoundingClientRect();
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      step(dt);
      draw();

      // Stop entirely once the smoke is gone
      if (level === 0 && particles.length === 0 && fx.length === 0 && bfx.length === 0 && !nibState) {
        running = false;
        return;
      }
      requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }

    // Reduced motion: a still, settled haze instead of drifting smoke
    function stillFrame() {
      particles = [];
      const n = Math.round(level * 36);
      for (let i = 0; i < n; i++) {
        const p = spawn(i % 3 === 0);
        const t = Math.random() * p.life * 0.6;
        p.age = t;
        p.x += p.vx * t;
        p.y += p.vy * t;
        p.size += p.grow * t;
        particles.push(p);
      }
      draw();
    }

    function setLevel(value) {
      const prev = level;
      level = value < 0.002 ? 0 : value;
      if (reducedMotion.matches) {
        if (Math.abs(level - prev) > 0.02 || (level === 0) !== (prev === 0)) stillFrame();
        return;
      }
      if (level > 0) start();
    }

    function setPointer(clientX, clientY) {
      if (reducedMotion.matches) return;
      const now = performance.now();
      const x = (clientX - originX) * RES;
      const y = (clientY - originY) * RES;
      if (ptr) {
        const dt = Math.max(0.008, (now - ptrTime) / 1000);
        ptrSpeed = Math.max(ptrSpeed, Math.hypot(x - ptr.x, y - ptr.y) / dt);
      }
      ptr = { x, y };
      ptrTime = now;
    }

    // A puff of moon dust where the visitor clicks the ground
    function puff(clientX, clientY) {
      if (reducedMotion.matches) return;
      const x = clientX - originX;
      const y = clientY - originY;
      const s = (src.size || 150) / RES;          // CSS px
      for (let i = 0; i < 16; i++) {
        const ang = Math.PI + Math.random() * Math.PI;          // upwards half
        const speed = s * (0.12 + Math.random() * 0.35);
        fx.push({
          x: x + (Math.random() - 0.5) * s * 0.06,
          y,
          vx: Math.cos(ang) * speed * 1.3,
          vy: Math.sin(ang) * speed * 0.7,
          gravity: s * 0.16,
          drag: 1.6,
          size: s * (0.05 + Math.random() * 0.08),
          grow: s * (0.05 + Math.random() * 0.05),
          age: 0,
          life: 1.8 + Math.random() * 1.2,
          peak: 0.5 + Math.random() * 0.25,
          sprite: sprites[(Math.random() * sprites.length) | 0],
        });
      }
      for (let i = 0; i < 6; i++) sparkAt(x, y, s, 0.6);
      start();
    }

    function sparkAt(x, y, s, strength = 1) {
      fx.push({
        x: x + (Math.random() - 0.5) * s * 0.05,
        y: y + (Math.random() - 0.5) * s * 0.03,
        vx: (Math.random() - 0.5) * s * 0.1,
        vy: -s * (0.05 + Math.random() * 0.12),
        gravity: -s * 0.01,
        drag: 0.9,
        size: 3 + Math.random() * 5,                 // fine specks, in CSS px
        grow: 0,
        age: 0,
        life: 1.4 + Math.random() * 1.4,
        peak: strength * (0.7 + Math.random() * 0.3),
        twinkle: true,
        phase: Math.random() * 6.28,
        additive: true,
        sprite: spark,
      });
    }

    // Fine gold dust lifting off a point on screen
    function sparkle(clientX, clientY, count = 5) {
      if (reducedMotion.matches) return;
      const x = clientX - originX;
      const y = clientY - originY;
      const s = (src.size || 150) / RES;
      for (let i = 0; i < count; i++) sparkAt(x, y, s);
      start();
    }

    function setMapper(fn) { mapper = fn; }

    // Moon dust drifts up out of the crater and settles on the given
    // points (bottle units). Each point: { x, y, group, fadeAt (ms) }.
    function gather(points, arriveBy = 2400) {
      if (reducedMotion.matches) return;
      const rnd = (a, b) => a + Math.random() * (b - a);
      for (const p of points) {
        const sx = 450 + rnd(-440, 440);
        const sy = rnd(1150, 1320);
        const dur = rnd(1300, 1650);
        const delay = Math.max(0, Math.min(arriveBy - dur, rnd(0, 600) + (p.group || 0) * 50));
        bfx.push({
          kind: "dust", sx, sy, tx: p.x, ty: p.y,
          cx: (sx + p.x) / 2 + rnd(-140, 140), cy: Math.min(sy, p.y) - rnd(20, 120),
          delay: delay / 1000, dur: dur / 1000,
          fadeAt: (p.fadeAt + rnd(-60, 120)) / 1000,
          life: (p.fadeAt + 700) / 1000,
          age: 0, size: rnd(2.2, 3.8), phase: Math.random() * 6.28,
        });
      }
      start();
    }

    // The etching point: { x, y, a } in bottle units, or null
    function nib(state) {
      nibState = state;
      if (state) start();
    }

    // A chisel strike: a small flash and a few chips of glass
    function strike(x, y) {
      if (reducedMotion.matches) return;
      bfx.push({ kind: "flash", x, y, age: 0, life: 0.22 });
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * (0.05 + Math.random() * 0.9);
        const v = 70 + Math.random() * 110;
        bfx.push({ kind: "chip", x, y, ox: 0, oy: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 0.35 + Math.random() * 0.3 });
      }
      start();
    }

    // A point of light travelling a curve across the screen (client px).
    // { sx, sy, tx, ty, cx, cy, delay, dur (ms), size, trail, core, onArrive }
    function flight(o) {
      if (reducedMotion.matches) { if (o.onArrive) setTimeout(o.onArrive, 0); return; }
      bfx.push({
        kind: "flight", sx: o.sx, sy: o.sy, tx: o.tx, ty: o.ty,
        cx: o.cx ?? (o.sx + o.tx) / 2, cy: o.cy ?? (o.sy + o.ty) / 2,
        x: o.sx, y: o.sy, delay: (o.delay || 0) / 1000, dur: (o.dur || 1000) / 1000,
        life: ((o.delay || 0) + (o.dur || 1000)) / 1000 + (o.linger || 0) / 1000,
        size: o.size || 5, peak: o.peak ?? 1, trail: !!o.trail, core: !!o.core,
        fadeOut: o.fadeOut !== false, ease: o.ease || null,
        age: 0, onArrive: o.onArrive || null,
      });
      start();
    }

    // A small flash of gold with sparks, at a point on screen
    function burst(clientX, clientY, count = 16, size = 46) {
      if (reducedMotion.matches) return;
      bfx.push({ kind: "sflash", x: clientX, y: clientY, age: 0, life: 0.45, size });
      sparkle(clientX, clientY, count);
    }

    window.addEventListener("resize", resize);
    resize();

    return { setLevel, resize, setPointer, puff, sparkle, setMapper, gather, nib, strike, flight, burst };
  })();


  /* =========================================
     RENDER
  ========================================= */

  const values = {};    // last written values — skip unchanged writes
  let listHidden = null;

  function write(name, value) {
    const v = Math.round(value * 10000) / 10000;
    if (values[name] === v) return;
    values[name] = v;
    stage.style.setProperty(`--${name}`, v);
  }

  const soonEl = document.querySelector(".moon-soon");
  const labelEl = document.querySelector(".waitlist-label");

  function sheenOn(el, v) {
    if (!el) return;
    if (v >= 0.98) el.classList.add("is-sheen");
    else if (v < 0.3) el.classList.remove("is-sheen");
  }

  function render(progress) {
    for (const name in TIMELINE) {
      if (name === "smoke" || name === "smokeOut") continue;
      const cssName = name === "brandOut" ? "brand-out"
                    : name === "bottleIn" ? "bottle-in"
                    : name;
      write(cssName, ease(range(progress, TIMELINE[name])));
    }

    // Smoke: builds, then thins to a low haze around the bottle
    smoke.setLevel(
      ease(range(progress, TIMELINE.smoke)) *
      (1 - (1 - SMOKE_HAZE) * ease(range(progress, TIMELINE.smokeOut)))
    );

    // Scroll hint leaves as soon as the visitor starts scrolling
    write("cue", 1 - ease(range(progress, SCROLL_CUE_FADE)));

    stage.classList.toggle("is-cue-hidden", values.cue === 0);

    // Gold catching the light, each time the text arrives
    sheenOn(soonEl, values.soon);
    sheenOn(labelEl, values.list);

    // Waiting list can't be focused or clicked until visible
    const hidden = values.list === 0;
    if (hidden !== listHidden) {
      listHidden = hidden;
      stage.classList.toggle("is-list-hidden", hidden);
    }
  }


  /* =========================================
     SMOOTHED SCROLL LOOP
     The scene glides towards the scroll position instead
     of jumping with each mouse-wheel step. It still stops
     when scrolling stops and reverses when scrolling back.
  ========================================= */

  let target = 0;       // where the scroll position says we should be
  let shown = 0;        // where the scene currently is
  let running = false;
  let lastTime = 0;

  const readProgress = () =>
    clamp((window.scrollY - sceneTop) / scrollDistance, 0, 1);

  function frame(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    if (reducedMotion.matches || SMOOTHING <= 0) {
      shown = target;
    } else {
      shown += (target - shown) * (1 - Math.exp(-dt / SMOOTHING));
      if (Math.abs(target - shown) < 0.00005) shown = target;
    }

    render(shown);

    if (shown !== target) {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function onScroll() {
    target = readProgress();
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  // Sizes changed, page restored, etc. — jump straight there
  function refresh() {
    measure();
    smoke.resize();
    target = shown = readProgress();
    render(shown);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh);            // after images/fonts
  window.addEventListener("pageshow", refresh);        // back/forward cache

  if ("ResizeObserver" in window) {
    new ResizeObserver(refresh).observe(scene);
  }

  // Scene length changes with the reduced-motion setting
  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener("change", refresh);
  }

  refresh();


  /* =========================================
     DEPTH
     The landscape, smoke and bottle shift slightly at
     different speeds with the pointer (and with tilt on
     phones that allow it without asking), so the crater
     feels like a real space. CSS decides how far each
     layer moves from --px / --py.
  ========================================= */

  const depth = (() => {
    let tx = 0, ty = 0;       // target
    let cx = 0, cy = 0;       // current
    let running = false;

    function frame() {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) { cx = tx; cy = ty; }
      stage.style.setProperty("--px", cx.toFixed(4));
      stage.style.setProperty("--py", cy.toFixed(4));
      if (cx !== tx || cy !== ty) requestAnimationFrame(frame);
      else running = false;
    }

    function set(x, y) {
      if (reducedMotion.matches) return;
      tx = clamp(x, -1, 1);
      ty = clamp(y, -1, 1);
      if (!running) { running = true; requestAnimationFrame(frame); }
    }

    // Tilt: only where the browser offers it without a permission prompt
    let tiltSeen = false;
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma == null || e.beta == null) return;
      tiltSeen = true;
      set(e.gamma / 25, (e.beta - 45) / 25);
    });

    return { set, usesTilt: () => tiltSeen };
  })();


  /* ---- Pointer: depth and smoke ---- */

  function onPointer(clientX, clientY) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!depth.usesTilt()) depth.set((clientX / w) * 2 - 1, (clientY / h) * 2 - 1);
    smoke.setPointer(clientX, clientY);
  }

  window.addEventListener("pointermove", (e) => onPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener("pointerdown", (e) => onPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) onPointer(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener("mouseleave", () => depth.set(0, 0));

  // Click the ground: a puff of moon dust where you "step"
  let caughtAt = 0;             // a star was just caught: that tap isn't a step
  document.addEventListener("click", (e) => {
    if (performance.now() - caughtAt < 500) return;
    if ((values.lunar || 0) < 0.8) return;
    if (e.target.closest && e.target.closest(".waitlist, .moon-share, .birth-moon, .wish, .wish-star, button, a, input, canvas.sign-pad")) return;
    if (e.clientY < window.innerHeight * 0.42) return;   // the sky isn't ground
    smoke.puff(e.clientX, e.clientY);
  });


  /* =========================================
     SHOOTING STARS
     Every 10 seconds, once the sky is visible, a faint gold
     shooting star crosses it. They are quick, so they are
     forgiving to catch: a tap anywhere near the star or the
     trail it leaves (which lingers for a second) counts.
     Catch one and make a wish.
  ========================================= */

  const wishHooks = { open: null };   // filled in by the wish section

  (() => {
    if (!("animate" in document.documentElement)) return;
    const INTERVAL = 10000;
    const DURATION = 1300;
    const LINGER = 1000;        // ms the trail stays catchable after the star
    const REACH = 40;           // px: about a thumb
    const active = [];

    function fire() {
      if (reducedMotion.matches || document.hidden) return;
      if ((values.lunar || 0) < 0.8 || (values["brand-out"] || 0) < 0.9) return;
      if (document.querySelector(".wish:not([hidden])")) return;

      const W = stage.clientWidth, H = stage.clientHeight;
      const x = W * (0.35 + Math.random() * 0.6);
      const y = H * (0.04 + Math.random() * 0.2);
      const angle = 152 + Math.random() * 14;          // travelling left and down
      const dist = Math.min(W, H) * (0.35 + Math.random() * 0.2);
      const rad = angle * Math.PI / 180;
      const dx = Math.cos(rad) * dist, dy = Math.sin(rad) * dist;
      const easing = "cubic-bezier(0.25, 0.6, 0.3, 1)";

      // The faint trail it leaves behind
      const trail = document.createElement("span");
      trail.className = "shooting-trail";
      trail.style.width = `${dist}px`;
      stage.appendChild(trail);
      const tr = (sx, o) => ({ transform: `translate(${x}px, ${y}px) rotate(${angle}deg) scaleX(${sx})`, opacity: o });
      const trailAnim = trail.animate([tr(0, 0), tr(0.25, 0.5), tr(1, 0.4)], { duration: DURATION, easing, fill: "forwards" });

      const star = document.createElement("span");
      star.className = "shooting-star";
      stage.appendChild(star);
      const at = (f, sx, o) =>
        ({ transform: `translate(${x + dx * f}px, ${y + dy * f}px) rotate(${angle + 180}deg) scaleX(${sx})`, opacity: o });
      const anim = star.animate(
        [at(0, 0.2, 0), at(0.25, 1, 1), at(1, 0.6, 0)],
        { duration: DURATION, easing }
      );

      const s = { x, y, dx, dy, star, trail, anim, born: performance.now(), caught: false };
      active.push(s);

      anim.onfinish = () => star.remove();
      trailAnim.onfinish = () => {
        if (s.caught) return;
        trail.animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: LINGER, fill: "forwards" }).onfinish = () => {
          trail.remove();
          const k = active.indexOf(s);
          if (k >= 0) active.splice(k, 1);
        };
      };
    }

    // How far along its path the star is (0 → 1), matching its keyframes
    function travelled(s) {
      const timing = s.anim.effect && s.anim.effect.getComputedTiming();
      const p = timing && timing.progress != null ? timing.progress : 1;
      return p < 0.5 ? 0.25 * (p / 0.5) : 0.25 + 0.75 * ((p - 0.5) / 0.5);
    }

    function distanceToSegment(px, py, ax, ay, bx, by) {
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
      return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    }

    function tryCatch(clientX, clientY) {
      const r = stage.getBoundingClientRect();
      const px = clientX - r.left, py = clientY - r.top;
      const now = performance.now();
      for (const s of active) {
        if (s.caught || now - s.born > DURATION + LINGER) continue;
        const f = travelled(s);
        if (distanceToSegment(px, py, s.x, s.y, s.x + s.dx * f, s.y + s.dy * f) <= REACH) {
          catchStar(s, clientX, clientY);
          return true;
        }
      }
      return false;
    }

    function catchStar(s, clientX, clientY) {
      s.caught = true;
      caughtAt = performance.now();
      s.anim.cancel();
      s.star.remove();
      s.trail.getAnimations().forEach((a) => a.commitStyles && a.commitStyles());
      s.trail.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 900, fill: "forwards" }).onfinish = () => s.trail.remove();
      const k = active.indexOf(s);
      if (k >= 0) active.splice(k, 1);
      smoke.burst(clientX, clientY, 18, 54);
      if (wishHooks.open) setTimeout(() => wishHooks.open("star"), 450);
    }

    document.addEventListener("pointerdown", (e) => {
      if (!active.length) return;
      if (e.target.closest && e.target.closest(".waitlist, .moon-share, .birth-moon, .wish, .wish-star, button, a, input, canvas.sign-pad")) return;
      tryCatch(e.clientX, e.clientY);
    }, { passive: true });

    setInterval(fire, INTERVAL);
  })();


  /* =========================================
     ARRIVAL
     Black first, then the R fades up once it has
     actually loaded (never pops in half-drawn).
  ========================================= */

  const emblem = document.querySelector(".remoire-r");
  let arrived = false;

  function arrive() {
    if (arrived) return;
    arrived = true;
    requestAnimationFrame(() => document.documentElement.classList.add("is-ready"));
  }

  if (emblem && emblem.decode) {
    emblem.decode().then(arrive, arrive);
  } else {
    window.addEventListener("load", arrive);
  }
  setTimeout(arrive, 2500);   // safety net on slow connections


  /* =========================================
     WAITING LIST
  ========================================= */

  if (!form) return;

  const input = form.querySelector("#waitlist-email");
  const nameInput = form.querySelector("#waitlist-name");
  const skipBtn = form.querySelector(".waitlist-skip");
  const status = form.querySelector(".waitlist-status");
  const engraveEl = form.querySelector(".engrave");
  const thanks = form.querySelector(".waitlist-thanks");
  const pad = form.querySelector(".sign-pad");
  const modeBtns = [...form.querySelectorAll(".sign-mode")];
  const clearBtn = form.querySelector(".sign-clear");

  const THANKS = thanks ? thanks.textContent.trim() : "Thank you";
  const ENGRAVE_STAGGER = 45;   // ms between letters
  const ENGRAVE_TIME = 2000;    // ms for one letter to glow and sink
  const LIGHT_TIME = 4500;      // ms for the light to spread over the bottle
  const NAME_DELAY = 1400;      // ms into the light before the name is cut
  const NAME_STAGGER = 140;     // ms between engraved letters

  let step = "name";            // "name" → "email" → "done"
  let pending = { name: null, signature: null };   // what they engraved, until the email seals it
  let busy = false;

  // Light spreads across the bottle: a reward for joining.
  function lightTheBottle() {
    const duration = reducedMotion.matches ? 800 : LIGHT_TIME;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      stage.style.setProperty("--joined", ease(t).toFixed(4));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Typed letters glow, then settle into the lunar dust.
  function engrave(text) {
    return new Promise((resolve) => {
      if (!engraveEl || !text) return resolve();
      engraveEl.textContent = "";
      [...text].forEach((ch, i) => {
        const span = document.createElement("span");
        span.textContent = ch;
        span.style.animationDelay = `${i * ENGRAVE_STAGGER}ms`;
        engraveEl.appendChild(span);
      });
      form.classList.add("is-engraving");
      const total = ENGRAVE_TIME + text.length * ENGRAVE_STAGGER;
      setTimeout(() => {
        form.classList.remove("is-engraving");
        engraveEl.textContent = "";
        resolve();
      }, reducedMotion.matches ? 600 : total * 0.8);
    });
  }

  /* ---- The name ---- */

  // Letters, spaces, hyphens and apostrophes only; 14 characters.
  function cleanName(raw) {
    return raw
      .normalize("NFKC")
      .replace(/[^\p{L}\p{M}' .-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 14);
  }

  // A short list of words the bottle will never carry.
  const BLOCKED = /(fuck|shit|cunt|bitch|nigg|fag|whore|slut|rape|nazi|hitler|dick|cock|puss|wank|twat|bastard|retard|porn|sex)/i;

  // Cut the name into the bottle, letter by letter, along the curve
  // of the sphere. Letters towards the sides are narrowed, as they
  // would be on a real curved surface.
  // What is engraved, kept so "Save your moon" can redraw it
  let engraving = null;

  async function engraveBottle(name, isStatic = false) {
    const svg = document.querySelector(".bottle-name");
    if (!svg) return;
    svg.classList.toggle("is-static", isStatic);
    const path = svg.querySelector(".bottle-name-path");
    const group = svg.querySelector(".bottle-name-letters");
    const ns = "http://www.w3.org/2000/svg";
    group.textContent = "";
    const letters = [];

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }

    const text = name.toUpperCase();
    const chars = [...text];
    const L = path.getTotalLength();

    // Size to fit comfortably on the front of the sphere
    let size = 46;
    const tracking = () => size * 0.32;
    const measure = () => {
      const probe = document.createElementNS(ns, "text");
      probe.setAttribute("font-size", size);
      group.appendChild(probe);
      const widths = chars.map((ch) => {
        probe.textContent = ch === " " ? " " : ch;
        return probe.getComputedTextLength();
      });
      probe.remove();
      return widths;
    };
    let widths = measure();
    let total = widths.reduce((a, b) => a + b, 0) + tracking() * (chars.length - 1);
    if (total > L * 0.72) {
      size = size * (L * 0.72) / total;
      widths = measure();
      total = widths.reduce((a, b) => a + b, 0) + tracking() * (chars.length - 1);
    }

    const CX = 450, HALF = 407;   // sphere centre and half-width at this height
    let at = (L - total) / 2;
    const woven = !isStatic && !reducedMotion.matches;

    chars.forEach((ch, i) => {
      const mid = at + widths[i] / 2;
      at += widths[i] + tracking();
      if (ch === " ") return;

      const p = path.getPointAtLength(mid);
      const q = path.getPointAtLength(Math.min(L, mid + 1));
      const angle = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      const squeeze = Math.sqrt(Math.max(0.2, 1 - Math.pow((p.x - CX) / HALF, 2)));
      letters.push({ ch, x: p.x, y: p.y, angle, squeeze, size, w: widths[i] });
      if (woven) return;

      const g = document.createElementNS(ns, "g");
      g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(2)}) scale(${squeeze.toFixed(3)} 1)`);

      const delay = `${i * NAME_STAGGER}ms`;
      for (const cls of ["nl-glint", "nl-cut"]) {
        const t = document.createElementNS(ns, "text");
        t.setAttribute("class", cls);
        t.setAttribute("font-size", size.toFixed(1));
        t.setAttribute("letter-spacing", "0");
        t.setAttribute("filter", cls === "nl-cut" ? "url(#name-cut)" : "url(#name-glint)");
        t.style.animationDelay = delay;
        t.textContent = ch;
        g.appendChild(t);
      }
      group.appendChild(g);
    });

    engraving = { type: "name", letters };
    if (woven) weaveName(svg, group, letters);
  }

  /* ---- The engraving: dust gathers, the point cuts, the chisel sets ----
     Moon dust rises from the crater and settles into the shape of the
     name. A bright etching point then cuts each dusty letter, and a
     single chisel strike sets it into the glass. */

  const WEAVE = { gather: 2400, per: 360, gap: 160, dust: 55 };
  let weaveRun = 0;

  function frames(dur, fn, run) {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = (now) => {
        if (run !== weaveRun) return resolve(false);
        const t = Math.min(1, (now - start) / dur);
        fn(t);
        if (t < 1) requestAnimationFrame(tick); else resolve(true);
      };
      requestAnimationFrame(tick);
    });
  }
  const pause = (ms, run) => frames(ms, () => {}, run);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // A point in a letter's own space → bottle units
  function letterPoint(l, lx, ly) {
    const a = l.angle * Math.PI / 180, x = lx * l.squeeze;
    return { x: l.x + x * Math.cos(a) - ly * Math.sin(a), y: l.y + x * Math.sin(a) + ly * Math.cos(a) };
  }

  // Random points inside a letter's shape, for the dust to settle on
  function sampleLetter(l, count) {
    const k = 4;
    const c = document.createElement("canvas");
    const W = Math.ceil(l.w * k + 24), H = Math.ceil(l.size * 1.35 * k);
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.font = `500 ${l.size * k}px "Cormorant Garamond", Garamond, serif`;
    g.textAlign = "center";
    g.fillStyle = "#fff";
    g.fillText(l.ch, W / 2, l.size * k);
    const data = g.getImageData(0, 0, W, H).data;
    const out = [];
    for (let tries = 0; out.length < count && tries < 15000; tries++) {
      const px = (Math.random() * W) | 0, py = (Math.random() * H) | 0;
      if (data[(py * W + px) * 4 + 3] > 128) out.push(letterPoint(l, (px - W / 2) / k, (py - l.size * k) / k));
    }
    return out;
  }

  function svgEl(name, attrs, parent) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const key in attrs) n.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function clearWeave(svg) {
    weaveRun++;
    smoke.nib(null);
    svg.querySelectorAll(".weave-clip").forEach((n) => n.remove());
  }

  // Shake a letter and flash its glint: the chisel lands
  function setWithChisel(at, shakeEl, hotEl, run) {
    smoke.strike(at.x, at.y);
    const dx = rnd(-1.8, 1.8), dy = rnd(-1, 1);
    hotEl.setAttribute("opacity", "0.9");
    frames(700, (t) => {
      const e = 1 - ease(Math.min(1, t * 4.5));
      shakeEl.setAttribute("transform", `translate(${(dx * e).toFixed(2)} ${(dy * e).toFixed(2)})`);
      hotEl.setAttribute("opacity", (0.9 * (1 - ease(t))).toFixed(3));
    }, run);
  }

  async function weaveName(svg, group, letters) {
    clearWeave(svg);
    const run = weaveRun;
    const defs = svg.querySelector("defs");
    const { gather, per, gap } = WEAVE;

    const rows = letters.map((l, i) => {
      const id = `weave-clip-${run}-${i}`;
      const cp = svgEl("clipPath", { id, class: "weave-clip" }, defs);
      const rect = svgEl("rect", { x: -l.w / 2 - 2, y: -l.size, width: 0, height: l.size * 1.4 }, cp);
      const g = svgEl("g", { transform: `translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.angle.toFixed(2)}) scale(${l.squeeze.toFixed(3)} 1)` }, group);
      const shakeEl = svgEl("g", {}, g);
      const cutG = svgEl("g", { "clip-path": `url(#${id})` }, shakeEl);
      const make = (cls, filter, parent, opacity) => {
        const t = svgEl("text", { class: cls, "font-size": l.size.toFixed(1), "letter-spacing": "0", filter: `url(#${filter})`, opacity }, parent);
        t.textContent = l.ch;
        return t;
      };
      make("weave-cut", "name-cut", cutG, 1);
      const glow = make("weave-glow", "name-glint", cutG, 0.75);
      const hot = make("weave-glow", "name-glint", shakeEl, 0);
      return { l, rect, glow, hot, shakeEl };
    });

    // 1. The dust gathers
    const points = [];
    letters.forEach((l, i) => {
      const fadeAt = gather + i * (per + gap) + per * 0.4;
      sampleLetter(l, WEAVE.dust).forEach((p) => points.push({ x: p.x, y: p.y, group: i, fadeAt }));
    });
    smoke.gather(points, gather);
    if (!(await pause(gather, run))) return;

    // 2. The point cuts each letter; 3. the chisel sets it
    const nib = { x: 0, y: 0, a: 0 };
    smoke.nib(nib);
    for (let i = 0; i < rows.length; i++) {
      const { l, rect, glow, hot, shakeEl } = rows[i];
      let n = 0;
      const ok = await frames(per, (t) => {
        const w = l.w + 4;
        rect.setAttribute("width", (t * w).toFixed(2));
        const p = letterPoint(l, -l.w / 2 - 2 + t * w, -l.size * 0.36 + Math.sin(t * 40) * l.size * 0.34);
        nib.x = p.x; nib.y = p.y; nib.a = 1;
        if (++n % 3 === 0) {
          const s = bottleToScreen(p.x, p.y);
          if (s) smoke.sparkle(s.x, s.y, 1);
        }
      }, run);
      if (!ok) return;
      setWithChisel(letterPoint(l, 0, -l.size * 0.45), shakeEl, hot, run);
      frames(700, (t) => glow.setAttribute("opacity", (0.75 * (1 - t)).toFixed(3)), run);
      if (i < rows.length - 1) {
        const next = rows[i + 1].l;
        const from = letterPoint(l, l.w / 2, -l.size * 0.36);
        const to = letterPoint(next, -next.w / 2, -next.size * 0.36);
        if (!(await frames(gap, (t) => { nib.x = from.x + (to.x - from.x) * t; nib.y = from.y + (to.y - from.y) * t; nib.a = 0.3; }, run))) return;
      }
    }
    await frames(400, (t) => { nib.a = 1 - t; }, run);
    if (run === weaveRun) smoke.nib(null);
  }

  // The same, for a drawn signature: the dust settles along the strokes,
  // the point follows the pen, and the chisel sets the end of each stroke.
  async function weaveSignature(svg, strokesEls, width) {
    clearWeave(svg);
    const run = weaveRun;
    const { gather } = WEAVE;

    let at = gather;
    const plan = strokesEls.map(({ cut, glint }, i) => {
      let len = 0;
      try { len = cut.getTotalLength(); } catch (e) {}
      const dur = clamp(250 + len * 2.2, 350, 1400);
      const item = { cut, glint, len, dur, start: at, i };
      at += dur + 120;
      return item;
    });

    const points = [];
    plan.forEach(({ cut, len, dur, start, i }) => {
      if (!len) return;
      const n = clamp(Math.round(len / 5), 6, 70);
      for (let k = 0; k < n; k++) {
        const u = Math.random();
        const p = cut.getPointAtLength(len * u);
        points.push({ x: p.x + rnd(-1, 1) * width * 0.4, y: p.y + rnd(-1, 1) * width * 0.4, group: i, fadeAt: start + ease(u) * dur });
      }
    });
    plan.forEach(({ cut, glint }) => {
      for (const el of [cut, glint]) { el.style.animation = "none"; el.style.strokeDashoffset = "1"; }
      glint.style.opacity = "0.8";
    });
    smoke.gather(points, gather);
    if (!(await pause(gather, run))) return;

    const nib = { x: 0, y: 0, a: 0 };
    smoke.nib(nib);
    for (const { cut, glint, len, dur } of plan) {
      let n = 0;
      const ok = await frames(dur, (t) => {
        const e = ease(t);
        cut.style.strokeDashoffset = glint.style.strokeDashoffset = (1 - e).toFixed(4);
        if (!len) return;
        const p = cut.getPointAtLength(len * e);
        nib.x = p.x; nib.y = p.y; nib.a = 1;
        if (++n % 3 === 0) {
          const s = bottleToScreen(p.x, p.y);
          if (s) smoke.sparkle(s.x, s.y, 1);
        }
      }, run);
      if (!ok) return;
      if (len) smoke.strike(nib.x, nib.y);
      frames(800, (t) => { glint.style.opacity = (0.8 * (1 - t)).toFixed(3); }, run);
      if (!(await pause(120, run))) return;
    }
    await frames(400, (t) => { nib.a = 1 - t; }, run);
    if (run === weaveRun) smoke.nib(null);
  }

  smoke.setMapper(() => {
    const svg = document.querySelector(".bottle-name");
    return svg ? svg.getBoundingClientRect() : null;
  });

  // Bottle drawing units (900 × 1128) → a point on screen
  function bottleToScreen(x, y) {
    const svg = document.querySelector(".bottle-name");
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (!r.width) return null;
    return { x: r.left + (x / 900) * r.width, y: r.top + (y / 1128) * r.height };
  }

  /* ---- Drawn signature ---- */

  let mode = "type";            // "type" | "draw"
  let strokes = [];             // [[ [x, y], … ], …] in pad CSS px
  let padSize = { w: 1, h: 1 };
  let padCtx = null;

  function sizePad() {
    if (!pad) return;
    const r = pad.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    padSize = { w: r.width, h: r.height };
    pad.width = Math.max(1, Math.round(r.width * dpr));
    pad.height = Math.max(1, Math.round(r.height * dpr));
    padCtx = pad.getContext("2d");
    padCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawPad();
  }

  function redrawPad() {
    if (!padCtx) return;
    padCtx.clearRect(0, 0, padSize.w, padSize.h);
    padCtx.lineCap = "round";
    padCtx.lineJoin = "round";
    padCtx.lineWidth = 2.2;
    padCtx.strokeStyle = "#e7c380";
    padCtx.shadowColor = "rgba(216, 169, 100, 0.6)";
    padCtx.shadowBlur = 6;
    for (const s of strokes) {
      if (s.length < 2) {
        if (s.length === 1) {
          padCtx.beginPath();
          padCtx.arc(s[0][0], s[0][1], 1.2, 0, Math.PI * 2);
          padCtx.fillStyle = "#e7c380";
          padCtx.fill();
        }
        continue;
      }
      padCtx.beginPath();
      padCtx.moveTo(s[0][0], s[0][1]);
      for (let i = 1; i < s.length - 1; i++) {
        const mx = (s[i][0] + s[i + 1][0]) / 2;
        const my = (s[i][1] + s[i + 1][1]) / 2;
        padCtx.quadraticCurveTo(s[i][0], s[i][1], mx, my);
      }
      const last = s[s.length - 1];
      padCtx.lineTo(last[0], last[1]);
      padCtx.stroke();
    }
  }

  function setMode(next) {
    mode = next;
    form.classList.toggle("is-draw", mode === "draw");
    modeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    status.textContent = "";
    if (mode === "draw") {
      setTimeout(sizePad, 650);   // after the field has grown
      if (clearBtn) clearBtn.tabIndex = 0;
    } else {
      if (clearBtn) clearBtn.tabIndex = -1;
      setTimeout(() => nameInput && nameInput.focus({ preventScroll: true }), 300);
    }
  }

  function clearPad() {
    strokes = [];
    form.classList.remove("has-ink");
    redrawPad();
  }

  if (pad) {
    let drawing = false;
    const at = (e) => {
      const r = pad.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    pad.addEventListener("pointerdown", (e) => {
      if (mode !== "draw" || step !== "name") return;
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      drawing = true;
      strokes.push([at(e)]);
      form.classList.add("has-ink");
      status.textContent = "";
      redrawPad();
    });
    pad.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const s = strokes[strokes.length - 1];
      const p = at(e);
      const q = s[s.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.5) {
        s.push(p);
        redrawPad();
      }
    });
    const end = () => { drawing = false; };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
    window.addEventListener("resize", () => { if (mode === "draw") sizePad(); });
  }

  modeBtns.forEach((b) => b.addEventListener("click", () => {
    if (step === "name" && !busy) setMode(b.dataset.mode);
  }));
  if (clearBtn) clearBtn.addEventListener("click", clearPad);

  // Draw the signature onto the bottle, following the curve of the
  // sphere: squeezed towards the sides, bowed like a line of latitude.
  function engraveSignature(lines, isStatic = false) {
    const svg = document.querySelector(".bottle-name");
    if (!svg) return;
    svg.classList.toggle("is-static", isStatic);
    const group = svg.querySelector(".bottle-signature");
    const ns = "http://www.w3.org/2000/svg";
    group.textContent = "";

    const pts = lines.flat();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const sw = Math.max(1, maxX - minX), sh = Math.max(1, maxY - minY);

    // Target area on the bottle (bottle viewBox units)
    const BOX_W = 460, BOX_H = 150, CX = 450, CY = 800;
    const k = Math.min(BOX_W / sw, BOX_H / sh);
    const HALF = 407;                        // sphere half-width here
    const arc = (x) => 62 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 450) / 350, 2)));

    const map = ([x, y]) => {
      const fx = CX + (x - minX - sw / 2) * k;
      const fy = CY + (y - minY - sh / 2) * k;
      const u = clamp((fx - CX) / HALF, -1.2, 1.2);
      const px = CX + HALF * Math.sin(u);           // wraps around the sphere
      const py = fy + (arc(px) - 62) * 0.9;         // follows the latitude
      return [px, py];
    };

    const pathFor = (s) => {
      const m = s.map(map);
      if (m.length === 1) return `M ${m[0][0].toFixed(1)} ${m[0][1].toFixed(1)} l 0.1 0`;
      let d = `M ${m[0][0].toFixed(1)} ${m[0][1].toFixed(1)}`;
      for (let i = 1; i < m.length - 1; i++) {
        const mx = (m[i][0] + m[i + 1][0]) / 2, my = (m[i][1] + m[i + 1][1]) / 2;
        d += ` Q ${m[i][0].toFixed(1)} ${m[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
      }
      const l = m[m.length - 1];
      return d + ` L ${l[0].toFixed(1)} ${l[1].toFixed(1)}`;
    };

    const width = clamp(2.2 * k, 4, 7);
    const paths = [];
    const cutEls = [];
    const pairs = [];
    let delay = 0;
    lines.forEach((s) => {
      const d = pathFor(s);
      paths.push(d);
      const pair = {};
      pairs.push(pair);
      for (const cls of ["sig-glint", "sig-cut"]) {
        const p = document.createElementNS(ns, "path");
        p.setAttribute("d", d);
        p.setAttribute("class", cls);
        p.setAttribute("pathLength", "1");
        p.setAttribute("stroke-width", (cls === "sig-glint" ? width * 1.1 : width).toFixed(2));
        p.setAttribute("filter", cls === "sig-cut" ? "url(#name-cut)" : "url(#name-glint)");
        p.style.animationDelay = `${delay}ms, ${delay}ms`;
        group.appendChild(p);
        pair[cls === "sig-cut" ? "cut" : "glint"] = p;
        if (cls === "sig-cut") cutEls.push({ el: p, delay });
      }
      delay += 380;
    });

    engraving = { type: "signature", paths, width };

    if (!isStatic && !reducedMotion.matches) {
      weaveSignature(svg, pairs, width);
      return;
    }

    // Gold dust follows the pen as the signature draws itself
    if (!isStatic) {
      cutEls.forEach(({ el, delay: start }) => {
        let len = 0;
        try { len = el.getTotalLength(); } catch (e) { return; }
        const steps = 14;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          setTimeout(() => {
            const pt = el.getPointAtLength(len * t);
            const p = bottleToScreen(pt.x, pt.y);
            if (p) smoke.sparkle(p.x, p.y, 5);
          }, start + t * 2400);
        }
      });
    }
  }

  async function submitSignature() {
    const ink = strokes.reduce((n, s) => n + s.length, 0);
    if (ink < 8) {
      status.textContent = "Draw your signature, or choose Type";
      return;
    }
    const lines = strokes.map((s) => s.slice());
    if (pad) {
      pad.classList.add("is-sinking");
      await new Promise((r) => setTimeout(r, reducedMotion.matches ? 400 : 1500));
      pad.classList.remove("is-sinking");
    }
    clearPad();
    showEmailStep(null, lines);
  }


  /* ---- Steps ---- */

  // Step one: sign the bottle. Nothing is focused on arrival.
  function prepareNameStep() {
    step = "name";
    input.tabIndex = -1;
    if (nameInput) nameInput.tabIndex = 0;
    if (skipBtn) skipBtn.tabIndex = 0;
    modeBtns.forEach((b) => (b.tabIndex = 0));
    form.classList.add("is-name");
  }

  // Step two: their name is on the moon; the email seals it.
  function showEmailStep(name, signature) {
    pending = { name: name || null, signature: signature || null };
    step = "email";
    const le1 = form.querySelector(".le-1");
    if (le1) le1.textContent = name ? "Your name is on the moon." : signature ? "Your mark is on the moon." : "";
    form.classList.remove("is-name", "is-draw", "has-ink");
    form.classList.add("is-email");
    modeBtns.forEach((b) => (b.tabIndex = -1));
    if (clearBtn) clearBtn.tabIndex = -1;
    if (nameInput) { nameInput.value = ""; nameInput.tabIndex = -1; nameInput.blur(); }
    if (skipBtn) skipBtn.tabIndex = -1;
    input.tabIndex = 0;
    status.textContent = "";

    // The bottle is engraved while they write their email
    const delay = reducedMotion.matches ? 100 : 300;
    if (name) setTimeout(() => engraveBottle(name), delay);
    else if (signature) setTimeout(() => engraveSignature(signature), delay);
    setTimeout(() => input.focus({ preventScroll: true }), 1600);
  }

  function finish() {
    const { name, signature } = pending;
    step = "done";
    form.classList.remove("is-name", "is-email", "is-draw", "has-ink");
    form.classList.add("is-done");
    input.tabIndex = -1;
    status.textContent = name ? `${THANKS} Your name is engraved on the bottle.`
                       : signature ? `${THANKS} Your signature is engraved on the bottle.`
                       : THANKS;
    lightTheBottle();
    remember({ name: name || null, signature: signature ? compact(signature) : null });
    enableAfter();
  }

  // Adds the email to the Klaviyo waiting list (client endpoint,
  // designed to be called from the browser with the public key).
  async function subscribe(email) {
    const url = `https://a.klaviyo.com/client/subscriptions?company_id=${encodeURIComponent(KLAVIYO_PUBLIC_KEY)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
        "revision": KLAVIYO_REVISION,
      },
      body: JSON.stringify({
        data: {
          type: "subscription",
          attributes: {
            custom_source: SIGNUP_SOURCE,
            profile: {
              data: {
                type: "profile",
                attributes: { email },
              },
            },
          },
          relationships: {
            list: { data: { type: "list", id: KLAVIYO_LIST_ID } },
          },
        },
      }),
    });
    // Klaviyo answers 202 Accepted with no body
    if (!response.ok) throw new Error(`Klaviyo ${response.status}`);
  }

  async function submitEmail() {
    const email = input.value.trim();
    input.value = email;

    if (!email || !input.checkValidity()) {
      status.textContent = "Please enter a valid email address";
      input.focus();
      return;
    }

    if (!KLAVIYO_PUBLIC_KEY || !KLAVIYO_LIST_ID) {
      // Test mode — nothing is stored. The full sequence still plays.
      console.info("[REMOIRE] Waiting list in test mode. Not saved:", email);
    } else {
      status.textContent = "";
      form.setAttribute("aria-busy", "true");
      try {
        await subscribe(email);
      } catch (error) {
        console.warn("[REMOIRE] Sign-up failed", error);
        status.textContent = "Something went wrong. Please try again";
        return;
      } finally {
        form.removeAttribute("aria-busy");
      }
    }

    input.blur();
    await engrave(email);
    finish();
  }

  async function submitName() {
    if (mode === "draw") return submitSignature();
    const name = cleanName(nameInput ? nameInput.value : "");
    if (!name) return showEmailStep(null, null);
    if (BLOCKED.test(name.replace(/[^\p{L}]/gu, ""))) {
      status.textContent = "Please choose another name";
      nameInput.focus();
      return;
    }
    nameInput.blur();
    // The name stays on this screen only; it is not sent anywhere.
    await engrave(name);
    showEmailStep(name, null);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || step === "done") return;
    busy = true;
    try {
      if (step === "email") await submitEmail();
      else if (step === "name") await submitName();
    } finally {
      busy = false;
    }
  });

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      if (step === "name" && !busy) showEmailStep(null, null);
    });
  }

  [input, nameInput].forEach((el) => el && el.addEventListener("input", () => {
    if (status.textContent && step !== "done") status.textContent = "";
  }));


  /* =========================================
     REMEMBER VISITORS WHO HAVE JOINED
     Kept in this browser only: that they joined, and the
     name or signature on their bottle. The email is not
     kept here. For testing, add #reset to the address to
     clear it (e.g. remoire.co/#reset).
  ========================================= */

  const STORE_KEY = "remoire-moon";

  function remember(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, joined: true, at: Date.now(), ...data }));
    } catch (e) { /* private mode or storage blocked: fine */ }
  }

  function recall() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return d && d.v === 1 && d.joined ? d : null;
    } catch (e) {
      return null;
    }
  }

  function forget() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  // Signatures are stored lightly: whole-pixel points, every other one
  function compact(lines) {
    return lines.map((s) => s
      .filter((_, i) => i % 2 === 0 || i === s.length - 1)
      .map(([x, y]) => [Math.round(x), Math.round(y)]));
  }

  const saveBtn = form.querySelector(".save-moon");
  const startAgainBtn = form.querySelector(".start-again");

  const wishBtn = form.querySelector(".make-wish");

  function enableAfter() {
    if (saveBtn) saveBtn.tabIndex = 0;
    if (wishBtn) wishBtn.tabIndex = 0;
    if (startAgainBtn) startAgainBtn.tabIndex = 0;
  }

  // Start again: clears what this browser remembers and reloads
  if (startAgainBtn) {
    startAgainBtn.addEventListener("click", () => {
      forget();
      window.location.reload();
    });
  }

  // Hidden reset for testing: remoire.co/#reset
  if (window.location.hash === "#reset") {
    forget();
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) {}
  }

  // A returning visitor: the bottle is already lit and signed
  const returning = recall();
  if (!returning) prepareNameStep();
  if (returning) {
    step = "done";
    form.classList.add("is-done", "is-returning");
    input.tabIndex = -1;
    if (thanks) thanks.textContent = "Welcome back. When the moon rises, you will know.";
    status.textContent = "Welcome back.";
    stage.style.setProperty("--joined", "1");
    if (returning.name) engraveBottle(returning.name, true);
    else if (returning.signature && returning.signature.length) engraveSignature(returning.signature, true);
    enableAfter();
  }


  /* =========================================
     SAVE YOUR MOON
     Draws a Stories-sized image (1080 × 1920) of their
     signed bottle in the crater, with REMOIRE. Offers the
     phone's share sheet where available, a download, and
     always a preview they can press and hold to save.
  ========================================= */

  const shareBox = document.querySelector(".moon-share");
  const shareImg = shareBox && shareBox.querySelector(".moon-share-img");
  const shareSaveBtn = shareBox && shareBox.querySelector(".moon-share-save");
  const shareShareBtn = shareBox && shareBox.querySelector(".moon-share-share");
  const shareCloseBtn = shareBox && shareBox.querySelector(".moon-share-close");
  let shareFile = null;
  let shareUrl = "";

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  async function drawMoonImage() {
    const W = 1080, H = 1920;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");

    if (document.fonts && document.fonts.load) {
      try {
        await Promise.all([
          document.fonts.load('500 40px "Cormorant Garamond"'),
          document.fonts.load('600 40px "Cormorant Garamond"'),
        ]);
      } catch (e) {}
    }

    const [bg, bottle, wordmark] = await Promise.all([
      loadImage("assets/moon-background.webp"),
      loadImage("assets/Moon%20transparent.png"),
      loadImage("assets/remoire-wordmark.svg"),
    ]);

    // Landscape, cover-cropped around the crater
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const s = H / bg.height;
    const bw = bg.width * s;
    ctx.drawImage(bg, (W - bw) / 2, 0, bw, H);

    // Quiet vignette
    const vig = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.2, W / 2, H * 0.6, H * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Bottle on the crater floor
    const bottleW = 600;
    const bottleH = bottleW * bottle.height / bottle.width;
    const floorY = H * 0.72;
    const bx = (W - bottleW) / 2;
    const by = floorY + bottleH * 0.052 - bottleH;

    // Warm aura behind, as for someone who has joined
    const aura = ctx.createRadialGradient(W / 2, by + bottleH * 0.5, 0, W / 2, by + bottleH * 0.5, bottleW * 0.95);
    aura.addColorStop(0, "rgba(231,195,128,0.28)");
    aura.addColorStop(0.55, "rgba(216,169,100,0.09)");
    aura.addColorStop(1, "rgba(216,169,100,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.filter = "brightness(1.4)";
    ctx.drawImage(bottle, bx, by, bottleW, bottleH);
    ctx.restore();

    // Gold light on the ground at the base
    ctx.save();
    ctx.translate(W / 2, floorY);
    ctx.scale(1, 0.14);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, bottleW * 0.75);
    glow.addColorStop(0, "rgba(231,195,128,0.5)");
    glow.addColorStop(0.55, "rgba(216,169,100,0.14)");
    glow.addColorStop(1, "rgba(216,169,100,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, bottleW * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // The engraving, in bottle units (the bottle image is 900 wide)
    if (engraving) {
      const k = bottleW / 900;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(k, k);
      const cut = [
        ["rgba(0,0,0,0.85)", -2],
        ["rgba(231,195,128,0.75)", 1.6],
        ["#8a6835", 0],
      ];
      if (engraving.type === "name") {
        for (const L of engraving.letters) {
          ctx.save();
          ctx.translate(L.x, L.y);
          ctx.rotate(L.angle * Math.PI / 180);
          ctx.scale(L.squeeze, 1);
          ctx.font = `500 ${L.size}px "Cormorant Garamond", Garamond, serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          for (const [colour, dy] of cut) {
            ctx.fillStyle = colour;
            ctx.fillText(L.ch, 0, dy);
          }
          ctx.restore();
        }
      } else if (engraving.type === "signature" && window.Path2D) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = engraving.width;
        for (const [colour, dy] of cut) {
          ctx.save();
          ctx.translate(0, dy);
          ctx.strokeStyle = colour;
          for (const d of engraving.paths) ctx.stroke(new Path2D(d));
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // REMOIRE, and the date line
    const wmW = 640;
    const wmH = wmW * 167 / 1850;
    ctx.drawImage(wordmark, (W - wmW) / 2, 210, wmW, wmH);

    const setTracked = (text, y, font, colour, tracking) => {
      ctx.font = font;
      ctx.fillStyle = colour;
      ctx.textAlign = "left";
      const chars = [...text];
      const widths = chars.map((ch) => ctx.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
      let x = (W - total) / 2;
      chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + tracking; });
    };

    const gold = ctx.createLinearGradient(0, 330, 0, 372);
    gold.addColorStop(0.15, "#e7c380");
    gold.addColorStop(0.75, "#c39652");
    setTracked("COMING SOON", 368, '500 34px "Cormorant Garamond", Garamond, serif', gold, 34 * 0.62);

    // Darken the foot of the image so the address reads over the rocks
    const foot = ctx.createLinearGradient(0, H * 0.8, 0, H);
    foot.addColorStop(0, "rgba(0,0,0,0)");
    foot.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = foot;
    ctx.fillRect(0, H * 0.8, W, H * 0.2);

    setTracked("REMOIRE.CO", 1810, '600 26px "Cormorant Garamond", Garamond, serif', "#c39652", 26 * 0.5);

    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.9));
    return blob;
  }

  let shareTrigger = null;
  let shareName = "remoire.jpg";
  const shareTitle = shareBox && shareBox.querySelector(".moon-share-title");

  function closeShare() {
    if (!shareBox) return;
    shareBox.hidden = true;
    document.documentElement.style.overflow = "";
    if (shareTrigger) shareTrigger.focus({ preventScroll: true });
  }

  async function openShare(opts = {}) {
    if (!shareBox || !shareImg) return;
    const make = opts.make || drawMoonImage;
    const trigger = shareTrigger = opts.trigger || saveBtn;
    shareName = opts.file || "remoire.jpg";
    if (shareTitle) shareTitle.textContent = opts.title || "Your moon";
    shareImg.alt = opts.alt || "Your signed REMOIRE bottle in the crater.";
    const label = trigger ? trigger.textContent : "";
    if (trigger) trigger.textContent = opts.preparing || "Preparing your moon";
    try {
      const blob = await make();
      if (shareUrl) URL.revokeObjectURL(shareUrl);
      shareUrl = URL.createObjectURL(blob);
      shareFile = new File([blob], shareName, { type: "image/jpeg" });
      shareImg.src = shareUrl;

      const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [shareFile] }));
      if (shareShareBtn) shareShareBtn.hidden = !canShareFile;

      shareBox.hidden = false;
      document.documentElement.style.overflow = "hidden";
      (canShareFile ? shareShareBtn : shareSaveBtn).focus({ preventScroll: true });
    } catch (e) {
      console.warn("[REMOIRE] Could not prepare the image", e);
    } finally {
      if (trigger) trigger.textContent = label;
    }
  }

  if (saveBtn) saveBtn.addEventListener("click", () => openShare());
  if (shareCloseBtn) shareCloseBtn.addEventListener("click", closeShare);
  if (shareBox) {
    shareBox.addEventListener("click", (e) => { if (e.target === shareBox) closeShare(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !shareBox.hidden) closeShare();
    });
  }

  if (shareSaveBtn) {
    shareSaveBtn.addEventListener("click", () => {
      if (!shareUrl) return;
      const a = document.createElement("a");
      a.href = shareUrl;
      a.download = shareName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  if (shareShareBtn) {
    shareShareBtn.addEventListener("click", async () => {
      if (!shareFile) return;
      try {
        await navigator.share({ files: [shareFile], title: "REMOIRE" });
      } catch (e) { /* closed the share sheet */ }
    });
  }
  /* =========================================
     A WISH TO THE MOON
     After signing, or after catching a shooting star. The
     letters turn to gold dust, gather into one spark, and it
     rises into the sky to stay as a star. The wish itself is
     never stored or sent: only where its star sits, on this
     device.
  ========================================= */

  const wishBox = document.querySelector(".wish");
  const wishForm = wishBox && wishBox.querySelector(".wish-form");
  const wishInput = wishBox && wishBox.querySelector("#wish-input");
  const wishTitle = wishBox && wishBox.querySelector(".wish-title");
  const wishLetters = wishBox && wishBox.querySelector(".wish-letters");
  const wishCloseBtn = wishBox && wishBox.querySelector(".wish-close");
  const wishSky = document.querySelector(".wish-sky");
  const WISH_KEY = "remoire-wishes";
  const MAX_WISH_STARS = 24;
  let wishBusy = false;
  const easeInOut3 = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function loadWishStars() {
    try {
      const list = JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
      return Array.isArray(list)
        ? list.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)).slice(-MAX_WISH_STARS)
            .map((p) => ({ x: p.x, y: p.y, text: typeof p.text === "string" ? p.text.slice(0, 60) : "" }))
        : [];
    } catch (e) { return []; }
  }

  function saveWishStars(list) {
    try { localStorage.setItem(WISH_KEY, JSON.stringify(list.slice(-MAX_WISH_STARS))); } catch (e) {}
  }

  const wishReveal = document.querySelector(".wish-reveal");
  let revealTimer = 0;

  // Show a wish beside its star for a few seconds, then let it fade
  function revealWish(p, hint) {
    if (!wishReveal) return;
    clearTimeout(revealTimer);
    wishReveal.textContent = "";
    const line = document.createElement("span");
    line.textContent = p.text ? `\u201C${p.text}\u201D` : "A wish, kept by the moon.";
    wishReveal.appendChild(line);
    if (hint) {
      const h = document.createElement("span");
      h.className = "wish-reveal-hint";
      h.textContent = hint;
      wishReveal.appendChild(document.createElement("br"));
      wishReveal.appendChild(h);
    }
    wishReveal.hidden = false;
    wishReveal.classList.remove("is-shown");
    const W = stage.clientWidth, H = stage.clientHeight;
    const box = wishReveal.getBoundingClientRect();
    const sx = W * p.x / 100, sy = H * p.y / 100;
    const left = Math.max(16, Math.min(W - box.width - 16, sx - box.width / 2));
    wishReveal.style.left = `${left}px`;
    wishReveal.style.top = `${sy + 18}px`;
    stage.classList.add("is-revealing");
    requestAnimationFrame(() => wishReveal.classList.add("is-shown"));
    revealTimer = setTimeout(() => {
      wishReveal.classList.remove("is-shown");
      stage.classList.remove("is-revealing");
      revealTimer = setTimeout(() => { wishReveal.hidden = true; }, 900);
    }, hint ? 6000 : 4500);
  }

  function placeWishStar(p, isNew) {
    if (!wishSky) return;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "wish-star" + (isNew ? " is-new" : "");
    el.setAttribute("aria-label", "Your wish");
    el.style.left = `${p.x}%`;
    el.style.top = `${p.y}%`;
    if (!isNew) el.style.animationDelay = `${(-Math.random() * 5).toFixed(2)}s`;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if ((values.lunar || 0) < 0.8) return;
      revealWish(p);
    });
    wishSky.appendChild(el);
  }

  loadWishStars().forEach((p) => placeWishStar(p, false));

  function anyDialogOpen() {
    return (shareBox && !shareBox.hidden) || (birthBox && !birthBox.hidden);
  }

  function openWish(from) {
    if (!wishBox || wishBusy || !wishBox.hidden || anyDialogOpen()) return;
    wishTitle.textContent = from === "star" ? "Make a wish." : "Leave one wish with the moon.";
    wishBox.classList.remove("is-leaving", "is-releasing");
    wishLetters.textContent = "";
    wishInput.value = "";
    wishBox.hidden = false;
    stage.classList.add("is-wishing");
    setTimeout(() => wishInput.focus({ preventScroll: true }), 350);
  }
  wishHooks.open = openWish;

  function hideWish() {
    if (!wishBox || wishBox.hidden) return;
    wishBox.classList.add("is-leaving");
    stage.classList.remove("is-wishing");
    setTimeout(() => {
      wishBox.hidden = true;
      wishBox.classList.remove("is-leaving", "is-releasing");
      wishLetters.textContent = "";
      wishInput.value = "";
    }, 800);
  }

  function landWish(target, clientX, clientY) {
    if (clientX != null) smoke.burst(clientX, clientY, 10, 40);
    const p = { x: Math.round(target.x * 100) / 100, y: Math.round(target.y * 100) / 100, text: target.text || "" };
    placeWishStar(p, true);
    const list = loadWishStars();
    list.push(p);
    saveWishStars(list);
    wishBusy = false;
    // The first time, say how to find it again
    setTimeout(() => revealWish(p, "Tap your star to read it again."), reducedMotion.matches ? 300 : 1400);
  }

  function releaseWish(text) {
    wishBusy = true;
    const r = stage.getBoundingClientRect();
    const target = { x: 12 + Math.random() * 76, y: 6 + Math.random() * 22, text };   // % of the sky
    const tx = r.left + r.width * target.x / 100;
    const ty = r.top + r.height * target.y / 100;

    // The typed letters take the input's place, glow, and lift away
    wishLetters.textContent = "";
    const spans = [...text].map((ch, i) => {
      const s = document.createElement("span");
      s.textContent = ch;
      s.style.animationDelay = `${i * 25}ms`;
      wishLetters.appendChild(s);
      return s;
    });
    wishBox.classList.add("is-releasing");
    wishInput.blur();

    if (reducedMotion.matches) {
      hideWish();
      landWish(target);
      return;
    }

    const field = wishBox.querySelector(".wish-field").getBoundingClientRect();
    const gx = field.left + field.width / 2;
    const gy = field.top - 26;
    spans.forEach((s, i) => {
      const rc = s.getBoundingClientRect();
      if (!rc.width || rc.right > field.right) return;
      for (let k = 0; k < 4; k++) {
        const sx = rc.left + Math.random() * rc.width;
        const sy = rc.top + rc.height * (0.3 + Math.random() * 0.5);
        smoke.flight({
          sx, sy, tx: gx, ty: gy,
          cx: (sx + gx) / 2 + (Math.random() - 0.5) * 90, cy: Math.min(sy, gy) - 20 - Math.random() * 50,
          delay: 250 + i * 25 + Math.random() * 200, dur: 800 + Math.random() * 300,
          size: 3 + Math.random() * 2.5, peak: 0.9, ease: easeInOut3,
        });
      }
    });

    // Gathered: one spark rises to its place in the sky
    const gathered = 250 + spans.length * 25 + 200 + 1100;
    setTimeout(() => {
      hideWish();
      smoke.burst(gx, gy, 6, 28);
      smoke.flight({
        sx: gx, sy: gy, tx, ty,
        cx: gx + (tx - gx) * 0.2 + (Math.random() - 0.5) * 120, cy: Math.min(gy, ty) - 70,
        dur: 1700, size: 18, core: true, trail: true, fadeOut: false, ease: easeInOut3,
        onArrive: () => landWish(target, tx, ty),
      });
    }, gathered);
  }

  if (wishForm) {
    wishForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (wishBusy) return;
      const text = wishInput.value.replace(/\s+/g, " ").trim();
      if (!text) { wishInput.focus(); return; }
      releaseWish(text);
    });
    wishCloseBtn.addEventListener("click", () => { if (!wishBusy) hideWish(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !wishBox.hidden && !wishBusy) hideWish();
    });
  }
  if (wishBtn) wishBtn.addEventListener("click", () => openWish("button"));


  /* =========================================
     YOUR BIRTH MOON
     The moon's phase on the night they were born, worked out
     here in the browser (a standard low-precision lunar
     model, good to within a few hours). The date is kept on
     this device only.
  ========================================= */

  const birthBox = document.querySelector(".birth-moon");
  const birthOpenBtn = document.querySelector(".birth-moon-open");

  if (birthBox && birthOpenBtn) {
    const bForm = birthBox.querySelector(".birth-moon-form");
    const bInput = birthBox.querySelector("#birth-date");
    const bNote = birthBox.querySelector(".birth-moon-note");
    const bResult = birthBox.querySelector(".birth-moon-result");
    const bDate = birthBox.querySelector(".bm-date");
    const bPhase = birthBox.querySelector(".bm-phase");
    const bMonth = birthBox.querySelector(".bm-month");
    const bLine = birthBox.querySelector(".bm-line");
    const bCanvas = birthBox.querySelector(".birth-moon-disc");
    const bSave = birthBox.querySelector(".bm-save");
    const bAgain = birthBox.querySelector(".bm-again");
    const bClose = birthBox.querySelector(".bm-close");
    const BIRTH_KEY = "remoire-birth";
    const NOTE = bNote.textContent;

    const PHASE_NAMES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
                         "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
    const PHASE_LINES = [
      "Born under a new moon: a beginning, written in the dark.",
      "Born under a waxing crescent: always becoming.",
      "Born under a first quarter: half in light, half in wonder.",
      "Born under a waxing gibbous: nearly full, never finished.",
      "Born under a full moon: nothing hidden, everything bright.",
      "Born under a waning gibbous: generous with its light.",
      "Born under a last quarter: at peace with the dark.",
      "Born under a waning crescent: the quiet before the new.",
    ];
    const MONTH_MOONS = ["Wolf Moon", "Snow Moon", "Worm Moon", "Pink Moon", "Flower Moon", "Strawberry Moon",
                         "Buck Moon", "Sturgeon Moon", "Harvest Moon", "Hunter’s Moon", "Beaver Moon", "Cold Moon"];

    // Angle between the moon and the sun as seen from Earth (0 = new, 180 = full)
    function elongation(date) {
      const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
      const rad = Math.PI / 180;
      const g = (357.529 + 0.98560028 * d) * rad;
      const sun = 280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
      const Mm = (134.963 + 13.064993 * d) * rad;
      const F = (93.272 + 13.229350 * d) * rad;
      const D = (297.850 + 12.190749 * d) * rad;
      const moon = 218.316 + 13.176396 * d
        + 6.289 * Math.sin(Mm) - 1.274 * Math.sin(Mm - 2 * D) + 0.658 * Math.sin(2 * D)
        + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(g) - 0.114 * Math.sin(2 * F);
      return ((moon - sun) % 360 + 360) % 360;
    }

    function phaseIndex(E) {
      if (E < 12 || E >= 348) return 0;
      if (E < 78) return 1;
      if (E < 102) return 2;
      if (E < 168) return 3;
      if (E < 192) return 4;
      if (E < 258) return 5;
      if (E < 282) return 6;
      return 7;
    }

    /* ---- The moon's surface, in gold ----
       Drawn once in the browser and kept: soft "seas" (maria),
       craters with bright rims, a few rayed craters and fine dust.
       The same seed every time, so everyone sees the same moon. */

    const TEX = 600;
    let surface = null;

    function seeded(seed) {
      return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function buildSurface() {
      const rand = seeded(1969);
      const G = 64;
      const lattice = new Float32Array(G * G);
      for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
      const at = (x, y) => lattice[(((y % G) + G) % G) * G + (((x % G) + G) % G)];
      const noise = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
        const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
        return a + (b - a) * v;
      };
      const fbm = (x, y, oct) => {
        let s = 0, amp = 0.5, f = 1;
        for (let o = 0; o < oct; o++) { s += amp * noise(x * f, y * f); amp *= 0.5; f *= 2.03; }
        return s;
      };
      const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

      const A = new Float32Array(TEX * TEX);
      for (let y = 0; y < TEX; y++) {
        for (let x = 0; x < TEX; x++) {
          const u = x / TEX * 2.3, v = y / TEX * 2.3;
          const seas = smooth(0.47, 0.66, fbm(u + 11.3, v + 7.1, 6));
          const highlands = (fbm(u * 6 + 3.7, v * 6 + 1.9, 5) - 0.5) * 0.18;
          A[y * TEX + x] = 0.7 + highlands - seas * 0.34 + (rand() - 0.5) * 0.04;
        }
      }

      // Craters: many small, a few large; light baked from the upper left
      const crater = (cx, cy, cr, depth) => {
        const reach = cr * 1.35;
        const x0 = Math.max(0, Math.floor(cx - reach)), x1 = Math.min(TEX - 1, Math.ceil(cx + reach));
        const y0 = Math.max(0, Math.floor(cy - reach)), y1 = Math.min(TEX - 1, Math.ceil(cy + reach));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy) / cr;
            if (d > 1.35) continue;
            const side = d > 0 ? (dx * 0.6 + dy * 0.8) / (d * cr) : 0;   // -1 faces the light, +1 away
            let k = 0;
            if (d < 1) {
              k -= depth * 0.6 * (1 - d * d);                       // the floor
              k += depth * 0.9 * side * smooth(0.45, 1, d);          // inner walls
            } else {
              k += depth * 0.8 * (1 - (d - 1) / 0.35) * (0.55 - 0.45 * side);   // the rim
            }
            A[y * TEX + x] += k;
          }
        }
      };
      for (let i = 0; i < 340; i++) {
        const big = Math.pow(rand(), 4.5);
        const cr = TEX * (0.0025 + big * 0.05);
        crater(rand() * TEX, rand() * TEX, cr, (0.05 + rand() * 0.06) * (1 - big * 0.4));
      }

      // Two young craters, with soft bright haloes instead of rays
      for (const [cx, cy, cr] of [[TEX * 0.43, TEX * 0.8, TEX * 0.018], [TEX * 0.67, TEX * 0.3, TEX * 0.012]]) {
        crater(cx, cy, cr, 0.16);
        const reach = cr * 5;
        for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(TEX, cy + reach); y++) {
          for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(TEX, cx + reach); x++) {
            const d = Math.hypot(x - cx, y - cy) / reach;
            if (d < 1) A[y * TEX + x] += 0.09 * Math.pow(1 - d, 2);
          }
        }
      }

      for (let i = 0; i < A.length; i++) A[i] = Math.min(1, Math.max(0, A[i]));
      return A;
    }

    // Gold: deep bronze in the seas, pale gold on the brightest rims
    const STOPS = [[0, 52, 36, 16], [0.45, 150, 108, 54], [0.72, 214, 172, 106], [1, 250, 230, 186]];
    const goldOf = (a) => {
      for (let i = 1; i < STOPS.length; i++) {
        if (a <= STOPS[i][0]) {
          const p = STOPS[i - 1], q = STOPS[i], t = (a - p[0]) / (q[0] - p[0]);
          return [p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t, p[3] + (q[3] - p[3]) * t];
        }
      }
      return STOPS[STOPS.length - 1].slice(1);
    };

    // Draw the moon as lit on the given night. E: 0 = new, 180 = full.
    function paintMoon(canvas, E) {
      if (!surface) surface = buildSurface();
      const S = canvas.width;
      const ctx = canvas.getContext("2d");
      const img = ctx.createImageData(S, S);
      const data = img.data;
      const rad = E * Math.PI / 180;
      const sx = Math.sin(rad), sz = -Math.cos(rad);       // where the sun is
      const scale = TEX / S;
      for (let py = 0; py < S; py++) {
        const ny = (py + 0.5) / S * 2 - 1;
        const row = Math.min(TEX - 1, Math.floor(py * scale)) * TEX;
        for (let px = 0; px < S; px++) {
          const nx = (px + 0.5) / S * 2 - 1;
          const rr = nx * nx + ny * ny;
          if (rr > 1) continue;
          const edge = Math.min(1, (1 - Math.sqrt(rr)) * S * 0.5);   // smooth limb
          const nz = Math.sqrt(1 - rr);
          const l = nx * sx + nz * sz;
          const t = Math.min(1, Math.max(0, (l + 0.04) / 0.16));
          const lit = t * t * (3 - 2 * t);
          const light = 0.075 + 0.925 * lit;                       // earthshine on the dark side
          const limb = 0.72 + 0.28 * Math.pow(nz, 0.6);
          const a = surface[row + Math.min(TEX - 1, Math.floor(px * scale))];
          const [r, g, b] = goldOf(a);
          const k = light * limb;
          const o = (py * S + px) * 4;
          data[o] = r * k;
          data[o + 1] = g * k;
          data[o + 2] = b * k;
          data[o + 3] = 255 * edge;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    function sizeDisc() {
      const css = bCanvas.getBoundingClientRect().width || 220;
      const px = Math.round(Math.min(2, window.devicePixelRatio || 1) * css);
      if (bCanvas.width !== px) { bCanvas.width = px; bCanvas.height = px; }
    }

    function drawDisc(E) {
      paintMoon(bCanvas, E);
    }

    let discRun = 0;
    function revealDisc(E) {
      const run = ++discRun;
      const waning = E > 180;
      const w = waning ? 360 - E : E;
      if (reducedMotion.matches) { drawDisc(E); return; }
      const start = performance.now();
      const tick = (now) => {
        if (run !== discRun) return;
        const t = Math.min(1, (now - start) / 2000);
        const cur = w * ease(t);
        drawDisc(waning ? 360 - cur : cur);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date();
    bInput.max = iso(today);

    let current = null;

    function readingFor(value) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
      if (!m) return null;
      const y = +m[1], mo = +m[2], da = +m[3];
      const night = new Date(y, mo - 1, da, 21, 0, 0);       // the evening of that day
      if (isNaN(night) || y < 1900 || night.getDate() !== da) return null;
      if (night > new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59)) return null;
      const E = elongation(night);
      const idx = phaseIndex(E);
      const pct = Math.round((1 - Math.cos(E * Math.PI / 180)) / 2 * 100);
      const dateText = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(night);
      return {
        E, idx, pct,
        dateText: `The night of ${dateText}`,
        phase: PHASE_NAMES[idx],
        month: `${pct}% lit, in the month of the ${MONTH_MOONS[mo - 1]}`,
        line: PHASE_LINES[idx],
      };
    }

    function showResult(r) {
      current = r;
      bDate.textContent = r.dateText;
      bPhase.textContent = r.phase;
      bMonth.textContent = r.month;
      bLine.textContent = r.line;
      birthBox.classList.add("has-result");
      bResult.hidden = false;
      bSave.hidden = false;
      bAgain.hidden = false;
      revealDisc(r.E);
    }

    function resetBirth() {
      discRun++;
      current = null;
      birthBox.classList.remove("has-result");
      bResult.hidden = true;
      bSave.hidden = true;
      bAgain.hidden = true;
      bNote.textContent = NOTE;
      bNote.classList.remove("is-error");
      drawDisc(60);
    }

    function openBirth() {
      if (!birthBox.hidden) return;
      resetBirth();
      let saved = null;
      try { saved = localStorage.getItem(BIRTH_KEY); } catch (e) {}
      if (saved) bInput.value = saved;
      birthBox.hidden = false;
      document.documentElement.style.overflow = "hidden";
      sizeDisc();
      drawDisc(60);
      setTimeout(() => bInput.focus({ preventScroll: true }), 300);
    }

    function closeBirth() {
      birthBox.hidden = true;
      document.documentElement.style.overflow = "";
      birthOpenBtn.focus({ preventScroll: true });
    }

    bForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = readingFor(bInput.value);
      if (!r) {
        bNote.textContent = "Choose a date between 1900 and today";
        bNote.classList.add("is-error");
        bInput.focus();
        return;
      }
      try { localStorage.setItem(BIRTH_KEY, bInput.value); } catch (e2) {}
      bInput.blur();
      showResult(r);
      bClose.focus({ preventScroll: true });
    });
    bInput.addEventListener("input", () => {
      bNote.textContent = NOTE;
      bNote.classList.remove("is-error");
    });

    bAgain.addEventListener("click", () => {
      resetBirth();
      bInput.focus({ preventScroll: true });
    });
    bClose.addEventListener("click", closeBirth);
    birthBox.addEventListener("click", (e) => { if (e.target === birthBox) closeBirth(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !birthBox.hidden) closeBirth();
    });
    birthOpenBtn.addEventListener("click", openBirth);

    bSave.addEventListener("click", () => {
      if (!current) return;
      const r = current;
      birthBox.hidden = true;
      openShare({
        make: () => drawBirthMoonImage(r),
        title: "Your birth moon",
        alt: `The moon on the night you were born: ${r.phase}.`,
        file: "remoire-birth-moon.jpg",
        trigger: birthOpenBtn,
        preparing: "Preparing your moon",
      });
    });

    async function drawBirthMoonImage(r) {
      const W = 1080, H = 1920;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (document.fonts && document.fonts.load) {
        try {
          await Promise.all([
            document.fonts.load('400 40px "Cormorant Garamond"'),
            document.fonts.load('500 40px "Cormorant Garamond"'),
            document.fonts.load('600 40px "Cormorant Garamond"'),
          ]);
        } catch (e) {}
      }
      const [bg, wordmark] = await Promise.all([
        loadImage("assets/moon-background.webp"),
        loadImage("assets/remoire-wordmark.svg"),
      ]);

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // A low glimpse of the landscape at the foot
      const s = (H * 0.55) / bg.height;
      const bw = bg.width * s;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(bg, (W - bw) / 2, H * 0.45, bw, H * 0.55);
      ctx.globalAlpha = 1;
      const fade = ctx.createLinearGradient(0, H * 0.45, 0, H);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(0.45, "rgba(0,0,0,0.55)");
      fade.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, H * 0.45, W, H * 0.55);

      const wmW = 640, wmH = wmW * 167 / 1850;
      ctx.drawImage(wordmark, (W - wmW) / 2, 210, wmW, wmH);

      const tracked = (text, y, font, colour, tracking) => {
        ctx.font = font;
        ctx.fillStyle = colour;
        ctx.textAlign = "left";
        const chars = [...text];
        const widths = chars.map((ch) => ctx.measureText(ch).width);
        const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
        let x = (W - total) / 2;
        chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + tracking; });
      };
      const gold = ctx.createLinearGradient(0, 330, 0, 372);
      gold.addColorStop(0.15, "#e7c380");
      gold.addColorStop(0.75, "#c39652");
      tracked("YOUR BIRTH MOON", 368, '500 34px "Cormorant Garamond", Garamond, serif', gold, 34 * 0.5);

      // The moon, with a soft glow behind it
      const R = 300, CX = W / 2, CY = 820;
      const halo = ctx.createRadialGradient(CX, CY, R * 0.8, CX, CY, R * 1.5);
      halo.addColorStop(0, "rgba(231,195,128,0.14)");
      halo.addColorStop(1, "rgba(231,195,128,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(CX - R * 1.6, CY - R * 1.6, R * 3.2, R * 3.2);
      const moon = document.createElement("canvas");
      moon.width = moon.height = R * 2;
      paintMoon(moon, r.E);
      ctx.drawImage(moon, CX - R, CY - R);

      ctx.textAlign = "center";
      tracked(r.dateText.toUpperCase(), 1250, '500 28px "Cormorant Garamond", Garamond, serif', "#c39652", 28 * 0.3);
      ctx.textAlign = "center";
      ctx.fillStyle = "#e7c380";
      ctx.font = '500 84px "Cormorant Garamond", Garamond, serif';
      ctx.fillText(r.phase, W / 2, 1360);
      ctx.fillStyle = "#c39652";
      ctx.font = 'italic 400 38px "Cormorant Garamond", Garamond, serif';
      ctx.fillText(r.month, W / 2, 1432);

      ctx.fillStyle = "#e7c380";
      ctx.font = '400 46px "Cormorant Garamond", Garamond, serif';
      const words = r.line.split(" ");
      const lines = [];
      let lineText = "";
      for (const word of words) {
        const test = lineText ? `${lineText} ${word}` : word;
        if (ctx.measureText(test).width > 820 && lineText) { lines.push(lineText); lineText = word; }
        else lineText = test;
      }
      if (lineText) lines.push(lineText);
      lines.forEach((l, i) => ctx.fillText(l, W / 2, 1540 + i * 62));

      tracked("REMOIRE.CO", 1810, '600 26px "Cormorant Garamond", Garamond, serif', "#c39652", 26 * 0.5);
      return new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.9));
    }
  }

})();
