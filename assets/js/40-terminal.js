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
