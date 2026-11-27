# CORE829 Cyber — cyber.core829.net

Sito multipagina del servizio di **penetration test con agenti AI** di **CORE829 SRL**,
ramificazione di [core829.net](https://core829.net) pubblicata sul sottodominio `cyber.core829.net`. Il cliente invia solo una richiesta dal sito; perimetro,
autorizzazione, test, report e retest sono gestiti internamente da CORE829.

> Regola non negoziabile: nessun test parte senza **autorizzazione scritta del titolare**
> del sistema e **verifica della proprietà del dominio** (art. 615-ter c.p.).

## Stack

| Parte | Scelta | Perché |
|---|---|---|
| Server | Rust + Axum | Un solo binario, risposte in meno di 1 ms |
| Template | Askama | HTML verificato e compilato insieme al codice |
| Asset | rust-embed | CSS, JS, font e immagini incorporati nel binario |
| Frontend | JS e CSS senza framework | Nessuna dipendenza, pagina leggerissima |
| Font | Space Grotesk + JetBrains Mono (OFL), ospitati in locale | Nessuna chiamata a terzi, nessun cookie |

## Avvio in locale

```bash
cargo run --release
# → http://localhost:8080
```

## Configurazione (variabili d'ambiente)

| Variabile | Default | Descrizione |
|---|---|---|
| `PORT` | `8080` | Porta HTTP |
| `DATA_DIR` | `./data` | Cartella dove vengono salvate le richieste (`richieste.jsonl`) |
| `SITE_URL` | `https://cyber.core829.net` | URL pubblico (canonical, sitemap, Open Graph) |
| `TRUST_PROXY` | `false` | `true` solo dietro un reverse proxy fidato (legge `X-Forwarded-For`) |

## Produzione con Docker

```bash
docker build -t core829-cyber .
docker run -d -p 8080:8080 -v core829-cyber-data:/data -e TRUST_PROXY=true core829-cyber
```

Mettere davanti un reverse proxy con HTTPS (Caddy, Nginx o Cloudflare).

## Pagine

`/` · `/servizi` · `/metodo` · `/vulnerabilita` · `/report` · `/prezzi` · `/conformita` · `/faq` · `/chi-siamo` · `/contatti` · `/privacy` (+ 404, `sitemap.xml`, `robots.txt`).
Per aggiungerne una: template in `templates/` e una riga nella macro `pages!` di `src/pages.rs`.

## Struttura

```
src/
  main.rs       router, middleware, avvio e arresto ordinato
  config.rs     variabili d'ambiente
  company.rs    dati aziendali CORE829 (unica fonte per pagine, footer e dati strutturati)
  catalog.rs    listino servizi e domande frequenti
  pages.rs      pagine renderizzate e pre-compresse all'avvio, menu, sitemap
  encoded.rs    risposte pre-compresse (brotli/gzip) con ETag e 304
  requests.rs   POST /api/richieste: validazione, anti-spam, limite di frequenza, salvataggio
  assets.rs     asset incorporati; unisce css/NN-*.css e js/NN-*.js in un solo file ciascuno
  security.rs   header di sicurezza (CSP rigorosa, HSTS, ecc.)
templates/      pagine, layout base, parziali (console, form, step, CTA…)
assets/         css e js in moduli numerati, font, immagini, regole di prefetch
```

## Prestazioni

- Pagine e asset compressi una sola volta all'avvio (brotli 11 + gzip), serviti dalla memoria con ETag.
- Un solo CSS e un solo JS per tutto il sito, con cache immutabile (`?v=` = hash del contenuto).
- Navigazione istantanea: regole di prerender (`Speculation-Rules`) e transizioni tra pagine (View Transitions).
- Animazioni sospese fuori schermo o a scheda nascosta; meno particelle su dispositivi deboli; `prefers-reduced-motion` rispettato.

## API

`POST /api/richieste` (JSON) → `201` richiesta salvata · `422` errori per campo · `429` troppe richieste · `413` corpo troppo grande.

Campi: `nome`, `azienda`, `email`, `telefono`, `target` (sistema da testare), `tipo`, `servizio`,
`messaggio`, `autorizzazione` (obbligatoria: titolare o autorizzato dal titolare), `privacy`.

Protezioni: campo trappola invisibile, tempo minimo di compilazione, 5 richieste ogni 10 minuti per IP,
corpo massimo 16 KB. L'IP non viene salvato insieme alla richiesta (minimizzazione GDPR).

## Test

```bash
cargo test
```

## Prossima fase

- Dashboard interna CORE829 (accesso riservato): richieste, incarichi, autorizzazioni firmate, campagne, report
- Verifica automatica della proprietà del dominio (record DNS TXT)
- Archivio su PostgreSQL al posto di `richieste.jsonl` (stessa API)
- Notifica email a CORE829 a ogni nuova richiesta
