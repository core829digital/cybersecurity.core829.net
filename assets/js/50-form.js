/* --------------------------------------------------------------------------
   Preselezione dal link: /contatti?servizio=completo&tipo=agenzia#richiesta
   -------------------------------------------------------------------------- */
function initPrefill() {
  const form = $("[data-request-form]");
  if (!form) return;
  const q = new URLSearchParams(location.search);
  const set = (name, value) => {
    const el = form.elements[name];
    if (el && value && [...el.options].some((o) => o.value === value)) el.value = value;
  };
  set("servizio", q.get("servizio"));
  set("tipo", q.get("tipo"));
  if (location.hash === "#richiesta" && matchMedia("(hover: hover)").matches) {
    setTimeout(() => $("#f-nome")?.focus({ preventScroll: true }), 600);
  }
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
