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
