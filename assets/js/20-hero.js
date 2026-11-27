/* --------------------------------------------------------------------------
   HERO — costellazione di particelle che compone il simbolo CORE829

   Ottimizzazioni: i punti vengono raggruppati per colore e opacità in pochi
   Path2D (una manciata di fill per frame invece di migliaia di cambi di stile),
   le posizioni del puntatore non leggono il layout, il ciclo si ferma fuori
   schermo o a scheda nascosta, e sui dispositivi deboli i punti sono meno.
   -------------------------------------------------------------------------- */
function initConstellation() {
  const canvas = $("[data-constellation]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  const DPR = Math.min(devicePixelRatio || 1, 1.75);
  const LOW_POWER = (navigator.hardwareConcurrency || 8) <= 4 || navigator.connection?.saveData === true;
  const LEVELS = 6; // livelli di opacità per i batch
  let W = 0, H = 0, lastW = 0, heroTop = 0, particles = [], ambient = [], running = false, raf = 0;
  const mouse = { x: -9999, y: -9999, active: false };
  let lastBurst = performance.now();
  let scanY = -1;

  function sampleMark(cx, cy, width, step) {
    const height = width * (MARK_H / MARK_W);
    const off = document.createElement("canvas");
    off.width = Math.ceil(width);
    off.height = Math.ceil(height);
    const o = off.getContext("2d", { willReadFrequently: true });
    o.scale(width / MARK_W, height / MARK_H);
    MARK_PATHS.forEach((d) => o.fill(new Path2D(d)));
    const data = o.getImageData(0, 0, off.width, off.height).data;
    const pts = [];
    for (let y = 0; y < off.height; y += step) {
      for (let x = 0; x < off.width; x += step) {
        if (data[(y * off.width + x) * 4 + 3] > 128) {
          pts.push({ x: cx - width / 2 + x + (Math.random() - 0.5) * step * 0.5, y: cy - height / 2 + y + (Math.random() - 0.5) * step * 0.5 });
        }
      }
    }
    return pts;
  }

  function build() {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height; lastW = W;
    heroTop = r.top + scrollY;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const desktop = W > 980;
    const width = desktop ? Math.min(W * 0.58, 860) : Math.min(W * 1.15, 560);
    // il simbolo si forma dietro la console demo, su ogni dimensione di schermo
    const demo = $(".hero__demo", hero)?.getBoundingClientRect();
    const cx = demo ? demo.left - r.left + demo.width / 2 : W * 0.7;
    const cy = demo ? demo.top - r.top + demo.height / 2 : H * 0.5;
    const step = (desktop ? 9 : 8) + (LOW_POWER ? 3 : 0);

    particles = sampleMark(cx, cy, width, step).map((t) => ({
      tx: t.x, ty: t.y,
      x: REDUCED ? t.x : Math.random() * W,
      y: REDUCED ? t.y : Math.random() * H,
      vx: 0, vy: 0,
      s: Math.random() < 0.12 ? 2 : 1.25,
      w: Math.random() < 0.08, // alcuni punti bianchi
      ph: Math.random() * Math.PI * 2,
    }));

    const n = (desktop ? 90 : 40) >> (LOW_POWER ? 1 : 0);
    ambient = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
    }));
  }

  const newBuckets = () => Array.from({ length: LEVELS }, () => new Path2D());
  const level = (a) => Math.min(LEVELS - 1, Math.max(0, Math.round(a * (LEVELS - 1))));
  const fillBuckets = (buckets, rgb, maxAlpha) => {
    buckets.forEach((path, i) => {
      ctx.fillStyle = `rgba(${rgb},${((i + 1) / LEVELS) * maxAlpha})`;
      ctx.fill(path);
    });
  };
  const strokeBuckets = (buckets, rgb, maxAlpha) => {
    buckets.forEach((path, i) => {
      ctx.strokeStyle = `rgba(${rgb},${((i + 1) / LEVELS) * maxAlpha})`;
      ctx.stroke(path);
    });
  };

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const t = now / 1000;
    const baseAlpha = W > 980 ? 0.85 : 0.4;

    // Raffica periodica: le particelle si disperdono e si ricompongono
    if (!REDUCED && now - lastBurst > 9000) {
      lastBurst = now;
      scanY = 0;
      for (const p of particles) {
        const a = Math.random() * Math.PI * 2;
        const f = 2 + Math.random() * 6;
        p.vx += Math.cos(a) * f;
        p.vy += Math.sin(a) * f;
      }
    }
    if (scanY >= 0) { scanY += 9; if (scanY > H) scanY = -1; }

    // Particelle ambientali + collegamenti (raggruppati per opacità)
    const lines = newBuckets(), mouseLines = newBuckets(), dots = new Path2D();
    for (const a of ambient) {
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > H) a.vy *= -1;
    }
    const R = 130, R2 = R * R, M2 = 180 * 180;
    for (let i = 0; i < ambient.length; i++) {
      const a = ambient[i];
      for (let j = i + 1; j < ambient.length; j++) {
        const b = ambient[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const path = lines[level(1 - Math.sqrt(d2) / R)];
          path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
        }
      }
      if (mouse.active) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < M2) {
          const path = mouseLines[level(1 - Math.sqrt(d2) / 180)];
          path.moveTo(a.x, a.y); path.lineTo(mouse.x, mouse.y);
        }
      }
      dots.rect(a.x - 0.75, a.y - 0.75, 1.5, 1.5);
    }
    ctx.lineWidth = 1;
    strokeBuckets(lines, "248,248,248", 0.07);
    if (mouse.active) strokeBuckets(mouseLines, "255,39,67", 0.35);
    ctx.fillStyle = "rgba(248,248,248,0.35)";
    ctx.fill(dots);

    // Particelle del simbolo: molla verso il bersaglio + repulsione dal cursore
    const red = newBuckets(), white = newBuckets();
    const P = 110, P2 = P * P;
    for (const p of particles) {
      if (!REDUCED) {
        p.vx += (p.tx + Math.sin(t * 1.3 + p.ph) * 1.2 - p.x) * 0.028;
        p.vy += (p.ty + Math.cos(t * 1.1 + p.ph) * 1.2 - p.y) * 0.028;
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < P2 && d2 > 0.01) {
            const d = Math.sqrt(d2), f = (1 - d / P) * 2.4;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
          }
        }
        p.vx *= 0.84; p.vy *= 0.84;
        p.x += p.vx; p.y += p.vy;
      }
      const near = scanY >= 0 && Math.abs(p.y - scanY) < 18;
      const alpha = near ? 1 : 0.55 + 0.45 * Math.sin(t * 2 + p.ph * 3);
      (p.w || near ? white : red)[level(alpha)].rect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    fillBuckets(red, "255,39,67", baseAlpha);
    fillBuckets(white, "248,248,248", baseAlpha);

    if (scanY >= 0) {
      const g = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 2);
      g.addColorStop(0, "rgba(255,39,67,0)");
      g.addColorStop(1, "rgba(255,39,67,0.18)");
      ctx.fillStyle = g;
      ctx.fillRect(0, scanY - 40, W, 42);
    }
  }

  const loop = (now) => { draw(now); if (running) raf = requestAnimationFrame(loop); };
  const start = () => { if (!running && !REDUCED && !document.hidden) { running = true; raf = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  build();
  if (REDUCED) draw(performance.now());

  // su mobile la barra degli indirizzi cambia solo l'altezza: ricostruiamo solo se cambia la larghezza
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(hero.getBoundingClientRect().width - lastW) < 1) return;
      build();
      if (REDUCED) draw(performance.now());
    }, 150);
  });
  hero.addEventListener("pointermove", (e) => {
    mouse.x = e.pageX; mouse.y = e.pageY - heroTop; mouse.active = true;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => (mouse.active = false));
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
}
