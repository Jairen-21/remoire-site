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
    const none = { setLevel() {}, resize() {}, setPointer() {}, puff() {}, sparkle() {} };
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
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function draw() {
      paint(ctxBack, false);
      paint(ctxFront, true);
      paintFx(ctxFx);
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      step(dt);
      draw();

      // Stop entirely once the smoke is gone
      if (level === 0 && particles.length === 0 && fx.length === 0) {
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

    window.addEventListener("resize", resize);
    resize();

    return { setLevel, resize, setPointer, puff, sparkle };
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
  document.addEventListener("click", (e) => {
    if ((values.lunar || 0) < 0.8) return;
    if (e.target.closest && e.target.closest(".waitlist, .moon-share, button, a, input, canvas.sign-pad")) return;
    if (e.clientY < window.innerHeight * 0.42) return;   // the sky isn't ground
    smoke.puff(e.clientX, e.clientY);
  });


  /* =========================================
     SHOOTING STARS
     Every 10 seconds, once the sky is visible, a faint gold
     shooting star crosses it and vanishes.
  ========================================= */

  (() => {
    if (!("animate" in document.documentElement)) return;
    const INTERVAL = 10000;

    function fire() {
      if (reducedMotion.matches || document.hidden) return;
      if ((values.lunar || 0) < 0.8 || (values["brand-out"] || 0) < 0.9) return;

      const W = stage.clientWidth, H = stage.clientHeight;
      const star = document.createElement("span");
      star.className = "shooting-star";
      stage.appendChild(star);

      const x = W * (0.35 + Math.random() * 0.6);
      const y = H * (0.04 + Math.random() * 0.2);
      const angle = 152 + Math.random() * 14;          // travelling left and down
      const dist = Math.min(W, H) * (0.35 + Math.random() * 0.2);
      const rad = angle * Math.PI / 180;
      const dx = Math.cos(rad) * dist, dy = Math.sin(rad) * dist;
      const at = (f, sx, o) =>
        ({ transform: `translate(${x + dx * f}px, ${y + dy * f}px) rotate(${angle + 180}deg) scaleX(${sx})`, opacity: o });

      const anim = star.animate(
        [at(0, 0.2, 0), at(0.25, 1, 1), at(1, 0.6, 0)],
        { duration: 1300, easing: "cubic-bezier(0.25, 0.6, 0.3, 1)" }
      );
      anim.onfinish = () => star.remove();
    }

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

  let step = "email";           // "email" → "name" → "done"
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

    chars.forEach((ch, i) => {
      const mid = at + widths[i] / 2;
      at += widths[i] + tracking();
      if (ch === " ") return;

      const p = path.getPointAtLength(mid);
      const q = path.getPointAtLength(Math.min(L, mid + 1));
      const angle = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      const squeeze = Math.sqrt(Math.max(0.2, 1 - Math.pow((p.x - CX) / HALF, 2)));
      letters.push({ ch, x: p.x, y: p.y, angle, squeeze, size });

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

    // Gold dust lifts off each letter as it is cut
    if (!isStatic) {
      letters.forEach((L, i) => {
        setTimeout(() => {
          const p = bottleToScreen(L.x, L.y - L.size * 0.3);
          if (p) smoke.sparkle(p.x, p.y, 10);
        }, i * NAME_STAGGER + 450);
      });
    }
  }

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
    let delay = 0;
    lines.forEach((s) => {
      const d = pathFor(s);
      paths.push(d);
      for (const cls of ["sig-glint", "sig-cut"]) {
        const p = document.createElementNS(ns, "path");
        p.setAttribute("d", d);
        p.setAttribute("class", cls);
        p.setAttribute("pathLength", "1");
        p.setAttribute("stroke-width", (cls === "sig-glint" ? width * 1.1 : width).toFixed(2));
        p.setAttribute("filter", cls === "sig-cut" ? "url(#name-cut)" : "url(#name-glint)");
        p.style.animationDelay = `${delay}ms, ${delay}ms`;
        group.appendChild(p);
        if (cls === "sig-cut") cutEls.push({ el: p, delay });
      }
      delay += 380;
    });

    engraving = { type: "signature", paths, width };

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
    }
    finish(null, lines);
  }


  /* ---- Steps ---- */

  function showNameStep() {
    step = "name";
    input.value = "";
    input.tabIndex = -1;
    if (nameInput) nameInput.tabIndex = 0;
    if (skipBtn) skipBtn.tabIndex = 0;
    modeBtns.forEach((b) => (b.tabIndex = 0));
    form.classList.add("is-name");
    status.textContent = "";
    setTimeout(() => nameInput && nameInput.focus({ preventScroll: true }), 400);
  }

  function finish(name, signature) {
    step = "done";
    form.classList.remove("is-name", "is-draw", "has-ink");
    modeBtns.forEach((b) => (b.tabIndex = -1));
    if (clearBtn) clearBtn.tabIndex = -1;
    form.classList.add("is-done");
    if (nameInput) { nameInput.value = ""; nameInput.tabIndex = -1; nameInput.blur(); }
    if (skipBtn) skipBtn.tabIndex = -1;
    status.textContent = name ? `${THANKS} Your name is engraved on the bottle.`
                       : signature ? `${THANKS} Your signature is engraved on the bottle.`
                       : THANKS;
    lightTheBottle();
    const delay = reducedMotion.matches ? 300 : NAME_DELAY;
    if (name) setTimeout(() => engraveBottle(name), delay);
    else if (signature) setTimeout(() => engraveSignature(signature), delay);
    else engraving = null;

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
    showNameStep();
  }

  async function submitName() {
    if (mode === "draw") return submitSignature();
    const name = cleanName(nameInput ? nameInput.value : "");
    if (!name) return finish(null);
    if (BLOCKED.test(name.replace(/[^\p{L}]/gu, ""))) {
      status.textContent = "Please choose another name";
      nameInput.focus();
      return;
    }
    nameInput.blur();
    // The name stays on this screen only; it is not sent anywhere.
    await engrave(name);
    finish(name);
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
      if (step === "name" && !busy) finish(null);
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

  function enableAfter() {
    if (saveBtn) saveBtn.tabIndex = 0;
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

  function closeShare() {
    if (!shareBox) return;
    shareBox.hidden = true;
    document.documentElement.style.overflow = "";
    if (saveBtn) saveBtn.focus({ preventScroll: true });
  }

  async function openShare() {
    if (!shareBox || !shareImg) return;
    const label = saveBtn ? saveBtn.textContent : "";
    if (saveBtn) saveBtn.textContent = "Preparing your moon";
    try {
      const blob = await drawMoonImage();
      if (shareUrl) URL.revokeObjectURL(shareUrl);
      shareUrl = URL.createObjectURL(blob);
      shareFile = new File([blob], "remoire.jpg", { type: "image/jpeg" });
      shareImg.src = shareUrl;

      const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [shareFile] }));
      if (shareShareBtn) shareShareBtn.hidden = !canShareFile;

      shareBox.hidden = false;
      document.documentElement.style.overflow = "hidden";
      (canShareFile ? shareShareBtn : shareSaveBtn).focus({ preventScroll: true });
    } catch (e) {
      console.warn("[REMOIRE] Could not prepare the image", e);
    } finally {
      if (saveBtn) saveBtn.textContent = label;
    }
  }

  if (saveBtn) saveBtn.addEventListener("click", openShare);
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
      a.download = "remoire.jpg";
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
})();
