/* WIDgiT 2027 — interactive digital twin of a car.
   A small hand-built 3D renderer (no libraries). The topics of interest grow out of the twin.
   Topic text is read from the static cards in the page, so the page still works without JavaScript. */
(() => {
  'use strict';

  /* ---------- Scroll reveal (works even if the twin is missing) ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && !reduceMotion) {
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  }

  const root = document.getElementById('twin');
  if (!root) return;
  const stage = root.querySelector('.twin-stage');
  const canvas = root.querySelector('canvas');
  const labelsEl = root.querySelector('.twin-labels');
  const panel = root.querySelector('.twin-panel');
  const tabsEl = root.querySelector('.twin-tabs');
  const replayBtn = root.querySelector('.twin-replay');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  /* ---------- Topics (read from the static cards) ---------- */
  // Anchor = the point on the car each topic grows from.
  const ANCHORS = [
    [-0.2, 1.45, 0],     // Affordances: roof
    [0.1, 1.15, 0.72],   // Interaction: door
    [2.2, 0.5, 0],       // Spatial and physical: front bumper
    [1.5, 0.95, 0],      // Abstract: bonnet
    [-2.0, 0.95, 0],     // Collaboration: boot
    [1.4, 0.42, 0.95],   // Training: front wheel
    [-1.35, 0.42, -0.95] // Exemplars: rear wheel
  ];
  // Label positions in scene units, relative to the car (x right, y up).
  const LABEL_POS = [
    [0, 3.5], [-3.9, 1.5], [3.4, 2.9], [3.9, 1.5], [-3.4, 2.9], [3.4, 0.1], [-3.4, 0.1]
  ];
  const cards = [...document.querySelectorAll('.topic-cards .card')];
  const topics = cards.slice(0, ANCHORS.length).map((c, i) => ({
    title: c.querySelector('h3').textContent.trim(),
    short: c.dataset.short || c.querySelector('h3').textContent.trim(),
    items: [...c.querySelectorAll('li')].map((li) => li.textContent.trim()),
    anchor: ANCHORS[i],
    pos: LABEL_POS[i]
  }));
  if (!topics.length) return;

  /* ---------- Car model ---------- */
  const BODY = [226, 48, 74], GLASS = [130, 195, 240], TYRE = [28, 28, 38];
  const HUB = [90, 90, 105], HEAD = [255, 228, 130], TAIL = [255, 70, 70];
  const faces = [];
  const addFace = (pts, color, alpha, edge) => faces.push({ pts, color, alpha, edge: edge === undefined ? 0.5 : edge });

  function prism(poly, z0, z1, capColor, capA, edgeColors, sideA) {
    addFace(poly.map((p) => [p[0], p[1], z1]), capColor, capA);
    addFace(poly.map((p) => [p[0], p[1], z0]), capColor, capA);
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      addFace([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], edgeColors[i], sideA);
    });
  }
  function cylinder(cx, cy, cz, r, w, seg) {
    const ringA = [], ringB = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      ringA.push([cx + r * Math.cos(a), cy + r * Math.sin(a), cz - w / 2]);
      ringB.push([cx + r * Math.cos(a), cy + r * Math.sin(a), cz + w / 2]);
    }
    for (let k = 0; k < seg; k++) {
      const n = (k + 1) % seg;
      addFace([ringA[k], ringA[n], ringB[n], ringB[k]], TYRE, 0.9, 0.18);
    }
    addFace(ringA, HUB, 0.85, 0.25);
    addFace(ringB, HUB, 0.85, 0.25);
  }

  const lower = [[-2.1, 0.3], [2.1, 0.3], [2.2, 0.55], [2.05, 0.85], [1.0, 0.95], [-2.05, 0.95], [-2.2, 0.7]];
  const cabin = [[1.0, 0.95], [0.35, 1.45], [-0.75, 1.45], [-1.35, 0.95]];
  prism(lower, -0.85, 0.85, BODY, 0.5, lower.map(() => BODY), 0.55);
  prism(cabin, -0.7, 0.7, GLASS, 0.34, [GLASS, BODY, GLASS, BODY], 0.45);
  [-1, 1].forEach((s) => {
    // headlights on the slanted front panel, tail lights on the rear panel
    const hp = (t, z) => [2.2 - 0.15 * t + 0.012, 0.55 + 0.3 * t, z];
    addFace([hp(0.45, s * 0.42), hp(0.9, s * 0.42), hp(0.9, s * 0.78), hp(0.45, s * 0.78)], HEAD, 0.95, 0.2);
    const tp = (t, z) => [-2.05 - 0.15 * t - 0.012, 0.95 - 0.25 * t, z];
    addFace([tp(0.15, s * 0.4), tp(0.6, s * 0.4), tp(0.6, s * 0.78), tp(0.15, s * 0.78)], TAIL, 0.95, 0.2);
  });
  [[1.4, 1], [1.4, -1], [-1.35, 1], [-1.35, -1]].forEach(([x, s]) => cylinder(x, 0.42, s * 0.85, 0.42, 0.32, 14));

  /* ---------- View state ---------- */
  const PIV = [0, 1.0, 0];
  const D = 11;
  const L = (() => { const v = [-0.4, 0.8, 0.6]; const n = Math.hypot(...v); return v.map((c) => c / n); })();
  let yaw = -0.6, pitch = 0.3;
  let W = 0, H = 0, S = 80, CX = 0, CY = 0, F = 0, dpr = 1;
  let visible = false, sproutStart = null, active = -1;
  let dragging = false, lastX = 0, lastY = 0, moved = 0, lastInteract = -1e9;

  const rot = (p) => {
    const x = p[0] - PIV[0], y = p[1] - PIV[1], z = p[2] - PIV[2];
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  const proj = (r) => { const k = F / (D - r[2]); return [CX + r[0] * k, CY - r[1] * k]; };

  /* ---------- DOM: nodes, tabs, panel ---------- */
  const nodeEls = topics.map((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'twin-node';
    b.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="t"></span>';
    b.querySelector('.t').textContent = t.short;
    b.setAttribute('aria-label', t.title);
    b.addEventListener('click', () => select(i));
    labelsEl.appendChild(b);
    return b;
  });
  const tabEls = topics.map((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'twin-tab';
    b.textContent = (i + 1) + '. ' + t.short;
    b.addEventListener('click', () => select(i));
    tabsEl.appendChild(b);
    return b;
  });

  function select(i) {
    active = (active === i) ? -1 : i;
    nodeEls.forEach((el, k) => el.classList.toggle('active', k === active));
    tabEls.forEach((el, k) => el.classList.toggle('active', k === active));
    panel.textContent = '';
    if (active < 0) {
      const p = document.createElement('p');
      p.className = 'twin-empty';
      p.textContent = 'Select a node on the twin, or a topic below, to see what it covers.';
      panel.appendChild(p);
      return;
    }
    const t = topics[active];
    const h = document.createElement('h3');
    h.textContent = t.title;
    const ul = document.createElement('ul');
    t.items.forEach((txt) => { const li = document.createElement('li'); li.textContent = txt; ul.appendChild(li); });
    panel.append(h, ul);
  }
  select(-1);

  /* ---------- Layout and resize ---------- */
  const labelW = nodeEls.map(() => 40);
  function layout() {
    const r = stage.getBoundingClientRect();
    W = Math.max(280, r.width); H = Math.max(260, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W / 9.6, H / 6.2);
    CX = W / 2; CY = H * 0.64; F = S * D;
    nodeEls.forEach((el, i) => { labelW[i] = el.offsetWidth || 40; });
  }
  const labelPoint = (i) => {
    const u = topics[i].pos;
    const half = labelW[i] / 2 + 6;
    return { x: Math.min(W - half, Math.max(half, CX + u[0] * S)), y: CY - (u[1] - PIV[1]) * S };
  };
  window.addEventListener('resize', layout);
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(stage);

  /* ---------- Interaction ---------- */
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    lastInteract = performance.now();
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    yaw += dx * 0.01;
    pitch = Math.min(0.75, Math.max(-0.05, pitch + dy * 0.005));
    lastInteract = performance.now();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false; canvas.classList.remove('grabbing');
    if (moved < 6 && e.type === 'pointerup') {
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      let best = -1, bd = 18;
      anchorScr.forEach((a, i) => {
        if (!a || progress[i] <= 0.95) return;
        const d = Math.hypot(a[0] - px, a[1] - py);
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) select(best);
    }
    lastInteract = performance.now();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { yaw -= 0.15; lastInteract = performance.now(); }
    if (e.key === 'ArrowRight') { yaw += 0.15; lastInteract = performance.now(); }
  });
  replayBtn.addEventListener('click', () => { sproutStart = performance.now(); });

  /* ---------- Live readouts (illustrative) ---------- */
  const hud = {};
  root.querySelectorAll('[data-k]').forEach((el) => { hud[el.dataset.k] = el; });
  const state = { speed: 62, temp: 31, tyre: 2.4, lag: 12 };
  const tick = () => {
    state.speed = Math.max(40, Math.min(90, state.speed + (Math.random() - 0.5) * 6));
    state.temp = Math.max(28, Math.min(36, state.temp + (Math.random() - 0.5) * 0.8));
    state.tyre = Math.max(2.3, Math.min(2.6, state.tyre + (Math.random() - 0.5) * 0.04));
    state.lag = Math.max(6, Math.min(24, state.lag + (Math.random() - 0.5) * 5));
    if (hud.speed) hud.speed.textContent = Math.round(state.speed);
    if (hud.temp) hud.temp.textContent = state.temp.toFixed(1);
    if (hud.tyre) hud.tyre.textContent = state.tyre.toFixed(2);
    if (hud.lag) hud.lag.textContent = Math.round(state.lag);
  };
  tick();
  setInterval(() => { if (visible) tick(); }, 800);

  /* ---------- Render ---------- */
  const anchorScr = topics.map(() => null);
  const progress = topics.map(() => 0);
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const rgba = (c, sh, a) => 'rgba(' + Math.round(c[0] * sh) + ',' + Math.round(c[1] * sh) + ',' + Math.round(c[2] * sh) + ',' + a.toFixed(3) + ')';

  function drawFloor(time, carA) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,160,255,' + (0.17 * carA).toFixed(3) + ')';
    ctx.beginPath();
    for (let g = -6; g <= 6; g++) {
      const a = proj(rot([g, 0, -6])), b = proj(rot([g, 0, 6]));
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      const c = proj(rot([-6, 0, g])), d = proj(rot([6, 0, g]));
      ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
    }
    ctx.stroke();
    const ph = (time * 0.35) % 1;
    const rad = 1 + ph * 4.5;
    ctx.strokeStyle = 'rgba(255,140,185,' + (0.4 * (1 - ph) * carA).toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      const p = proj(rot([Math.cos(a) * rad, 0, Math.sin(a) * rad]));
      if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
  }

  function drawCar(carA) {
    const list = [];
    for (const f of faces) {
      const r = f.pts.map(rot);
      let z = 0;
      for (const v of r) z += v[2];
      list.push({ f, r, z: z / r.length });
    }
    list.sort((a, b) => a.z - b.z); // far to near
    for (const { f, r } of list) {
      const u = [r[1][0] - r[0][0], r[1][1] - r[0][1], r[1][2] - r[0][2]];
      const v = [r[2][0] - r[0][0], r[2][1] - r[0][1], r[2][2] - r[0][2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      const sh = 0.5 + 0.5 * Math.abs((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len);
      ctx.beginPath();
      r.forEach((p, i) => { const s = proj(p); if (i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]); });
      ctx.closePath();
      ctx.fillStyle = rgba(f.color, sh, f.alpha * carA);
      ctx.fill();
      if (f.edge > 0) {
        ctx.strokeStyle = 'rgba(255,195,220,' + (f.edge * carA).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  const bez = (A, C, B, t) => {
    const m = 1 - t;
    return [m * m * A[0] + 2 * m * t * C[0] + t * t * B[0], m * m * A[1] + 2 * m * t * C[1] + t * t * B[1]];
  };

  function drawTendrils(time, now) {
    topics.forEach((t, i) => {
      const a = proj(rot(t.anchor));
      anchorScr[i] = a;
      const p = progress[i];
      if (p <= 0) return;
      const B = labelPoint(i);
      const Bv = [B.x, B.y];
      const mid = [(a[0] + Bv[0]) / 2, (a[1] + Bv[1]) / 2];
      const dx = Bv[0] - a[0], dy = Bv[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const side = i % 2 ? 1 : -1;
      const C = [mid[0] - (dy / len) * len * 0.16 * side, mid[1] + (dx / len) * len * 0.16 * side];
      const isActive = i === active;
      const e = ease(p);
      ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,140,185,0.75)';
      ctx.lineWidth = isActive ? 2.2 : 1.3;
      ctx.beginPath();
      const N = 24;
      for (let k = 0; k <= N; k++) {
        const q = bez(a, C, Bv, (k / N) * e);
        if (k === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
      // anchor dot with pulse
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i);
      ctx.fillStyle = isActive ? '#ffffff' : '#ff8cb9';
      ctx.beginPath(); ctx.arc(a[0], a[1], isActive ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,185,' + (0.35 * (1 - pulse)).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(a[0], a[1], 6 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
      // data packet travelling out along the tendril
      if (p >= 1) {
        const q = bez(a, C, Bv, (time * 0.4 + i * 0.17) % 1);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function placeLabels() {
    topics.forEach((t, i) => {
      const p = progress[i];
      const B = labelPoint(i);
      const op = clamp01((p - 0.55) / 0.45);
      const sc = 0.6 + 0.4 * ease(op);
      const el = nodeEls[i];
      el.style.transform = 'translate(' + B.x.toFixed(1) + 'px,' + B.y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + sc.toFixed(3) + ')';
      el.style.opacity = op.toFixed(3);
      el.style.pointerEvents = op > 0.6 ? 'auto' : 'none';
      el.tabIndex = op > 0.6 ? 0 : -1;
    });
  }

  let prev = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { prev = now; return; }
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const time = now / 1000;
    if (!dragging && !reduceMotion && now - lastInteract > 2500) yaw += 0.22 * dt;

    const since = sproutStart === null ? -1 : (now - sproutStart) / 1000;
    const carA = reduceMotion ? 1 : clamp01(since / 1.0);
    topics.forEach((t, i) => {
      progress[i] = reduceMotion ? (sproutStart === null ? 0 : 1) : clamp01((since - 0.7 - i * 0.28) / 0.9);
    });

    ctx.clearRect(0, 0, W, H);
    drawFloor(time, Math.max(carA, 0.25));
    if (sproutStart !== null) drawCar(carA);
    drawTendrils(time, now);
    placeLabels();
  }

  /* ---------- Start when scrolled into view ---------- */
  layout();
  const start = () => { if (sproutStart === null) sproutStart = performance.now(); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        visible = e.isIntersecting;
        if (e.isIntersecting && e.intersectionRatio >= 0.3) start();
      });
    }, { threshold: [0, 0.3] }).observe(stage);
  } else {
    visible = true; start();
  }
  // Only now hide the plain cards, so the page keeps working if anything above failed.
  document.documentElement.classList.add('js');
  requestAnimationFrame(frame);
})();
