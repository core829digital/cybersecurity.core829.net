/* ==========================================================================
   STRIX by CORE829 — interazioni e motion design
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
   Demo della chat
   -------------------------------------------------------------------------- */
const CHATS = {
  hotel: {
    name: "Hotel Belvedere",
    lead: "Contatto inviato alla reception · email",
    steps: [
      ["user", "Ciao! Avete una doppia libera dal 14 al 16 agosto? C'è il parcheggio?"],
      ["bot", "Ciao! Le camere doppie partono da 120 € a notte con colazione inclusa, e il parcheggio privato è gratuito per gli ospiti. Per confermarti la disponibilità di quelle date ti metto in contatto con la reception: mi lasci la tua email?", ["camere.html", "servizi.html"]],
      ["user", "mario.rossi@email.it"],
      ["bot", "Perfetto, Mario. La reception ti scrive al più presto con la conferma. Buona giornata!"],
    ],
  },
  ristorante: {
    name: "Osteria del Porto",
    lead: "Richiesta tavolo inviata · WhatsApp",
    steps: [
      ["user", "Avete piatti senza glutine? Siete aperti il lunedì?"],
      ["bot", "Sì: nel menù trovi 8 piatti senza glutine segnalati, e la pasta può essere preparata senza glutine su richiesta. Il lunedì siamo chiusi; da martedì a domenica siamo aperti dalle 19:00 alle 23:30.", ["menu.pdf", "orari.html"]],
      ["user", "Vorrei prenotare per 4 sabato sera"],
      ["bot", "Volentieri! Lasciami un numero di telefono e lo staff ti conferma il tavolo per sabato."],
    ],
  },
  medico: {
    name: "Poliambulatorio San Luca",
    lead: "Richiamata richiesta alla segreteria",
    steps: [
      ["user", "Quanto costa una visita cardiologica? Serve l'impegnativa?"],
      ["bot", "La visita cardiologica con elettrocardiogramma costa 120 €. Essendo in regime privato non serve l'impegnativa. Non posso dare consigli medici, ma posso farti richiamare dalla segreteria per fissare l'appuntamento.", ["tariffe-2026.pdf"]],
      ["user", "Sì, grazie: 333 123 4567"],
      ["bot", "Fatto. La segreteria ti richiama in orario di apertura, dal lunedì al venerdì."],
    ],
  },
  ecommerce: {
    name: "Nordico Design",
    lead: "Link inviato · domanda registrata nel resoconto",
    steps: [
      ["user", "Quanto ci mette la spedizione in Sicilia? Posso fare il reso?"],
      ["bot", "Spediamo in 24–48 ore lavorative in tutta Italia; per le isole servono fino a 72 ore. Hai 30 giorni per il reso gratuito direttamente dalla tua area clienti.", ["spedizioni.html", "resi.html"]],
      ["user", "Il tavolo Fjord esiste anche in noce?"],
      ["bot", "Sul sito il tavolo Fjord è disponibile solo in rovere e frassino. Vuoi che giri la domanda al team per una versione su misura?"],
    ],
  },
  commercialista: {
    name: "Studio Ferri & Associati",
    lead: "Prima consulenza richiesta · CRM",
    steps: [
      ["user", "Seguite anche le partite IVA in regime forfettario?"],
      ["bot", "Sì, seguiamo i forfettari: dichiarazione dei redditi, F24 e consulenza durante l'anno. Il costo dipende dal numero di fatture emesse.", ["servizi.html", "listino.pdf"]],
      ["user", "Posso avere un preventivo?"],
      ["bot", "Certo! Ti propongo una prima consulenza di 20 minuti: mi lasci nome ed email così lo studio ti contatta?"],
    ],
  },
};

class ChatDemo {
  constructor(el) {
    this.el = el;
    this.log = $("[data-chat-log]", el);
    this.input = $("[data-chat-input]", el);
    this.name = $("[data-chat-name]", el);
    this.run = 0;
    this.visible = false;
    this.started = false;
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible && !this.started) { this.started = true; this.play(el.dataset.chat); }
    }, { threshold: 0.25 }).observe(el);
  }

  async wait(ms, id) {
    const end = performance.now() + ms;
    while (performance.now() < end || !this.visible || document.hidden) {
      if (id !== this.run) throw new Error("stop");
      await sleep(Math.min(80, Math.max(16, end - performance.now())));
    }
    if (id !== this.run) throw new Error("stop");
  }

  bubble(cls) {
    const b = document.createElement("div");
    b.className = `msg ${cls}`;
    this.log.appendChild(b);
    while (this.log.children.length > 8) this.log.firstElementChild.remove();
    return b;
  }

  async typeInput(text, id) {
    this.input.classList.remove("is-placeholder");
    this.input.textContent = "";
    const per = clamp(1300 / text.length, 14, 42);
    for (let i = 1; i <= text.length; i++) {
      this.input.textContent = text.slice(0, i);
      await this.wait(per, id);
    }
    await this.wait(260, id);
    this.input.textContent = "Scrivi un messaggio…";
    this.input.classList.add("is-placeholder");
  }

  async play(key) {
    const id = ++this.run;
    const chat = CHATS[key] || CHATS.hotel;
    this.el.dataset.chat = key;
    this.name.textContent = chat.name;
    this.log.replaceChildren();
    this.input.textContent = "Scrivi un messaggio…";
    this.input.classList.add("is-placeholder");

    if (REDUCED) {
      for (const [who, text, src] of chat.steps) this.renderStatic(who, text, src);
      return;
    }

    try {
      for (;;) {
        await this.wait(700, id);
        for (const [who, text, src] of chat.steps) {
          if (who === "user") {
            await this.typeInput(text, id);
            this.bubble("msg--user").textContent = text;
            await this.wait(450, id);
          } else {
            const typing = this.bubble("msg--typing");
            typing.innerHTML = "<i></i><i></i><i></i>";
            await this.wait(950, id);
            typing.remove();
            const b = this.bubble("msg--bot");
            const span = document.createElement("span");
            b.appendChild(span);
            const words = text.split(" ");
            for (let i = 1; i <= words.length; i++) {
              span.textContent = words.slice(0, i).join(" ");
              await this.wait(38, id);
            }
            if (src) this.sources(b, src);
            await this.wait(900, id);
          }
        }
        const lead = this.bubble("msg--lead");
        lead.innerHTML = "<b>✓</b>";
        lead.append(document.createTextNode(chat.lead));
        await this.wait(5200, id);
        this.log.style.transition = "opacity .5s";
        this.log.style.opacity = "0";
        await this.wait(550, id);
        this.log.replaceChildren();
        this.log.style.opacity = "1";
      }
    } catch { /* riproduzione interrotta (cambio settore) */ }
  }

  sources(b, src) {
    const wrap = document.createElement("div");
    wrap.className = "msg__src";
    src.forEach((s) => { const t = document.createElement("span"); t.textContent = `Fonte · ${s}`; wrap.appendChild(t); });
    b.appendChild(wrap);
  }

  renderStatic(who, text, src) {
    const b = this.bubble(who === "user" ? "msg--user" : "msg--bot");
    b.textContent = text;
    if (src) this.sources(b, src);
  }
}

function initChats() {
  $$("[data-chat]").forEach((el) => {
    const demo = new ChatDemo(el);
    if (el.hasAttribute("data-sector-widget")) {
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
   Terminale di installazione
   -------------------------------------------------------------------------- */
const TERM = {
  script: {
    hint: "Incolla prima di </body>",
    out: ["dominio verificato: tuosito.it", "widget caricato in 38 KB", "Strix è online"],
  },
  wordpress: {
    hint: "Dal pannello di WordPress",
    out: ["plugin attivato", "codice di attivazione verificato", "Strix è online"],
  },
  link: {
    hint: "Per i siti che non si possono modificare",
    out: ["pagina chat pronta", "nessuna modifica al tuo sito", "Strix è online"],
  },
};

function highlight(code, text) {
  code.replaceChildren();
  const re = /(<\/?script)|(\s[a-z-]+=)|("[^"]*")|(>)/g;
  let last = 0, m;
  const add = (str, cls) => {
    if (!str) return;
    if (!cls) { code.append(document.createTextNode(str)); return; }
    const s = document.createElement("span"); s.className = cls; s.textContent = str; code.append(s);
  };
  while ((m = re.exec(text))) {
    add(text.slice(last, m.index));
    add(m[0], m[1] || m[4] ? "t-tag" : m[2] ? "t-attr" : "t-str");
    last = re.lastIndex;
  }
  add(text.slice(last));
}

function initTerminal() {
  const term = $("[data-terminal]");
  if (!term) return;
  const code = $("[data-term-code]", term);
  const hint = $("[data-term-hint]", term);
  const out = $("[data-term-out]", term);
  const copy = $("[data-term-copy]", term);
  const tabs = $$("[role=tab]", term);
  let current = "script", run = 0, visible = false;
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
      await sleep(text[i - 1] === "\n" ? 180 : 22);
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
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(src(current));
      copy.textContent = "Copiato";
      copy.classList.add("is-done");
    } catch {
      copy.textContent = "Copia manuale";
    }
    setTimeout(() => { copy.textContent = "Copia"; copy.classList.remove("is-done"); }, 1800);
  });
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !visible) { visible = true; play(current); }
  }, { threshold: 0.35 }).observe(term);
}

/* Lingue che si alternano */
function initLangCycle() {
  const el = $("[data-lang-cycle]");
  if (!el || REDUCED) return;
  const words = ["Ciao", "Hello", "Hallo", "Bonjour", "Hola"];
  let i = 0;
  setInterval(async () => {
    if (document.hidden) return;
    const w = el.textContent;
    for (let k = w.length; k >= 0; k--) { el.textContent = w.slice(0, k); await sleep(45); }
    i = (i + 1) % words.length;
    const n = words[i];
    for (let k = 1; k <= n.length; k++) { el.textContent = n.slice(0, k); await sleep(70); }
  }, 2600);
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
  const plan = $("#f-piano");
  const sector = $("#f-settore");
  $$("[data-plan-pick]").forEach((a) => a.addEventListener("click", () => {
    if (plan) plan.value = a.dataset.planPick;
    if (sector && a.dataset.sectorPick) sector.value = a.dataset.sectorPick;
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
    sito: (v) => (/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(v.trim()) ? "" : "Inserisci l'indirizzo del sito, es. www.tuosito.it"),
    settore: (v) => (v ? "" : "Seleziona il tuo settore."),
  };

  const validateField = (name) => {
    if (name === "privacy") {
      const msg = form.elements.privacy.checked ? "" : "Per inviare la richiesta serve il consenso all'informativa.";
      setError("privacy", msg);
      return !msg;
    }
    const rule = RULES[name];
    if (!rule) return true;
    const msg = rule(form.elements[name].value);
    setError(name, msg);
    return !msg;
  };

  [...Object.keys(RULES), "privacy"].forEach((name) => {
    const el = form.elements[name];
    el?.addEventListener("blur", () => { if (el.value || el.closest(".field").classList.contains("is-invalid")) validateField(name); });
    el?.addEventListener("change", () => { if (el.closest(".field").classList.contains("is-invalid")) validateField(name); });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.classList.remove("is-error");
    const ok = [...Object.keys(RULES), "privacy"].map(validateField).every(Boolean);
    if (!ok) {
      status.textContent = "Controlla i campi evidenziati.";
      status.classList.add("is-error");
      form.querySelector(".is-invalid input, .is-invalid select")?.focus();
      return;
    }

    const f = form.elements;
    const payload = {
      nome: f.nome.value, azienda: f.azienda.value, email: f.email.value, telefono: f.telefono.value,
      sito: f.sito.value, settore: f.settore.value, piano: f.piano.value, messaggio: f.messaggio.value,
      privacy: f.privacy.checked, fax: f.fax.value, elapsed_ms: Math.round(performance.now() - T0),
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
initChats();
initTerminal();
initLangCycle();
initSteps();
initBilling();
initPlanPick();
initForm();
