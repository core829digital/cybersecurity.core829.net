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
  // ritardo progressivo automatico per i figli dei gruppi [data-stagger]
  $$("[data-stagger]").forEach((group) => {
    [...group.children].forEach((el, i) => el.style.setProperty("--d", `${Math.min(i, 8) * 0.07}s`));
  });
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
    if (el.closest(".hero, .lost, .phead")) setTimeout(() => scramble(el, 1300), 150);
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
  // bottoni magnetici: inseguimento smorzato, un solo frame per movimento
  $$("[data-magnetic]").forEach((el) => {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.1 ? requestAnimationFrame(step) : 0;
      if (!raf && !tx && !ty) el.style.transform = "";
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * 0.18;
      ty = (e.clientY - r.top - r.height / 2) * 0.3;
      kick();
    });
    el.addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
  });
}
