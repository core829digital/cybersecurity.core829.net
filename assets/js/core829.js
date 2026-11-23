/* ==========================================================================
   CORE829 Cybersecurity — interazioni e motion design
   Nessuna dipendenza esterna. Rispetta prefers-reduced-motion.
   ========================================================================== */

const root = document.documentElement;
root.classList.add("js");

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const T0 = performance.now();

/* Simbolo CORE829 (viewBox 0 0 1022 692) */
const MARK_PATHS = [
  "M464.805 29.531A331 346 0 1 0 629.059 195.526A14 14 0 0 0 609.015 189.485A166 180 0 0 0 525 346A194 208 0 1 1 377.278 144.005A14 14 0 0 0 392.621 138.032A359 374 0 0 1 467.853 53.027A14 14 0 0 0 464.805 29.531Z",
  "M557.195 662.469A331 346 0 1 0 392.941 496.474A14 14 0 0 0 412.985 502.515A166 180 0 0 0 497 346A194 208 0 1 1 644.722 547.995A14 14 0 0 0 629.379 553.968A359 374 0 0 1 554.147 638.973A14 14 0 0 0 557.195 662.469Z",
];
const MARK_W = 1022;
const MARK_H = 692;

/* --------------------------------------------------------------------------
   Navigazione, progresso di lettura, menu mobile
   -------------------------------------------------------------------------- */
function initNav() {
  const nav = $("[data-nav]");
  const bar = $("[data-progress]");
  const menu = $("[data-menu]");
  const toggle = $("[data-menu-toggle]");
  let lastY = scrollY;
  let ticking = false;

  const update = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav?.classList.toggle("is-scrolled", y > 24);
    const menuOpen = menu?.classList.contains("is-open");
    nav?.classList.toggle("is-hidden", !menuOpen && y > 480 && y > lastY + 4);
    if (y < lastY - 4 || y < 480) nav?.classList.remove("is-hidden");
    lastY = y;
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  if (toggle && menu) {
    const set = (open) => {
      menu.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      $(".sr-only", toggle).textContent = open ? "Chiudi il menu" : "Apri il menu";
    };
    toggle.addEventListener("click", () => set(!menu.classList.contains("is-open")));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => set(false)));
    addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  }
}

/* --------------------------------------------------------------------------
   Comparsa allo scroll + effetti collegati
   -------------------------------------------------------------------------- */
const onReveal = new Map(); // elemento -> callback eseguita alla prima comparsa

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-in");
      onReveal.get(e.target)?.();
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  $$(".reveal, [data-scramble], [data-count]").forEach((el) => io.observe(el));
}

/* Effetto "decrittazione" sul testo */
const GLYPHS = "!<>-_\\/[]{}=+*^?#01ABCDEFX§%";
function scramble(el, duration = 1000) {
  if (REDUCED || el.dataset.scrambled) return;
  el.dataset.scrambled = "1";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
  const finals = nodes.map((n) => n.nodeValue);
  const total = finals.reduce((a, s) => a + s.length, 0);
  const label = el.textContent.replace(/\s+/g, " ").trim();
  el.setAttribute("aria-label", label);
  const start = performance.now();

  const frame = (now) => {
    const p = clamp((now - start) / duration, 0, 1);
    let offset = 0;
    nodes.forEach((node, i) => {
      const f = finals[i];
      let out = "";
      for (let c = 0; c < f.length; c++) {
        const ch = f[c];
        const threshold = (offset + c) / total;
        out += ch === " " || ch === "\n" || p >= threshold * 0.85 + 0.15 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      node.nodeValue = out;
      offset += f.length;
    });
    if (p < 1) requestAnimationFrame(frame);
    else { nodes.forEach((n, i) => (n.nodeValue = finals[i])); el.removeAttribute("aria-label"); }
  };
  requestAnimationFrame(frame);
}

function initScramble() {
  $$("[data-scramble]").forEach((el) => {
    if (el.closest(".hero") || el.closest(".lost")) setTimeout(() => scramble(el, 1300), 150);
    else onReveal.set(el, () => scramble(el, 800));
  });
}

/* Contatori numerici */
function initCounters() {
  $$("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const fmt = (v) => v.toFixed(dec).replace(".", ",");
    if (REDUCED) { el.textContent = fmt(target); return; }
    el.textContent = fmt(0);
    onReveal.set(el, () => {
      const start = performance.now();
      const dur = 1600;
      const tick = (now) => {
        const p = clamp((now - start) / dur, 0, 1);
        el.textContent = fmt(target * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

/* Ora locale nell'HUD */
function initClock() {
  const el = $("[data-clock]");
  if (!el) return;
  const set = () => {
    const d = new Date();
    el.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    el.dateTime = d.toISOString();
  };
  set();
  setInterval(set, 15000);
}

/* Luce che segue il cursore sulle card + bottoni magnetici */
function initPointerFx() {
  if (!matchMedia("(hover: hover)").matches) return;
  $$("[data-spotlight]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
  if (REDUCED) return;
  $$("[data-magnetic]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.18;
      const y = (e.clientY - r.top - r.height / 2) * 0.3;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });
}

/* --------------------------------------------------------------------------
   HERO — costellazione di particelle che compone il simbolo CORE829
   -------------------------------------------------------------------------- */
function initConstellation() {
  const canvas = $("[data-constellation]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0, particles = [], ambient = [], running = false, raf = 0;
  const mouse = { x: -9999, y: -9999, active: false };
  let lastBurst = performance.now();
  let scanY = -1;

  function sampleMark(cx, cy, width, step) {
    const height = width * (MARK_H / MARK_W);
    const off = document.createElement("canvas");
    off.width = Math.ceil(width);
    off.height = Math.ceil(height);
    const o = off.getContext("2d");
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
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const desktop = W > 980;
    const width = desktop ? Math.min(W * 0.58, 860) : Math.min(W * 1.15, 560);
    // il simbolo si forma dietro la chat demo, su ogni dimensione di schermo
    const demo = $(".hero__demo", hero)?.getBoundingClientRect();
    const cx = demo ? demo.left - r.left + demo.width / 2 : W * 0.7;
    const cy = demo ? demo.top - r.top + demo.height / 2 : H * 0.5;
    const step = desktop ? 9 : 8;
    const targets = sampleMark(cx, cy, width, step);

    particles = targets.map((t) => ({
      tx: t.x, ty: t.y,
      x: REDUCED ? t.x : Math.random() * W,
      y: REDUCED ? t.y : Math.random() * H,
      vx: 0, vy: 0,
      s: Math.random() < 0.12 ? 2 : 1.25,
      w: Math.random() < 0.08, // alcuni punti bianchi
      ph: Math.random() * Math.PI * 2,
    }));

    const n = desktop ? 90 : 46;
    ambient = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
    }));
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const t = now / 1000;
    const desktop = W > 980;
    const baseAlpha = desktop ? 0.85 : 0.4;

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

    // Particelle ambientali + collegamenti
    ctx.lineWidth = 1;
    for (const a of ambient) {
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > W) a.vx *= -1;
      if (a.y < 0 || a.y > H) a.vy *= -1;
    }
    for (let i = 0; i < ambient.length; i++) {
      const a = ambient[i];
      for (let j = i + 1; j < ambient.length; j++) {
        const b = ambient[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130) {
          ctx.strokeStyle = `rgba(248,248,248,${0.07 * (1 - Math.sqrt(d2) / 130)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (mouse.active) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 180 * 180) {
          ctx.strokeStyle = `rgba(255,39,67,${0.35 * (1 - Math.sqrt(d2) / 180)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(248,248,248,0.35)";
      ctx.fillRect(a.x - 0.75, a.y - 0.75, 1.5, 1.5);
    }

    // Particelle del simbolo: molla verso il bersaglio + repulsione dal cursore
    for (const p of particles) {
      if (!REDUCED) {
        const jx = Math.sin(t * 1.3 + p.ph) * 1.2;
        const jy = Math.cos(t * 1.1 + p.ph) * 1.2;
        p.vx += (p.tx + jx - p.x) * 0.028;
        p.vy += (p.ty + jy - p.y) * 0.028;
        if (mouse.active) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 110 * 110 && d2 > 0.01) {
            const d = Math.sqrt(d2), f = (1 - d / 110) * 2.4;
            p.vx += (dx / d) * f; p.vy += (dy / d) * f;
          }
        }
        p.vx *= 0.84; p.vy *= 0.84;
        p.x += p.vx; p.y += p.vy;
      }
      const near = scanY >= 0 && Math.abs(p.y - scanY) < 18;
      const flicker = 0.55 + 0.45 * Math.sin(t * 2 + p.ph * 3);
      const alpha = baseAlpha * (near ? 1 : flicker);
      ctx.fillStyle = p.w || near ? `rgba(248,248,248,${alpha})` : `rgba(255,39,67,${alpha})`;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }

    if (scanY >= 0) {
      const g = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 2);
      g.addColorStop(0, "rgba(255,39,67,0)");
      g.addColorStop(1, "rgba(255,39,67,0.18)");
      ctx.fillStyle = g;
      ctx.fillRect(0, scanY - 40, W, 42);
    }
  }

  const loop = (now) => { draw(now); if (running) raf = requestAnimationFrame(loop); };
  const start = () => { if (!running && !REDUCED) { running = true; raf = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  build();
  if (REDUCED) draw(performance.now());

  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); if (REDUCED) draw(performance.now()); }, 150);
  });
  hero.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
  });
  hero.addEventListener("pointerleave", () => (mouse.active = false));
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
}

/* --------------------------------------------------------------------------
   Console di attacco (demo)
   -------------------------------------------------------------------------- */
/* Ogni passo: [ritardo ms, tipo, agente, testo, dettagli?]
   tipo: "run" = in corso, "ok" = completato, "find" = vulnerabilità dimostrata */
const CAMPAIGNS = {
  ecommerce: {
    target: "shop.esempio.it",
    mode: "Campagna di test · black-box",
    agents: 6,
    steps: [
      [500, "run", "RECON", "mappatura della superficie di attacco"],
      [1500, "ok", "RECON", "48 endpoint · 6 moduli · 1 API di pagamento"],
      [900, "run", "INJ", "test parametri su /prodotti?cerca="],
      [900, "run", "ACL", "accesso a /account/ordini/{id} con un altro utente"],
      [1700, "find", "ACL", "Ordini di altri clienti visibili (IDOR)", { sev: "high", cvss: "8.1", poc: "GET /account/ordini/10431 → 200 OK · dati di un altro cliente" }],
      [1100, "run", "LOGIC", "manipolazione del carrello in fase di conferma"],
      [1800, "find", "LOGIC", "Prezzo del carrello modificabile dal browser", { sev: "crit", cvss: "9.1", poc: "POST /api/carrello/conferma · prezzo: 0.01 → ordine creato" }],
      [900, "run", "XSS", "payload nelle recensioni dei prodotti"],
      [1400, "find", "XSS", "XSS memorizzato nelle recensioni", { sev: "med", cvss: "5.4", poc: "<img onerror> eseguito nella pagina prodotto" }],
      [1000, "ok", "REPORT", "3 vulnerabilità dimostrate · correzioni pronte"],
    ],
  },
  saas: {
    target: "app.esempio.io",
    mode: "Campagna di test · autenticato",
    agents: 7,
    steps: [
      [500, "run", "RECON", "lettura specifica OpenAPI e ruoli utente"],
      [1400, "ok", "RECON", "112 endpoint · 3 ruoli · multi-tenant"],
      [900, "run", "AUTH", "analisi dei token di sessione JWT"],
      [1700, "find", "AUTH", "Token JWT accettato senza firma", { sev: "crit", cvss: "9.8", poc: 'alg: "none" · role: "admin" → accesso al pannello' }],
      [1000, "run", "ACL", "accesso ai workspace di altri clienti"],
      [1700, "find", "ACL", "Dati di un altro cliente leggibili", { sev: "high", cvss: "8.8", poc: "GET /api/v1/workspaces/2207/fatture → 200 OK" }],
      [900, "run", "API", "assegnazione di campi protetti"],
      [1400, "find", "API", "Un utente può cambiarsi il ruolo", { sev: "high", cvss: "8.1", poc: 'PATCH /api/v1/me { "ruolo": "owner" } → 200 OK' }],
      [1000, "ok", "REPORT", "3 vulnerabilità dimostrate · correzioni pronte"],
    ],
  },
  sanita: {
    target: "prenota.esempio-clinica.it",
    mode: "Campagna di test · black-box",
    agents: 5,
    steps: [
      [500, "run", "RECON", "mappatura area pazienti e prenotazioni"],
      [1400, "ok", "RECON", "31 endpoint · area riservata · download referti"],
      [900, "run", "ACL", "download dei referti senza autenticazione"],
      [1800, "find", "ACL", "Referti scaricabili senza login", { sev: "crit", cvss: "9.1", poc: "GET /referti/download?id=88213 → PDF di un paziente" }],
      [1000, "run", "SESS", "durata e invalidazione delle sessioni"],
      [1400, "find", "SESS", "La sessione resta valida dopo il logout", { sev: "med", cvss: "5.9", poc: "cookie riutilizzato dopo /logout → 200 OK" }],
      [900, "run", "CONFIG", "header di sicurezza e servizi esposti"],
      [1300, "find", "CONFIG", "Header di sicurezza mancanti", { sev: "low", cvss: "3.1", poc: "assenti Content-Security-Policy e HSTS" }],
      [1000, "ok", "REPORT", "3 vulnerabilità dimostrate · correzioni pronte"],
    ],
  },
  wordpress: {
    target: "www.esempio-azienda.it",
    mode: "Campagna di test · black-box",
    agents: 5,
    steps: [
      [500, "run", "RECON", "rilevamento tema, plugin e versioni"],
      [1400, "ok", "RECON", "WordPress · 14 plugin · 2 moduli di contatto"],
      [900, "run", "VULN", "confronto versioni con vulnerabilità note"],
      [1700, "find", "VULN", "Plugin obsoleto con vulnerabilità nota", { sev: "high", cvss: "8.8", poc: "upload di file non autorizzato · versione vulnerabile confermata" }],
      [1000, "run", "AUTH", "protezioni del pannello /wp-admin"],
      [1500, "find", "AUTH", "Login senza limite di tentativi", { sev: "med", cvss: "5.3", poc: "200 tentativi in 60 s · nessun blocco" }],
      [900, "run", "INFO", "enumerazione utenti e file esposti"],
      [1300, "find", "INFO", "Nomi utente amministratore esposti", { sev: "low", cvss: "3.7", poc: "GET /wp-json/wp/v2/users → elenco utenti" }],
      [1000, "ok", "REPORT", "3 vulnerabilità dimostrate · correzioni pronte"],
    ],
  },
  api: {
    target: "api.esempio.com",
    mode: "Campagna di test · autenticato",
    agents: 6,
    steps: [
      [500, "run", "RECON", "import collezione Postman e schemi"],
      [1400, "ok", "RECON", "76 endpoint · 2 versioni dell'API"],
      [900, "run", "SSRF", "parametri che accettano URL esterni"],
      [1800, "find", "SSRF", "Il server scarica URL interni (SSRF)", { sev: "high", cvss: "8.6", poc: "url=http://169.254.169.254/ → metadati cloud" }],
      [1000, "run", "INJ", "iniezioni nei filtri di ricerca"],
      [1700, "find", "INJ", "SQL injection nel filtro ordini", { sev: "crit", cvss: "9.8", poc: "?stato=' OR 1=1-- → tutti gli ordini restituiti" }],
      [900, "run", "RATE", "limiti di frequenza su login e OTP"],
      [1300, "find", "RATE", "Codice OTP indovinabile per tentativi", { sev: "high", cvss: "7.5", poc: "10.000 tentativi senza blocco su /v2/otp" }],
      [1000, "ok", "REPORT", "3 vulnerabilità dimostrate · correzioni pronte"],
    ],
  },
};

const SEV_LABEL = { crit: "CRITICA", high: "ALTA", med: "MEDIA", low: "BASSA" };

class ConsoleDemo {
  constructor(el) {
    this.el = el;
    this.log = $("[data-console-log]", el);
    this.target = $("[data-console-target]", el);
    this.mode = $("[data-console-mode]", el);
    this.agents = $("[data-console-agents]", el);
    this.time = $("[data-console-time]", el);
    this.sev = Object.fromEntries($$("[data-sev]", el).map((b) => [b.dataset.sev, b]));
    this.run = 0;
    this.visible = false;
    this.started = false;
    this.t0 = 0;
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible && !this.started) { this.started = true; this.play(el.dataset.console); }
    }, { threshold: 0.25 }).observe(el);
    setInterval(() => this.tick(), 250);
  }

  tick() {
    if (!this.t0 || !this.visible) return;
    const s = Math.floor((performance.now() - this.t0) / 1000);
    this.time.textContent = [s / 3600, (s / 60) % 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, "0")).join(":");
  }

  async wait(ms, id) {
    const end = performance.now() + ms;
    while (performance.now() < end || !this.visible || document.hidden) {
      if (id !== this.run) throw new Error("stop");
      await sleep(Math.min(80, Math.max(16, end - performance.now())));
    }
    if (id !== this.run) throw new Error("stop");
  }

  reset(c) {
    this.log.replaceChildren();
    Object.values(this.sev).forEach((b) => { b.textContent = "0"; b.parentElement.classList.remove("is-hit"); });
    this.target.textContent = c.target;
    this.mode.textContent = c.mode;
    this.agents.textContent = `${c.agents} agenti attivi`;
    this.t0 = performance.now();
  }

  line(kind, agent, text, stamp) {
    const p = document.createElement("p");
    p.className = `cl cl--${kind}`;
    const t = document.createElement("span"); t.className = "cl__t"; t.textContent = stamp;
    const a = document.createElement("span"); a.className = "cl__a"; a.textContent = agent;
    const m = document.createElement("span"); m.className = "cl__m";
    m.textContent = (kind === "run" ? "▸ " : kind === "ok" ? "✓ " : "■ ") + text;
    p.append(t, a, m);
    this.log.appendChild(p);
    while (this.log.children.length > 14) this.log.firstElementChild.remove();
    return p;
  }

  finding(d, title) {
    const f = document.createElement("div");
    f.className = `finding finding--${d.sev}`;
    const top = document.createElement("div"); top.className = "finding__top";
    const pill = document.createElement("span"); pill.className = `sev-pill sev-pill--${d.sev}`; pill.textContent = `${SEV_LABEL[d.sev]} · CVSS ${d.cvss}`;
    const ok = document.createElement("span"); ok.className = "finding__ok"; ok.textContent = "✓ PoC verificata";
    top.append(pill, ok);
    const h = document.createElement("p"); h.className = "finding__title"; h.textContent = title;
    const poc = document.createElement("p"); poc.className = "finding__pocline"; poc.textContent = d.poc;
    f.append(top, h, poc);
    this.log.appendChild(f);
    const b = this.sev[d.sev];
    b.textContent = String(Number(b.textContent) + 1);
    b.parentElement.classList.remove("is-hit"); void b.offsetWidth; b.parentElement.classList.add("is-hit");
  }

  stamp() {
    const s = Math.floor((performance.now() - this.t0) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  async play(key) {
    const id = ++this.run;
    const c = CAMPAIGNS[key] || CAMPAIGNS.ecommerce;
    this.el.dataset.console = key;
    this.reset(c);

    if (REDUCED) {
      for (const [, kind, agent, text, d] of c.steps) {
        if (kind === "find") this.finding(d, text); else this.line(kind, agent, text, "--:--");
      }
      return;
    }
    try {
      for (;;) {
        for (const [delay, kind, agent, text, d] of c.steps) {
          await this.wait(delay, id);
          if (kind === "find") {
            this.line("find", agent, "vulnerabilità dimostrata", this.stamp());
            await this.wait(350, id);
            this.finding(d, text);
          } else {
            this.line(kind, agent, text, this.stamp());
          }
        }
        this.agents.textContent = "campagna completata";
        await this.wait(6000, id);
        this.log.style.transition = "opacity .5s";
        this.log.style.opacity = "0";
        await this.wait(550, id);
        this.reset(c);
        this.log.style.opacity = "1";
      }
    } catch { /* riproduzione interrotta (cambio scenario) */ }
  }
}

function initConsoles() {
  $$("[data-console]").forEach((el) => {
    const demo = new ConsoleDemo(el);
    if (el.closest(".sectors__demo")) {
      const tabs = $$("[data-sector-tabs] [role=tab]");
      tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => {
          tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
          demo.started = true;
          demo.play(tab.dataset.sector);
        });
        tab.addEventListener("keydown", (e) => {
          const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
          if (!dir) return;
          e.preventDefault();
          const next = tabs[(i + dir + tabs.length) % tabs.length];
          next.focus(); next.click();
        });
      });
    }
  });
}

/* --------------------------------------------------------------------------
   Terminale del perimetro di test
   -------------------------------------------------------------------------- */
const TERM = {
  esterno: {
    hint: "Perimetro del test · dall'esterno",
    out: ["autorizzazione firmata", "dominio verificato (record DNS)", "6 agenti avviati nella finestra concordata"],
  },
  login: {
    hint: "Perimetro del test · con login",
    out: ["autorizzazione firmata", "utenti di test ricevuti", "7 agenti avviati su 2 ruoli"],
  },
  codice: {
    hint: "Perimetro del test · codice sorgente",
    out: ["accesso in sola lettura al repository", "analisi del codice + test sull'app in staging", "test collegati alle pull request"],
  },
};

function highlight(code, text) {
  code.replaceChildren();
  text.split("\n").forEach((row, i) => {
    if (i) code.append(document.createTextNode("\n"));
    const m = row.match(/^(\s*[\w-]+:)(.*)$/);
    if (!m) { code.append(document.createTextNode(row)); return; }
    const k = document.createElement("span"); k.className = "t-tag"; k.textContent = m[1];
    const v = document.createElement("span"); v.className = "t-str"; v.textContent = m[2];
    code.append(k, v);
  });
}

function initTerminal() {
  const term = $("[data-terminal]");
  if (!term) return;
  const code = $("[data-term-code]", term);
  const hint = $("[data-term-hint]", term);
  const out = $("[data-term-out]", term);
  const tabs = $$("[role=tab]", term);
  let current = "esterno", run = 0, visible = false;
  const src = (k) => $(`[data-term-src="${k}"]`, term).dataset.text.trim();

  async function play(key) {
    const id = ++run;
    current = key;
    const text = src(key);
    const cfg = TERM[key];
    hint.textContent = cfg.hint;
    out.replaceChildren();
    code.textContent = "";
    if (REDUCED) { highlight(code, text); cfg.out.forEach((l) => addLine(l)); return; }
    for (let i = 1; i <= text.length; i++) {
      if (id !== run) return;
      code.textContent = text.slice(0, i);
      await sleep(text[i - 1] === "\n" ? 160 : 18);
    }
    highlight(code, text);
    for (const l of cfg.out) {
      await sleep(420);
      if (id !== run) return;
      addLine(l);
    }
  }
  function addLine(l) {
    const p = document.createElement("p");
    const b = document.createElement("b"); b.textContent = "✓ ";
    p.append(b, document.createTextNode(l));
    out.appendChild(p);
  }

  tabs.forEach((t) => t.addEventListener("click", () => {
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    play(t.dataset.tab);
  }));
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !visible) { visible = true; play(current); }
  }, { threshold: 0.35 }).observe(term);
}

/* Linea di avanzamento dei passaggi */
function initSteps() {
  const steps = $("[data-steps]");
  if (!steps) return;
  const items = $$(".step", steps);
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = steps.getBoundingClientRect();
    const p = clamp((innerHeight * 0.72 - r.top) / (r.height * 0.9), 0, 1);
    steps.style.setProperty("--p", p.toFixed(3));
    const desktop = innerWidth > 980;
    items.forEach((it, i) => {
      const lit = desktop ? p >= i / (items.length - 1) - 0.02 : it.getBoundingClientRect().top < innerHeight * 0.7;
      it.classList.toggle("is-lit", REDUCED || lit);
    });
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();
}

/* --------------------------------------------------------------------------
   Prezzi
   -------------------------------------------------------------------------- */
function initBilling() {
  const group = $("[data-billing]");
  if (!group) return;
  const btns = $$("button", group);
  btns.forEach((b) => b.addEventListener("click", () => {
    const yearly = b.dataset.period === "yearly";
    if (group.classList.contains("is-yearly") === yearly) return;
    group.classList.toggle("is-yearly", yearly);
    btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $$("[data-price]").forEach((el) => {
      el.classList.remove("is-rolling"); void el.offsetWidth; el.classList.add("is-rolling");
      setTimeout(() => {
        el.textContent = yearly ? Number(el.dataset.yearly).toLocaleString("it-IT") : el.dataset.monthly;
        const card = el.closest(".plan");
        $("[data-per]", card).textContent = yearly ? "/anno" : "/mese";
        const note = $(".plan__note", card);
        note.textContent = yearly ? note.dataset.yearlyNote + " · IVA esclusa" : note.dataset.monthlyNote;
      }, REDUCED ? 0 : 200);
    });
  }));
}

/* I pulsanti "Richiedi …" preselezionano il piano nel modulo */
function initPlanPick() {
  const plan = $("#f-servizio");
  const type = $("#f-tipo");
  $$("[data-plan-pick]").forEach((a) => a.addEventListener("click", () => {
    if (plan) plan.value = a.dataset.planPick;
    if (type && a.dataset.typePick) type.value = a.dataset.typePick;
    setTimeout(() => $("#f-nome")?.focus({ preventScroll: true }), 700);
  }));
}

/* --------------------------------------------------------------------------
   Modulo di richiesta
   -------------------------------------------------------------------------- */
function initForm() {
  const form = $("[data-request-form]");
  if (!form) return;
  const status = $("[data-form-status]", form);
  const submit = $("[data-submit]", form);
  const label = $("[data-submit-label]", form);
  const done = $("[data-form-done]", form);

  const setError = (name, msg) => {
    const err = $(`#e-${name}`, form);
    const input = form.elements[name];
    const field = input?.closest(".field");
    field?.classList.toggle("is-invalid", !!msg);
    if (err) err.textContent = msg || "";
    if (input) {
      if (msg) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", `e-${name}`); }
      else { input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby"); }
    }
  };

  const RULES = {
    nome: (v) => (v.trim().length < 2 ? "Inserisci nome e cognome." : ""),
    azienda: (v) => (v.trim().length < 2 ? "Inserisci il nome dell'azienda." : ""),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Inserisci un indirizzo email valido."),
    telefono: (v) => (v && !/^[\d\s+().\-/]+$/.test(v) ? "Il numero può contenere solo cifre, spazi e +." : ""),
    target: (v) => (/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(v.trim()) ? "" : "Inserisci l'indirizzo da testare, es. www.tuosito.it"),
    tipo: (v) => (v ? "" : "Seleziona il tipo di sistema."),
  };

  const CHECKS = {
    autorizzazione: "Possiamo testare solo sistemi di cui sei titolare o per cui hai l'autorizzazione del titolare.",
    privacy: "Per inviare la richiesta serve il consenso all'informativa.",
  };
  const FIELDS = [...Object.keys(RULES), ...Object.keys(CHECKS)];

  const validateField = (name) => {
    if (CHECKS[name]) {
      const msg = form.elements[name].checked ? "" : CHECKS[name];
      setError(name, msg);
      return !msg;
    }
    const rule = RULES[name];
    if (!rule) return true;
    const msg = rule(form.elements[name].value);
    setError(name, msg);
    return !msg;
  };

  FIELDS.forEach((name) => {
    const el = form.elements[name];
    el?.addEventListener("blur", () => { if (el.value || el.closest(".field").classList.contains("is-invalid")) validateField(name); });
    el?.addEventListener("change", () => { if (el.closest(".field").classList.contains("is-invalid")) validateField(name); });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.classList.remove("is-error");
    const ok = FIELDS.map(validateField).every(Boolean);
    if (!ok) {
      status.textContent = "Controlla i campi evidenziati.";
      status.classList.add("is-error");
      form.querySelector(".is-invalid input, .is-invalid select")?.focus();
      return;
    }

    const f = form.elements;
    const payload = {
      nome: f.nome.value, azienda: f.azienda.value, email: f.email.value, telefono: f.telefono.value,
      target: f.target.value, tipo: f.tipo.value, servizio: f.servizio.value, messaggio: f.messaggio.value,
      autorizzazione: f.autorizzazione.checked, privacy: f.privacy.checked, fax: f.fax.value, elapsed_ms: Math.round(performance.now() - T0),
    };

    submit.classList.add("is-loading");
    submit.setAttribute("aria-busy", "true");
    label.textContent = "Invio in corso…";
    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        done.hidden = false;
        done.focus();
        form.reset();
        return;
      }
      if (data.errors) Object.entries(data.errors).forEach(([k, m]) => setError(k, m));
      status.textContent = data.message || "Si è verificato un errore. Riprova.";
      status.classList.add("is-error");
    } catch {
      status.textContent = "Connessione non riuscita. Riprova o scrivici a hello@core829.net.";
      status.classList.add("is-error");
    } finally {
      submit.classList.remove("is-loading");
      submit.removeAttribute("aria-busy");
      label.textContent = "Invia richiesta";
    }
  });
}

/* --------------------------------------------------------------------------
   Avvio
   -------------------------------------------------------------------------- */
initNav();
initScramble();
initCounters();
initReveal();
initClock();
initPointerFx();
initConstellation();
initConsoles();
initTerminal();
initSteps();
initBilling();
initPlanPick();
initForm();
